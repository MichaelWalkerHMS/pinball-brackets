import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Tournament, Player, Result } from "@/lib/types";
import TournamentOverview from "./TournamentOverview";
import PlayerManagement from "./PlayerManagement";
import ResultsEntry from "./ResultsEntry";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function TournamentAdminPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const supabase = await createClient();

  // Fetch tournament
  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (tournamentError || !tournament) {
    notFound();
  }

  // Fetch players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("tournament_id", id)
    .order("seed", { ascending: true });

  // Fetch bracket count
  const { count: bracketCount } = await supabase
    .from("brackets")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", id);

  // Fetch results
  const { data: results } = await supabase
    .from("results")
    .select("*")
    .eq("tournament_id", id)
    .order("round", { ascending: true })
    .order("match_position", { ascending: true });

  const typedTournament = tournament as Tournament;
  const typedPlayers = (players || []) as Player[];
  const typedResults = (results || []) as Result[];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "players", label: "Players" },
    { id: "results", label: "Results" },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/admin" className="text-[rgb(var(--color-accent-primary))] hover:underline text-sm">
          &larr; Back to Tournaments
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">
            {typedTournament.name}
          </h1>
          <StatusBadge status={typedTournament.status} />
          {!typedTournament.is_active && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))]">
              Hidden
            </span>
          )}
        </div>
        <p className="text-[rgb(var(--color-text-secondary))] mt-1">
          {typedTournament.player_count} players &bull; {bracketCount || 0}{" "}
          bracket(s) submitted
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-[rgb(var(--color-border-primary))] mb-6">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/admin/tournament/${id}?tab=${t.id}`}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-[rgb(var(--color-accent-primary))] text-[rgb(var(--color-accent-primary))]"
                  : "border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <TournamentOverview
          tournament={typedTournament}
          bracketCount={bracketCount || 0}
        />
      )}

      {tab === "players" && (
        <PlayerManagement
          tournament={typedTournament}
          players={typedPlayers}
          bracketCount={bracketCount || 0}
        />
      )}

      {tab === "results" && (
        <ResultsEntry
          tournament={typedTournament}
          players={typedPlayers}
          results={typedResults}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    upcoming: "bg-[rgb(var(--color-accent-light))] text-[rgb(var(--color-accent-text))]",
    in_progress: "bg-[rgb(var(--color-warning-bg))] text-[rgb(var(--color-warning-text))]",
    completed: "bg-[rgb(var(--color-success-bg))] text-[rgb(var(--color-success-text))]",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-primary))]"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
