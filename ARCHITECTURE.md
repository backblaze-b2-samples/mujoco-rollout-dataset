<!-- last_verified: 2026-08-06 -->
# Architecture

## Components

<!-- gen:begin arch-components -->
A local pipeline that rolls out reinforcement-learning policies in MuJoCo Playground, renders each episode to video, and streams the rendered video plus per-step state, action and reward arrays and an episode-summary JSON to Backblaze B2 for offline policy analysis and behavioral-cloning dataset curation.

- **apps/web/** — Next.js 16, React 19, Tailwind v4, shadcn/ui, TanStack Query, Recharts
  - Rollout Configuration (`/rollouts`) — create, edit, list and delete rollout jobs (environment, episode count, resolution, camera, policy)
  - Dataset Explorer (`/dataset`) — browse rollouts and episodes, play rendered video and download trajectory arrays via presigned URLs
  - Bucket Explorer (`/files`) — browse the full B2 bucket: list, preview, download, delete
  - Dashboard (`/`) — rollout and episode stats, cumulative reward, storage used, recent rollouts
- **services/api/** — FastAPI, Python 3.12+, boto3, Pydantic v2, MuJoCo Playground (mujoco + mujoco-mjx + jax), imageio
  - REST API for every operation the frontend consumes, exported to `docs/api/openapi.json`
  - Backblaze B2 (S3-compatible API) access isolated in the `repo/` layer
  - Policy Rollout & Rendering — MuJoCo Playground rolls out a policy, records state/action/reward, and renders each episode to MP4 — runs locally, CPU by default
  - B2 Dataset Write — per episode: MP4 + state/action/reward .npy + summary JSON streamed to B2
  - Structured JSON logging with request tracing, plus `/health` and Prometheus `/metrics`
- **packages/shared/** — TypeScript types generated from the API contract by `pnpm gen:api`, consumed by `apps/web/` as a workspace dependency (pnpm workspaces)
<!-- gen:end arch-components -->

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Authored Python files under `services/api/app/` stay under 300 lines

### Directory Structure

<!-- gen:begin arch-directory -->
```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models, and the response-model base
    config/                Settings loaded from environment
    repo/                  B2 S3 client (data access layer)
    service/               Business logic
    runtime/               FastAPI route handlers
  scripts/                 Operational scripts (OpenAPI export, bucket CORS)
  tests/                   pytest tests (structural + integration)
```
<!-- gen:end arch-directory -->

## Boundary Invariants

- **No external SDK leakage**: `boto3` is only imported in `app/repo/`. All other layers interact with B2 through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No cross-layer mutable state**: Configuration is read-only after init, and no mutable state is shared *between* layers. Intra-layer caches/counters (the listing cache in `repo/list_cache.py`, the B2 connectivity cache in `repo/b2_client.py`, the download counter in `repo/counter.py`, the rate-limit and metrics state in `runtime/`) are module-local and guarded by a `threading.Lock`. The listing cache also owns the only background thread in the app: a stale entry is served immediately while that thread re-scans (stale-while-revalidate), and `main.lifespan` warms it once at startup so no user pays for the cold full-bucket scan.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. File keys reject empty and path-traversal patterns; optional prefix confinement via `ALLOWED_KEY_PREFIX` (off by default).

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repository: `web` builds from the
  repository root because it consumes `packages/shared`; `api` builds from
  `services/api`. Each service's versioned config sits at its own root —
  `railway.json` and `services/api/railway.json` — the default path Railway
  discovers, so a one-click template deploy inherits the same build, start, and
  health behavior with nothing to configure by hand. The human-approved
  staging/production contract lives in [infra/railway/README.md](infra/railway/README.md).
- **Vercel** — one project using [Vercel Services](https://vercel.com/docs/services):
  the `web` (Next.js) and `api` (FastAPI) services build from the same repo and
  share one origin — the web app at `/`, the API under `/api`. The repo-root
  `vercel.json` declares both services and routes `/api/*` to the API service;
  the Vercel-only `services/api/index.py` strips the `/api` prefix so FastAPI
  keeps its native paths (`/health`, `/files`, `/rollouts`, …). The MuJoCo
  Playground render engine (native JAX/MJX) does not run on Vercel serverless,
  so a Vercel deploy configures and browses rollouts while the render runs
  locally or on a self-hosted API; rendered artifacts are served from B2 via
  presigned GET (see [Policy Rollout & Rendering](docs/features/policy-rollout.md)),
  and the bucket must allow the deploy origin in its CORS. A two-separate-Projects
  alternative and the full delivery contract live in
  [infra/vercel/README.md](infra/vercel/README.md).

External provisioning and deployment remain explicit user-approved actions.

## Data Stores

<!-- gen:begin arch-data-stores -->
- **Backblaze B2 (S3-compatible API)** — the only data store; there is no application database
  - Every object this app writes lives under the `rollouts/` key prefix of one bucket
  - Listing, per-key metadata and presigned URLs all come from the S3 surface below
  - The primary entity is `Rollout`; one rollout is one object
<!-- gen:end arch-data-stores -->

## External Services

<!-- gen:begin arch-external-services -->
- **Backblaze B2 (S3-compatible API)** — reached only through `services/api/app/repo/`, using:
  - `put_object` — write rollout config JSON, rendered episode MP4, state/action/reward .npy arrays, and episode-summary JSON
  - `list_objects_v2` — list rollouts and episodes under the rollouts/ prefix, and back the full-bucket explorer and dashboard stats
  - `head_object` — the /health connectivity probe and cheap per-asset existence and size checks
  - `get_object` — re-read episode-summary JSON and small arrays server-side
  - `presigned GET` — inline playback of rendered MP4 and download of trajectory .npy arrays
  - `delete_object` — delete a rollout and every artifact under its prefix
<!-- gen:end arch-external-services -->

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins. `CORSMiddleware` is registered LAST in `main.py` (outermost) so it wraps **every** response, including uncaught-exception 500s — otherwise the browser would block error responses and the UI would only see an opaque "network error". See [docs/RELIABILITY.md](docs/RELIABILITY.md#error-handling). A per-IP rate-limit middleware sits inner to CORS; see [docs/SECURITY.md](docs/SECURITY.md#rate-limiting).
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Configure**: Browser -> `POST /rollouts` -> service writes `rollouts/<id>/config.json` to B2 -> response
- **Run**: Browser -> `POST /rollouts/{id}/run` -> service invokes the MuJoCo engine -> per episode, repo `put_object`s the MP4 + `state/action/reward.npy` + summary JSON to B2 -> response
- **Explore**: Browser -> `GET /rollouts/{id}/episodes` -> repo mints presigned GET URLs -> browser plays the MP4 and downloads arrays **directly from B2**
- **List**: Browser -> `GET /files` (or `GET /rollouts`) -> service calls repo -> returns the list
- **Delete**: Browser -> `DELETE /rollouts/{id}` -> service -> repo deletes every object under the rollout prefix (scoped)

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request; also the catch-all that converts uncaught exceptions to a typed JSON 500)
- `/metrics` endpoint (Prometheus format: request count, latency)
- `/health` endpoint (B2 connectivity check)

## API Contract

<!-- gen:begin arch-api-contract -->
- Checked-in OpenAPI artifact: `docs/api/openapi.json`
- Export / check: `pnpm contract:export` / `pnpm contract:check`
- Generate the client seam from it: `pnpm gen:api` (drift gate: `pnpm gen:check`)
- FastAPI freshness test: `services/api/tests/test_openapi_contract.py`
- Frontend route drift test: `apps/web/src/lib/api-contract.test.ts`

The FastAPI routers and Pydantic models are the single source of truth. The
frontend's `API_CLIENT_ROUTES` registry, the `qk` query-key factory and the
shared TypeScript types are **generated** from the exported artifact by
`pnpm gen:api`, so the client cannot drift from the backend — there is no
hand-written copy left to disagree. The two contract tests are kept as a
belt-and-braces check that the generated files and the committed artifact are
still in step.

| Route | Returns | Generated client route |
| --- | --- | --- |
| `DELETE /files-by-key` | `DeleteFileResponse` | `fileByKeyDelete` |
| `DELETE /files/{key}` | `DeleteFileResponse` | `legacyFileDelete` |
| `DELETE /rollouts/{rollout_id}` | `RolloutDeleteResult` | `rolloutDelete` |
| `GET /files` | `FileMetadata[]` | `files` |
| `GET /files-by-key/detail` | `FileMetadataDetail` | `fileByKeyDetail` |
| `GET /files-by-key/download` | `FileUrlResponse` | `fileByKeyDownload` |
| `GET /files-by-key/metadata` | `FileMetadata` | `fileByKeyMetadata` |
| `GET /files-by-key/preview` | `FileUrlResponse` | `fileByKeyPreview` |
| `GET /files/{key}` | `FileMetadata` | `legacyFileMetadata` |
| `GET /files/{key}/download` | `FileUrlResponse` | `legacyFileDownload` |
| `GET /files/{key}/preview` | `FileUrlResponse` | `legacyFilePreview` |
| `GET /files/stats` | `UploadStats` | `fileStats` |
| `GET /files/stats/activity` | `DailyUploadCount[]` | `uploadActivity` |
| `GET /health` | `HealthStatus` | `health` |
| `GET /metrics` | — | _server-only_ |
| `GET /rollouts` | `RolloutList` | `rollouts` |
| `GET /rollouts/{rollout_id}` | `RolloutDetail` | `rolloutDetail` |
| `GET /rollouts/{rollout_id}/episodes` | `EpisodeList` | `rolloutEpisodes` |
| `GET /rollouts/{rollout_id}/episodes/{episode_id}/assets` | `EpisodeAssets` | `episodeAssets` |
| `PATCH /rollouts/{rollout_id}` | `Rollout` | `rolloutUpdate` |
| `POST /rollouts` | `Rollout` | `rolloutCreate` |
| `POST /rollouts/{rollout_id}/run` | `RolloutRunResult` | `rolloutRun` |
<!-- gen:end arch-api-contract -->

## Canonical Files

<!-- gen:begin arch-canonical-files -->
Hand-written — this is the file to edit:

- Layered API handler: `services/api/app/runtime/`
- Service orchestration: `services/api/app/service/`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Pydantic models: `services/api/app/types/` (`base.py` carries the response-model config)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- OpenAPI exporter: `services/api/scripts/export_openapi.py`
- Frontend API client — error policy, transport, fallback: `apps/web/src/lib/api-client.ts`
- Frontend data layer — caching, invalidation, polling: `apps/web/src/lib/queries.ts`
- Shared type barrel: `packages/shared/src/types.ts`
- Generator policy: `scripts/gen/api-gen.config.json`
- Sample manifest behind the generated docs: `docs/exec-plans/sample.json`

Generated — **never hand-edit**; change the source and re-run the command:

- `docs/api/openapi.json` — `pnpm contract:export` (source: the routers and models)
- `packages/shared/src/generated/api-types.ts` — `pnpm gen:api`
- `apps/web/src/lib/generated/api-routes.ts` — `pnpm gen:api`
- `apps/web/src/lib/generated/query-keys.ts` — `pnpm gen:api`
- The marker-delimited regions of this file, `AGENTS.md`, `README.md` and the 2 `infra/` runbooks — `pnpm gen:docs`
<!-- gen:end arch-canonical-files -->

## Core Features

<!-- gen:begin arch-core-features -->
- [Rollout Configuration](docs/features/rollout-configuration.md) — create, edit, list and delete rollout jobs (environment, episode count, resolution, camera, policy)
- [Policy Rollout & Rendering](docs/features/policy-rollout.md) — MuJoCo Playground rolls out a policy, records state/action/reward, and renders each episode to MP4 — runs locally, CPU by default
- [B2 Dataset Write](docs/features/b2-dataset-write.md) — per episode: MP4 + state/action/reward .npy + summary JSON streamed to B2
- [Dataset Explorer](docs/features/dataset-explorer.md) — browse rollouts and episodes, play rendered video and download trajectory arrays via presigned URLs
- [Bucket Explorer](docs/features/file-browser.md) — browse the full B2 bucket: list, preview, download, delete
- [Dashboard](docs/features/dashboard.md) — rollout and episode stats, cumulative reward, storage used, recent rollouts
<!-- gen:end arch-core-features -->

## References

<!-- gen:begin arch-references -->
- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
- [infra/vercel/README.md](infra/vercel/README.md) — Vercel deployment contract
- [infra/railway/README.md](infra/railway/README.md) — Railway delivery contract
<!-- gen:end arch-references -->
