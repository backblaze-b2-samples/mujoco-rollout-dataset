/**
 * Curated option lists and the small, fast default preset for a rollout.
 *
 * Finite-value config fields are rendered as selectors (never free text) from
 * these lists — see `components/rollouts/rollout-form.tsx`. The values mirror
 * the `Literal` types on the Pydantic models, so the contract and the UI agree.
 */

/** A handful of MuJoCo Playground environments spanning control, locomotion and manipulation. */
export const ENVIRONMENTS = [
  { value: "CartpoleBalance", label: "Cartpole Balance (small & fast)" },
  { value: "AntRun", label: "Ant Run (locomotion)" },
  { value: "Go1JoystickFlatTerrain", label: "Go1 Joystick — Flat Terrain (quadruped)" },
  { value: "PandaPickCube", label: "Panda Pick Cube (manipulation)" },
  { value: "HumanoidWalk", label: "Humanoid Walk (locomotion)" },
] as const;

export const RESOLUTIONS = ["240p", "480p", "720p"] as const;
export const CAMERAS = ["side", "track", "front"] as const;
export const OUTPUT_FORMATS = ["mp4", "png_sequence"] as const;
export const POLICIES = ["random", "checkpoint"] as const;

export type Resolution = (typeof RESOLUTIONS)[number];
export type Camera = (typeof CAMERAS)[number];
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type Policy = (typeof POLICIES)[number];

/**
 * Safe demo defaults, surfaced as placeholder / description guidance on the
 * create form (never an autofill button). CartpoleBalance with two short
 * episodes needs no downloaded checkpoint and no external key.
 */
export const ROLLOUT_DEFAULTS = {
  environment: "CartpoleBalance",
  episode_count: 2,
  resolution: "240p" as Resolution,
  camera: "side" as Camera,
  output_format: "mp4" as OutputFormat,
  policy: "random" as Policy,
  seed: 0,
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
};
