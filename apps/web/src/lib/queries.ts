"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  ApiError,
  createRollout,
  deleteFile,
  deleteRollout,
  getDownloadUrl,
  getEpisodes,
  getFileDetail,
  getFiles,
  getFileStats,
  getHealth,
  getPreviewUrl,
  getRollout,
  getUploadActivity,
  listRollouts,
  runRollout,
  updateRollout,
} from "@/lib/api-client";
import type {
  EpisodeList,
  FileMetadata,
  FileMetadataDetail,
  FileUrlResponse,
  Rollout,
  RolloutCreate,
  RolloutDeleteResult,
  RolloutDetail,
  RolloutList,
  RolloutRunRequest,
  RolloutRunResult,
  RolloutUpdate,
} from "@mujoco-rollout-dataset/shared";
import { qk } from "@/lib/generated/query-keys";

// Query keys are GENERATED from the API contract (`pnpm gen:api`) and their
// hierarchy is declared in `scripts/gen/api-gen.config.json`, so invalidating
// a parent key still reaches its children and no hook can invent a key the API
// cannot answer. Re-exported here because this module is the data layer's
// public surface: components and tests import `qk` from `@/lib/queries`.
//
// The caching policy below — staleTime, refetchInterval, retry, `enabled`
// gating, the query-vs-mutation choice, and the cache surgery — is hand-written
// on purpose and is never generated. The per-id rollout/episode keys below are
// hand-written too: the generator keys only off query parameters, so a
// path-parameter read (one rollout) needs its id folded into the key here.
export { qk };

/** Nested under qk.all so invalidating qk.all (or `[...qk.all, "rollout"]`) reaches them. */
const rolloutDetailKey = (id: string) => [...qk.all, "rollout", id] as const;
const rolloutEpisodesKey = (id: string) =>
  [...qk.all, "rollout", id, "episodes"] as const;

export type Health = Awaited<ReturnType<typeof getHealth>>;

/**
 * Gate a query on something being open/visible. Deliberately the only option we
 * expose, so callers can't drift the caching policy per call site.
 */
export interface QueryGate {
  enabled?: boolean;
}

// --- bucket explorer + dashboard stats (kept from the starter) -----------

export function useFiles(prefix = "", limit = 100, { enabled = true }: QueryGate = {}) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
    enabled,
  });
}

export function useFileStats({ enabled = true }: QueryGate = {}) {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
    enabled,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g. when the
// dialog opens for a specific file). Short-lived because the URL has a presigned
// expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useFileDetail(key: string | undefined, enabled: boolean) {
  return useQuery<FileMetadataDetail, ApiError>({
    queryKey: qk.detail(key ?? ""),
    queryFn: () => getFileDetail(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

// Health poll for the top-of-app B2 banner. `retry: false` keeps a down API
// silent; the banner only reacts to an up API reporting b2_connected: false.
export function useHealth() {
  return useQuery<Health>({
    queryKey: qk.health(),
    queryFn: getHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}

export function dropDeletedFileFromCache(qc: QueryClient, fileKey: string) {
  qc.setQueriesData<FileMetadata[]>(
    { queryKey: [...qk.all, "files"] },
    (previous) =>
      previous ? previous.filter((file) => file.key !== fileKey) : previous,
  );
  qc.removeQueries({ queryKey: qk.preview(fileKey) });
  qc.removeQueries({ queryKey: qk.detail(fileKey) });
}

/**
 * Fetch a download URL for one file. A mutation, not a query: it has a server
 * side effect (it bumps the download counter) and must never be cached.
 */
export function useDownloadUrl() {
  const qc = useQueryClient();
  return useMutation<FileUrlResponse, ApiError, FileMetadata>({
    mutationFn: (file) => getDownloadUrl(file.key),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.stats() }),
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    onSuccess: (_data, fileKey) => {
      dropDeletedFileFromCache(qc, fileKey);
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- rollouts (the primary entity) ---------------------------------------

export function useRollouts(limit = 50) {
  return useQuery<RolloutList, ApiError>({
    queryKey: qk.rollouts(limit),
    queryFn: () => listRollouts(limit),
  });
}

export function useRollout(id: string | undefined) {
  return useQuery<RolloutDetail, ApiError>({
    queryKey: rolloutDetailKey(id ?? ""),
    queryFn: () => getRollout(id as string),
    enabled: !!id,
    // Self-advance a running rollout to its terminal status without a manual
    // reload: poll while running, stop once complete/failed (or on error).
    refetchInterval: (query) =>
      query.state.data?.rollout.status === "running" ? 3000 : false,
  });
}

export function useEpisodes(id: string | undefined, { enabled = true }: QueryGate = {}) {
  return useQuery<EpisodeList, ApiError>({
    queryKey: rolloutEpisodesKey(id ?? ""),
    queryFn: () => getEpisodes(id as string),
    enabled: enabled && !!id,
  });
}

export function useCreateRollout() {
  const qc = useQueryClient();
  return useMutation<Rollout, ApiError, RolloutCreate>({
    mutationFn: (payload) => createRollout(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...qk.all, "rollouts"] }),
  });
}

export function useUpdateRollout(id: string) {
  const qc = useQueryClient();
  return useMutation<Rollout, ApiError, RolloutUpdate>({
    mutationFn: (patch) => updateRollout(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...qk.all, "rollouts"] });
      qc.invalidateQueries({ queryKey: rolloutDetailKey(id) });
    },
  });
}

export function useDeleteRollout() {
  const qc = useQueryClient();
  return useMutation<RolloutDeleteResult, ApiError, string>({
    mutationFn: (id) => deleteRollout(id),
    // A run/delete changes rollouts, episodes AND bucket stats — reconcile all.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}

export function useRunRollout(id: string) {
  const qc = useQueryClient();
  return useMutation<RolloutRunResult, ApiError, RolloutRunRequest | undefined>({
    mutationFn: (req) => runRollout(id, req ?? {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.all }),
  });
}
