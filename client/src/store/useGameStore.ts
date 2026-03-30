import { create } from "zustand";
import {
  CellValue,
  MatchEndPayload,
  MatchMode,
  MatchStartPayload,
  MatchStatus,
  PlayerInfo,
  StateSyncPayload,
  StateUpdatePayload
} from "../types/protocol";

interface GameState {
  userId: string;
  username: string;
  authToken: string;
  authRefreshToken: string;
  matchId: string;
  /** 4-digit room code when joining/creating via create_*_match; empty for matchmaker. */
  joinCode: string;
  mode: MatchMode;
  status: MatchStatus;
  board: CellValue[];
  players: PlayerInfo[];
  turnUserId: string;
  moveNumber: number;
  timeLimitMs?: number;
  turnDeadlineMs?: number;
  result?: MatchEndPayload["result"];
  winnerUserId?: string;
  forfeitReason?: string;
  setAuth: (userId: string, username: string, token: string, refreshToken?: string) => void;
  setMatchId: (matchId: string, joinCode?: string) => void;
  setMode: (mode: MatchMode) => void;
  applyMatchStart: (payload: MatchStartPayload) => void;
  applyStateUpdate: (payload: StateUpdatePayload) => void;
  applyStateSync: (payload: StateSyncPayload) => void;
  applyMatchEnd: (payload: MatchEndPayload) => void;
  resetMatch: () => void;
  logout: () => void;
}

const EMPTY_BOARD: CellValue[] = Array.from({ length: 9 }, () => "empty");

export const useGameStore = create<GameState>((set) => ({
  userId: "",
  username: "",
  authToken: "",
  authRefreshToken: "",
  matchId: "",
  joinCode: "",
  mode: "classic",
  status: "waiting",
  board: EMPTY_BOARD,
  players: [],
  turnUserId: "",
  moveNumber: 0,
  setAuth: (userId, username, token, refreshToken) =>
    set({ userId, username, authToken: token, authRefreshToken: refreshToken ?? "" }),
  setMatchId: (matchId, joinCode) =>
    set((state) => {
      if (!matchId) return { matchId: "", joinCode: "" };
      return { matchId, joinCode: joinCode !== undefined ? joinCode : state.joinCode };
    }),
  setMode: (mode) => set({ mode }),
  applyMatchStart: (payload) =>
    set((state) => ({
      matchId: payload.matchId,
      joinCode: state.joinCode,
      board: payload.board,
      players: payload.players,
      turnUserId: payload.turnUserId,
      moveNumber: payload.moveNumber,
      mode: payload.mode,
      status: payload.status,
      timeLimitMs: payload.timeLimitMs,
      turnDeadlineMs: payload.turnDeadlineMs,
      result: undefined,
      winnerUserId: undefined,
      forfeitReason: undefined
    })),
  applyStateUpdate: (payload) =>
    set((state) => ({
      joinCode: state.joinCode,
      board: payload.board,
      turnUserId: payload.turnUserId,
      moveNumber: payload.moveNumber,
      status: payload.status,
      timeLimitMs: payload.timeLimitMs,
      turnDeadlineMs: payload.turnDeadlineMs
    })),
  applyStateSync: (payload) =>
    set((state) => ({
      matchId: payload.matchId,
      joinCode: state.joinCode,
      board: payload.board,
      players: payload.players,
      turnUserId: payload.turnUserId,
      moveNumber: payload.moveNumber,
      mode: payload.mode,
      status: payload.status,
      timeLimitMs: payload.timeLimitMs,
      turnDeadlineMs: payload.turnDeadlineMs,
      result: payload.result,
      winnerUserId: payload.winnerUserId,
      forfeitReason: payload.forfeitReason
    })),
  applyMatchEnd: (payload) =>
    set({
      joinCode: "",
      board: payload.board,
      status: "finished",
      moveNumber: payload.moveNumber,
      result: payload.result,
      winnerUserId: payload.winnerUserId,
      forfeitReason: payload.forfeitReason
    }),
  resetMatch: () =>
    set({
      matchId: "",
      joinCode: "",
      status: "waiting",
      board: EMPTY_BOARD,
      players: [],
      turnUserId: "",
      moveNumber: 0,
      timeLimitMs: undefined,
      turnDeadlineMs: undefined,
      result: undefined,
      winnerUserId: undefined,
      forfeitReason: undefined
    }),
  logout: () =>
    set({
      userId: "",
      username: "",
      authToken: "",
      authRefreshToken: "",
      matchId: "",
      joinCode: "",
      mode: "classic",
      status: "waiting",
      board: EMPTY_BOARD,
      players: [],
      turnUserId: "",
      moveNumber: 0,
      timeLimitMs: undefined,
      turnDeadlineMs: undefined,
      result: undefined,
      winnerUserId: undefined,
      forfeitReason: undefined
    })
}));
