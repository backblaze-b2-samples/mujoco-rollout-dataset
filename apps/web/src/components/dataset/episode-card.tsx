"use client";

import { Check, Download, Film, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Episode } from "@mujoco-rollout-dataset/shared";

function DownloadLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <Button asChild variant="outline" size="sm" className="h-7">
      <a href={url} download>
        <Download className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}

/**
 * One rendered episode: the video (MP4 plays inline; a PNG-sequence ZIP is a
 * download), the run metrics, and presigned downloads for the trajectory
 * arrays and summary JSON. The URLs are short-lived presigned GETs the browser
 * fetches straight from B2.
 */
export function EpisodeCard({ episode }: { episode: Episode }) {
  const isVideo = !!episode.video_url && episode.video_url.includes(".mp4");

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted/40">
          {isVideo ? (
            <video
              controls
              loop
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              src={episode.video_url ?? undefined}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Film className="h-6 w-6" />
              <span className="text-xs">
                {episode.video_url ? "PNG sequence — download to view" : "No render available"}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{episode.episode_id}</span>
            {episode.success ? (
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" />
                success
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <X className="h-3 w-3" />
                no success flag
              </Badge>
            )}
          </div>
          <div className="flex gap-4 font-mono text-xs text-muted-foreground tabular-nums">
            <span>reward {episode.total_reward.toFixed(2)}</span>
            <span>{episode.length} steps</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isVideo && episode.video_url && <DownloadLink url={episode.video_url} label="frames.zip" />}
          <DownloadLink url={episode.state_url} label="state.npy" />
          <DownloadLink url={episode.action_url} label="action.npy" />
          <DownloadLink url={episode.reward_url} label="reward.npy" />
          <DownloadLink url={episode.summary_url} label="summary.json" />
        </div>
      </CardContent>
    </Card>
  );
}
