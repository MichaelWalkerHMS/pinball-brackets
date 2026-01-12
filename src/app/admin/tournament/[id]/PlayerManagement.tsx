"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Tournament, Player } from "@/lib/types";
import type { PlayerDiff, MappedPlayer } from "@/lib/matchplay";
import { reorderPlayers, deletePlayer, addPlayer, updatePlayerName, importMatchPlayPlayers } from "./actions";
import MatchPlayDiff from "./MatchPlayDiff";

interface PlayerManagementProps {
  tournament: Tournament;
  players: Player[];
  bracketCount?: number;
}

export default function PlayerManagement({
  tournament,
  players: initialPlayers,
  bracketCount = 0,
}: PlayerManagementProps) {
  const [showBulkImport, setShowBulkImport] = useState(
    initialPlayers.length === 0
  );
  const [players, setPlayers] = useState(initialPlayers);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Add player state
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Match Play import state
  const [isFetchingMP, setIsFetchingMP] = useState(false);
  const [mpPlayers, setMpPlayers] = useState<MappedPlayer[] | null>(null);
  const [mpDiff, setMpDiff] = useState<PlayerDiff | null>(null);
  const [showMpDiff, setShowMpDiff] = useState(false);
  const [isApplyingMP, setIsApplyingMP] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex((p) => p.id === active.id);
        const newIndex = items.findIndex((p) => p.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        // Update seed numbers
        return newOrder.map((p, i) => ({ ...p, seed: i + 1 }));
      });
      setHasChanges(true);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    const newOrder = players.map((p, i) => ({ id: p.id, seed: i + 1 }));
    const result = await reorderPlayers(tournament.id, newOrder);

    if (result.error) {
      setError(result.error);
    } else {
      setHasChanges(false);
      window.location.reload();
    }

    setIsSaving(false);
  }

  function handleCancel() {
    setPlayers(initialPlayers);
    setHasChanges(false);
  }

  async function handleDelete(playerId: string, playerName: string) {
    if (
      !confirm(
        `Are you sure you want to remove "${playerName}"? Seeds below will shift up.`
      )
    ) {
      return;
    }

    setError(null);
    const result = await deletePlayer(playerId);

    if (result.error) {
      setError(result.error);
    } else {
      window.location.reload();
    }
  }

  // Inline edit handlers
  function handleStartEdit(player: Player) {
    setEditingPlayerId(player.id);
    setEditingName(player.name);
  }

  function handleCancelEdit() {
    setEditingPlayerId(null);
    setEditingName("");
  }

  async function handleSaveEdit() {
    if (!editingPlayerId || !editingName.trim()) return;
    setIsUpdating(true);
    setError(null);
    const result = await updatePlayerName(editingPlayerId, editingName.trim());
    setIsUpdating(false);
    if (result.success) {
      handleCancelEdit();
      window.location.reload();
    } else {
      setError(result.error || "Failed to update player name");
    }
  }

  // Add player handler
  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    setIsAdding(true);
    setError(null);
    const nextSeed = players.length + 1;
    const result = await addPlayer(tournament.id, newPlayerName.trim(), nextSeed);
    setIsAdding(false);

    if (result.success) {
      setNewPlayerName("");
      window.location.reload();
    } else {
      setError(result.error || "Failed to add player");
    }
  }

  // Match Play import handler
  async function handleFetchFromMatchPlay() {
    if (!tournament.matchplay_id) return;

    setIsFetchingMP(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        matchplayId: tournament.matchplay_id,
        tournamentId: tournament.id,
      });
      const response = await fetch(`/api/matchplay/players?${params}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to fetch from Match Play");
        return;
      }

      setMpPlayers(result.players);

      // If there are changes and existing players have MP IDs, show diff modal
      if (result.hasChanges && result.diff) {
        setMpDiff(result.diff);
        setShowMpDiff(true);
      } else if (result.existingCount === 0 || !result.hasChanges) {
        // Fresh import or no changes - proceed directly
        if (result.players.length === 0) {
          setError("No players found in Match Play tournament");
          return;
        }
        // For fresh import, just apply the players directly
        await applyMatchPlayPlayers(result.players);
      } else {
        // Players exist but no MP IDs - warn and ask to replace
        const shouldReplace = confirm(
          `This will replace all ${result.existingCount} existing players with ${result.players.length} players from Match Play. Continue?`
        );
        if (shouldReplace) {
          await applyMatchPlayPlayers(result.players);
        }
      }
    } catch (err) {
      console.error("Error fetching from Match Play:", err);
      setError("Failed to connect to Match Play");
    } finally {
      setIsFetchingMP(false);
    }
  }

  async function applyMatchPlayPlayers(playersToImport: MappedPlayer[]) {
    setIsApplyingMP(true);
    setError(null);

    try {
      const result = await importMatchPlayPlayers(tournament.id, playersToImport);

      if (result.error) {
        setError(result.error);
      } else {
        setShowMpDiff(false);
        setMpDiff(null);
        setMpPlayers(null);
        window.location.reload();
      }
    } catch (err) {
      console.error("Error applying Match Play players:", err);
      setError("Failed to apply Match Play players");
    } finally {
      setIsApplyingMP(false);
    }
  }

  function handleConfirmMpDiff() {
    if (mpPlayers) {
      applyMatchPlayPlayers(mpPlayers);
    }
  }

  function handleCancelMpDiff() {
    setShowMpDiff(false);
    setMpDiff(null);
    setMpPlayers(null);
  }

  return (
    <div className="space-y-6">
      {/* Match Play Diff Modal */}
      {showMpDiff && mpDiff && (
        <MatchPlayDiff
          diff={mpDiff}
          bracketCount={bracketCount}
          onConfirm={handleConfirmMpDiff}
          onCancel={handleCancelMpDiff}
          isApplying={isApplyingMP}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">
            Players ({players.length}/{tournament.player_count})
          </h2>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Drag to reorder players. Changes are saved when you click Save.
          </p>
        </div>
        <div className="flex gap-2">
          {tournament.matchplay_id && (
            <button
              onClick={handleFetchFromMatchPlay}
              disabled={isFetchingMP}
              className="px-3 py-1.5 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] text-sm font-medium disabled:opacity-50"
            >
              {isFetchingMP ? "Syncing..." : "Sync from Match Play"}
            </button>
          )}
          {players.length > 0 && (
            <button
              onClick={() => setShowBulkImport(!showBulkImport)}
              className="text-[rgb(var(--color-accent-primary))] hover:text-[rgb(var(--color-accent-hover))] text-sm font-medium"
            >
              {showBulkImport ? "Show Player List" : "Bulk Import"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))] text-sm">
          {error}
        </div>
      )}

      {showBulkImport ? (
        <BulkImportPanel
          tournamentId={tournament.id}
          playerCount={tournament.player_count}
          existingPlayers={players}
          onComplete={() => setShowBulkImport(false)}
        />
      ) : (
        <>
          {/* Save/Cancel buttons when changes exist */}
          {hasChanges && (
            <div className="flex gap-2 p-4 bg-[rgb(var(--color-warning-bg-light))] border border-[rgb(var(--color-warning-border))] rounded-lg">
              <span className="flex-1 text-[rgb(var(--color-warning-text))] text-sm">
                You have unsaved changes to player order.
              </span>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-3 py-1.5 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Order"}
              </button>
            </div>
          )}

          <PlayerList
            players={players}
            tournamentId={tournament.id}
            sensors={sensors}
            onDragEnd={handleDragEnd}
            onDelete={handleDelete}
            editingPlayerId={editingPlayerId}
            editingName={editingName}
            isUpdating={isUpdating}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onSaveEdit={handleSaveEdit}
            onEditingNameChange={setEditingName}
          />

          {/* Add Player Section */}
          <div className="mt-4 border-t border-[rgb(var(--color-border-primary))] pt-4">
            <h4 className="font-medium text-[rgb(var(--color-text-primary))] mb-2">Add Player</h4>
            <form onSubmit={handleAddPlayer} className="flex gap-2">
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="flex-1 px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
                disabled={isAdding || players.length >= tournament.player_count}
              />
              <button
                type="submit"
                disabled={isAdding || !newPlayerName.trim() || players.length >= tournament.player_count}
                className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? "Adding..." : "Add"}
              </button>
            </form>
            {players.length >= tournament.player_count && (
              <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">Tournament is at maximum capacity</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BulkImportPanel({
  tournamentId,
  playerCount,
  existingPlayers,
  onComplete,
}: {
  tournamentId: string;
  playerCount: number;
  existingPlayers: Player[];
  onComplete: () => void;
}) {
  const [names, setNames] = useState(
    existingPlayers.map((p) => p.name).join("\n")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineCount = names
    .split("\n")
    .filter((line) => line.trim() !== "").length;

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    const playerNames = names
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name !== "");

    if (playerNames.length === 0) {
      setError("Please enter at least one player name");
      setIsSubmitting(false);
      return;
    }

    if (playerNames.length > playerCount) {
      setError(`Too many players. Maximum is ${playerCount}.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const { bulkImportPlayers } = await import("./actions");
      const result = await bulkImportPlayers(tournamentId, playerNames);

      if (result.error) {
        setError(result.error);
      } else {
        onComplete();
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-6">
      <h3 className="font-medium text-[rgb(var(--color-text-primary))] mb-2">Bulk Import Players</h3>
      <p className="text-sm text-[rgb(var(--color-text-muted))] mb-4">
        Enter player names, one per line. The order determines seeding (first
        line = seed 1).
      </p>

      {error && (
        <div className="p-3 bg-[rgb(var(--color-error-bg-light))] border border-[rgb(var(--color-error-border))] rounded-lg text-[rgb(var(--color-error-text))] text-sm mb-4">
          {error}
        </div>
      )}

      <textarea
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="Dominic Labella&#10;Matthew Stacks&#10;Rodney Minch&#10;..."
        className="w-full h-64 px-3 py-2 border border-[rgb(var(--color-border-secondary))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] font-mono text-sm bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
      />

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-[rgb(var(--color-text-muted))]">
          {lineCount} player(s) entered (max {playerCount})
        </span>
        <div className="flex gap-2">
          {existingPlayers.length > 0 && (
            <button
              onClick={onComplete}
              className="px-4 py-2 bg-[rgb(var(--color-bg-tertiary))] text-[rgb(var(--color-text-secondary))] rounded-lg hover:bg-[rgb(var(--color-border-secondary))] font-medium"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || lineCount === 0}
            className="px-4 py-2 bg-[rgb(var(--color-accent-primary))] text-white rounded-lg hover:bg-[rgb(var(--color-accent-hover))] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Importing..." : "Import Players"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerList({
  players,
  tournamentId,
  sensors,
  onDragEnd,
  onDelete,
  editingPlayerId,
  editingName,
  isUpdating,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditingNameChange,
}: {
  players: Player[];
  tournamentId: string;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  onDelete: (playerId: string, playerName: string) => void;
  editingPlayerId: string | null;
  editingName: string;
  isUpdating: boolean;
  onStartEdit: (player: Player) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditingNameChange: (name: string) => void;
}) {
  if (players.length === 0) {
    return (
      <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] p-6 text-center">
        <p className="text-[rgb(var(--color-text-muted))]">No players added yet.</p>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
          Use the bulk import above to add players.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[rgb(var(--color-bg-primary))] rounded-lg border border-[rgb(var(--color-border-primary))] overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={players.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-y divide-[rgb(var(--color-border-primary))]">
            {players.map((player) => (
              <SortablePlayerRow
                key={player.id}
                player={player}
                onDelete={() => onDelete(player.id, player.name)}
                isEditing={editingPlayerId === player.id}
                editingName={editingName}
                isUpdating={isUpdating}
                onStartEdit={() => onStartEdit(player)}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onEditingNameChange={onEditingNameChange}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortablePlayerRow({
  player,
  onDelete,
  isEditing,
  editingName,
  isUpdating,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditingNameChange,
}: {
  player: Player;
  onDelete: () => void;
  isEditing: boolean;
  editingName: string;
  isUpdating: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditingNameChange: (name: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 px-4 py-3 bg-[rgb(var(--color-bg-primary))] ${
        isDragging ? "shadow-lg z-10 opacity-90" : "hover:bg-[rgb(var(--color-bg-secondary))]"
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]"
        title="Drag to reorder"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8h16M4 16h16"
          />
        </svg>
      </button>

      {/* Seed Number */}
      <span className="w-8 text-center font-mono text-[rgb(var(--color-text-muted))]">
        {player.seed}
      </span>

      {/* Player Name */}
      {isEditing ? (
        <input
          type="text"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
          disabled={isUpdating}
          className="flex-1 px-2 py-1 border border-[rgb(var(--color-accent-primary))] rounded focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent-primary))] font-medium bg-[rgb(var(--color-bg-primary))] text-[rgb(var(--color-text-primary))]"
        />
      ) : (
        <span
          onClick={onStartEdit}
          className="flex-1 font-medium cursor-pointer text-[rgb(var(--color-text-primary))] hover:text-[rgb(var(--color-accent-primary))]"
          title="Click to edit"
        >
          {player.name}
        </span>
      )}

      {/* IFPA ID */}
      {player.ifpa_id && (
        <span className="text-sm text-[rgb(var(--color-text-muted))]">IFPA #{player.ifpa_id}</span>
      )}

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="text-[rgb(var(--color-error-icon))] hover:text-[rgb(var(--color-error-text))] p-1"
        title="Remove player"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </li>
  );
}
