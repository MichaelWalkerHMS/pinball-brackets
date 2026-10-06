"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/lib/types";
import type { HeadToHead, HeadToHeadRecord } from "@/lib/ifpa";

interface MatchupAnalysisModalProps {
  topPlayer: Player;
  bottomPlayer: Player;
  onClose: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; data: HeadToHead };

const NO_IFPA_NUMBER = "No IFPA Number Found";

interface StatRowProps {
  label: string;
  top: number | null | undefined;
  bottom: number | null | undefined;
  better: "lower" | "higher";
  prefix?: string;
}

function StatRow({ label, top, bottom, better, prefix = "" }: StatRowProps) {
  let topWins = false;
  let bottomWins = false;
  if (top != null && bottom != null && top !== bottom) {
    topWins = better === "lower" ? top < bottom : top > bottom;
    bottomWins = !topWins;
  }

  const cell = (value: number | null | undefined, wins: boolean) => (
    <span
      className={`text-center tabular-nums ${
        wins
          ? "font-bold text-[rgb(var(--color-success-text))]"
          : "text-[rgb(var(--color-text-primary))]"
      }`}
    >
      {value == null ? "—" : `${prefix}${value.toLocaleString()}`}
    </span>
  );

  return (
    <div className="grid grid-cols-3 items-center py-2 border-b border-[rgb(var(--color-border-primary))] text-sm">
      {cell(top, topWins)}
      <span className="text-center text-xs text-[rgb(var(--color-text-muted))]">{label}</span>
      {cell(bottom, bottomWins)}
    </div>
  );
}

function PlayerHeader({ player }: { player: Player }) {
  return (
    <div className="text-center">
      <p className="text-xs text-[rgb(var(--color-text-muted))]">Seed {player.seed}</p>
      <p className="font-semibold text-[rgb(var(--color-text-primary))]">{player.name}</p>
      {player.ifpa_id === null && (
        <p className="text-xs text-[rgb(var(--color-warning-text))]">{NO_IFPA_NUMBER}</p>
      )}
    </div>
  );
}

export default function MatchupAnalysisModal({
  topPlayer,
  bottomPlayer,
  onClose,
}: MatchupAnalysisModalProps) {
  const hasAnyIfpaId = topPlayer.ifpa_id !== null || bottomPlayer.ifpa_id !== null;
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!hasAnyIfpaId) return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (topPlayer.ifpa_id !== null) params.set("p1", String(topPlayer.ifpa_id));
    if (bottomPlayer.ifpa_id !== null) params.set("p2", String(bottomPlayer.ifpa_id));

    fetch(`/api/ifpa/head-to-head?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HeadToHead>;
      })
      .then((data) => setState({ status: "loaded", data }))
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("Failed to load matchup analysis:", err);
          setState({ status: "error" });
        }
      });

    return () => controller.abort();
  }, [hasAnyIfpaId, topPlayer.ifpa_id, bottomPlayer.ifpa_id]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Portal to body so the overlay isn't clipped by the bracket's scroll container
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="matchup-analysis-title"
    >
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg shadow-xl w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-6 pb-4 border-b border-[rgb(var(--color-border-primary))]">
          <h2 id="matchup-analysis-title" className="text-xl font-bold">
            Matchup Analysis
          </h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 items-center mb-2">
            <PlayerHeader player={topPlayer} />
            <span className="text-center text-sm font-bold text-[rgb(var(--color-text-muted))]">vs</span>
            <PlayerHeader player={bottomPlayer} />
          </div>

          {!hasAnyIfpaId ? null : state.status === "loading" ? (
            <p className="text-center py-8 text-sm text-[rgb(var(--color-text-muted))]">
              Loading IFPA data...
            </p>
          ) : state.status === "error" ? (
            <p className="text-center py-8 text-sm text-[rgb(var(--color-error-text))]">
              Couldn&apos;t load IFPA data. Please try again later.
            </p>
          ) : (
            <>
              <StatRow label="IFPA Rank" top={state.data.player1?.ifpaRank} bottom={state.data.player2?.ifpaRank} better="lower" prefix="#" />
              <StatRow label="IFPA Rating" top={state.data.player1?.ifpaRating} bottom={state.data.player2?.ifpaRating} better="higher" />
              <StatRow label="Match Play Rating" top={state.data.player1?.matchplayRating} bottom={state.data.player2?.matchplayRating} better="higher" />
            </>
          )}

          {(!hasAnyIfpaId || state.status === "loaded") && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-[rgb(var(--color-text-primary))] mb-1">
                Head-to-Head
              </h3>
              {state.status === "loaded" && state.data.record ? (
                <HeadToHeadSummary data={state.data} record={state.data.record} />
              ) : (
                <p className="text-sm text-[rgb(var(--color-text-muted))]">{NO_IFPA_NUMBER}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function HeadToHeadSummary({
  data,
  record,
}: {
  data: HeadToHead;
  record: HeadToHeadRecord;
}) {
  const { player1Wins, player2Wins, ties } = record;
  const total = player1Wins + player2Wins + ties;

  if (total === 0) {
    return (
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        These players have never played in the same IFPA event.
      </p>
    );
  }

  return (
    <>
      <p className="text-3xl font-bold text-center tabular-nums text-[rgb(var(--color-text-primary))]">
        {player1Wins} – {player2Wins}
        {ties > 0 && <span className="text-base font-normal text-[rgb(var(--color-text-muted))]"> ({ties} tied)</span>}
      </p>
      <p className="text-xs text-center text-[rgb(var(--color-text-muted))] mb-3">
        Head-to-head record across {total} IFPA event{total !== 1 ? "s" : ""}
      </p>
      <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">Recent meetings</p>
      <ul className="text-xs divide-y divide-[rgb(var(--color-border-primary))]">
        {data.recentMeetings.map((m, i) => (
          <li key={`${m.date}-${i}`} className="grid grid-cols-[2rem_1fr_2rem] gap-2 py-1.5 items-center">
            <span className={`text-center tabular-nums ${m.player1Finish < m.player2Finish ? "font-bold text-[rgb(var(--color-success-text))]" : ""}`}>
              {m.player1Finish}
            </span>
            <span className="text-center min-w-0">
              <span className="block truncate text-[rgb(var(--color-text-secondary))]" title={m.tournamentName}>
                {m.tournamentName}
              </span>
              <span className="block text-[rgb(var(--color-text-muted))]">{m.date}</span>
            </span>
            <span className={`text-center tabular-nums ${m.player2Finish < m.player1Finish ? "font-bold text-[rgb(var(--color-success-text))]" : ""}`}>
              {m.player2Finish}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
