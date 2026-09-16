"use client";

import Link from "next/link";
import { ArrowRight, Bot } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function RecentRolloutsTable() {
  const { data, isLoading, error, refetch } = useRollouts();
  const rollouts = (data?.rollouts ?? []).slice(0, 6);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent Rollouts</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/rollouts"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : rollouts.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No rollouts yet"
            description="Create a rollout to get started."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[36%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="w-[20%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Environment
                </TableHead>
                <TableHead className="w-[16%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="w-[28%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                      className="block truncate rounded-sm underline-offset-4 hover:underline"
                      title={rollout.name}
                    >
                      {rollout.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate">
                    {rollout.environment}
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
        )}
      </CardContent>
    </Card>
  );
}
