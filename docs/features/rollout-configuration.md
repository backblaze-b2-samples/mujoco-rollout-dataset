<!-- last_verified: 2026-09-16 -->
# Feature: Rollout Configuration

## Purpose
Create, edit, list and delete rollout jobs — the primary entity — whose config
JSON is the single source of truth for what `Run` will render.

## Used By
- UI: `/rollouts` (list + "New rollout" dialog), `/rollouts/[id]` (detail, edit, delete)
- API: `GET/POST /rollouts`, `GET/PATCH/DELETE /rollouts/{id}`

## Core Functions
- `apps/web/src/components/rollouts/rollout-form.tsx` — shared create/edit form (selectors for finite fields, safe-default hints on create)
- `apps/web/src/components/rollouts/rollouts-table.tsx` — the rollout list
- `apps/web/src/app/rollouts/page.tsx`, `apps/web/src/app/rollouts/[id]/page.tsx` — screens
- `services/api/app/runtime/rollouts.py` — the rollout router
- `services/api/app/service/rollout.py` — `create_rollout`, `list_rollouts`, `update_rollout`, `delete_rollout`
- `services/api/app/repo/rollout_store.py` — B2-backed config CRUD under the `rollouts/` prefix

## Canonical Files
- Form UX exemplar: `apps/web/src/components/rollouts/rollout-form.tsx`
- CRUD service: `services/api/app/service/rollout.py`

## Inputs
- `RolloutCreate`: name, environment, episode_count, resolution, camera, output_format, policy, seed, checkpoint_key (source: New-rollout form)
- `RolloutUpdate`: any subset of the above (source: edit form; draft/failed rollouts only)

## Outputs
- `Rollout` config JSON persisted at `rollouts/<id>/config.json` in B2
- `DELETE` sweeps every object under `rollouts/<id>/` and returns the count removed

## Flow
- User opens `/rollouts`, presses "New rollout", fills the form (defaults roll out CartpoleBalance with the random policy)
- `POST /rollouts` writes the config JSON; the user lands on the detail page
- Edit is allowed only while the rollout is `draft` or `failed` (a `409` otherwise)
- Delete removes the config and every rendered artifact under the rollout's prefix (scoped)

## Edge Cases
- Finite fields (environment, resolution, camera, output_format, policy) are selectors, so an invalid value can't be typed
- Editing a `running`/`complete` rollout → `409 Conflict`
- Unknown rollout id → `404`
- B2 write failure → `502` with an actionable message

## UX States
- Loading: table skeleton rows
- Empty: "No rollouts yet" with a prompt to create one
- Error: inline `ErrorState` with Retry

## Verification
- Test files: `services/api/tests/test_rollouts.py`
- Required cases: create defaults, create/list/get round-trip, edit-only-when-draft (409), scoped delete, missing rollout 404
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
