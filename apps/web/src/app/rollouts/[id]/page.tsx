"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/rollouts/status-badge";
import { RolloutForm } from "@/components/rollouts/rollout-form";
import { EpisodeCard } from "@/components/dataset/episode-card";
import { useDeleteRollout, useRollout, useRunRollout, useUpdateRollout } from "@/lib/queries";
import type { Rollout, RolloutCreate } from "@mujoco-rollout-dataset/shared";

function ConfigRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function RolloutDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, error, refetch } = useRollout(id);
  const runRollout = useRunRollout(id);
  const updateRollout = useUpdateRollout(id);
  const deleteRollout = useDeleteRollout();

  const rollout: Rollout | undefined = data?.rollout;
  const episodes = data?.episodes ?? [];
  const editable = rollout?.status === "draft" || rollout?.status === "failed";

  const handleRun = () => {
    runRollout.mutate(undefined, {
      onSuccess: (result) => {
        if (result.status === "complete") {
          toast.success(`Rendered ${result.episodes.length} episode(s) to B2`);
        } else {
          toast.error("Rollout failed", { description: result.message ?? "See the API logs." });
        }
      },
      onError: (err) => toast.error("Run failed", { description: err.message }),
    });
  };

  const handleEdit = (payload: RolloutCreate) => {
    updateRollout.mutate(payload, {
      onSuccess: () => {
        setEditOpen(false);
        toast.success("Rollout updated");
      },
      onError: (err) => toast.error("Update failed", { description: err.message }),
    });
  };

  const handleDelete = () => {
    deleteRollout.mutate(id, {
      onSuccess: (result) => {
        toast.success("Rollout deleted", {
          description: `${result.objects_deleted} B2 object(s) removed.`,
        });
        router.push("/rollouts");
      },
      onError: (err) => toast.error("Delete failed", { description: err.message }),
    });
  };

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <Link
          href="/rollouts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All rollouts
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !rollout ? (
        <EmptyState title="Rollout not found" />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="page-title">{rollout.name}</h1>
                <StatusBadge status={rollout.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {rollout.environment} · {rollout.episode_count_done}/{rollout.episode_count} episodes
                rendered
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleRun} disabled={runRollout.isPending}>
                {runRollout.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {runRollout.isPending ? "Rendering..." : "Run"}
              </Button>
              {editable && (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Edit rollout</DialogTitle>
                    </DialogHeader>
                    <RolloutForm
                      mode="edit"
                      initial={rollout}
                      pending={updateRollout.isPending}
                      onSubmit={handleEdit}
                    />
                  </DialogContent>
                </Dialog>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this rollout?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the rollout config and every episode artifact under
                      its B2 prefix ({rollout.key_prefix}). This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader className="border-b border-border py-4 px-5">
                <CardTitle className="card-title">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-2">
                <dl>
                  <ConfigRow label="Environment" value={rollout.environment} />
                  <ConfigRow label="Episodes" value={rollout.episode_count} />
                  <ConfigRow label="Resolution" value={rollout.resolution} />
                  <ConfigRow label="Camera" value={rollout.camera} />
                  <ConfigRow label="Output" value={rollout.output_format} />
                  <ConfigRow label="Policy" value={rollout.policy} />
                  <ConfigRow label="Seed" value={rollout.seed} />
                  <ConfigRow label="Cumulative reward" value={rollout.total_reward.toFixed(2)} />
                  <ConfigRow label="B2 prefix" value={rollout.key_prefix} />
                </dl>
              </CardContent>
            </Card>

            <div className="space-y-4 lg:col-span-2">
              <h2 className="card-title">Episodes</h2>
              {episodes.length === 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <EmptyState
                      icon={Play}
                      title="No episodes yet"
                      description="Press Run to roll out the policy and render episodes to B2."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {episodes.map((episode) => (
                    <EpisodeCard key={episode.episode_id} episode={episode} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
