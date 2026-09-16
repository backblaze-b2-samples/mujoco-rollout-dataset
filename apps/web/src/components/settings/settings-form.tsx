"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { FlaskConical } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { DangerZone } from "./danger-zone";
import { ENVIRONMENTS, RESOLUTIONS } from "@/lib/rollout-options";
import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  normalizeTheme,
} from "@/lib/theme-preference";
import {
  DEMO_PREFERENCES_DEFAULTS,
  loadDemoPreferences,
  saveDemoPreferences,
} from "@/lib/demo-preferences";

// This page is a SHOWCASE. Theme is the one preference the app genuinely
// honours (owned by next-themes, applied for real). The rollout preferences are
// a deliberate DEMO: they show what a preferences page can look like when you
// adapt the kit, without pretending the New-rollout form reads them back yet. A
// banner says so, and the demo values persist to localStorage only.
const settingsSchema = z.object({
  defaultEnvironment: z.string().min(1),
  defaultResolution: z.enum(RESOLUTIONS),
  defaultEpisodeCount: z
    .string()
    .regex(/^\d+$/, "Must be a number")
    .refine((v) => {
      const n = Number(v);
      return n >= 1 && n <= 100;
    }, "Must be between 1 and 100"),
  notifyOnComplete: z.boolean(),
  theme: z.enum(THEME_OPTIONS),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const defaultValues: SettingsValues = {
  ...DEMO_PREFERENCES_DEFAULTS,
  theme: DEFAULT_THEME,
};

export function SettingsForm() {
  const [submitting, setSubmitting] = useState(false);
  // next-themes is the single owner of the theme (it persists it under its own
  // storage key); the radio group is a view onto it, which is why the header
  // toggle and this form always agree.
  const { setTheme, theme } = useTheme();
  const hydratedRef = useRef(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  });

  // Hydrate once, after next-themes has resolved the active theme on the client.
  useEffect(() => {
    if (hydratedRef.current || theme === undefined) return;
    hydratedRef.current = true;
    form.reset({
      ...loadDemoPreferences(),
      theme: normalizeTheme(theme),
    });
  }, [form, theme]);

  const onSubmit = async (values: SettingsValues) => {
    setSubmitting(true);
    // Theme is real: applied immediately AND persisted (next-themes' own key).
    setTheme(values.theme);
    // The rest is the demo: persisted locally only, never sent anywhere.
    const { theme: _theme, ...demo } = values;
    const stored = saveDemoPreferences(demo);
    setSubmitting(false);

    if (stored) {
      toast.success("Preferences saved in this browser", {
        description:
          "Theme is applied now. Rollout defaults are a demo — stored locally, not read back into the form yet.",
      });
    } else {
      toast.warning("Theme applied; demo preferences not stored", {
        description:
          "Your browser blocked local storage, so the demo values won't persist. Theme still changed.",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Alert>
          <FlaskConical />
          <AlertTitle>Most of this page is a demonstration</AlertTitle>
          <AlertDescription>
            <span>
              It shows what a preferences page can look like when you build on this starter kit. Only{" "}
              <strong>Theme</strong> is wired up for real. The rollout defaults below are
              illustrative placeholders — they save to this browser but the New-rollout form does not
              read them back yet. Wire them into your own preferences API when you add one. See{" "}
              <code>docs/features/settings.md</code>.
            </span>
          </AlertDescription>
        </Alert>

        {/* Rollout defaults (demo) */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Rollout defaults</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            <FormField
              control={form.control}
              name="defaultEnvironment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default environment</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-72">
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
                  <FormDescription>
                    Demo field. The environment a new rollout would start from.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultResolution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default resolution</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-40">
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
                  <FormDescription>Demo field. Lower renders faster.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultEpisodeCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default episode count</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-32 font-mono tabular-nums"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Demo field. Between 1 and 100.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notifyOnComplete"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Notify me when a rollout completes</FormLabel>
                    <FormDescription>
                      Demo field. A real build would push a toast or email when a run finishes.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Appearance</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-6">
            <FormField
              control={form.control}
              name="theme"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Theme</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-6"
                    >
                      {THEME_OPTIONS.map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-2 text-sm capitalize cursor-pointer"
                        >
                          <RadioGroupItem value={t} />
                          {t}
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    Applied for real when you save. The header toggle changes it too.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <DangerZone />

        {/* Action bar */}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset({ ...DEMO_PREFERENCES_DEFAULTS, theme: DEFAULT_THEME })}
          >
            Reset
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
