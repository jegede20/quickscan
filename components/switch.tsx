"use client";

/** Round pill switch. Orange when active. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 motion-reduce:transition-none ${
        checked ? "border-accent bg-accent" : "border-border bg-bg"
      }`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-surface transition-transform duration-200 ease-out motion-reduce:transition-none ${
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}
