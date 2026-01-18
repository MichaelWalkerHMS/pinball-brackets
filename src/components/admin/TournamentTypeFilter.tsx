"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { TournamentType } from "@/lib/types";

interface TournamentTypeFilterProps {
  counts: {
    all: number;
    open: number;
    womens: number;
  };
}

export default function TournamentTypeFilter({ counts }: TournamentTypeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFilter = (searchParams.get("type") as TournamentType | "all") || "all";

  function handleFilterChange(filter: "all" | TournamentType) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter === "all") {
      params.delete("type");
    } else {
      params.set("type", filter);
    }
    router.push(`/admin?${params.toString()}`);
  }

  const filters = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "open" as const, label: "Open", count: counts.open },
    { value: "womens" as const, label: "Women's", count: counts.womens },
  ];

  return (
    <div className="flex gap-2">
      {filters.map(({ value, label, count }) => (
        <button
          key={value}
          onClick={() => handleFilterChange(value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            currentFilter === value
              ? "bg-[rgb(var(--color-accent-primary))] text-white"
              : "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-border-secondary))]"
          }`}
        >
          {label} ({count})
        </button>
      ))}
    </div>
  );
}
