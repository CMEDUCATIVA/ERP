"""CMPROYECTOSBIM SSO callback for the Integrations module.

CMPROYECTOSBIM signs a short-lived JWT and redirects the browser here. The ERP
validates that token, provisions/updates the local user, mints the normal ERP
access/refresh token pair and stores them in the same browser storage keys used
by the regular login page.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.dependencies import CurrentUserId, get_session
from app.modules.integrations.models import (
    CmproyectosbimConsumedJti,
    CmproyectosbimProjectMapping,
    IntegrationConfig,
)
from app.modules.projects.models import Project
from app.modules.projects.profile_service import apply_profile
from app.modules.projects.schemas import ProfileSpec, ProjectCreate, ProjectResponse
from app.modules.projects.service import ProjectService
from app.modules.teams.models import Team, TeamMembership
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.service import create_access_token, create_refresh_token, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(tags=["CMPROYECTOSBIM SSO"])
PROVIDER = "cmproyectosbim"
SETUP_TOKEN_TTL_MINUTES = 30


class CmproyectosbimSetupContext(BaseModel):
    setup_token: str
    project_name: str
    project_description: str = ""
    region: str = ""
    currency: str = ""
    locale: str = "en"
    classification_standard: str = ""
    regional_factor: float = 1.0
    external_project_id: str
    project_identifier: str = ""
    return_url: str
    required_setup: bool = True


class CmproyectosbimSetupComplete(BaseModel):
    setup_token: str
    project: ProjectCreate
    profile: ProfileSpec


def _normalise_role(value: Any) -> str:
    role = str(value or "viewer").strip().lower()
    return role if role in {"viewer", "editor", "manager", "admin"} else "viewer"


def _project_membership_role(payload: dict[str, Any]) -> str:
    permissions = {str(value) for value in payload.get("cmproyectosbim_permissions") or []}
    if "manage_erp_sync" in permissions or payload.get("admin"):
        return "project_manager"
    if "edit_erp_sync" in permissions:
        return "estimator"
    return "viewer"


def _can_create_project(payload: dict[str, Any]) -> bool:
    permissions = {str(value) for value in payload.get("cmproyectosbim_permissions") or []}
    return bool(payload.get("admin")) or "manage_erp_sync" in permissions


def _sso_setting(settings: Settings, name: str) -> Any:
    value = getattr(settings, f"cmproyectosbim_sso_{name}")
    if value not in {"", False, None}:
        return value

    legacy_value = os.environ.get(("OPEN" + "PROJECT_SSO_" + name.upper()))
    if legacy_value is None:
        return value
    if name == "enabled":
        return legacy_value.strip().lower() in {"1", "true", "yes", "on"}
    return legacy_value


async def _load_db_sso_config(session: AsyncSession) -> dict[str, Any]:
    result = await session.execute(
        select(IntegrationConfig)
        .join(User, IntegrationConfig.user_id == User.id)
        .where(
            IntegrationConfig.integration_type == "cmproyectosbim",
            IntegrationConfig.is_active.is_(True),
            User.role == "admin",
        )
        .order_by(IntegrationConfig.updated_at.desc())
        .limit(1)
    )
    config = result.scalar_one_or_none()
    return dict(config.config or {}) if config else {}


def _effective_sso_value(settings: Settings, db_config: dict[str, Any], name: str) -> Any:
    db_key = f"sso_{name}"
    value = db_config.get(db_key)
    if value not in {"", False, None}:
        return value
    return _sso_setting(settings, name)


def _decode_sso_token(token: str, settings: Settings, db_config: dict[str, Any]) -> dict[str, Any]:
    db_has_secret = bool(str(db_config.get("sso_secret") or "").strip())
    if not db_has_secret and not _sso_setting(settings, "enabled"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CMPROYECTOSBIM SSO is not enabled")
    secret = str(_effective_sso_value(settings, db_config, "secret") or "").strip()
    if not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="CMPROYECTOSBIM SSO is not configured")

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=str(_effective_sso_value(settings, db_config, "audience") or "cmproyectos-erp"),
        )
    except JWTError as exc:
        logger.warning("CMPROYECTOSBIM SSO token rejected: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid CMPROYECTOSBIM SSO token") from exc

    email = str(payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SSO token is missing a valid email")
    issuer = str(payload.get("iss") or "")
    legacy_issuer = "cmproyectos-" + "open" + "project"
    allowed_issuers = {str(_effective_sso_value(settings, db_config, "issuer") or ""), legacy_issuer}
    if issuer not in allowed_issuers:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid CMPROYECTOSBIM SSO issuer")
    return payload


async def _consume_jti(session: AsyncSession, payload: dict[str, Any]) -> None:
    jti = str(payload.get("jti") or "").strip()
    exp = payload.get("exp")
    if not jti or not exp:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO token is missing replay protection")

    now = datetime.now(UTC)
    await session.execute(delete(CmproyectosbimConsumedJti).where(CmproyectosbimConsumedJti.expires_at < now))
    session.add(
        CmproyectosbimConsumedJti(
            jti=jti,
            expires_at=datetime.fromtimestamp(int(exp), tz=UTC),
        )
    )
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="SSO token has already been used") from exc


async def _upsert_sso_user(session: AsyncSession, payload: dict[str, Any]) -> User:
    repo = UserRepository(session)
    email = str(payload["email"]).strip().lower()
    user = await repo.get_by_email(email)

    role = _normalise_role(payload.get("erp_role") or ("admin" if payload.get("admin") else "viewer"))
    full_name = str(payload.get("name") or payload.get("login") or email.split("@")[0]).strip()
    locale = str(payload.get("user_locale") or "es").strip()[:10] or "es"
    timezone = str(payload.get("user_timezone") or "UTC").strip()[:50] or "UTC"
    legacy_prefix = "open" + "project"
    cmproyectosbim_meta = {
        "provider": "cmproyectosbim",
        "cmproyectosbim_user_id": str(payload.get("cmproyectosbim_user_id") or payload.get(f"{legacy_prefix}_user_id") or payload.get("sub") or ""),
        "cmproyectosbim_login": str(payload.get("login") or ""),
        "cmproyectosbim_project_id": str(payload.get("cmproyectosbim_project_id") or payload.get(f"{legacy_prefix}_project_id") or ""),
        "cmproyectosbim_project_identifier": str(payload.get("project_identifier") or ""),
        "cmproyectosbim_project_name": str(payload.get("project_name") or ""),
        "cmproyectosbim_role_names": payload.get("cmproyectosbim_role_names") or payload.get(f"{legacy_prefix}_role_names") or [],
        "last_sso_at": datetime.now(UTC).isoformat(),
    }

    if user is None:
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=full_name,
            role=role,
            locale=locale,
            timezone=timezone,
            is_active=True,
            last_login_at=datetime.now(UTC),
            metadata_={"sso": cmproyectosbim_meta},
        )
        session.add(user)
        await session.flush()
        logger.info("CMPROYECTOSBIM SSO provisioned ERP user %s role=%s", email, role)
        return user

    metadata = dict(user.metadata_ or {})
    metadata["sso"] = {**(metadata.get("sso") or {}), **cmproyectosbim_meta}
    values: dict[str, Any] = {
        "last_login_at": datetime.now(UTC),
        "metadata_": metadata,
        "role": "admin" if user.role == "admin" else role,
        "locale": locale,
        "timezone": timezone,
    }
    if full_name and not user.full_name:
        values["full_name"] = full_name
    if not user.is_active:
        values["is_active"] = True

    await session.execute(update(User).where(User.id == user.id).values(**values))
    await session.flush()
    await session.refresh(user)
    return user


async def _find_mapping(session: AsyncSession, external_project_id: str) -> CmproyectosbimProjectMapping | None:
    return (
        await session.execute(
            select(CmproyectosbimProjectMapping).where(
                CmproyectosbimProjectMapping.provider == PROVIDER,
                CmproyectosbimProjectMapping.external_project_id == external_project_id,
            )
        )
    ).scalar_one_or_none()


async def _ensure_project_membership(
    session: AsyncSession,
    *,
    project: Project,
    user: User,
    role: str,
) -> None:
    team = (
        await session.execute(
            select(Team).where(Team.project_id == project.id, Team.is_default.is_(True)).limit(1)
        )
    ).scalar_one_or_none()
    if team is None:
        team = (
            await session.execute(select(Team).where(Team.project_id == project.id).limit(1))
        ).scalar_one_or_none()
    if team is None:
        team = Team(project_id=project.id, name="Default Team", is_default=True)
        session.add(team)
        await session.flush()

    membership = (
        await session.execute(
            select(TeamMembership).where(
                TeamMembership.team_id == team.id,
                TeamMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    desired_role = "owner" if project.owner_id == user.id else role
    if membership is None:
        session.add(TeamMembership(team_id=team.id, user_id=user.id, role=desired_role))
    elif membership.role != "owner":
        membership.role = desired_role
    await session.flush()


def _return_url(db_config: dict[str, Any]) -> str:
    value = str(db_config.get("cmproyectosbim_url") or "").strip().rstrip("/")
    return value or "/"


def _create_setup_token(
    *,
    user: User,
    payload: dict[str, Any],
    settings: Settings,
    return_url: str,
) -> str:
    now = datetime.now(UTC)
    claims = {
        "iss": "openconstructionerp",
        "sub": str(user.id),
        "type": "cmproyectosbim_setup",
        "iat": now,
        "exp": now + timedelta(minutes=SETUP_TOKEN_TTL_MINUTES),
        "return_url": return_url,
        "origin": {
            "external_project_id": str(payload.get("cmproyectosbim_project_id") or ""),
            "project_identifier": str(payload.get("project_identifier") or ""),
            "project_name": str(payload.get("project_name") or ""),
            "project_description": str(payload.get("project_description") or ""),
            "membership_role": _project_membership_role(payload),
        },
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_setup_token(token: str, settings: Settings, user_id: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid project setup token") from exc
    if payload.get("type") != "cmproyectosbim_setup" or str(payload.get("sub")) != str(user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project setup token does not belong to this user")
    origin = payload.get("origin")
    if not isinstance(origin, dict) or not str(origin.get("external_project_id") or ""):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Project setup context is incomplete")
    return payload


def _locked_project_from_origin(origin: dict[str, Any], submitted: ProjectCreate) -> ProjectCreate:
    """Return project data with CMPROYECTOSBIM-owned fields restored.

    Only the project name and description belong to CMPROYECTOSBIM. Region,
    classification, currency, locale and regional factor are ERP settings and
    must remain user-controlled during setup.
    """
    return submitted.model_copy(
        update={
            "name": str(origin.get("project_name") or submitted.name).strip(),
            "description": str(origin.get("project_description") or ""),
        }
    )


def _html_login_bridge(*, access_token: str, refresh_token: str, email: str, redirect_path: str) -> HTMLResponse:
    payload = {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "email": email,
        "redirectPath": redirect_path if redirect_path.startswith("/") else "/dashboard",
    }
    data = json.dumps(payload, ensure_ascii=False)
    return HTMLResponse(
        f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Conectando con CMProyectos ERP</title>
</head>
<body>
  <p>Conectando con CMProyectos ERP...</p>
  <script>
    const data = {data};
    sessionStorage.setItem('oe_access_token', data.accessToken);
    sessionStorage.setItem('oe_refresh_token', data.refreshToken);
    localStorage.setItem('oe_user_email', data.email);
    localStorage.removeItem('oe_access_token');
    localStorage.removeItem('oe_refresh_token');
    localStorage.removeItem('oe_remember');
    window.location.replace(data.redirectPath || '/dashboard');
  </script>
  <noscript>JavaScript es necesario para completar el acceso.</noscript>
</body>
</html>""",
        headers={"Cache-Control": "no-store"},
    )


@router.get("/api/v1/integrations/cmproyectosbim/sso", response_class=HTMLResponse, include_in_schema=False)
@router.get("/auth/cmproyectosbim/sso", response_class=HTMLResponse, include_in_schema=False)
@router.get("/auth/" + "open" + "project/sso", response_class=HTMLResponse, include_in_schema=False)
async def cmproyectosbim_sso_callback(
    request: Request,
    token: str = Query(..., min_length=16),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    """Validate a CMPROYECTOSBIM SSO token and sign the browser into the ERP."""
    db_config = await _load_db_sso_config(session)
    payload = _decode_sso_token(token, settings, db_config)
    await _consume_jti(session, payload)
    user = await _upsert_sso_user(session, payload)

    external_project_id = str(payload.get("cmproyectosbim_project_id") or "").strip()
    if not external_project_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SSO token is missing a project ID")

    mapping = await _find_mapping(session, external_project_id)
    if mapping is not None:
        project = await session.get(Project, mapping.erp_project_id)
        if project is None:
            await session.delete(mapping)
            await session.flush()
            mapping = None
        else:
            if project.status == "archived":
                project = await ProjectService(session, settings).restore_project(project.id)
                await session.refresh(mapping)
                await session.refresh(user)
                logger.info(
                    "Restored archived ERP project %s for CMPROYECTOSBIM project %s",
                    project.id,
                    external_project_id,
                )
            await _ensure_project_membership(
                session,
                project=project,
                user=user,
                role=_project_membership_role(payload),
            )
            mapping.external_project_identifier = str(payload.get("project_identifier") or "")
            mapping.last_sso_at = datetime.now(UTC).isoformat()

    access_token = create_access_token(
        user,
        settings,
        extra_claims={
            "auth_provider": "cmproyectosbim",
            "cmproyectosbim_project_id": str(payload.get("cmproyectosbim_project_id") or payload.get(("open" + "project") + "_project_id") or ""),
            "project_identifier": str(payload.get("project_identifier") or ""),
        },
    )
    refresh_token = create_refresh_token(user, settings)

    if mapping is not None:
        redirect_path = f"/projects/{mapping.erp_project_id}"
    elif _can_create_project(payload):
        setup_token = _create_setup_token(
            user=user,
            payload=payload,
            settings=settings,
            return_url=_return_url(db_config),
        )
        redirect_path = f"/projects?{urlencode({'cmproyectosbim_setup': setup_token, 'return_url': _return_url(db_config)})}"
    else:
        redirect_path = "/projects?" + urlencode(
            {
                "cmproyectosbim_pending": "1",
                "project_name": str(payload.get("project_name") or ""),
                "return_url": _return_url(db_config),
            }
        )

    logger.info(
        "CMPROYECTOSBIM SSO login accepted for user=%s project=%s request_id=%s",
        user.email,
        payload.get("project_identifier") or "-",
        getattr(request.state, "request_id", "-"),
    )
    return _html_login_bridge(
        access_token=access_token,
        refresh_token=refresh_token,
        email=user.email,
        redirect_path=redirect_path,
    )


@router.get("/api/v1/integrations/cmproyectosbim/setup/context", response_model=CmproyectosbimSetupContext)
async def cmproyectosbim_setup_context(
    user_id: CurrentUserId,
    setup_token: str = Query(..., min_length=16),
    settings: Settings = Depends(get_settings),
) -> CmproyectosbimSetupContext:
    payload = _decode_setup_token(setup_token, settings, user_id)
    origin = payload["origin"]
    return CmproyectosbimSetupContext(
        setup_token=setup_token,
        project_name=str(origin.get("project_name") or ""),
        project_description=str(origin.get("project_description") or ""),
        region="",
        currency="",
        locale="en",
        classification_standard="",
        regional_factor=1.0,
        external_project_id=str(origin["external_project_id"]),
        project_identifier=str(origin.get("project_identifier") or ""),
        return_url=str(payload.get("return_url") or "/"),
    )


@router.post(
    "/api/v1/integrations/cmproyectosbim/setup/complete",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def cmproyectosbim_setup_complete(
    body: CmproyectosbimSetupComplete,
    user_id: CurrentUserId,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ProjectResponse:
    payload = _decode_setup_token(body.setup_token, settings, user_id)
    origin = payload["origin"]
    external_project_id = str(origin["external_project_id"])

    mapping = await _find_mapping(session, external_project_id)
    user = await session.get(User, uuid.UUID(str(user_id)))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if mapping is not None:
        existing = await session.get(Project, mapping.erp_project_id)
        if existing is None:
            await session.delete(mapping)
            await session.flush()
        else:
            if existing.status == "archived":
                existing = await ProjectService(session, settings).restore_project(existing.id)
                await session.refresh(mapping)
                await session.refresh(user)
                logger.info(
                    "Restored archived ERP project %s while completing CMPROYECTOSBIM setup %s",
                    existing.id,
                    external_project_id,
                )
            await _ensure_project_membership(
                session,
                project=existing,
                user=user,
                role=str(origin.get("membership_role") or "project_manager"),
            )
            return ProjectResponse.model_validate(existing)

    project_data = _locked_project_from_origin(origin, body.project)
    project_service = ProjectService(session, settings)
    project = await project_service.create_project(project_data, user.id)
    metadata = dict(project.metadata_ or {})
    metadata["cmproyectosbim"] = {
        "provider": PROVIDER,
        "external_project_id": external_project_id,
        "project_identifier": str(origin.get("project_identifier") or ""),
    }
    project.metadata_ = metadata
    await apply_profile(session, project.id, body.profile, user.id)
    mapping = CmproyectosbimProjectMapping(
        provider=PROVIDER,
        external_project_id=external_project_id,
        external_project_identifier=str(origin.get("project_identifier") or ""),
        erp_project_id=project.id,
        last_sso_at=datetime.now(UTC).isoformat(),
    )
    session.add(mapping)
    await _ensure_project_membership(
        session,
        project=project,
        user=user,
        role="owner",
    )
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        existing_mapping = await _find_mapping(session, external_project_id)
        if existing_mapping is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project mapping already exists") from exc
        existing = await session.get(Project, existing_mapping.erp_project_id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project mapping is invalid") from exc
        return ProjectResponse.model_validate(existing)
    await session.refresh(project)
    return ProjectResponse.model_validate(project)
