<!-- last_verified: 2026-09-16 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance overview of rollout activity and the dataset streamed to B2.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /rollouts`, `GET /files/stats`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — four stat cards (total rollouts, episodes rendered, cumulative reward, B2 storage used)
- `apps/web/src/components/dashboard/recent-rollouts-table.tsx` — the six most recent rollouts, each a link to its detail page
- `apps/web/src/components/dashboard/episodes-chart.tsx` — episodes rendered per day over the last week
- `apps/web/src/lib/queries.ts` — `useRollouts()`, `useFileStats()`
- `services/api/app/service/rollout.py` — `list_rollouts()` (the aggregate source)
- `services/api/app/repo/list_cache.py` — the shared bucket listing behind `GET /files/stats`

## Canonical Files
- Stat cards: `apps/web/src/components/dashboard/stats-cards.tsx`

## Inputs
- None (the dashboard loads its data automatically)

## Outputs
- `GET /rollouts` → `RolloutList`, aggregated client-side into rollout count, episode count and cumulative reward
- `GET /files/stats` → `UploadStats` for total B2 storage used

## Flow
- Page loads → `useRollouts` and `useFileStats` fetch in parallel
- Stat cards show total rollouts, episodes rendered, cumulative reward and B2 storage used
- The chart buckets each rollout's rendered episodes by creation day over the last 7 days
- The recent-rollouts table shows the six newest rollouts (name, environment, status, created), each linking to its detail page

## Edge Cases
- API unavailable → `ErrorState` with retry; the chart does not show a false zero while loading
- No rollouts yet → empty chart and table messages
- Bucket changed elsewhere → storage figure can lag by up to `LIST_CACHE_TTL_SECONDS`; the app's own writes invalidate the cache

## UX States
- Loading: a "Loading rollout stats…" notice above skeleton cards, plus chart/table skeletons
- Empty: "No rollouts yet" / "No episodes yet"
- Loaded: populated cards, chart and table

## Verification
- Test files: `services/api/tests/test_rollouts.py`, `apps/web/src/lib/queries.test.ts`
- Required cases: aggregates over several rollouts, empty state, API error fallback
- Focused verify command: `pnpm test:web`
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
