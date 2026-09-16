// GENERATED FILE — DO NOT EDIT.
//
// Written by `pnpm gen:api` from:
//   docs/api/openapi.json
//
// Hand edits are discarded by the next `pnpm gen:api`. `pnpm gen:check`
// (part of `pnpm verify:web`) fails while this file disagrees with the
// contract. To change what is here, change the FastAPI route or Pydantic
// model and re-run `pnpm contract:export && pnpm gen:api`.

/** One day's upload count, for the dashboard activity chart. */
export interface DailyUploadCount {
  date: string;
  uploads: number;
}

/** Acknowledgement that one object was removed from the bucket. */
export interface DeleteFileResponse {
  deleted: boolean;
  key: string;
}

/** One rendered episode plus fresh presigned URLs for its artifacts. */
export interface Episode {
  /** Presigned GET for action.npy. */
  action_url: string | null;
  episode_id: string;
  /** Number of simulation steps in the episode. */
  length: number;
  /** SHA-256 of the policy checkpoint, or null for the random policy. */
  policy_checkpoint_hash: string | null;
  /** Presigned GET for reward.npy. */
  reward_url: string | null;
  /** Presigned GET for state.npy. */
  state_url: string | null;
  success: boolean;
  /** Presigned GET for summary.json. */
  summary_url: string | null;
  total_reward: number;
  /** Presigned GET for the rendered MP4 (or PNG-sequence ZIP). */
  video_url: string | null;
}

/** Freshly minted presigned GET URLs for one episode's artifacts. */
export interface EpisodeAssets {
  action_url: string | null;
  reward_url: string | null;
  state_url: string | null;
  summary_url: string | null;
  video_url: string | null;
}

/** Every episode belonging to a rollout. */
export interface EpisodeList {
  episodes: Episode[];
}

/** One stored object as the file list and the by-key metadata route see it. */
export interface FileMetadata {
  content_type: string;
  filename: string;
  folder: string;
  key: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
  /**
   * Public object URL, set only when B2_PUBLIC_URL_BASE is configured and
   * the bucket is public. Null otherwise — the UI asks for a presigned URL
   * instead.
   */
  url: string | null;
}

/** Rich metadata recomputed on demand by re-reading the stored object. */
export interface FileMetadataDetail {
  /** Audio/video: bits per second. */
  bitrate: number | null;
  /** Audio/video: codec name. */
  codec: string | null;
  /** Audio/video: duration in seconds. */
  duration_seconds: number | null;
  /**
   * Image-specific: EXIF tags, values stringified. Null for non-images or
   * when no EXIF block was present.
   */
  exif: Record<string, string> | null;
  extension: string;
  filename: string;
  /** Image-specific: pixel height. Null for non-images. */
  image_height: number | null;
  /** Image-specific: pixel width. Null for non-images. */
  image_width: number | null;
  md5: string;
  /**
   * Set when a format-specific extractor was skipped or failed (e.g. an
   * image above Pillow's decompression-bomb limit). The core fields are
   * always exact, so the UI shows this instead of silently dropping the
   * Image / PDF section.
   */
  metadata_warning: string | null;
  mime_type: string;
  /** PDF-specific: author. */
  pdf_author: string | null;
  /** PDF-specific: page count. Null for non-PDFs. */
  pdf_pages: number | null;
  /** PDF-specific: title. */
  pdf_title: string | null;
  sha256: string;
  size_bytes: number;
  size_human: string;
  uploaded_at: string;
}

/** A short-lived presigned GET for downloading or previewing one object. */
export interface FileUrlResponse {
  /**
   * Presigned GET URL. Download URLs force an attachment disposition;
   * preview URLs are signed inline so a PDF renders in place.
   */
  url: string;
}

export interface HTTPValidationError {
  detail?: ValidationError[];
}

/**
 * Liveness plus B2 reachability. The route answers HTTP 200 even when B2
 * is unreachable, so a caller must read `b2_connected` rather than
 * trusting the status code.
 */
export interface HealthStatus {
  /** True when the bucket answered a cheap head request. */
  b2_connected: boolean;
  /** "healthy" when B2 answered, else "degraded". */
  status: string;
}

/** A configured rollout job and its run status. */
export interface Rollout {
  camera: string;
  /**
   * B2 key of an uploaded policy checkpoint; null for the built-in random
   * policy.
   */
  checkpoint_key: string | null;
  created_at: string;
  /** MuJoCo Playground environment name, e.g. CartpoleBalance. */
  environment: string;
  episode_count: number;
  /** Episodes rendered and written to B2 so far. */
  episode_count_done: number;
  id: string;
  /** B2 prefix under which this rollout's artifacts live. */
  key_prefix: string;
  name: string;
  output_format: string;
  policy: string;
  resolution: string;
  seed: number;
  status: string;
  /** Cumulative reward summed across every rendered episode. */
  total_reward: number;
}

/**
 * New-rollout request. Finite fields default to the small, fast demo
 * preset.
 */
export interface RolloutCreate {
  camera?: string;
  checkpoint_key?: string | null;
  environment?: string;
  episode_count?: number;
  name: string;
  output_format?: string;
  policy?: string;
  resolution?: string;
  seed?: number;
}

/** Acknowledgement that a rollout and all its B2 artifacts were removed. */
export interface RolloutDeleteResult {
  deleted: boolean;
  id: string;
  /** Number of B2 objects removed under the rollout prefix. */
  objects_deleted: number;
}

/** A rollout with its episodes expanded. */
export interface RolloutDetail {
  episodes: Episode[];
  rollout: Rollout;
}

/** A page of rollouts, newest first. */
export interface RolloutList {
  /** Opaque continuation token; null when there are no more rollouts. */
  cursor: string | null;
  rollouts: Rollout[];
}

/** Optional per-run overrides for `POST /rollouts/{id}/run`. */
export interface RolloutRunRequest {
  episode_count?: number | null;
  seed?: number | null;
}

/**
 * The outcome of a rollout run: the updated rollout and its new episodes.
 * `status` is `complete` when every episode rendered and streamed to B2,
 * or `failed` when the run could not run (e.g. the MuJoCo engine is not
 * installed on this host — the app persists the failure rather than
 * returning a 500).
 */
export interface RolloutRunResult {
  episodes: Episode[];
  /** Human-readable detail, set on a failed run. */
  message: string | null;
  rollout: Rollout;
  status: string;
}

/** Partial update of a draft rollout's config. Every field is optional. */
export interface RolloutUpdate {
  camera?: string | null;
  checkpoint_key?: string | null;
  environment?: string | null;
  episode_count?: number | null;
  name?: string | null;
  output_format?: string | null;
  policy?: string | null;
  resolution?: string | null;
  seed?: number | null;
}

/** Aggregate bucket figures behind the dashboard stat cards. */
export interface UploadStats {
  total_downloads: number;
  total_files: number;
  total_size_bytes: number;
  total_size_human: string;
  uploads_today: number;
}

export interface ValidationError {
  ctx?: Record<string, unknown>;
  input?: unknown;
  loc: (string | number)[];
  msg: string;
  type: string;
}
