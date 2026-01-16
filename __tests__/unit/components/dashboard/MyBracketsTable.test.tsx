import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import MyBracketsTable from "@/components/dashboard/MyBracketsTable";
import type { DashboardBracket } from "@/lib/types";

const mockBrackets: DashboardBracket[] = [
  {
    id: "bracket-1",
    name: "My First Bracket",
    tournament_id: "tournament-1",
    tournament_name: "2026 Michigan State Championship",
    tournament_state: "Michigan",
    tournament_year: 2026,
    player_count: 24,
    tournament_status: "in_progress",
    pick_count: 24,
    expected_picks: 24,
    is_complete: true,
    is_public: true,
    score: 42,
    rank: 3,
    is_locked: false,
  },
  {
    id: "bracket-2",
    name: "Second Try",
    tournament_id: "tournament-1", // Same tournament as bracket-1
    tournament_name: "2026 Michigan State Championship",
    tournament_state: "Michigan",
    tournament_year: 2026,
    player_count: 24,
    tournament_status: "in_progress",
    pick_count: 10,
    expected_picks: 24,
    is_complete: false,
    is_public: false, // Private bracket
    score: 0,
    rank: null,
    is_locked: false,
  },
  {
    id: "bracket-3",
    name: "Championship Pick",
    tournament_id: "tournament-2", // Different tournament
    tournament_name: "2025 Indiana State Championship",
    tournament_state: "Indiana",
    tournament_year: 2025,
    player_count: 16,
    tournament_status: "completed",
    pick_count: 16,
    expected_picks: 16,
    is_complete: true,
    is_public: true,
    score: 28,
    rank: 5,
    is_locked: true,
  },
];

describe("MyBracketsTable", () => {
  describe("when brackets exist", () => {
    it("groups brackets by tournament", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Should show tournament names as group headers
      expect(screen.getByText("2026 Michigan State Championship")).toBeInTheDocument();
      expect(screen.getByText("2025 Indiana State Championship")).toBeInTheDocument();
    });

    it("shows Leaderboard link for each tournament", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Each tournament group has a Leaderboard link
      const leaderboardLinks = screen.getAllByRole("link", { name: "Leaderboard" });
      expect(leaderboardLinks).toHaveLength(2);
    });

    it("renders bracket cards as clickable links", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Find bracket card links by their href attribute
      const links = screen.getAllByRole("link");
      const bracketLinks = links.filter(link =>
        link.getAttribute("href")?.startsWith("/bracket/")
      );

      // Should have 3 bracket cards plus 2 leaderboard links = 5 total links starting with /bracket or /tournament
      // Filter to just bracket cards (not leaderboard)
      const bracketCardLinks = bracketLinks.filter(link =>
        !link.getAttribute("href")?.startsWith("/tournament/")
      );

      expect(bracketCardLinks).toHaveLength(3);
      // Unlocked brackets link to edit, locked brackets link to view
      expect(bracketCardLinks[0]).toHaveAttribute("href", "/bracket/bracket-1/edit"); // unlocked
      expect(bracketCardLinks[1]).toHaveAttribute("href", "/bracket/bracket-2/edit"); // unlocked
      expect(bracketCardLinks[2]).toHaveAttribute("href", "/bracket/bracket-3"); // locked
    });

    it("renders bracket names within cards", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Bracket names should be in headings
      expect(screen.getByRole("heading", { name: "My First Bracket" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Second Try" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Championship Pick" })).toBeInTheDocument();
    });

    it("renders score box for scored brackets", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Scores shown as numbers in a box
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.getByText("28")).toBeInTheDocument();
    });

    it("renders lock icon for private brackets", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Only bracket-2 is private (is_public: false)
      // The lock icon is an SVG, we check it's rendered in the correct card
      const secondTryHeading = screen.getByRole("heading", { name: "Second Try" });
      const card = secondTryHeading.closest("a");
      expect(card).toBeInTheDocument();

      // The lock icon should be present in the card
      const lockIcon = card?.querySelector("svg[viewBox='0 0 24 24'][fill='currentColor']");
      expect(lockIcon).toBeInTheDocument();
    });

    it("renders Leaderboard link for each tournament group", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      const leaderboardLinks = screen.getAllByRole("link", { name: "Leaderboard" });
      // One per tournament group (2 tournaments)
      expect(leaderboardLinks).toHaveLength(2);
    });

    it("links Leaderboard to correct tournament URLs", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      const leaderboardLinks = screen.getAllByRole("link", { name: "Leaderboard" });
      expect(leaderboardLinks[0]).toHaveAttribute("href", "/tournament/tournament-1");
      expect(leaderboardLinks[1]).toHaveAttribute("href", "/tournament/tournament-2");
    });
  });

  describe("collapsible behavior", () => {
    it("starts with all tournaments expanded", () => {
      render(<MyBracketsTable brackets={mockBrackets} />);

      // All bracket names should be visible
      expect(screen.getByRole("heading", { name: "My First Bracket" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Second Try" })).toBeVisible();
      expect(screen.getByRole("heading", { name: "Championship Pick" })).toBeVisible();
    });

    it("collapses tournament when header is clicked", async () => {
      const user = userEvent.setup();
      render(<MyBracketsTable brackets={mockBrackets} />);

      // Click on Michigan tournament header
      const michiganHeader = screen.getByText("2026 Michigan State Championship").closest("button");
      expect(michiganHeader).toBeInTheDocument();

      await user.click(michiganHeader!);

      // Michigan brackets should be hidden
      expect(screen.queryByRole("heading", { name: "My First Bracket" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Second Try" })).not.toBeInTheDocument();

      // Indiana bracket should still be visible
      expect(screen.getByRole("heading", { name: "Championship Pick" })).toBeVisible();
    });

    it("expands tournament when collapsed header is clicked again", async () => {
      const user = userEvent.setup();
      render(<MyBracketsTable brackets={mockBrackets} />);

      const michiganHeader = screen.getByText("2026 Michigan State Championship").closest("button");

      // Collapse
      await user.click(michiganHeader!);
      expect(screen.queryByRole("heading", { name: "My First Bracket" })).not.toBeInTheDocument();

      // Expand again
      await user.click(michiganHeader!);
      expect(screen.getByRole("heading", { name: "My First Bracket" })).toBeVisible();
    });
  });

  describe("when no brackets exist", () => {
    it("renders empty state message", () => {
      render(<MyBracketsTable brackets={[]} />);

      expect(screen.getByText("You haven't created any brackets yet.")).toBeInTheDocument();
      expect(screen.getByText("Use the form below to create your first bracket!")).toBeInTheDocument();
    });

    it("does not render tournament groups", () => {
      render(<MyBracketsTable brackets={[]} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });
});
