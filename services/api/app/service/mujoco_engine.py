"""The MuJoCo Playground rollout + render engine.

This is the sample's headline capability and it is REAL: it builds a MuJoCo
Playground environment, rolls out a policy with genuine MJX physics, collects
per-step state/action/reward, and renders each episode offscreen to video.
Nothing here is simulated or mocked.

The heavy stack (``jax``, ``mujoco``, ``mujoco_playground``, ``numpy``,
``imageio``) is imported lazily inside :func:`run_episodes` and shipped in the
gated ``requirements-ml.txt`` (see docs/features/policy-rollout.md). The default
``pnpm run setup`` installs only the baseline ``requirements.txt``, so on a host
without the engine a run degrades to an actionable
:class:`EngineUnavailableError` instead of crashing the API — the caller
persists that as a ``failed`` rollout.

Device selection is runtime auto-detect (CUDA -> CPU). JAX has no Apple-MPS
backend, so on macOS it runs on CPU; a GPU is never hard-required.
"""

import io
import logging
import zipfile
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Curated resolutions -> (height, width). Kept small by default so a demo run
# and its screenshots stay fast (build-constraints: tiny default preset).
RESOLUTIONS: dict[str, tuple[int, int]] = {
    "240p": (240, 320),
    "480p": (480, 640),
    "720p": (720, 1280),
}

# Cap steps per episode so a default demo (CartpoleBalance, 2 episodes) finishes
# quickly. Real physics still runs; the episode just ends at the cap or on done.
STEP_CAP = 100


class EngineUnavailableError(RuntimeError):
    """The MuJoCo Playground stack is not importable on this host."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


@dataclass
class EpisodeArtifacts:
    """Everything one rendered episode contributes to the B2 dataset."""

    episode_id: str
    total_reward: float
    length: int
    success: bool
    video_bytes: bytes
    video_content_type: str
    video_filename: str
    state_npy: bytes
    action_npy: bytes
    reward_npy: bytes
    summary: dict


def _select_device(jax) -> str:
    """Report the JAX backend (auto-detected), never forcing a GPU.

    JAX picks CUDA when a CUDA jaxlib is installed, else CPU; it has no Apple-MPS
    backend, so macOS falls back to CPU. We only log the choice.
    """
    try:
        backend = jax.default_backend()
    except Exception:
        backend = "cpu"
    logger.info("MuJoCo Playground running on JAX backend: %s", backend)
    return backend


def _to_array(np, value):
    """Coerce a JAX array or dict-of-arrays observation into a flat numpy row."""
    if isinstance(value, dict):
        parts = [np.asarray(value[k]).reshape(-1) for k in sorted(value)]
        return np.concatenate(parts) if parts else np.zeros((0,), dtype=np.float32)
    return np.asarray(value).reshape(-1)


def _encode_video(np, imageio, frames, output_format: str, fps: int):
    """Encode rendered frames to MP4 (default) or a ZIP of PNGs.

    Returns (bytes, content_type, filename). MP4 is the primary, inline-playable
    asset; ``png_sequence`` produces a downloadable frame archive instead.
    """
    stacked = [np.asarray(f, dtype=np.uint8) for f in frames]
    if output_format == "png_sequence":
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, frame in enumerate(stacked):
                png = imageio.imwrite("<bytes>", frame, extension=".png")
                zf.writestr(f"frame_{i:05d}.png", png)
        return buf.getvalue(), "application/zip", "frames.zip"

    buf = io.BytesIO()
    # imageio-ffmpeg writes MP4 to a file-like via the ffmpeg plugin.
    writer = imageio.get_writer(buf, format="mp4", fps=fps, codec="libx264", macro_block_size=None)
    try:
        for frame in stacked:
            writer.append_data(frame)
    finally:
        writer.close()
    return buf.getvalue(), "video/mp4", "video.mp4"


def _npy_bytes(np, array) -> bytes:
    buf = io.BytesIO()
    np.save(buf, np.asarray(array))
    return buf.getvalue()


def run_episodes(config: dict, episode_count: int, seed: int) -> list[EpisodeArtifacts]:
    """Roll out `episode_count` episodes and return their rendered artifacts.

    Raises :class:`EngineUnavailableError` when the engine stack is not
    installed, so the caller can persist a ``failed`` run rather than 500.
    """
    try:
        import imageio.v2 as imageio
        import jax
        import numpy as np
        from mujoco_playground import registry
    except ImportError as e:  # pragma: no cover - exercised on hosts without the ML stack
        raise EngineUnavailableError(
            "MuJoCo Playground engine is not installed on this host. Install the "
            "gated engine deps: `services/api/.venv/bin/pip install -r "
            "services/api/requirements-ml.txt` (supported on Linux with CUDA or "
            "on macOS CPU; JAX has no Apple-MPS backend). Original error: "
            f"{e}"
        ) from e

    backend = _select_device(jax)
    environment = config["environment"]
    height, width = RESOLUTIONS.get(config.get("resolution", "240p"), RESOLUTIONS["240p"])
    camera = config.get("camera", "side")
    output_format = config.get("output_format", "mp4")

    env = registry.load(environment)
    jit_reset = jax.jit(env.reset)
    jit_step = jax.jit(env.step)
    fps = round(1.0 / float(getattr(env, "dt", 1 / 30))) or 30

    artifacts: list[EpisodeArtifacts] = []
    for ep_index in range(episode_count):
        rng = jax.random.PRNGKey(seed + ep_index)
        rng, reset_rng = jax.random.split(rng)
        state = jit_reset(reset_rng)

        trajectory = [state]
        observations: list = []
        actions: list = []
        rewards: list[float] = []
        success = False

        for _ in range(STEP_CAP):
            rng, act_rng = jax.random.split(rng)
            action = jax.random.uniform(
                act_rng, (env.action_size,), minval=-1.0, maxval=1.0
            )
            observations.append(_to_array(np, state.obs))
            actions.append(np.asarray(action).reshape(-1))
            state = jit_step(state, action)
            rewards.append(float(state.reward))
            trajectory.append(state)
            info = getattr(state, "info", {}) or {}
            if bool(info.get("success", False)):
                success = True
            if bool(getattr(state, "done", False)):
                break

        frames = _render(env, trajectory, height, width, camera)
        video_bytes, video_ct, video_name = _encode_video(
            np, imageio, frames, output_format, fps
        )

        state_arr = np.stack(observations) if observations else np.zeros((0, 0), dtype=np.float32)
        action_arr = np.stack(actions) if actions else np.zeros((0, 0), dtype=np.float32)
        reward_arr = np.asarray(rewards, dtype=np.float32)
        total_reward = float(reward_arr.sum())
        length = int(reward_arr.shape[0])
        episode_id = f"ep-{ep_index:04d}"

        summary = {
            "episode_id": episode_id,
            "environment": environment,
            "backend": backend,
            "total_reward": total_reward,
            "length": length,
            "success": success,
            "resolution": config.get("resolution", "240p"),
            "camera": camera,
            "seed": seed + ep_index,
            "state_shape": list(state_arr.shape),
            "action_shape": list(action_arr.shape),
        }

        artifacts.append(
            EpisodeArtifacts(
                episode_id=episode_id,
                total_reward=total_reward,
                length=length,
                success=success,
                video_bytes=video_bytes,
                video_content_type=video_ct,
                video_filename=video_name,
                state_npy=_npy_bytes(np, state_arr),
                action_npy=_npy_bytes(np, action_arr),
                reward_npy=_npy_bytes(np, reward_arr),
                summary=summary,
            )
        )

    return artifacts


def _render(env, trajectory, height: int, width: int, camera: str):
    """Render a trajectory offscreen, falling back to the env default camera.

    Some Playground envs don't define a `side`/`track`/`front` camera; a bad
    camera name raises inside MuJoCo, so we retry with the env default rather
    than failing the whole run (native-ML crashes are contained in-repo).
    """
    try:
        return env.render(trajectory, height=height, width=width, camera=camera)
    except Exception:
        logger.warning("Render with camera=%r failed; retrying with env default", camera)
        return env.render(trajectory, height=height, width=width)
