"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RolloutForm } from "@/components/rollouts/rollout-form";
import { RolloutsTable } from "@/components/rollouts/rollouts-table";
import { useCreateRollout } from "@/lib/queries";
import type { RolloutCreate } from "@mujoco-rollout-dataset/shared";

export default function RolloutsPage() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const createRollout = useCreateRollout();

  const handleCreate = (payload: RolloutCreate) => {
    createRollout.mutate(payload, {
      onSuccess: (rollout) => {
        setOpen(false);
        toast.success("Rollout created", {
          description: "Open it and press Run to render episodes to B2.",
        });
        router.push(`/rollouts/${rollout.id}`);
      },
      onError: (error) => {
        toast.error("Could not create rollout", { description: error.message });
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Rollouts</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Configure MuJoCo Playground rollout jobs. Run one to render episodes and stream the
            dataset to Backblaze B2.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8">
              <Plus className="h-3.5 w-3.5" />
              New rollout
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New rollout</DialogTitle>
              <DialogDescription>
                Pick an environment and a policy. The defaults roll out CartpoleBalance with the
                built-in random policy — no checkpoint or extra key required.
              </DialogDescription>
            </DialogHeader>
            <RolloutForm mode="create" pending={createRollout.isPending} onSubmit={handleCreate} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="animate-fade-in-up stagger-2">
        <CardContent className="p-0">
          <RolloutsTable />
        </CardContent>
      </Card>
    </div>
  );
}
