/**
 * Illustrative "rollout preferences" for the settings page.
 *
 * These controls are a deliberate DEMO of client-side persistence. They record
 * the environment, resolution and episode count you'd like the New-rollout form
 * to start from — but the kit does not yet read them back into that form, so
 * they change no behaviour on their own. The Settings page says so in a banner,
 * and this module persists the values to `localStorage` only: a faithful demo
 * of the persistence you would later wire into your own preferences API.
 *
 * The one preference the app genuinely honours — Theme — is NOT here; it is
 * owned by `next-themes` (see `theme-preference.ts`) and applied for real.
 */

import { APP_SLUG } from "@/lib/app-config";
import { ENVIRONMENTS, RESOLUTIONS } from "@/lib/rollout-options";

export type DemoResolution = (typeof RESOLUTIONS)[number];

export interface DemoPreferences {
  defaultEnvironment: string;
  defaultResolution: DemoResolution;
  /** Kept as a string to match the numeric `<input>` the form binds to. */
  defaultEpisodeCount: string;
  notifyOnComplete: boolean;
}

export const DEMO_PREFERENCES_DEFAULTS: DemoPreferences = {
  defaultEnvironment: "CartpoleBalance",
  defaultResolution: "240p",
  defaultEpisodeCount: "2",
  notifyOnComplete: true,
};

/** Namespaced by app slug so two of these apps on one origin cannot collide. */
export const DEMO_PREFERENCES_STORAGE_KEY = `${APP_SLUG}-demo-preferences`;

function isEnvironment(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ENVIRONMENTS.some((env) => env.value === value)
  );
}

function isResolution(value: unknown): value is DemoResolution {
  return typeof value === "string" && (RESOLUTIONS as readonly string[]).includes(value);
}

/**
 * Read the stored demo preferences, tolerating a missing, corrupt, or partial
 * blob by falling back to the defaults field by field. SSR-safe: returns the
 * defaults when there is no `window`.
 */
export function loadDemoPreferences(): DemoPreferences {
  if (typeof window === "undefined") return { ...DEMO_PREFERENCES_DEFAULTS };

  let stored: unknown;
  try {
    const raw = window.localStorage.getItem(DEMO_PREFERENCES_STORAGE_KEY);
    if (!raw) return { ...DEMO_PREFERENCES_DEFAULTS };
    stored = JSON.parse(raw);
  } catch {
    return { ...DEMO_PREFERENCES_DEFAULTS };
  }
  if (typeof stored !== "object" || stored === null) {
    return { ...DEMO_PREFERENCES_DEFAULTS };
  }

  const s = stored as Record<string, unknown>;
  return {
    defaultEnvironment: isEnvironment(s.defaultEnvironment)
      ? s.defaultEnvironment
      : DEMO_PREFERENCES_DEFAULTS.defaultEnvironment,
    defaultResolution: isResolution(s.defaultResolution)
      ? s.defaultResolution
      : DEMO_PREFERENCES_DEFAULTS.defaultResolution,
    defaultEpisodeCount:
      typeof s.defaultEpisodeCount === "string"
        ? s.defaultEpisodeCount
        : DEMO_PREFERENCES_DEFAULTS.defaultEpisodeCount,
    notifyOnComplete:
      typeof s.notifyOnComplete === "boolean"
        ? s.notifyOnComplete
        : DEMO_PREFERENCES_DEFAULTS.notifyOnComplete,
  };
}

/**
 * Persist the demo preferences to `localStorage`. Returns `false` when there is
 * no `window` or storage is blocked (private mode / quota), so the caller can
 * report the failure honestly rather than claiming a save that did not happen.
 */
export function saveDemoPreferences(values: DemoPreferences): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(DEMO_PREFERENCES_STORAGE_KEY, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}
