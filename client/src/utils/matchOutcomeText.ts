import type { PlayerInfo } from "../types/protocol";

/** Human-readable outcome for the signed-in user (server `result` is match-level, not "you won"). */
export function matchOutcomeText(
  result: "win" | "draw" | "forfeit" | undefined,
  winnerUserId: string | undefined,
  userId: string,
  players: PlayerInfo[]
): string {
  if (!result) return "Unknown";

  if (result === "draw") {
    return "Draw";
  }

  if (result === "forfeit") {
    if (!winnerUserId) return "Match ended (forfeit)";
    if (winnerUserId === userId) {
      return "You won — opponent forfeited";
    }
    const w = players.find((p) => p.userId === winnerUserId);
    return `You lost — ${w?.username ?? "Opponent"} won by forfeit`;
  }

  if (result === "win") {
    if (!winnerUserId) return "Match finished";
    if (winnerUserId === userId) {
      return "You won!";
    }
    const w = players.find((p) => p.userId === winnerUserId);
    return `You lost — ${w?.username ?? "Opponent"} won`;
  }

  return result;
}
