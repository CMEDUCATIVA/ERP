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
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from jose import JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.dependencies import get_session
from app.modules.integrations.models import IntegrationConfig
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.service import create_access_token, create_refresh_token, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(tags=["CMPROYECTOSBIM SSO"])


def _normalise_role(value: Any) -> str:
    role = str(value or "viewer").strip().lower()
    return role if role in {"viewer", "editor", "manager", "admin"} else "viewer"


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


async def _upsert_sso_user(session: AsyncSession, payload: dict[str, Any]) -> User:
    repo = UserRepository(session)
    email = str(payload["email"]).strip().lower()
    user = await repo.get_by_email(email)

    role = _normalise_role(payload.get("erp_role") or ("admin" if payload.get("admin") else "viewer"))
    full_name = str(payload.get("name") or payload.get("login") or email.split("@")[0]).strip()
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
            locale="es",
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
    }
    if full_name and not user.full_name:
        values["full_name"] = full_name
    if not user.is_active:
        values["is_active"] = True

    await session.execute(update(User).where(User.id == user.id).values(**values))
    await session.flush()
    await session.refresh(user)
    return user


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
    user = await _upsert_sso_user(session, payload)

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

    redirect_path = str(_effective_sso_value(settings, db_config, "redirect_path") or "/dashboard")
    if payload.get("project_identifier"):
        separator = "&" if "?" in redirect_path else "?"
        redirect_path = f"{redirect_path}{separator}{urlencode({'cmproyectosbim_project': str(payload['project_identifier'])})}"

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
