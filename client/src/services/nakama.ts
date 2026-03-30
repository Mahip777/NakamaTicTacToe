import { Client, RpcResponse, Session, Socket } from "@heroiclabs/nakama-js";
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";
import { OpCode, MatchEndPayload, MatchStartPayload, StateSyncPayload, StateUpdatePayload } from "../types/protocol";
import { useGameStore } from "../store/useGameStore";

const DEFAULT_SERVER_KEY = "defaultkey";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = "7350";
const DEFAULT_USE_SSL = false;

class NakamaService {
  private client: Client;
  private socket: Socket | null = null;
  private session: Session | null = null;

  private parseRpcPayload<T>(rpc: RpcResponse): T {
    const p = rpc.payload;
    if (p == null) {
      throw new Error("empty RPC payload");
    }
    if (typeof p === "string") {
      return JSON.parse(p) as T;
    }
    return p as T;
  }

  constructor() {
    this.client = new Client(DEFAULT_SERVER_KEY, this.resolveHost(), DEFAULT_PORT, DEFAULT_USE_SSL);
  }

  private resolveHost(): string {
    const envHost = process.env.EXPO_PUBLIC_NAKAMA_HOST;
    if (envHost && envHost.trim().length > 0) {
      return envHost.trim();
    }

    const hostFromExpo = Constants.expoConfig?.hostUri?.split(":")[0];
    if (hostFromExpo && hostFromExpo !== "127.0.0.1" && hostFromExpo !== "localhost") {
      return hostFromExpo;
    }

    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      try {
        const hostname = new URL(scriptURL).hostname;
        if (hostname && hostname !== "127.0.0.1" && hostname !== "localhost") {
          return hostname;
        }
      } catch {
        // no-op
      }
    }

    if (Platform.OS === "android") {
      return "10.0.2.2";
    }

    return DEFAULT_HOST;
  }

  getSession(): Session | null {
    return this.session;
  }

  /**
   * Rehydrates Session from Zustand after Fast Refresh or any remount where the service
   * singleton was recreated but the store still holds tokens from login.
   */
  private ensureSessionFromStore(): void {
    if (this.session) {
      return;
    }
    const { authToken, authRefreshToken } = useGameStore.getState();
    if (!authToken) {
      throw new Error("session missing");
    }
    this.session = Session.restore(authToken, authRefreshToken || "");
  }

  async authenticateGuest(username: string): Promise<void> {
    const deviceId = `device-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    this.session = await this.client.authenticateDevice(deviceId, true, username);
    useGameStore.getState().setAuth(
      this.session.user_id || "",
      username,
      this.session.token || "",
      this.session.refresh_token || ""
    );
  }

  async connectSocket(): Promise<void> {
    this.ensureSessionFromStore();
    if (!this.session) {
      throw new Error("Session missing. Authenticate first.");
    }
    this.socket = this.client.createSocket(false, true);
    await this.socket.connect(this.session, true);
    this.registerSocketHandlers();
  }

  /** Disconnects realtime socket, drops session, clears auth and match state in the store. */
  logout(): void {
    if (this.socket) {
      this.socket.ondisconnect = async () => {};
      try {
        this.socket.disconnect(false);
      } catch {
        // ignore
      }
    }
    this.socket = null;
    this.session = null;
    useGameStore.getState().logout();
  }

  private registerSocketHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.ondisconnect = async () => {
      await this.safeReconnect();
    };

    this.socket.onmatchdata = (data) => {
      const payloadText = new TextDecoder().decode(data.data);
      const payload = JSON.parse(payloadText);
      const store = useGameStore.getState();
      if (data.op_code === OpCode.MATCH_START) {
        store.applyMatchStart(payload as MatchStartPayload);
      } else if (data.op_code === OpCode.STATE_UPDATE) {
        store.applyStateUpdate(payload as StateUpdatePayload);
      } else if (data.op_code === OpCode.STATE_SYNC) {
        store.applyStateSync(payload as StateSyncPayload);
      } else if (data.op_code === OpCode.MATCH_END) {
        store.applyMatchEnd(payload as MatchEndPayload);
      }
    };
  }

  private async safeReconnect(): Promise<void> {
    if (!this.session || !this.socket) {
      return;
    }
    try {
      await this.socket.connect(this.session, true);
      const matchId = useGameStore.getState().matchId;
      if (matchId) {
        await this.socket.joinMatch(matchId);
      }
    } catch {
      // Caller screen can surface retry UI if desired.
    }
  }

  async addMatchmaker(mode: "classic" | "timed"): Promise<void> {
    if (!this.socket) throw new Error("socket not connected");
    await this.socket.addMatchmaker("*", 2, 2, { mode }, {});
    this.socket.onmatchmakermatched = async (matched) => {
      const match = await this.socket!.joinMatch(matched.match_id);
      useGameStore.getState().setMatchId(match.match_id, "");
    };
  }

  async createPrivateMatch(mode: "classic" | "timed"): Promise<{ matchId: string; joinCode: string }> {
    this.ensureSessionFromStore();
    const rpc = await this.client.rpc(this.session!, "create_private_match", { mode });
    return this.parseRpcPayload<{ matchId: string; joinCode: string }>(rpc);
  }

  async createPublicMatch(mode: "classic" | "timed"): Promise<{ matchId: string; joinCode: string }> {
    this.ensureSessionFromStore();
    const rpc = await this.client.rpc(this.session!, "create_public_match", { mode });
    return this.parseRpcPayload<{ matchId: string; joinCode: string }>(rpc);
  }

  async listPublicMatches(limit = 20): Promise<Array<{ matchId: string; joinCode?: string | null; size?: number; label?: string }>> {
    this.ensureSessionFromStore();
    const rpc = await this.client.rpc(this.session!, "list_public_matches", { limit });
    return this.parseRpcPayload<{ matches: Array<{ matchId: string; joinCode?: string | null; size?: number; label?: string }> }>(rpc).matches;
  }

  async resolveJoinCode(code: string): Promise<string> {
    this.ensureSessionFromStore();
    const rpc = await this.client.rpc(this.session!, "resolve_join_code", { code: code.trim() });
    const r = this.parseRpcPayload<{ ok: boolean; matchId?: string; error?: string }>(rpc);
    if (!r.ok || !r.matchId) {
      throw new Error(r.error || "Invalid room code");
    }
    return r.matchId;
  }

  async joinMatchById(matchId: string, joinCode = ""): Promise<void> {
    if (!this.socket) throw new Error("socket not connected");
    await this.socket.joinMatch(matchId);
    useGameStore.getState().setMatchId(matchId, joinCode);
  }

  async sendMove(cellIndex: number): Promise<void> {
    if (!this.socket) throw new Error("socket not connected");
    const matchId = useGameStore.getState().matchId;
    if (!matchId) throw new Error("No active match");
    await this.socket.sendMatchState(matchId, OpCode.PLAYER_MOVE, JSON.stringify({ cellIndex }));
  }

  async fetchLeaderboard(limit = 20): Promise<unknown[]> {
    this.ensureSessionFromStore();
    const rpc = await this.client.rpc(this.session!, "fetch_leaderboard", { limit });
    const parsed = this.parseRpcPayload<{ leaderboard: unknown[] }>(rpc);
    return parsed.leaderboard;
  }

  async fetchPlayerStats(): Promise<unknown> {
    this.ensureSessionFromStore();
    const rpc = await this.client.rpc(this.session!, "fetch_player_stats", {});
    return this.parseRpcPayload<{ stats: unknown }>(rpc).stats;
  }
}

export const nakamaService = new NakamaService();
