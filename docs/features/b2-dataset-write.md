<!-- last_verified: 2026-09-16 -->
# Feature: B2 Dataset Write

## Purpose
Stream each rendered episode's dataset to Backblaze B2 — the app's whole reason
to exist — demonstrating the bulk write amplification simulation produces.

## Used By
- API: the write half of `POST /rollouts/{id}/run`
- Repo: `services/api/app/repo/rollout_store.py`

## Core Functions
- `services/api/app/repo/rollout_store.py` — `put_bytes`, `put_json`, `delete_prefix`, `presign_get` (boto3 confined to the repo layer)
- `services/api/app/service/rollout.py` — `run_rollout()` writes each episode's five artifacts, then updates the config

## Canonical Files
- Storage adapter: `services/api/app/repo/rollout_store.py`

## Inputs
- The `EpisodeArtifacts` produced by the engine (video bytes, three `.npy` arrays, summary dict)

## Outputs
Per episode, under `rollouts/<id>/episodes/<episode_id>/`:
- `video.mp4` (or `frames.zip` for a PNG sequence) — the rendered video
- `state.npy`, `action.npy`, `reward.npy` — the trajectory arrays
- `summary.json` — total reward, length, success flag, environment, seed
All via `put_object` on the S3-compatible API. The rollout config JSON is updated with `episode_count_done` and `total_reward`.

## Flow
- The engine returns artifacts to `run_rollout`
- For each episode, `run_rollout` calls `rollout_store.put_bytes` / `put_json` for all five objects
- The shared bucket-listing cache is invalidated so the new objects show in the explorer and dashboard immediately
- The rollout config is rewritten with the completed status and aggregates

## Edge Cases
- Any `put_object` failure → `502`; the run is already marked `failed`
- Long runs → hundreds of MB of continuous ingest, the write-amplification story B2 is built for
- Delete is scoped to a single rollout's prefix, so it never touches another rollout's data

## UX States
- Not applicable directly; surfaced through the run's toast and the Dataset explorer

## Verification
- Test files: `services/api/tests/test_rollouts.py` (`test_run_writes_episode_artifacts`, `test_delete_is_scoped_to_prefix`)
- Required cases: five artifacts written per episode, scoped delete removes only the target prefix
- Focused verify command: `pnpm test:api`
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Dataset Explorer](dataset-explorer.md)
