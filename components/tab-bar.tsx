"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, QrCode, ScanLine, Settings } from "lucide-react";

const TABS = [
  { href: "/", label: "Scan", Icon: ScanLine },
  { href: "/history", label: "History", Icon: Clock },
  { href: "/create", label: "Create", Icon: QrCode },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-16 flex-col items-center justify-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              <span
                aria-hidden
                className={`absolute top-0 h-[3px] w-6 rounded-b-full bg-accent transition-opacity duration-150 motion-reduce:transition-none ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <Icon
                className={`h-[22px] w-[22px] ${active ? "text-ink" : "text-muted"}`}
                strokeWidth={1.5}
              />
              <span
                className={`text-xs ${
                  active ? "text-ink font-medium" : "text-muted"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
