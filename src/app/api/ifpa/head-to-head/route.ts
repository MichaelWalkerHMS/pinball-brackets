import { NextRequest, NextResponse } from "next/server";
import { createIfpaClient, buildHeadToHead } from "@/lib/ifpa";

const IFPA_ID_PATTERN = /^\d{1,9}$/;

function parseIfpaId(value: string | null): number | null | "invalid" {
  if (value === null || value === "") return null;
  return IFPA_ID_PATTERN.test(value) ? Number(value) : "invalid";
}

/**
 * GET /api/ifpa/head-to-head?p1=<ifpaId>&p2=<ifpaId>
 *
 * Either ID may be omitted (player has no IFPA number); the head-to-head record
 * is only returned when both are present. IFPA data is public, so this route
 * needs no auth — it exists to keep IFPA_API_KEY (a query parameter) off the client.
 */
export async function GET(request: NextRequest) {
  const player1Id = parseIfpaId(request.nextUrl.searchParams.get("p1"));
  const player2Id = parseIfpaId(request.nextUrl.searchParams.get("p2"));

  if (
    player1Id === "invalid" ||
    player2Id === "invalid" ||
    (player1Id === null && player2Id === null) ||
    player1Id === player2Id
  ) {
    return NextResponse.json({ error: "Invalid IFPA IDs" }, { status: 400 });
  }

  const ids = [player1Id, player2Id].filter((id): id is number => id !== null);

  try {
    const client = createIfpaClient();
    const [players, pvp] = await Promise.all([
      client.getPlayers(ids),
      // IFPA returns 400 if either ID is unknown; still show the valid player's stats
      player1Id !== null && player2Id !== null
        ? client.getPvp(player1Id, player2Id).catch((err) => {
            console.error("[IFPA] pvp lookup failed:", err);
            return null;
          })
        : null,
    ]);
    return NextResponse.json(buildHeadToHead(player1Id, player2Id, players, pvp));
  } catch (err) {
    // IFPA error text can echo request details, so log it rather than returning it
    console.error("[IFPA] head-to-head failed:", err);
    return NextResponse.json({ error: "Failed to load IFPA data" }, { status: 502 });
  }
}
