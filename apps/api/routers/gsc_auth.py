"""Google Search Console OAuth routes."""

from __future__ import annotations

import os
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from apps.api.auth import get_current_user
from apps.api.rate_limit import check_gsc_connect_rate_limit, check_gsc_refresh_rate_limit
from apps.api.routers.projects import _require_owned_project, get_db
from apps.api.services.gsc_metrics import augment_audit_report, get_connection_status
from apps.api.services.gsc_oauth import (
    consume_oauth_state,
    create_oauth_state,
    delete_connection,
    exchange_code_for_tokens,
    list_accessible_sites,
    revoke_token,
    upsert_connection,
)
from apps.api.services.token_crypto import decrypt_token

router = APIRouter(prefix="/api/auth/gsc", tags=["gsc-auth"])


class GscDisconnectBody(BaseModel):
    project_id: str = Field(min_length=1)


class GscRefreshBody(BaseModel):
    project_id: str = Field(min_length=1)
    url: str = Field(min_length=1)


def _frontend_base() -> str:
    return os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


@router.get("/start")
async def gsc_oauth_start(
    project_id: str = Query(..., min_length=1),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    check_gsc_connect_rate_limit(current_user["id"])

    try:
        _, auth_url = await create_oauth_state(
            db, project_id=project_id, user_id=current_user["id"]
        )
    except HTTPException:
        raise
    except Exception as exc:
        if "gsc_oauth_states" in str(exc) or "UndefinedTable" in type(exc).__name__:
            raise HTTPException(
                status_code=503,
                detail="GSC schema not applied. Run migration 0008_gsc_integration.sql",
            ) from exc
        raise

    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/callback")
async def gsc_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db=Depends(get_db),
):
    if error:
        return RedirectResponse(
            url=f"{_frontend_base()}/dashboard?gsc_error={quote(error)}",
            status_code=302,
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state")

    oauth_state = await consume_oauth_state(db, state)
    project_id = str(oauth_state["project_id"])

    tokens = await exchange_code_for_tokens(code, oauth_state["code_verifier"])
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    expires_in = int(tokens.get("expires_in", 3600))

    sites = await list_accessible_sites(access_token)
    if not sites:
        return RedirectResponse(
            url=f"{_frontend_base()}/project/{project_id}/audits?gsc_error=no_properties",
            status_code=302,
        )

    property_url = sites[0]
    await upsert_connection(
        db,
        project_id=project_id,
        property_url=property_url,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )

    return RedirectResponse(
        url=f"{_frontend_base()}/project/{project_id}/audits?gsc_connected=1",
        status_code=302,
    )


@router.get("/status")
async def gsc_connection_status(
    project_id: str = Query(..., min_length=1),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, project_id, current_user["id"])
    return await get_connection_status(db, project_id)


@router.post("/disconnect")
async def gsc_disconnect(
    body: GscDisconnectBody,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, body.project_id, current_user["id"])
    row = await db.fetchrow(
        """SELECT gsc_property_url, encrypted_access_token, encrypted_refresh_token,
                  token_expires_at, status
           FROM public.gsc_connections WHERE project_id = $1""",
        body.project_id,
    )
    if row is None:
        return {"disconnected": True}

    try:
        refresh_token = decrypt_token(row["encrypted_refresh_token"])
        await revoke_token(refresh_token)
    except Exception:
        pass

    await delete_connection(db, body.project_id)
    return {"disconnected": True}


@router.post("/refresh")
async def gsc_refresh_metrics(
    body: GscRefreshBody,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    await _require_owned_project(db, body.project_id, current_user["id"])
    check_gsc_refresh_rate_limit(body.project_id, body.url)

    report = await augment_audit_report(
        db,
        project_id=body.project_id,
        audited_url=body.url.strip(),
        report={},
        bypass_cache=True,
    )
    metrics = report.get("gsc_metrics")
    if metrics is None:
        raise HTTPException(status_code=404, detail="GSC not connected for this project")
    return metrics
