"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/rollouts/status-badge";
import { useRollouts } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export function RolloutsTable() {
  const { data, isLoading, error, refetch } = useRollouts();
  const rollouts = data?.rollouts ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  if (rollouts.length === 0) {
    return (
      <EmptyState
        icon={Bot}
        title="No rollouts yet"
        description="Create a rollout to roll out a MuJoCo Playground policy and stream its dataset to B2."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Name
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Environment
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Episodes
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reward
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Created
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rollouts.map((rollout) => (
          <TableRow key={rollout.id} className="table-row-hover">
            <TableCell className="font-medium">
              <Link
                href={`/rollouts/${rollout.id}`}
                className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {rollout.name}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{rollout.environment}</TableCell>
            <TableCell className="font-mono text-xs tabular-nums">
              {rollout.episode_count_done}/{rollout.episode_count}
            </TableCell>
            <TableCell className="font-mono text-xs tabular-nums">
              {rollout.total_reward.toFixed(2)}
            </TableCell>
            <TableCell>
              <StatusBadge status={rollout.status} />
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
              {formatDate(rollout.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
