"""‌⁠‍Catalog resource service - business logic for resource catalog management.

Stateless service layer. Handles:
- Resource CRUD
- Search with filters
- Extraction from cost item components
- Statistics
"""

import logging
import uuid
from collections import defaultdict
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import event_bus

_logger_ev = __import__("logging").getLogger(__name__ + ".events")


async def _safe_publish(name: str, data: dict, source_module: str = "") -> None:
    try:
        event_bus.publish_detached(name, data, source_module=source_module)
    except Exception:
        _logger_ev.debug("Event publish skipped: %s", name)


from app.modules.catalog.models import CatalogResource, CatalogResourceType
from app.modules.catalog.repository import CatalogResourceRepository
from app.modules.catalog.schemas import (
    CatalogCategoryStat,
    CatalogResourceCreate,
    CatalogResourceTypeCreate,
    CatalogResourceTypeUpdate,
    CatalogResourceUpdate,
    CatalogSearchQuery,
    CatalogStatsResponse,
    CatalogTypeStat,
)
from app.modules.costs.models import CostItem

logger = logging.getLogger(__name__)

DEFAULT_RESOURCE_TYPES: tuple[dict[str, object], ...] = (
    {
        "value": "labor",
        "code": "01",
        "name": "Mano de Obra",
        "calculation_group": "labor",
        "badge": "MO",
        "bg": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        "i18n_key": "boq.resource_type_labor",
        "fallback": "Labor",
        "sort_order": 10,
    },
    {
        "value": "material",
        "code": "02",
        "name": "Materiales",
        "calculation_group": "material",
        "badge": "M",
        "bg": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        "i18n_key": "boq.resource_type_material",
        "fallback": "Material",
        "sort_order": 20,
    },
    {
        "value": "equipment",
        "code": "03",
        "name": "Equipos",
        "calculation_group": "equipment",
        "badge": "E",
        "bg": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
        "i18n_key": "boq.resource_type_equipment",
        "fallback": "Equipment",
        "sort_order": 30,
    },
    {
        "value": "operator",
        "code": "04",
        "name": "Operador",
        "calculation_group": "operator",
        "badge": "O",
        "bg": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        "i18n_key": "boq.resource_type_operator",
        "fallback": "Operator",
        "sort_order": 40,
    },
    {
        "value": "subcontractor",
        "code": "05",
        "name": "Subcontratos",
        "calculation_group": "subcontractor",
        "badge": "S",
        "bg": "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
        "i18n_key": "boq.resource_type_subcontractor",
        "fallback": "Subcontractor",
        "sort_order": 50,
    },
    {
        "value": "overhead",
        "code": "06",
        "name": "Gastos Generales",
        "calculation_group": "overhead",
        "badge": "GG",
        "bg": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        "i18n_key": "boq.resource_type_overhead",
        "fallback": "Gastos Generales",
        "sort_order": 60,
    },
)

# ── Categorization maps ──────────────────────────────────────────────────

MATERIAL_CATEGORIES: list[tuple[list[str], str]] = [
    (["concrete", "cement"], "Concrete & Cement"),
    (["steel", "metal", "bolt", "nail"], "Steel & Metal"),
    (["weld", "electrode"], "Welding"),
    (["wood", "timber", "plywood"], "Wood & Timber"),
    (["pipe", "valve"], "Pipes & Fittings"),
    (["paint", "primer", "varnish"], "Paint & Finish"),
    (["cable", "wire"], "Electrical"),
    (["sand", "gravel", "crushed"], "Aggregates"),
    (["oxygen", "acetylene", "propane"], "Chemicals"),
    (["water"], "Water"),
]

EQUIPMENT_CATEGORIES: list[tuple[list[str], str]] = [
    (["crane"], "Cranes"),
    (["truck", "flatbed"], "Trucks"),
    (["excavator"], "Excavators"),
    (["bulldozer"], "Bulldozers"),
    (["weld"], "Welding Equipment"),
    (["winch", "hoist"], "Hoists & Winches"),
    (["compressor"], "Compressors"),
    (["pump"], "Pumps"),
]


def _categorize_material(name: str) -> str:
    """‌⁠‍Categorize a material resource by name keywords."""
    name_lower = name.lower()
    for keywords, category in MATERIAL_CATEGORIES:
        if any(kw in name_lower for kw in keywords):
            return category
    return "General"


def _categorize_equipment(name: str) -> str:
    """‌⁠‍Categorize an equipment resource by name keywords."""
    name_lower = name.lower()
    for keywords, category in EQUIPMENT_CATEGORIES:
        if any(kw in name_lower for kw in keywords):
            return category
    return "General Equipment"


def _fmt_price(value: float) -> str:
    """Serialise an aggregated price without lossy 2dp truncation (CAT-003).

    ``f"{x:.2f}"`` on derived avg/min/max rates discards precision that
    later ``adjust-prices`` factor passes then compound. Keep full
    significant digits (``%.12g``) and trim trailing-zero noise only.
    """
    out = f"{float(value):.12g}"
    return "0" if out in ("-0", "-0.0") else out


def _categorize_resource(resource_type: str, name: str) -> str:
    """Categorize a resource based on its type and name."""
    if resource_type == "material":
        return _categorize_material(name)
    if resource_type == "equipment":
        return _categorize_equipment(name)
    if resource_type == "labor":
        return "Labor"
    if resource_type == "operator":
        return "Operators"
    return "General"


class CatalogResourceService:
    """Business logic for catalog resource operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CatalogResourceRepository(session)

    async def ensure_default_resource_types(self) -> None:
        """Create protected default resource types if they are missing."""
        existing = {
            value
            for value in (
                await self.session.execute(select(CatalogResourceType.value))
            ).scalars().all()
        }
        missing: list[CatalogResourceType] = []
        for row in DEFAULT_RESOURCE_TYPES:
            if str(row["value"]) in existing:
                continue
            missing.append(
                CatalogResourceType(
                    value=str(row["value"]),
                    code=str(row["code"]),
                    name=str(row["name"]),
                    calculation_group=str(row["calculation_group"]),
                    badge=str(row["badge"]),
                    bg=str(row["bg"]),
                    i18n_key=str(row["i18n_key"]),
                    fallback=str(row["fallback"]),
                    is_system=True,
                    is_active=True,
                    sort_order=int(row["sort_order"]),
                    metadata_={},
                )
            )
        if missing:
            self.session.add_all(missing)
            await self.session.flush()

    async def list_resource_types(self, include_inactive: bool = False) -> list[CatalogResourceType]:
        await self.ensure_default_resource_types()
        stmt = select(CatalogResourceType)
        if not include_inactive:
            stmt = stmt.where(CatalogResourceType.is_active.is_(True))
        stmt = stmt.order_by(CatalogResourceType.sort_order, CatalogResourceType.code)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_resource_type(self, data: CatalogResourceTypeCreate) -> CatalogResourceType:
        await self.ensure_default_resource_types()
        used_codes = set(
            (
                await self.session.execute(select(CatalogResourceType.code))
            ).scalars().all()
        )
        requested_code = data.code.zfill(2)
        existing_value = (
            await self.session.execute(
                select(CatalogResourceType).where(CatalogResourceType.value == data.value)
            )
        ).scalar_one_or_none()

        def next_available_code(exclude: str | None = None) -> str | None:
            unavailable = used_codes - ({exclude} if exclude else set())
            for index in range(1, 100):
                candidate = str(index).zfill(2)
                if candidate not in unavailable:
                    return candidate
            return None

        if existing_value is not None and existing_value.is_active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Resource type value already exists",
            )
        if existing_value is not None:
            code = (
                requested_code
                if requested_code == existing_value.code or requested_code not in used_codes
                else next_available_code(exclude=existing_value.code)
            )
            if code is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="No available resource type codes",
                )
            await self.session.execute(
                update(CatalogResourceType)
                .where(CatalogResourceType.value == data.value)
                .values(
                    code=code,
                    name=data.name,
                    calculation_group=data.calculation_group,
                    badge=data.badge.upper(),
                    bg=data.bg,
                    i18n_key=data.i18n_key,
                    fallback=data.fallback or data.name,
                    is_system=False,
                    is_active=True,
                    sort_order=int(code),
                    metadata_=data.metadata,
                )
            )
            await self.session.flush()
            self.session.expire_all()
            return (
                await self.session.execute(
                    select(CatalogResourceType).where(CatalogResourceType.value == data.value)
                )
            ).scalar_one()

        code = requested_code if requested_code not in used_codes else next_available_code()
        if code is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No available resource type codes",
            )
        row = CatalogResourceType(
            value=data.value,
            code=code,
            name=data.name,
            calculation_group=data.calculation_group,
            badge=data.badge.upper(),
            bg=data.bg,
            i18n_key=data.i18n_key,
            fallback=data.fallback or data.name,
            is_system=False,
            is_active=True,
            sort_order=int(code),
            metadata_=data.metadata,
        )
        self.session.add(row)
        await self.session.flush()
        return row

    async def update_resource_type(self, value: str, data: CatalogResourceTypeUpdate) -> CatalogResourceType:
        await self.ensure_default_resource_types()
        row = (
            await self.session.execute(
                select(CatalogResourceType).where(CatalogResourceType.value == value)
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource type not found")
        if row.is_system:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="System resource types cannot be edited")

        fields = data.model_dump(exclude_unset=True, exclude_none=True)
        if "code" in fields:
            fields["code"] = str(fields["code"]).zfill(2)
            duplicate = (
                await self.session.execute(
                    select(CatalogResourceType).where(
                        CatalogResourceType.code == fields["code"],
                        CatalogResourceType.value != value,
                    )
                )
            ).scalar_one_or_none()
            if duplicate is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource type code already exists")
        if "badge" in fields:
            fields["badge"] = str(fields["badge"]).upper()
        if "metadata" in fields:
            fields["metadata_"] = fields.pop("metadata")

        if fields:
            await self.session.execute(
                update(CatalogResourceType).where(CatalogResourceType.value == value).values(**fields)
            )
            await self.session.flush()
            self.session.expire_all()
            row = (
                await self.session.execute(
                    select(CatalogResourceType).where(CatalogResourceType.value == value)
                )
            ).scalar_one()
        return row

    async def delete_resource_type(self, value: str) -> None:
        await self.ensure_default_resource_types()
        row = (
            await self.session.execute(
                select(CatalogResourceType).where(CatalogResourceType.value == value)
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource type not found")
        if row.is_system:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="System resource types cannot be deleted")
        await self.session.execute(
            update(CatalogResourceType).where(CatalogResourceType.value == value).values(is_active=False)
        )
        await self.session.flush()

    # ── Create ────────────────────────────────────────────────────────────

    async def create_resource(self, data: CatalogResourceCreate) -> CatalogResource:
        """Create a new catalog resource.

        Raises HTTPException 409 if resource_code already exists.
        """
        existing = await self.repo.get_by_code(data.resource_code)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Catalog resource with code '{data.resource_code}' already exists",
            )

        resource = CatalogResource(
            resource_code=data.resource_code,
            name=data.name,
            resource_type=data.resource_type,
            category=data.category,
            unit=data.unit,
            base_price=str(data.base_price),
            min_price=str(data.min_price),
            max_price=str(data.max_price),
            currency=data.currency,
            usage_count=0,
            source=data.source,
            region=data.region,
            specifications=data.specifications,
            metadata_=data.metadata,
        )
        resource = await self.repo.create(resource)

        await _safe_publish(
            "catalog.resource.created",
            {"resource_id": str(resource.id), "code": resource.resource_code},
            source_module="oe_catalog",
        )

        logger.info("Catalog resource created: %s (%s)", resource.resource_code, resource.name)
        return resource

    # ── Read ──────────────────────────────────────────────────────────────

    async def update_resource(
        self,
        resource_id: uuid.UUID,
        data: CatalogResourceUpdate,
    ) -> CatalogResource:
        """Update a resource and synchronize FK-linked assembly components."""
        resource = await self.get_resource(resource_id)
        fields = data.model_dump(exclude_unset=True, exclude_none=True)
        if not fields:
            return resource

        from app.modules.assemblies.models import Assembly, Component
        from app.modules.assemblies.service import (
            _compute_assembly_total,
            _compute_typed_total,
        )

        linked_components = list(
            (
                await self.session.execute(
                    select(Component).where(Component.catalog_resource_id == resource_id)
                )
            )
            .scalars()
            .all()
        )

        new_currency = fields.get("currency")
        if (
            new_currency is not None
            and str(new_currency).upper() != str(resource.currency).upper()
            and linked_components
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Currency cannot be changed while the resource is used by "
                    f"{len(linked_components)} assembly component(s)."
                ),
            )

        def _money(name: str) -> Decimal:
            raw = fields.get(name, getattr(resource, name))
            try:
                value = Decimal(str(raw))
            except (InvalidOperation, ValueError, TypeError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{name} is not a valid decimal value",
                ) from exc
            if not value.is_finite() or value < 0:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{name} must be a finite value greater than or equal to 0",
                )
            return value

        base_price = _money("base_price")
        min_price = _money("min_price")
        max_price = _money("max_price")
        has_band = min_price > 0 and max_price > 0
        if has_band and (
            min_price > max_price or not (min_price <= base_price <= max_price)
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Price band must satisfy min_price <= base_price <= max_price",
            )

        model_fields: dict[str, object] = {}
        for key, value in fields.items():
            if key in {"base_price", "min_price", "max_price"}:
                model_fields[key] = str(value)
            elif key == "metadata":
                model_fields["metadata_"] = value
            elif key == "currency":
                model_fields[key] = str(value).upper()
            else:
                model_fields[key] = value

        for key, value in model_fields.items():
            setattr(resource, key, value)

        affected_assembly_ids: set[uuid.UUID] = set()
        for component in linked_components:
            if "name" in fields:
                component.description = str(fields["name"])
            if "resource_type" in fields:
                component.resource_type = str(fields["resource_type"])
                metadata = dict(component.metadata_ or {})
                metadata["resource_type"] = component.resource_type
                component.metadata_ = metadata
            if "unit" in fields:
                component.unit = str(fields["unit"])
            if "base_price" in fields:
                component.unit_cost = str(base_price)

            component.total = _compute_typed_total(
                resource_type=component.resource_type,
                factor=float(component.factor),
                quantity=float(component.quantity),
                unit_cost=float(component.unit_cost),
                metadata=dict(component.metadata_ or {}),
            )
            affected_assembly_ids.add(component.assembly_id)

        if affected_assembly_ids:
            assemblies = list(
                (
                    await self.session.execute(
                        select(Assembly).where(Assembly.id.in_(affected_assembly_ids))
                    )
                )
                .scalars()
                .all()
            )
            for assembly in assemblies:
                components = list(
                    (
                        await self.session.execute(
                            select(Component).where(Component.assembly_id == assembly.id)
                        )
                    )
                    .scalars()
                    .all()
                )
                assembly.total_rate = _compute_assembly_total(
                    components,
                    assembly.bid_factor,
                )

        await self.session.flush()
        updated = await self.get_resource(resource_id)
        await _safe_publish(
            "catalog.resource.updated",
            {
                "resource_id": str(resource_id),
                "base_price": updated.base_price,
                "changed_fields": sorted(fields),
                "components_synchronized": True,
            },
            source_module="oe_catalog",
        )
        logger.info(
            "Catalog resource updated: %s (%s); linked components=%d",
            updated.resource_code,
            resource_id,
            len(linked_components),
        )
        return updated

    async def get_resource(self, resource_id: uuid.UUID) -> CatalogResource:
        """Get catalog resource by ID. Raises 404 if not found."""
        resource = await self.repo.get_by_id(resource_id)
        if resource is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Catalog resource not found",
            )
        return resource

    async def search_resources(self, query: CatalogSearchQuery) -> tuple[list[CatalogResource], int]:
        """Search catalog resources with filters and pagination."""
        return await self.repo.search(
            q=query.q,
            resource_type=query.resource_type,
            category=query.category,
            region=query.region,
            unit=query.unit,
            min_price=query.min_price,
            max_price=query.max_price,
            offset=query.offset,
            limit=query.limit,
        )

    async def get_stats(self, region: str | None = None) -> CatalogStatsResponse:
        """Get aggregated statistics for the catalog.

        ``region`` scopes every aggregate (total, by_type, by_category)
        so the UI's tab/category counts match the region-filtered
        resource list instead of advertising rows it can never display.
        """
        total = await self.repo.count(region=region)
        by_type_raw = await self.repo.stats_by_type(region=region)
        by_category_raw = await self.repo.stats_by_category(region=region)

        return CatalogStatsResponse(
            total=total,
            by_type=[CatalogTypeStat(resource_type=rt, count=c) for rt, c in by_type_raw],
            by_category=[
                CatalogCategoryStat(category=cat, count=c, code=code) for cat, c, code in by_category_raw
            ],
        )

    async def next_code_for_prefix(self, prefix: str) -> str:
        """Mint the next free resource code for ``prefix`` (TT type + CC
        category) in our ``TT+CC+NNNNNN`` scheme. The correlative is padded so
        the full code reaches 10 digits (6 digits for a 4-char prefix).
        """
        best = await self.repo.max_code_suffix(prefix)
        width = max(1, 10 - len(prefix))
        return f"{prefix}{best + 1:0{width}d}"

    # ── Regions ─────────────────────────────────────────────────────────

    async def get_loaded_regions(self) -> list[str]:
        """Return distinct region identifiers that have catalog resources."""
        from sqlalchemy import distinct

        stmt = (
            select(distinct(CatalogResource.region))
            .where(CatalogResource.is_active.is_(True))
            .where(CatalogResource.region.isnot(None))
            .where(CatalogResource.region != "")
        )
        result = await self.session.execute(stmt)
        regions = [row[0] for row in result.all()]
        regions.sort()
        return regions

    async def get_region_stats(self) -> list[dict[str, object]]:
        """Return resource count per loaded region."""
        return await self.repo.stats_by_region()

    async def delete_region(self, region: str) -> int:
        """Delete all catalog resources for a given region."""
        count = await self.repo.delete_by_region(region)
        await _safe_publish(
            "catalog.region.deleted",
            {"region": region, "deleted": count},
            source_module="oe_catalog",
        )
        logger.info("Deleted catalog region %s: %d resources removed", region, count)
        return count

    async def delete_resource(self, resource_id: uuid.UUID) -> None:
        """Delete a single catalog resource by ID. Raises 404 if not found."""
        deleted = await self.repo.delete_by_id(resource_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Catalog resource not found",
            )
        await _safe_publish(
            "catalog.resource.deleted",
            {"resource_id": str(resource_id)},
            source_module="oe_catalog",
        )
        logger.info("Catalog resource deleted: %s", resource_id)

    async def import_region_from_costs(self, region: str) -> dict[str, int]:
        """Import catalog resources from cost item components for a specific region.

        Extracts materials, equipment, labor, and operators from cost items
        that belong to the given region. Replaces any existing catalog data
        for that region.

        Returns:
            Dict with counts by resource_type.
        """
        # Clear existing catalog entries for this region
        await self.repo.delete_by_region(region)

        # Query cost items for this region
        stmt = select(CostItem).where(CostItem.is_active.is_(True)).where(CostItem.region == region)
        result = await self.session.execute(stmt)
        cost_items = list(result.scalars().all())

        if not cost_items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No cost items found for region '{region}'. "
                f"Import the cost database first via /v1/costs/load-cwicr/{region}",
            )

        # Determine currency from first cost item (no project context here -
        # this is a tenant-wide region extraction; rely on CostItem.currency).
        currency = ""
        first_item = cost_items[0]
        if hasattr(first_item, "currency") and first_item.currency:
            currency = first_item.currency

        # Aggregate components by (code, type)
        component_data: dict[str, dict] = {}

        for item in cost_items:
            components = item.components or []
            for comp in components:
                code = comp.get("code", "")
                if not code:
                    continue

                comp_type = comp.get("type", "other")
                if comp_type not in ("material", "equipment", "labor", "operator"):
                    continue

                key = f"{comp_type}:{code}"
                try:
                    rate = float(comp.get("unit_rate", 0) or 0)
                except (ValueError, TypeError):
                    # Skip components whose unit_rate is non-numeric
                    # (e.g. "N/A", "TBD", or a nested object). Mirrors the
                    # GitHub CSV import path's malformed-row handling.
                    continue

                if key not in component_data:
                    component_data[key] = {
                        "code": code,
                        "name": comp.get("name", code),
                        "type": comp_type,
                        "unit": comp.get("unit", "unit"),
                        "rates": [],
                        "count": 0,
                    }

                component_data[key]["rates"].append(rate)
                component_data[key]["count"] += 1

        # Create catalog resources (no limit per type for region import)
        resources_to_create: list[CatalogResource] = []
        counts: dict[str, int] = defaultdict(int)

        for comp_data in component_data.values():
            rates = comp_data["rates"]
            if not rates:
                continue

            avg_rate = sum(rates) / len(rates)
            min_rate = min(rates)
            max_rate = max(rates)

            comp_type = comp_data["type"]
            category = _categorize_resource(comp_type, comp_data["name"])
            resource_code = f"CAT-{region}-{comp_type[:3].upper()}-{comp_data['code']}"

            resource = CatalogResource(
                resource_code=resource_code,
                name=comp_data["name"],
                resource_type=comp_type,
                category=category,
                unit=comp_data["unit"],
                base_price=_fmt_price(avg_rate),
                min_price=_fmt_price(min_rate),
                max_price=_fmt_price(max_rate),
                currency=currency,
                usage_count=comp_data["count"],
                source="cost_import",
                region=region,
                specifications={
                    "sample_count": len(rates),
                    "original_code": comp_data["code"],
                },
                metadata_={},
            )
            resources_to_create.append(resource)
            counts[comp_type] += 1

        if resources_to_create:
            await self.repo.bulk_create(resources_to_create)

        await _safe_publish(
            "catalog.region.imported",
            {
                "region": region,
                "total": len(resources_to_create),
                "by_type": dict(counts),
            },
            source_module="oe_catalog",
        )

        logger.info(
            "Catalog region import for %s: %d resources (%s)",
            region,
            len(resources_to_create),
            dict(counts),
        )
        return dict(counts)

    # ── Extract from cost items ──────────────────────────────────────────

    async def extract_from_cost_items(self) -> dict[str, int]:
        """Extract top 100 resources from cost item components.

        Aggregates components across all active cost items, computes
        avg/min/max rates, categorizes, and inserts the top 100 into
        the catalog.

        Returns:
            Dict with counts by resource_type.
        """
        # Soft-delete previously extracted resources
        await self.repo.delete_by_source("cwicr_extraction")

        # Query all active cost items with components
        stmt = select(CostItem).where(CostItem.is_active.is_(True))
        result = await self.session.execute(stmt)
        cost_items = list(result.scalars().all())

        # Aggregate components by (code, type)
        component_data: dict[str, dict] = {}

        for item in cost_items:
            components = item.components or []
            item_currency = getattr(item, "currency", "") or ""
            for comp in components:
                code = comp.get("code", "")
                if not code:
                    continue

                comp_type = comp.get("type", "other")
                if comp_type not in ("material", "equipment", "labor", "operator"):
                    continue

                key = f"{comp_type}:{code}"
                try:
                    rate = float(comp.get("unit_rate", 0) or 0)
                except (ValueError, TypeError):
                    # Skip components whose unit_rate is non-numeric
                    # (e.g. "N/A", "TBD", or a nested object). Mirrors the
                    # GitHub CSV import path's malformed-row handling.
                    continue

                if key not in component_data:
                    component_data[key] = {
                        "code": code,
                        "name": comp.get("name", code),
                        "type": comp_type,
                        "unit": comp.get("unit", "unit"),
                        "rates": [],
                        "count": 0,
                        "currency": item_currency,
                    }
                elif not component_data[key].get("currency") and item_currency:
                    component_data[key]["currency"] = item_currency

                component_data[key]["rates"].append(rate)
                component_data[key]["count"] += 1

        # Sort by usage count and select top items per type
        type_limits = {
            "material": 50,
            "equipment": 30,
            "labor": 10,
            "operator": 10,
        }

        resources_to_create: list[CatalogResource] = []
        counts: dict[str, int] = defaultdict(int)

        for resource_type, limit in type_limits.items():
            typed_components = [v for v in component_data.values() if v["type"] == resource_type]
            typed_components.sort(key=lambda x: x["count"], reverse=True)

            for comp in typed_components[:limit]:
                rates = comp["rates"]
                avg_rate = sum(rates) / len(rates) if rates else 0
                min_rate = min(rates) if rates else 0
                max_rate = max(rates) if rates else 0

                category = _categorize_resource(resource_type, comp["name"])
                resource_code = f"CAT-{resource_type[:3].upper()}-{comp['code']}"

                resource = CatalogResource(
                    resource_code=resource_code,
                    name=comp["name"],
                    resource_type=resource_type,
                    category=category,
                    unit=comp["unit"],
                    base_price=_fmt_price(avg_rate),
                    min_price=_fmt_price(min_rate),
                    max_price=_fmt_price(max_rate),
                    # Inherit currency from the parent CostItem when
                    # available. Empty (NOT NULL allows ``""``) when the
                    # parent has no currency stamped - the renderer
                    # falls back to the bare-number formatter rather
                    # than mis-stamping EUR onto a USD/GBP/JPY rate.
                    currency=comp.get("currency") or "",
                    usage_count=comp["count"],
                    source="cwicr_extraction",
                    specifications={
                        "sample_count": len(rates),
                        "original_code": comp["code"],
                    },
                    metadata_={},
                )
                resources_to_create.append(resource)
                counts[resource_type] += 1

        if resources_to_create:
            await self.repo.bulk_create(resources_to_create)

        await _safe_publish(
            "catalog.resources.extracted",
            {
                "total": len(resources_to_create),
                "by_type": dict(counts),
            },
            source_module="oe_catalog",
        )

        logger.info(
            "Catalog extraction complete: %d resources (%s)",
            len(resources_to_create),
            dict(counts),
        )
        return dict(counts)
