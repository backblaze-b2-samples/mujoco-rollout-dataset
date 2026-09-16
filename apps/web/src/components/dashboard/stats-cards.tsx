"use client";

import { Bot, Film, HardDrive, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingNotice } from "@/components/common/loading-notice";
import { useFileStats, useRollouts } from "@/lib/queries";

export function StatsCards() {
  const rolloutsQuery = useRollouts();
  const statsQuery = useFileStats();

  // The bucket-stats error is the load-bearing one (a full listing failed);
  // surface it inline rather than lying with zeroes.
  if (statsQuery.error) {
    return (
      <Card>
        <CardContent className="p-0">
          <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
        </CardContent>
      </Card>
    );
  }

  const rollouts = rolloutsQuery.data?.rollouts ?? [];
  const totalEpisodes = rollouts.reduce((sum, r) => sum + r.episode_count_done, 0);
  const cumulativeReward = rollouts.reduce((sum, r) => sum + r.total_reward, 0);
  const isLoading = rolloutsQuery.isLoading || statsQuery.isLoading;

  const cards = [
    { title: "Total Rollouts", value: rollouts.length, icon: Bot },
    { title: "Episodes Rendered", value: totalEpisodes, icon: Film },
    { title: "Cumulative Reward", value: cumulativeReward.toFixed(2), icon: Trophy },
    { title: "B2 Storage Used", value: statsQuery.data?.total_size_human ?? "0 B", icon: HardDrive },
  ];

  return (
    <>
      {isLoading && <LoadingNotice className="mb-3" subject="rollout stats" />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card key={card.title} className={`card-hover animate-fade-in-up stagger-${i + 1}`}>
            <CardHeader className="flex flex-row items-center justify-between pt-4 pb-2 px-4 space-y-0">
              <CardTitle className="text-xs font-semibold text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className="stat-icon-wrap">
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="pb-5 px-4">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="stat-value">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
