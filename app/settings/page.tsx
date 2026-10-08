"use client";

import { Trash2 } from "lucide-react";
import { Switch } from "@/components/switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearAllData, saveSettings, useSettings } from "@/lib/storage";

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-base text-ink">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useSettings();

  return (
    <div className="flex flex-1 flex-col px-5 pb-[calc(88px+env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Settings</h1>

      <div className="rounded-card border border-border bg-surface">
        <SettingRow label="Theme" hint="Light or dark appearance">
          <ThemeToggle />
        </SettingRow>
        <SettingRow label="Vibrate on scan" hint="Haptic tap when a result opens">
          <Switch
            checked={settings.vibrate}
            onChange={(vibrate) => saveSettings({ ...settings, vibrate })}
            label="Vibrate on scan"
          />
        </SettingRow>
        <SettingRow label="Sound" hint="Short beep when a result opens">
          <Switch
            checked={settings.sound}
            onChange={(sound) => saveSettings({ ...settings, sound })}
            label="Sound"
          />
        </SettingRow>
        <SettingRow
          label="Auto-open links"
          hint="Open detected links without tapping"
        >
          <Switch
            checked={settings.autoOpen}
            onChange={(autoOpen) => saveSettings({ ...settings, autoOpen })}
            label="Auto-open links"
          />
        </SettingRow>
      </div>

      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              "Clear all scan history, favorites and settings? This cannot be undone."
            )
          ) {
            clearAllData();
          }
        }}
        className="mt-5 flex h-12 items-center justify-center gap-2 rounded-ctl border border-error/50 bg-surface text-base font-medium text-error"
      >
        <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
        Clear all data
      </button>

      <p className="mt-6 text-center text-sm text-muted">
        QuickScan keeps everything on your device.
        <br />
        No accounts, no uploads, no tracking.
      </p>
    </div>
  );
}
