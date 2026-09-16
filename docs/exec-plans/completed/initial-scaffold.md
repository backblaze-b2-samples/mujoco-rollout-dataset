# Build plan — `mujoco-rollout-dataset`

Scaffolded from `vibe-coding-starter-kit`. Source of truth for starter content:
`.claude/scratch/vcsk-a46dc765-a029-485e-b751-56827c09e924/`.

## 1. Purpose

`mujoco-rollout-dataset` is a local RL-rollout dataset pipeline: it rolls out
policies in **MuJoCo Playground** across simulated environments, renders each
episode to MP4, and streams the rendered video plus per-step state/action/reward
`.npy` arrays and an episode-summary JSON to Backblaze B2 under an
experiment/episode key prefix. The rendered videos and trajectory arrays are
served back through presigned B2 URLs for offline policy visualization,
behavioral-cloning dataset construction, and evaluation dashboards. It is for
robotics ML engineers and reinforcement-learning researchers who need large
collections of simulated rollout episodes to train and evaluate locomotion and
manipulation policies, and it showcases **B2 as the storage layer** for the bulk
write-amplification that simulation produces (each episode = MP4 + 3 arrays +
summary JSON; long runs mean hundreds of GB of continuous ingest). It runs on
local OSS with **no second API key — B2 credentials only**.

## 2. Architecture delta from `vibe-coding-starter-kit`

The starter kit is the ceiling. Strip what this app doesn't need; keep the
proven full-stack seam (Next.js 16 + FastAPI + boto3 S3 + pnpm workspaces,
`pnpm gen:api` / `gen:docs` / `gen:check` generators, infra runbooks, B2 client
with `user_agent_extra`, presigned-URL plumbing, health/metrics/ratelimit).

### keep (as-is)
- Full monorepo seam: `apps/web` (Next.js 16, React 19, Tailwind v4, shadcn/ui,
  TanStack Query, Recharts), `services/api` (FastAPI, Pydantic v2, boto3),
  `packages/`, `pnpm-workspace.yaml`, generators under `scripts/gen`, infra
  (`infra/vercel`, `infra/railway`), CI under `.github`.
- `services/api/app/repo/b2_client.py` (S3 client + `user_agent_extra`),
  `b2_object.py`, `b2_upload.py`, `list_cache.py`, `counter.py`.
- `runtime/health.py`, `runtime/metrics.py`, `runtime/ratelimit.py`.
- **Bucket explorer (full-bucket browse) — NON-NEGOTIABLE KEEP.** The starter's
  `/files` file-browser screen and its `list_objects_v2`-backed listing stay.
  Note: for this sample the bucket explorer doubles as a raw view of the same
  dataset objects, but it is kept as the generic full-bucket browser regardless.
- `settings` screen + `settings-form.tsx` (the in-repo exemplar for selector +
  default-hint form UX). Repurpose its demo fields to rollout-relevant
  preferences (default environment, default resolution) — keep the pattern.
- `config/settings.py`, `config/b2_required_vars.json`, `types/base.py`,
  `types/errors.py`, `types/formatting.py`, `types/health.py`.

### trim (remove from starter)
- `runtime/upload.py` + `service/upload.py` + `service/metadata.py` +
  `types/upload.py` **as the primary flow** — this app is a *producer* of
  simulation artifacts, not a user-upload app. KEEP a minimal presigned-PUT path
  ONLY if used for optional policy-checkpoint upload (see §3); otherwise trim the
  drag-and-drop `/upload` screen and its components.
- `service/metadata.py` image/EXIF/PDF extraction (Pillow/PyPDF2) — not relevant
  to `.npy`/MP4 artifacts. Remove Pillow/PyPDF2 deps; metadata for this app is
  the episode-summary JSON produced at rollout time, not extracted post-hoc.
- `docs/features/file-upload.md`, `docs/features/metadata-extraction.md` — delete.
- Any starter demo copy referencing "vibe coding" / generic file storage.

### add (new for `mujoco-rollout-dataset`)
- `services/api/app/repo/rollout_store.py` — B2-backed rollout config CRUD
  (config JSON under the config prefix; list/get/delete scoped by prefix).
- `services/api/app/service/rollout.py` — the MuJoCo Playground rollout+render
  engine: builds the env, rolls out a policy, collects per-step state/action/
  reward, renders frames to MP4, writes MP4 + `state.npy` + `action.npy` +
  `reward.npy` + `summary.json` to B2. **`deployment: local`** — CPU default,
  GPU autodetect (see §4).
- `services/api/app/runtime/rollouts.py` — the rollout router (endpoints in §3).
- `services/api/app/types/rollout.py` — Pydantic models: `Rollout`,
  `RolloutCreate`, `RolloutUpdate`, `RolloutList`, `RolloutDetail`, `Episode`,
  `EpisodeList`, `EpisodeAssets`, `RolloutRunResult`.
- **Sample-scoped asset explorer (mandatory ADD):** a "Dataset" screen
  (`/dataset`) scoped to this app's own `rollouts/` prefix — browse rollouts →
  episodes, play the rendered MP4 inline (presigned GET), download the trajectory
  `.npy` arrays. This is the sample-specific explorer that complements (never
  replaces) the kept full-bucket explorer.
- `/rollouts` screen — the primary-entity lifecycle UI (create/list/detail/edit/
  delete/run; see §4).
- web components: `components/rollouts/*`, `components/dataset/*`; hooks for the
  new queries; rewritten dashboard cards.

## 3. B2 surface (S3-compatible only — no b2-native)

All operations via the S3-compatible API on the shared `b2_client.py` (custom
`user_agent_extra`). No b2-native API anywhere.

| operation | why |
|---|---|
| `put_object` | write rollout config JSON, per-episode MP4, `state/action/reward.npy`, `summary.json` |
| `list_objects_v2` | list rollouts + episodes scoped by `rollouts/` prefix; also backs the kept full-bucket explorer and dashboard stats |
| `head_object` | `/health` connectivity probe; cheap per-asset existence/size checks |
| `get_object` | re-read `summary.json` / small arrays server-side |
| presigned GET | serve rendered MP4 for inline playback + trajectory `.npy` downloads |
| presigned PUT | OPTIONAL — direct browser upload of a policy checkpoint into `rollouts/<id>/checkpoint/` (only if checkpoint-upload feature is built; otherwise omit) |
| `delete_object` | delete a rollout and every artifact under its prefix (scoped delete) |

### API endpoints (recorded ONCE — this is the builder's contract)

Base path `/api`. Implement as FastAPI routers + Pydantic models; `pnpm gen:api`
derives the web seam. Existing starter endpoints (`/health`, `/stats`,
`/files*`) are kept as-is except where noted.

| path | method | request model | response model |
|---|---|---|---|
| `/api/rollouts` | GET | — (query: `limit`, `cursor`) | `RolloutList` |
| `/api/rollouts` | POST | `RolloutCreate` | `Rollout` |
| `/api/rollouts/{rollout_id}` | GET | — | `RolloutDetail` |
| `/api/rollouts/{rollout_id}` | PATCH | `RolloutUpdate` | `Rollout` |
| `/api/rollouts/{rollout_id}` | DELETE | — | `DeleteResult` (reuse starter delete-result shape) |
| `/api/rollouts/{rollout_id}/run` | POST | `RolloutRunRequest` (optional overrides) | `RolloutRunResult` |
| `/api/rollouts/{rollout_id}/episodes` | GET | — | `EpisodeList` (each `Episode` carries presigned video + array URLs) |
| `/api/rollouts/{rollout_id}/episodes/{episode_id}/assets` | GET | — | `EpisodeAssets` (fresh presigned GET URLs) |

`Rollout` fields: `id`, `name`, `environment`, `episode_count`, `resolution`,
`camera`, `output_format`, `seed`, `policy` (`random`|`checkpoint`),
`checkpoint_key` (nullable), `status` (`draft`|`running`|`complete`|`failed`),
`created_at`, `episode_count_done`, `key_prefix`. `Episode` fields: `episode_id`,
`total_reward`, `length`, `success`, `policy_checkpoint_hash`, `video_url`,
`state_url`, `action_url`, `reward_url`, `summary_url`.

## 4. Key features

1. **Rollout configuration** — create/edit/list rollout jobs; config JSON stored
   in the B2 config prefix. `deployment: local`, no external provider.
2. **Policy rollout & rendering (MuJoCo Playground)** — the headline capability.
   Builds a MuJoCo Playground environment, rolls out a policy (default: a
   built-in `random`/scripted policy so a demo needs **no downloaded checkpoint
   and no key**), collects per-step state/action/reward, renders each episode
   offscreen to MP4, and streams MP4 + `.npy` arrays + `summary.json` to B2.
   - **External API provider:** NONE. `deployment: local`.
   - **CPU-default / GPU-autodetect (hard rule):** auto-detect CUDA → Apple MPS →
     CPU at runtime; never hard-require a GPU. MuJoCo Playground is JAX/MJX-based;
     **JAX has weak/no Apple-MPS support, so on macOS it falls back to CPU** (the
     rule's documented CUDA → CPU fallback). MuJoCo offscreen rendering uses its
     own GL backend. Native-ML crashes / macOS GL banners are expected — contain
     and fix in-repo; surface one only if it BLOCKS the run.
   - **Cost:** $0 (fully local, B2 credentials only).
3. **B2 dataset write** — per episode: MP4 (rendered video) + `state.npy` +
   `action.npy` + `reward.npy` + `summary.json` (total reward, length, success
   flag, policy-checkpoint hash) under `rollouts/<id>/episodes/<ep>/`.
   Demonstrates bulk write amplification. `deployment: local`.
4. **Dataset explorer (sample-scoped)** — `/dataset`: browse rollouts → episodes,
   inline MP4 playback + `.npy` downloads via presigned GET. `deployment: local`.
5. **Bucket explorer (kept)** — full-bucket browse from the starter. Never removed.
6. **Dashboard** — stats cards: total rollouts, total episodes, cumulative reward,
   B2 storage used; recent rollouts; episodes-over-time chart. `deployment: local`.

**Provider orchestration via Genblaze:** N/A — the description names no Genblaze
stack; all compute is local MuJoCo. Use `sample-builder` (not `genblaze-*`).

### Primary-entity lifecycle (mandatory)
Primary entity: **rollout** (singular `rollout`, plural `rollouts`; schema
`Rollout`). All lifecycle verbs are built in the UI on `/rollouts`:
- **create** — "New rollout" form (§ Form UX). ✅ built.
- **read** — rollouts list + detail (episodes, presigned video). ✅ built.
- **edit** — edit a `draft` rollout's config. ✅ built.
- **delete** — delete rollout + all B2 artifacts under its prefix (scoped). ✅ built.
- **run** — "Run" action triggers `POST /rollouts/{id}/run`; UI shows progress
  and resulting episodes. ✅ built.

No verbs omitted → `omitted_ui_verbs: []`.

### Form UX conventions (create/edit rollout)
Finite-value fields use selectors (`Select`/`RadioGroup`), never free text —
applies to create AND edit:
- `environment` → `Select` (curated MuJoCo Playground env list, e.g.
  `CartpoleBalance`, `AntRun`, `Go1JoystickFlatTerrain`, `PandaPickCube`).
- `resolution` → `Select` (`240p` / `480p` / `720p`).
- `camera` → `Select` (`side` / `track` / `front`).
- `output_format` → `RadioGroup` (`mp4` / `png_sequence`).
- `policy` → `RadioGroup` (`random` / `checkpoint`).
- `episode_count`, `seed` → numeric inputs (not finite sets).

CREATE-form safe defaults, surfaced as placeholder / `FormDescription` guidance
only (never an autofill button): `environment=CartpoleBalance` (small & fast),
`episode_count=2`, `resolution=240p`, `camera=side`, `output_format=mp4`,
`policy=random`, `seed=0`. EDIT form opens pre-filled with the real resource.
Model on `apps/web/src/components/settings/settings-form.tsx`.

## 5. Doc transforms
- **Rewrite:** `docs/features/dashboard.md` → rollout dashboard;
  `docs/features/file-browser.md` → keep as the kept full-bucket explorer doc;
  `docs/features/settings.md` → rollout preferences.
- **Delete:** `docs/features/file-upload.md`, `docs/features/metadata-extraction.md`.
- **New stubs:** `docs/features/rollout-configuration.md`,
  `docs/features/policy-rollout.md`, `docs/features/b2-dataset-write.md`,
  `docs/features/dataset-explorer.md`.
- Regenerate `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/app-workflows.md`
  and infra runbooks via `pnpm gen:docs` from the new `sample.json`.

### Declared identity — write `docs/exec-plans/sample.json` (builder's FIRST act, before `pnpm gen:docs`)
Builder writes this file verbatim into the new tree, then runs the generators.

```json
{
  "$schema": "../../scripts/gen/sample.schema.json",
  "schema_version": 1,
  "name": "MuJoCo Rollout Dataset",
  "slug": "mujoco-rollout-dataset",
  "package_scope": "@mujoco-rollout-dataset",
  "purpose": "A local pipeline that rolls out reinforcement-learning policies in MuJoCo Playground, renders each episode to video, and streams the rendered video plus per-step state, action and reward arrays and an episode-summary JSON to Backblaze B2 for offline policy analysis and behavioral-cloning dataset curation.",
  "tagline": "Roll out simulated robots, stream the dataset straight to B2.",
  "primary_entity": { "schema": "Rollout", "singular": "rollout", "plural": "rollouts" },
  "features": [
    { "title": "Rollout Configuration", "route": "/rollouts", "doc": "docs/features/rollout-configuration.md", "summary": "create, edit, list and delete rollout jobs (environment, episode count, resolution, camera, policy)", "workflow_heading": "Configure a Rollout" },
    { "title": "Policy Rollout & Rendering", "route": null, "doc": "docs/features/policy-rollout.md", "summary": "MuJoCo Playground rolls out a policy, records state/action/reward, and renders each episode to MP4 — runs locally, CPU by default" },
    { "title": "B2 Dataset Write", "route": null, "doc": "docs/features/b2-dataset-write.md", "summary": "per episode: MP4 + state/action/reward .npy + summary JSON streamed to B2" },
    { "title": "Dataset Explorer", "route": "/dataset", "doc": "docs/features/dataset-explorer.md", "summary": "browse rollouts and episodes, play rendered video and download trajectory arrays via presigned URLs", "workflow_heading": "Explore the Dataset" },
    { "title": "Bucket Explorer", "route": "/files", "doc": "docs/features/file-browser.md", "summary": "browse the full B2 bucket: list, preview, download, delete", "workflow_heading": "Browse the Bucket" },
    { "title": "Dashboard", "route": "/", "doc": "docs/features/dashboard.md", "summary": "rollout and episode stats, cumulative reward, storage used, recent rollouts", "workflow_heading": "View Dashboard" }
  ],
  "b2_surface": [
    { "operation": "put_object", "why": "write rollout config JSON, rendered episode MP4, state/action/reward .npy arrays, and episode-summary JSON" },
    { "operation": "list_objects_v2", "why": "list rollouts and episodes under the rollouts/ prefix, and back the full-bucket explorer and dashboard stats" },
    { "operation": "head_object", "why": "the /health connectivity probe and cheap per-asset existence and size checks" },
    { "operation": "get_object", "why": "re-read episode-summary JSON and small arrays server-side" },
    { "operation": "presigned GET", "why": "inline playback of rendered MP4 and download of trajectory .npy arrays" },
    { "operation": "delete_object", "why": "delete a rollout and every artifact under its prefix" }
  ],
  "b2_key_prefix": "rollouts/",
  "stack": {
    "web": "Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query, Recharts",
    "api": "FastAPI, Python 3.12+, boto3, Pydantic v2, MuJoCo Playground (mujoco + mujoco-mjx + jax), imageio",
    "storage": "Backblaze B2 (S3-compatible API)",
    "package_manager": "pnpm workspaces"
  },
  "deployment_targets": ["vercel", "railway"],
  "env_vars": [
    { "name": "B2_APPLICATION_KEY_ID", "required": true, "secret": true, "note": "B2 application key ID (**keyID** in the B2 console)" },
    { "name": "B2_APPLICATION_KEY", "required": true, "secret": true, "note": "B2 application key (**applicationKey**) — shown once at creation" },
    { "name": "B2_BUCKET_NAME", "required": true, "secret": false, "note": "bucket unique name (**Bucket Unique Name** in the B2 console)" },
    { "name": "B2_REGION", "required": true, "secret": false, "note": "the region inside the bucket's **Endpoint** (`s3.<region>.backblazeb2.com`); the S3 endpoint is derived from it" },
    { "name": "B2_PUBLIC_URL_BASE", "required": false, "secret": false, "note": "public object base URL, when the bucket is public" },
    { "name": "NEXT_PUBLIC_API_URL", "required": false, "secret": false, "note": "separate-origin deploys only; Next.js inlines it at build time" }
  ],
  "attribution_token": "b2ai-mujoco-rollout-dataset",
  "repo": { "org": "backblaze-b2-samples", "name": "mujoco-rollout-dataset" },
  "screenshots": []
}
```

Note: `screenshots: []` (empty is valid — screenshots are a later pipeline step).
`primary_entity.schema` = `Rollout` must be a real key in the exported OpenAPI
components. `attribution_token` = `b2ai-mujoco-rollout-dataset` must equal the
`user_agent_extra` value in `services/api/app/repo/b2_client.py` (`pnpm gen:check`
asserts it). `name` must equal `APP_NAME` in `apps/web/src/lib/app-config.ts`.

## 6. Rename table

| from (`vibe-coding-starter-kit`) | to (`mujoco-rollout-dataset`) |
|---|---|
| `vibe-coding-starter-kit` (kebab/slug) | `mujoco-rollout-dataset` |
| `Vibe Coding Starter Kit` (display / `APP_NAME`) | `MuJoCo Rollout Dataset` |
| `@vibe-coding-starter-kit` (npm scope) | `@mujoco-rollout-dataset` |
| `vibe_coding_starter_kit` (snake, if any) | `mujoco_rollout_dataset` |
| attribution / `user_agent_extra` / `utm_content` | `b2ai-mujoco-rollout-dataset` |
| b2 key prefix | `rollouts/` |
| repo | `backblaze-b2-samples/mujoco-rollout-dataset` |
| image tags / workflow slugs / CORS rule id / localStorage namespace | `mujoco-rollout-dataset` |
| `API_TITLE` (derived from `APP_NAME`) | `MuJoCo Rollout Dataset API` |

All of the above derive from `docs/exec-plans/sample.json` + `app-config.ts`, so
the rename sweep must update `sample.json`, `app-config.ts`, `b2_client.py`
(`user_agent_extra`), package manifests, and any remaining literal strings, then
run `pnpm gen:docs` + `pnpm gen:check`.

## Constraints reminder for the builder
- Apply the three B2 standards via `/b2-doctor`: S3-compatible API default (no
  b2-native), custom `user_agent_extra` on every S3 client, standardized `B2_*`
  env var names.
- Vendor-themed sample MUST use the vendor's own engine for the headline
  capability: use **MuJoCo Playground** for the rollout+render, never a substitute.
- Keep the run genuinely real: real MuJoCo physics → real state/action/reward,
  real rendered frames → real MP4, real B2 writes. Default `policy=random` so a
  demo run needs no downloaded checkpoint and no external key.
- Secrets only in `.env` (gitignored); placeholders in `.env.example`.
