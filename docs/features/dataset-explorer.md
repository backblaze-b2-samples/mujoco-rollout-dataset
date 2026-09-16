<!-- last_verified: 2026-09-16 -->
# Feature: Dataset Explorer

## Purpose
Browse the rendered dataset — scoped to this app's own `rollouts/` prefix —
playing each episode's video inline and downloading its trajectory arrays via
presigned B2 URLs. It complements (never replaces) the full-bucket explorer.

## Used By
- UI: `/dataset`
- API: `GET /rollouts`, `GET /rollouts/{id}/episodes`, `GET /rollouts/{id}/episodes/{episode_id}/assets`

## Core Functions
- `apps/web/src/app/dataset/page.tsx` — rollout picker + episode grid
- `apps/web/src/components/dataset/episode-card.tsx` — inline `<video>` player + trajectory downloads (shared with the rollout detail page)
- `services/api/app/service/rollout.py` — `get_episodes`, `get_episode_assets` (mint fresh presigned GET URLs)
- `services/api/app/repo/rollout_store.py` — `presign_get`, `list_episode_ids`

## Canonical Files
- Player + downloads: `apps/web/src/components/dataset/episode-card.tsx`

## Inputs
- A selected rollout id (from the rollout picker)

## Outputs
- `EpisodeList` / `EpisodeAssets` carrying short-lived presigned GET URLs for the MP4, the three `.npy` arrays and `summary.json`

## Flow
- The page lists rollouts that have rendered episodes (`episode_count_done > 0`)
- Selecting one fetches its episodes; each `EpisodeCard` plays the MP4 inline (signed `Content-Disposition: inline`) or offers the PNG-sequence ZIP as a download
- Each array and the summary JSON is a presigned download button — the bytes are fetched straight from B2, never proxied through the API

## Edge Cases
- No rendered episodes yet → empty state pointing at `/rollouts`
- A PNG-sequence episode → the video pane shows a "download to view" placeholder
- A missing asset → its download button is omitted (the presigned URL is null)

## UX States
- Loading: skeletons for the episode cards
- Empty: "No rendered episodes yet"
- Error: inline `ErrorState` with Retry

## Verification
- Test files: `services/api/tests/test_rollouts.py` (episode listing exercised via the run test)
- Required cases: episodes list with presigned URLs after a run; empty dataset before any run
- Focused verify command: `pnpm test:api`
- Pass criteria: focused tests and `pnpm verify` green; after a real run, videos play inline and arrays download

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
