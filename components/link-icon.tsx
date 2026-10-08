"use client";

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";

/**
 * The destination site's icon for a link (its "app logo"), so a scanned QR
 * is recognizable at a glance. Best-effort: the site's own favicon first,
 * then DuckDuckGo's icon service, then a plain link glyph.
 */
export function LinkIcon({
  href,
  size = 24,
  className = "",
}: {
  href: string;
  size?: number;
  className?: string;
}) {
  const sources = useMemo(() => {
    try {
      const u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return [];
      return [
        `${u.origin}/favicon.ico`,
        `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`,
      ];
    } catch {
      return [];
    }
  }, [href]);

  const [step, setStep] = useState(0);

  if (step >= sources.length) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border border-border bg-surface ${className}`}
        style={{ width: size, height: size }}
      >
        <Link2
          className="text-muted"
          strokeWidth={1.5}
          style={{ width: size * 0.55, height: size * 0.55 }}
        />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={sources[step]}
      src={sources[step]}
      alt=""
      width={size}
      height={size}
      onError={() => setStep((s) => s + 1)}
      className={`shrink-0 rounded-full border border-border bg-surface object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
