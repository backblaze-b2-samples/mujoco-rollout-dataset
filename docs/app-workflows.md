<!-- last_verified: 2026-09-16 -->
# App Workflows

User journeys inside the application.

## Configure a Rollout

- User navigates to `/rollouts` and presses **New rollout**
- A dialog opens the shared rollout form. Finite-value fields are selectors, never free text: environment, resolution and camera are `Select`s; output format and policy are `RadioGroup`s; episode count and seed are numeric inputs
- The create form's safe defaults are surfaced as placeholder / description guidance (never an autofill button): CartpoleBalance, 2 episodes, 240p, side camera, MP4, random policy, seed 0 — a run that needs no downloaded checkpoint and no second key
- On submit the config JSON is written to B2 (`rollouts/<id>/config.json`) and the user lands on the rollout's detail page
- On the detail page the user can **Run** the rollout, **Edit** it (only while `draft` or `failed` — the form opens pre-filled), or **Delete** it. Delete asks for confirmation and then sweeps every artifact under the rollout's prefix, reporting how many B2 objects were removed
- See: [Rollout Configuration](features/rollout-configuration.md)

## Explore the Dataset

- User navigates to `/dataset`
- A picker lists the rollouts that already have rendered episodes (scoped to this app's `rollouts/` prefix); the first is selected by default
- Each episode renders as a card: the MP4 plays inline (the URL is signed with `Content-Disposition: inline`), or a PNG-sequence episode shows a "download to view" placeholder with the frame ZIP
- Below the video, the episode's metrics (total reward, step count, success flag) and a row of presigned download buttons for `state.npy`, `action.npy`, `reward.npy` and `summary.json` — the bytes stream straight from B2, never through the API
- Empty state (no rendered episodes yet) points the user at `/rollouts`
- See: [Dataset Explorer](features/dataset-explorer.md)

## Browse the Bucket

- User navigates to `/files`
- Page loads the 100 most recent objects from the API (sorted most recent first) — including every rollout artifact. While it loads, the page says so on screen and escalates the wording if the wait runs long — a full bucket listing measured 2.8s-21s cold
- If that limit was hit, a notice states how many objects the bucket actually holds — the page never claims to show everything
- Files are displayed in a tree view with folders and type-specific icons; folders auto-expand until the *majority* of listed files are reachable without clicking, so the page's own "click a file" instruction is always actionable
- Arriving at `/files?preview=<key>` expands that file's folders and opens its preview directly — how the ⌘K palette and the dashboard's recent-rollouts rows hand off a specific file
- **Preview**: opens a dialog with an image/PDF/video preview + a metadata panel (checksums, size, type), plus the file's Download / Delete actions
- **Download**: shows a pending state and a toast while the presigned URL is fetched, then starts the download via an anchor click
- **Delete**: the confirmation dialog stays open showing "Deleting..." until the request settles, then the row disappears with the toast and the list reconciles with the server
- Empty bucket shows a prompt to run a rollout (rollouts are what populate the bucket)
- See: [Bucket Explorer](features/file-browser.md)

## View Dashboard

- User navigates to `/` (home)
- `useRollouts` and `useFileStats` load in parallel; while stats load, the page states it in words above the cards rather than showing silent skeletons
- Stat cards show total rollouts, episodes rendered, cumulative reward and B2 storage used
- The chart buckets each rollout's rendered episodes by creation day over the last 7 days
- The recent-rollouts table shows the six newest rollouts (name, environment, status, created); each name links to that rollout's detail page
- Empty state: "No rollouts yet" messages
- See: [Dashboard](features/dashboard.md)
