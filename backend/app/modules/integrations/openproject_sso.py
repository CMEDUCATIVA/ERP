"""OpenProject SSO callback for the Integrations module.

OpenProject signs a short-lived JWT and redirects the browser here. The ERP
validates that token, provisions/updates the local user, mints the normal ERP
access/refresh token pair and stores them in the same browser storage keys used
by the regular login page.
"""

from __future__ import annotations

import json
import logging
import secrets
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from jose import JWTError, jwt
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.dependencies import get_session
from app.modules.users.models import User
from app.modules.users.repository import UserRepository
from app.modules.users.service import create_access_token, create_refresh_token, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(tags=["OpenProject SSO"])


def _normalise_role(value: Any) -> str:
    role = str(value or "viewer").strip().lower()
    return role if role in {"viewer", "editor", "manager", "admin"} else "viewer"


def _decode_openproject_token(token: str, settings: Settings) -> dict[str, Any]:
    if not settings.openproject_sso_enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OpenProject SSO is not enabled")
    if not settings.openproject_sso_secret.strip():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OpenProject SSO is not configured")

    try:
        payload = jwt.decode(
            token,
            settings.openproject_sso_secret,
            algorithms=["HS256"],
            issuer=settings.openproject_sso_issuer,
            audience=settings.openproject_sso_audience,
        )
    except JWTError as exc:
        logger.warning("OpenProject SSO token rejected: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OpenProject SSO token") from exc

    email = str(payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SSO token is missing a valid email")
    return payload


async def _upsert_sso_user(session: AsyncSession, payload: dict[str, Any]) -> User:
    repo = UserRepository(session)
    email = str(payload["email"]).strip().lower()
    user = await repo.get_by_email(email)

    role = _normalise_role(payload.get("erp_role") or ("admin" if payload.get("admin") else "viewer"))
    full_name = str(payload.get("name") or payload.get("login") or email.split("@")[0]).strip()
    openproject_meta = {
        "provider": "openproject",
        "openproject_user_id": str(payload.get("openproject_user_id") or payload.get("sub") or ""),
        "openproject_login": str(payload.get("login") or ""),
        "openproject_project_id": str(payload.get("openproject_project_id") or ""),
        "openproject_project_identifier": str(payload.get("project_identifier") or ""),
        "openproject_project_name": str(payload.get("project_name") or ""),
        "openproject_role_names": payload.get("openproject_role_names") or [],
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
            metadata_={"sso": openproject_meta},
        )
        session.add(user)
        await session.flush()
        logger.info("OpenProject SSO provisioned ERP user %s role=%s", email, role)
        return user

    metadata = dict(user.metadata_ or {})
    metadata["sso"] = {**(metadata.get("sso") or {}), **openproject_meta}
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


@router.get("/auth/openproject/sso", response_class=HTMLResponse, include_in_schema=False)
async def openproject_sso_callback(
    request: Request,
    token: str = Query(..., min_length=16),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    """Validate an OpenProject SSO token and sign the browser into the ERP."""
    payload = _decode_openproject_token(token, settings)
    user = await _upsert_sso_user(session, payload)

    access_token = create_access_token(
        user,
        settings,
        extra_claims={
            "auth_provider": "openproject",
            "openproject_project_id": str(payload.get("openproject_project_id") or ""),
            "project_identifier": str(payload.get("project_identifier") or ""),
        },
    )
    refresh_token = create_refresh_token(user, settings)

    redirect_path = settings.openproject_sso_redirect_path or "/dashboard"
    if payload.get("project_identifier"):
        separator = "&" if "?" in redirect_path else "?"
        redirect_path = f"{redirect_path}{separator}{urlencode({'openproject_project': str(payload['project_identifier'])})}"

    logger.info(
        "OpenProject SSO login accepted for user=%s project=%s request_id=%s",
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
