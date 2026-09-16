"""Rollout lifecycle orchestration.

Owns the create / read / edit / delete / run behaviour for the primary entity.
Persistence and the S3 client stay in ``repo`` (``rollout_store``); the heavy
physics engine stays in ``mujoco_engine``. This module is the seam between the
two and never imports boto3 or the ML stack directly.
"""

import logging
import re
import uuid
from datetime import UTC, datetime

from app.repo import rollout_store
from app.service.mujoco_engine import EngineUnavailableError, run_episodes
from app.types.rollout import (
    Episode,
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

_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_NPY_CT = "application/octet-stream"


class RolloutNotFoundError(Exception):
    def __init__(self, detail: str = "Rollout not found"):
        self.detail = detail
        super().__init__(detail)


class RolloutStateError(Exception):
    """Raised for an operation the rollout's current status forbids."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _validate_id(rollout_id: str) -> None:
    if not _ID_RE.match(rollout_id):
        raise RolloutNotFoundError("Invalid rollout id")


def _config_to_rollout(config: dict) -> Rollout:
    return Rollout(**config)


def _load_config(rollout_id: str) -> dict:
    _validate_id(rollout_id)
    config = rollout_store.get_json(rollout_store.config_key(rollout_id))
    if config is None:
        raise RolloutNotFoundError()
    return config


def create_rollout(payload: RolloutCreate) -> Rollout:
    rollout_id = uuid.uuid4().hex[:12]
    config = {
        "id": rollout_id,
        "name": payload.name,
        "environment": payload.environment,
        "episode_count": payload.episode_count,
        "resolution": payload.resolution,
        "camera": payload.camera,
        "output_format": payload.output_format,
        "seed": payload.seed,
        "policy": payload.policy,
        "checkpoint_key": payload.checkpoint_key,
        "status": "draft",
        "created_at": datetime.now(UTC).isoformat(),
        "episode_count_done": 0,
        "total_reward": 0.0,
        "key_prefix": rollout_store.rollout_prefix(rollout_id),
    }
    rollout_store.put_json(rollout_store.config_key(rollout_id), config)
    logger.info("Rollout created: id=%s env=%s", rollout_id, payload.environment)
    return _config_to_rollout(config)


def list_rollouts(limit: int = 50, cursor: str | None = None) -> RolloutList:
    rollouts: list[Rollout] = []
    for rollout_id in rollout_store.list_rollout_ids():
        config = rollout_store.get_json(rollout_store.config_key(rollout_id))
        if config:
            rollouts.append(_config_to_rollout(config))
    rollouts.sort(key=lambda r: r.created_at, reverse=True)
    return RolloutList(rollouts=rollouts[:limit], cursor=None)


def get_rollout(rollout_id: str) -> Rollout:
    return _config_to_rollout(_load_config(rollout_id))


def update_rollout(rollout_id: str, patch: RolloutUpdate) -> Rollout:
    config = _load_config(rollout_id)
    if config["status"] not in ("draft", "failed"):
        raise RolloutStateError(
            f"A {config['status']} rollout cannot be edited. Only draft or failed rollouts are editable."
        )
    updates = patch.model_dump(exclude_unset=True)
    config.update(updates)
    rollout_store.put_json(rollout_store.config_key(rollout_id), config)
    logger.info("Rollout updated: id=%s fields=%s", rollout_id, list(updates))
    return _config_to_rollout(config)


def delete_rollout(rollout_id: str) -> RolloutDeleteResult:
    _load_config(rollout_id)  # raise if missing
    count = rollout_store.delete_prefix(rollout_store.rollout_prefix(rollout_id))
    logger.info("Rollout deleted: id=%s objects=%d", rollout_id, count)
    return RolloutDeleteResult(deleted=True, id=rollout_id, objects_deleted=count)


def _episode(rollout_id: str, episode_id: str) -> Episode:
    prefix = rollout_store.episode_prefix(rollout_id, episode_id)
    summary = rollout_store.get_json(f"{prefix}summary.json") or {}

    video_key = f"{prefix}video.mp4"
    if not rollout_store.object_exists(video_key):
        zip_key = f"{prefix}frames.zip"
        video_key = zip_key if rollout_store.object_exists(zip_key) else video_key

    return Episode(
        episode_id=episode_id,
        total_reward=float(summary.get("total_reward", 0.0)),
        length=int(summary.get("length", 0)),
        success=bool(summary.get("success", False)),
        policy_checkpoint_hash=summary.get("policy_checkpoint_hash"),
        video_url=rollout_store.presign_get(video_key, disposition="inline"),
        state_url=rollout_store.presign_get(f"{prefix}state.npy", filename=f"{episode_id}-state.npy"),
        action_url=rollout_store.presign_get(f"{prefix}action.npy", filename=f"{episode_id}-action.npy"),
        reward_url=rollout_store.presign_get(f"{prefix}reward.npy", filename=f"{episode_id}-reward.npy"),
        summary_url=rollout_store.presign_get(f"{prefix}summary.json", disposition="inline"),
    )


def get_episodes(rollout_id: str) -> EpisodeList:
    _load_config(rollout_id)
    episode_ids = rollout_store.list_episode_ids(rollout_id)
    return EpisodeList(episodes=[_episode(rollout_id, eid) for eid in episode_ids])


def get_episode_assets(rollout_id: str, episode_id: str) -> EpisodeAssets:
    _load_config(rollout_id)
    _validate_id(episode_id)
    prefix = rollout_store.episode_prefix(rollout_id, episode_id)
    video_key = f"{prefix}video.mp4"
    if not rollout_store.object_exists(video_key):
        video_key = f"{prefix}frames.zip"
    return EpisodeAssets(
        video_url=rollout_store.presign_get(video_key, disposition="inline"),
        state_url=rollout_store.presign_get(f"{prefix}state.npy", filename=f"{episode_id}-state.npy"),
        action_url=rollout_store.presign_get(f"{prefix}action.npy", filename=f"{episode_id}-action.npy"),
        reward_url=rollout_store.presign_get(f"{prefix}reward.npy", filename=f"{episode_id}-reward.npy"),
        summary_url=rollout_store.presign_get(f"{prefix}summary.json", disposition="inline"),
    )


def get_rollout_detail(rollout_id: str) -> RolloutDetail:
    rollout = get_rollout(rollout_id)
    episodes = get_episodes(rollout_id).episodes
    return RolloutDetail(rollout=rollout, episodes=episodes)


def _persist_status(config: dict, status: str) -> None:
    config["status"] = status
    rollout_store.put_json(rollout_store.config_key(config["id"]), config)


def run_rollout(rollout_id: str, req: RolloutRunRequest) -> RolloutRunResult:
    """Render the configured episodes and stream each one's dataset to B2.

    On a host without the engine, or on any engine failure, the run is persisted
    as ``failed`` and returned as such — the endpoint never 500s.
    """
    config = _load_config(rollout_id)
    episode_count = req.episode_count or config["episode_count"]
    seed = req.seed if req.seed is not None else config["seed"]
    _persist_status(config, "running")

    try:
        artifacts = run_episodes(config, episode_count, seed)
    except EngineUnavailableError as e:
        _persist_status(config, "failed")
        logger.warning("Rollout %s failed: engine unavailable", rollout_id)
        return RolloutRunResult(
            rollout=_config_to_rollout(config), episodes=[], status="failed", message=e.detail
        )
    except Exception as e:
        _persist_status(config, "failed")
        logger.exception("Rollout %s failed during run", rollout_id)
        return RolloutRunResult(
            rollout=_config_to_rollout(config),
            episodes=[],
            status="failed",
            message=f"Rollout run failed: {e}",
        )

    for art in artifacts:
        prefix = rollout_store.episode_prefix(rollout_id, art.episode_id)
        rollout_store.put_bytes(f"{prefix}{art.video_filename}", art.video_bytes, art.video_content_type)
        rollout_store.put_bytes(f"{prefix}state.npy", art.state_npy, _NPY_CT)
        rollout_store.put_bytes(f"{prefix}action.npy", art.action_npy, _NPY_CT)
        rollout_store.put_bytes(f"{prefix}reward.npy", art.reward_npy, _NPY_CT)
        rollout_store.put_json(f"{prefix}summary.json", art.summary)

    config["episode_count_done"] = len(artifacts)
    config["episode_count"] = max(config["episode_count"], episode_count)
    config["total_reward"] = sum(art.total_reward for art in artifacts)
    _persist_status(config, "complete")
    logger.info("Rollout %s complete: %d episodes written to B2", rollout_id, len(artifacts))

    episodes = [_episode(rollout_id, art.episode_id) for art in artifacts]
    return RolloutRunResult(
        rollout=_config_to_rollout(config), episodes=episodes, status="complete", message=None
    )
