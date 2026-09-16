// Single source of truth for app identity. Rename here to rebrand a clone of this starter.
export const APP_NAME = "MuJoCo Rollout Dataset";
export const APP_DESCRIPTION =
  "Roll out RL policies in MuJoCo Playground and stream the rendered video and trajectory dataset to Backblaze B2";

/**
 * URL- and storage-safe form of APP_NAME ("My Sample App" -> "my-sample-app").
 * Derived, never declared a second time: anything that needs an app-namespaced
 * identifier (a `localStorage` key, a cache prefix) builds on this, so a
 * rebrand cannot leave one stale copy behind for a grep to miss.
 */
export const APP_SLUG = APP_NAME.toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
