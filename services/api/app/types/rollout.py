"""Pydantic models for the rollout dataset pipeline.

`Rollout` is the primary entity: a configured MuJoCo Playground rollout job. Its
episodes carry the rendered video and per-step trajectory arrays, addressed by
short-lived presigned GET URLs the browser fetches directly from B2.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.types.base import ResponseModel

# Finite-value config fields. Kept as literals so the exported contract carries
# the enums and the frontend renders selectors (not free text) for them.
RolloutPolicy = Literal["random", "checkpoint"]
RolloutStatus = Literal["draft", "running", "complete", "failed"]
RolloutResolution = Literal["240p", "480p", "720p"]
RolloutCamera = Literal["side", "track", "front"]
RolloutOutputFormat = Literal["mp4", "png_sequence"]


class Rollout(ResponseModel):
    """A configured rollout job and its run status."""

    id: str
    name: str
    environment: str = Field(description="MuJoCo Playground environment name, e.g. CartpoleBalance.")
    episode_count: int
    resolution: RolloutResolution
    camera: RolloutCamera
    output_format: RolloutOutputFormat
    seed: int
    policy: RolloutPolicy
    checkpoint_key: str | None = Field(
        default=None,
        description="B2 key of an uploaded policy checkpoint; null for the built-in random policy.",
    )
    status: RolloutStatus
    created_at: datetime
    episode_count_done: int = Field(description="Episodes rendered and written to B2 so far.")
    total_reward: float = Field(
        default=0.0, description="Cumulative reward summed across every rendered episode."
    )
    key_prefix: str = Field(description="B2 prefix under which this rollout's artifacts live.")


class RolloutCreate(BaseModel):
    """New-rollout request. Finite fields default to the small, fast demo preset."""

    name: str = Field(min_length=1, max_length=120)
    environment: str = Field(default="CartpoleBalance", min_length=1)
    episode_count: int = Field(default=2, ge=1, le=100)
    resolution: RolloutResolution = "240p"
    camera: RolloutCamera = "side"
    output_format: RolloutOutputFormat = "mp4"
    seed: int = Field(default=0, ge=0)
    policy: RolloutPolicy = "random"
    checkpoint_key: str | None = None


class RolloutUpdate(BaseModel):
    """Partial update of a draft rollout's config. Every field is optional."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    environment: str | None = Field(default=None, min_length=1)
    episode_count: int | None = Field(default=None, ge=1, le=100)
    resolution: RolloutResolution | None = None
    camera: RolloutCamera | None = None
    output_format: RolloutOutputFormat | None = None
    seed: int | None = Field(default=None, ge=0)
    policy: RolloutPolicy | None = None
    checkpoint_key: str | None = None


class RolloutList(ResponseModel):
    """A page of rollouts, newest first."""

    rollouts: list[Rollout]
    cursor: str | None = Field(
        default=None, description="Opaque continuation token; null when there are no more rollouts."
    )


class Episode(ResponseModel):
    """One rendered episode plus fresh presigned URLs for its artifacts."""

    episode_id: str
    total_reward: float
    length: int = Field(description="Number of simulation steps in the episode.")
    success: bool
    policy_checkpoint_hash: str | None = Field(
        default=None, description="SHA-256 of the policy checkpoint, or null for the random policy."
    )
    video_url: str | None = Field(
        default=None, description="Presigned GET for the rendered MP4 (or PNG-sequence ZIP)."
    )
    state_url: str | None = Field(default=None, description="Presigned GET for state.npy.")
    action_url: str | None = Field(default=None, description="Presigned GET for action.npy.")
    reward_url: str | None = Field(default=None, description="Presigned GET for reward.npy.")
    summary_url: str | None = Field(default=None, description="Presigned GET for summary.json.")


class EpisodeList(ResponseModel):
    """Every episode belonging to a rollout."""

    episodes: list[Episode]


class EpisodeAssets(ResponseModel):
    """Freshly minted presigned GET URLs for one episode's artifacts."""

    video_url: str | None = None
    state_url: str | None = None
    action_url: str | None = None
    reward_url: str | None = None
    summary_url: str | None = None


class RolloutDetail(ResponseModel):
    """A rollout with its episodes expanded."""

    rollout: Rollout
    episodes: list[Episode]


class RolloutRunRequest(BaseModel):
    """Optional per-run overrides for `POST /rollouts/{id}/run`."""

    episode_count: int | None = Field(default=None, ge=1, le=100)
    seed: int | None = Field(default=None, ge=0)


class RolloutRunResult(ResponseModel):
    """The outcome of a rollout run: the updated rollout and its new episodes.

    `status` is `complete` when every episode rendered and streamed to B2, or
    `failed` when the run could not run (e.g. the MuJoCo engine is not installed
    on this host — the app persists the failure rather than returning a 500).
    """

    rollout: Rollout
    episodes: list[Episode]
    status: RolloutStatus
    message: str | None = Field(
        default=None, description="Human-readable detail, set on a failed run."
    )


class RolloutDeleteResult(ResponseModel):
    """Acknowledgement that a rollout and all its B2 artifacts were removed."""

    deleted: bool
    id: str
    objects_deleted: int = Field(description="Number of B2 objects removed under the rollout prefix.")
