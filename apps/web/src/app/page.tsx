import Link from "next/link";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentRolloutsTable } from "@/components/dashboard/recent-rollouts-table";
import { EpisodesChart } from "@/components/dashboard/episodes-chart";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            MuJoCo Playground rollouts and the dataset streamed to your Backblaze B2 bucket.
          </p>
        </div>
        <Button asChild size="sm" className="h-8">
          <Link href="/rollouts">
            <Bot className="h-3.5 w-3.5" />
            New rollout
          </Link>
        </Button>
      </div>
      <StatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="animate-fade-in-up stagger-3">
          <EpisodesChart />
        </div>
        <div className="animate-fade-in-up stagger-4">
          <RecentRolloutsTable />
        </div>
      </div>
    </div>
  );
}
