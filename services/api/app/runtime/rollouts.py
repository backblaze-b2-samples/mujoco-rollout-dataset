import logging

# Sync `def` handlers on purpose: the whole call chain is blocking (boto3, and
# for /run the MuJoCo engine), and Starlette runs sync handlers in its
# threadpool — an `async def` here would stall the event loop for the whole
# render. See runtime/files.py for the same rationale.
from fastapi import APIRouter, HTTPException

from app.service.rollout import (
    RolloutNotFoundError,
    RolloutStateError,
    create_rollout,
    delete_rollout,
    get_episode_assets,
    get_episodes,
    get_rollout_detail,
    list_rollouts,
    run_rollout,
    update_rollout,
)
from app.types.rollout import (
    EpisodeAssets,
    EpisodeList,
    Rollout,
    RolloutCreate,
    RolloutDeleteResult,
    RolloutDetail,
    RolloutList,
    RolloutRunRequest,
    RolloutRunResult,
    RolloutUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# SECURITY: like the file routes, these are intentionally UNAUTHENTICATED and
# bucket-wide (single-tenant demo stance — see docs/SECURITY.md). A multi-tenant
# clone must add an auth dependency here AND scope the rollouts/ prefix per user.


@router.get("/rollouts", response_model=RolloutList)
def list_rollouts_endpoint(limit: int = 50, cursor: str | None = None):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    try:
        return list_rollouts(limit=limit, cursor=cursor)
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to list rollouts from storage") from None


@router.post("/rollouts", response_model=Rollout)
def create_rollout_endpoint(payload: RolloutCreate):
    try:
        return create_rollout(payload)
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to write rollout to storage") from None


@router.get("/rollouts/{rollout_id}", response_model=RolloutDetail)
def get_rollout_endpoint(rollout_id: str):
    try:
        return get_rollout_detail(rollout_id)
    except RolloutNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to read rollout from storage") from None


@router.patch("/rollouts/{rollout_id}", response_model=Rollout)
def update_rollout_endpoint(rollout_id: str, patch: RolloutUpdate):
    try:
        return update_rollout(rollout_id, patch)
    except RolloutNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RolloutStateError as e:
        raise HTTPException(status_code=409, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to update rollout in storage") from None


@router.delete("/rollouts/{rollout_id}", response_model=RolloutDeleteResult)
def delete_rollout_endpoint(rollout_id: str):
    try:
        return delete_rollout(rollout_id)
    except RolloutNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to delete rollout from storage") from None


@router.post("/rollouts/{rollout_id}/run", response_model=RolloutRunResult)
def run_rollout_endpoint(rollout_id: str, req: RolloutRunRequest | None = None):
    try:
        return run_rollout(rollout_id, req or RolloutRunRequest())
    except RolloutNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RolloutStateError as e:
        raise HTTPException(status_code=409, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to write rollout artifacts to storage") from None


@router.get("/rollouts/{rollout_id}/episodes", response_model=EpisodeList)
def list_episodes_endpoint(rollout_id: str):
    try:
        return get_episodes(rollout_id)
    except RolloutNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to list episodes from storage") from None


@router.get(
    "/rollouts/{rollout_id}/episodes/{episode_id}/assets",
    response_model=EpisodeAssets,
)
def episode_assets_endpoint(rollout_id: str, episode_id: str):
    try:
        return get_episode_assets(rollout_id, episode_id)
    except RolloutNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to presign episode assets") from None
