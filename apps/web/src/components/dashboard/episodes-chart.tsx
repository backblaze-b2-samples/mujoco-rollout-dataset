"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useRollouts } from "@/lib/queries";

const chartConfig = {
  episodes: {
    label: "Episodes",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const DAYS = 7;

/** Episodes rendered per calendar day over the last week, bucketed by the
 *  rollout's creation date. */
export function EpisodesChart() {
  const { data, isLoading, error, refetch } = useRollouts();

  const chartData = useMemo(() => {
    const rollouts = data?.rollouts ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: { key: string; label: string; episodes: number }[] = [];
    for (let i = DAYS - 1; i >= 0; i -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      buckets.push({
        key: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        episodes: 0,
      });
    }

    const index = new Map(buckets.map((b) => [b.key, b]));
    for (const rollout of rollouts) {
      const key = new Date(rollout.created_at).toISOString().slice(0, 10);
      const bucket = index.get(key);
      if (bucket) bucket.episodes += rollout.episode_count_done;
    }
    return buckets;
  }, [data]);

  const total = chartData.reduce((sum, d) => sum + d.episodes, 0);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Episodes Rendered</CardTitle>
        <CardDescription className="text-xs">Last 7 days</CardDescription>
        <CardAction className="text-right self-center">
          {isLoading ? (
            <div aria-hidden className="space-y-1">
              <Skeleton className="ml-auto h-2.5 w-10" />
              <Skeleton className="ml-auto h-6 w-12" />
            </div>
          ) : (
            <>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total
              </div>
              <div className="text-lg font-semibold tabular-nums tracking-tight leading-tight">
                {total}
              </div>
            </>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : total === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No episodes yet"
            description="Run a rollout to see episodes rendered over time."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="episodes-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-episodes)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-episodes)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                width={28}
              />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="episodes"
                fill="url(#episodes-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
