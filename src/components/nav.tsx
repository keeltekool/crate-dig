"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

const NAV_ITEMS = [
  { path: "/roll", label: "ROLL" },
  { path: "/library", label: "LIBRARY" },
  { path: "/history", label: "HISTORY" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-vinyl-border">
      <div className="max-w-[600px] mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/roll">
          <Logo compact />
        </Link>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`px-3 py-1.5 text-xs tracking-widest font-mono transition-colors ${
                  active
                    ? "text-orange-500 bg-orange-500/10"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
