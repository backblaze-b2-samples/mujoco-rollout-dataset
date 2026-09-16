"use client";

import { useState } from "react";
import Link from "next/link";
import { Database } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EpisodeCard } from "@/components/dataset/episode-card";
import { useEpisodes, useRollouts } from "@/lib/queries";

export default function DatasetPage() {
  const { data, isLoading, error, refetch } = useRollouts();
  const rollouts = (data?.rollouts ?? []).filter((r) => r.episode_count_done > 0);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const activeId = selectedId ?? rollouts[0]?.id;
  const episodesQuery = useEpisodes(activeId, { enabled: !!activeId });
  const episodes = episodesQuery.data?.episodes ?? [];

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Dataset</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Browse rendered rollouts scoped to this app&apos;s <code>rollouts/</code> prefix. Play an
          episode inline and download its trajectory arrays — all served by presigned B2 URLs.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rollouts.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Database}
              title="No rendered episodes yet"
              description="Run a rollout to populate the dataset, then it will appear here."
              action={
                <Link href="/rollouts" className="text-sm font-medium text-primary hover:underline">
                  Go to Rollouts
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Rollout</span>
            <Select value={activeId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rollouts.map((rollout) => (
                  <SelectItem key={rollout.id} value={rollout.id}>
                    {rollout.name} · {rollout.environment} ({rollout.episode_count_done} ep)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeId && (
              <Link
                href={`/rollouts/${activeId}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                View rollout
              </Link>
            )}
          </div>

          {episodesQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : episodesQuery.error ? (
            <ErrorState error={episodesQuery.error} onRetry={() => episodesQuery.refetch()} />
          ) : episodes.length === 0 ? (
            <EmptyState title="No episodes in this rollout yet" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {episodes.map((episode) => (
                <EpisodeCard key={episode.episode_id} episode={episode} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
