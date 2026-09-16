"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  CAMERAS,
  ENVIRONMENTS,
  OUTPUT_FORMATS,
  POLICIES,
  RESOLUTIONS,
  ROLLOUT_DEFAULTS,
  type Camera,
  type OutputFormat,
  type Policy,
  type Resolution,
} from "@/lib/rollout-options";
import type { RolloutCreate } from "@mujoco-rollout-dataset/shared";

// Finite-value fields are selectors (never free text). episode_count and seed
// are open numeric ranges, so they stay numeric inputs — kept as strings in the
// form (matching the numeric <input>) and converted to numbers on submit, so
// the schema has no transform and the form value type stays stable.
const schema = z.object({
  name: z.string().min(1, "Give this rollout a name").max(120),
  environment: z.string().min(1),
  episode_count: z
    .string()
    .regex(/^\d+$/, "Whole number")
    .refine((v) => {
      const n = Number(v);
      return n >= 1 && n <= 100;
    }, "Between 1 and 100"),
  resolution: z.enum(RESOLUTIONS),
  camera: z.enum(CAMERAS),
  output_format: z.enum(OUTPUT_FORMATS),
  policy: z.enum(POLICIES),
  checkpoint_key: z.string().optional(),
  seed: z.string().regex(/^\d+$/, "Whole number, 0 or greater"),
});

type RolloutFormValues = z.infer<typeof schema>;

export interface RolloutFormProps {
  mode: "create" | "edit";
  initial?: Partial<RolloutCreate>;
  pending?: boolean;
  submitLabel?: string;
  onSubmit: (payload: RolloutCreate) => void;
}

export function RolloutForm({ mode, initial, pending, submitLabel, onSubmit }: RolloutFormProps) {
  const form = useForm<RolloutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      environment: initial?.environment ?? ROLLOUT_DEFAULTS.environment,
      episode_count: String(initial?.episode_count ?? ROLLOUT_DEFAULTS.episode_count),
      resolution: (initial?.resolution ?? ROLLOUT_DEFAULTS.resolution) as Resolution,
      camera: (initial?.camera ?? ROLLOUT_DEFAULTS.camera) as Camera,
      output_format: (initial?.output_format ?? ROLLOUT_DEFAULTS.output_format) as OutputFormat,
      policy: (initial?.policy ?? ROLLOUT_DEFAULTS.policy) as Policy,
      checkpoint_key: initial?.checkpoint_key ?? "",
      seed: String(initial?.seed ?? ROLLOUT_DEFAULTS.seed),
    },
  });

  const isCreate = mode === "create";
  const policy = useWatch({ control: form.control, name: "policy" });

  const submit = (values: RolloutFormValues) => {
    onSubmit({
      name: String(values.name),
      environment: String(values.environment),
      episode_count: Number(values.episode_count),
      resolution: values.resolution,
      camera: values.camera,
      output_format: values.output_format,
      policy: values.policy,
      checkpoint_key:
        values.policy === "checkpoint" && values.checkpoint_key
          ? String(values.checkpoint_key)
          : null,
      seed: Number(values.seed),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. cartpole-baseline" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="environment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Environment</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ENVIRONMENTS.map((env) => (
                    <SelectItem key={env.value} value={env.value}>
                      {env.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCreate && (
                <FormDescription>
                  CartpoleBalance is small and fast — a good first run.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="episode_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Episodes</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={100} placeholder="2" {...field} />
                </FormControl>
                {isCreate && <FormDescription>Start with 2 for a quick demo.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="seed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seed</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="0" {...field} />
                </FormControl>
                {isCreate && <FormDescription>Fixes the episode randomness.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="resolution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resolution</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESOLUTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCreate && <FormDescription>240p renders fastest.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="camera"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Camera</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CAMERAS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCreate && <FormDescription>Falls back to the env default if absent.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="output_format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Output format</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                  {OUTPUT_FORMATS.map((fmt) => (
                    <label key={fmt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value={fmt} />
                      {fmt === "mp4" ? "MP4 video" : "PNG sequence (ZIP)"}
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              {isCreate && <FormDescription>MP4 plays inline in the Dataset explorer.</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="policy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Policy</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6">
                  {POLICIES.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm capitalize cursor-pointer">
                      <RadioGroupItem value={p} />
                      {p}
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              {isCreate && (
                <FormDescription>
                  Random needs no checkpoint and no key — the default demo.
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {policy === "checkpoint" && (
          <FormField
            control={form.control}
            name="checkpoint_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Checkpoint key</FormLabel>
                <FormControl>
                  <Input placeholder="rollouts/<id>/checkpoint/policy.msgpack" {...field} />
                </FormControl>
                <FormDescription>B2 key of an uploaded policy checkpoint.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : (submitLabel ?? (isCreate ? "Create rollout" : "Save changes"))}
          </Button>
        </div>
      </form>
    </Form>
  );
}
