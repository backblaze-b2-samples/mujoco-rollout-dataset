<!-- last_verified: 2026-09-16 -->
# Feature: Policy Rollout & Rendering (MuJoCo Playground)

## Purpose
The headline capability: build a MuJoCo Playground environment, roll out a policy
with real MJX physics, record per-step state/action/reward, and render each
episode offscreen to video — then hand the artifacts to the B2 dataset writer.

## Used By
- UI: the "Run" action on `/rollouts/[id]`
- API: `POST /rollouts/{id}/run`
- Engine: `services/api/app/service/mujoco_engine.py` (lazy-imported)

## Core Functions
- `services/api/app/service/mujoco_engine.py` — `run_episodes()`: `registry.load(env)`, JIT reset/step, random-action rollout, offscreen render, MP4/ZIP encode, `.npy` serialization
- `services/api/app/service/rollout.py` — `run_rollout()`: orchestrates the run, persists status, streams artifacts
- `services/api/requirements-ml.txt` — the gated engine stack (jax, mujoco, mujoco-mjx, playground, numpy, imageio)

## Canonical Files
- Engine: `services/api/app/service/mujoco_engine.py`

## Inputs
- The rollout config (environment, resolution, camera, output_format, seed) plus optional per-run `episode_count` / `seed` overrides

## Outputs
- Per episode: rendered video frames, `state`/`action`/`reward` numpy arrays, and a summary dict (total reward, length, success flag)
- Side effect: the rollout's status transitions `running` → `complete` (or `failed`)

## Flow
- `run_rollout` marks the rollout `running` and calls `run_episodes`
- `run_episodes` lazy-imports the engine; missing → `EngineUnavailableError`
- Device auto-detect: JAX picks CUDA when present, else CPU (no Apple-MPS backend, so macOS runs on CPU). A GPU is never required
- For each episode: reset, step `STEP_CAP` times (or until `done`) with random actions, collect obs/action/reward, render, encode
- Artifacts are returned to `run_rollout`, which streams them to B2 (see B2 Dataset Write)

## Edge Cases
- Engine not installed → the run is persisted as `failed` with an actionable message; the POST returns 200, never 500
- A camera name the env doesn't define → render retries with the env default camera (contained in-repo)
- `png_sequence` output → frames are zipped instead of encoded to MP4

## UX States
- Running: the Run button shows a spinner ("Rendering...")
- Complete: success toast with the episode count; episodes appear on the detail page and in the Dataset explorer
- Failed: error toast carrying the engine's message

## Verification
- Test files: `services/api/tests/test_rollouts.py` (`test_run_without_engine_persists_failed`, `test_run_writes_episode_artifacts`)
- Required cases: engine-unavailable → failed (no 500), successful run writes five artifacts per episode
- Focused verify command: `pnpm test:api`
- Full local verify command: install `requirements-ml.txt`, then run a real rollout (`POST /rollouts/{id}/run`) and confirm MP4 + arrays land in B2
- Pass criteria: focused tests green; a real run renders genuine MuJoCo physics to B2

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [B2 Dataset Write](b2-dataset-write.md)
