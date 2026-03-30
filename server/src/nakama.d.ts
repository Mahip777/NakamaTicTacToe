declare namespace nkruntime {
  type MatchState = Record<string, unknown>;
  interface Presence {
    userId: string;
    sessionId: string;
    username: string;
  }
  interface MatchData {
    opCode: number;
    data: Uint8Array;
    sender: Presence;
  }
  interface Match {
    matchId: string;
    size?: number;
    label?: string;
  }
  interface MatchmakerUser {
    properties?: Record<string, unknown>;
  }
  interface EnvelopeMatchmakerAdd {
    matchmakerAdd: {
      stringProperties: Record<string, string>;
    };
  }
  interface Context {
    userId: string;
    executionMode?: number;
    matchId?: string;
  }
  interface Logger {
    info(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
  }
  interface MatchDispatcher {
    broadcastMessage(opCode: number, data: string, presences: Presence[] | null, sender: Presence | null, reliable: boolean): void;
    matchLabelUpdate(label: string): void;
  }
  interface Nakama {
    matchCreate(moduleName: string, params?: Record<string, unknown>): string;
    matchList(limit: number, authoritative: boolean, label: string | null, minSize: number | null, minCount: number, maxCount: number, query: string): Match[];
    sqlExec(query: string, params?: unknown[]): void;
    sqlQuery(query: string, params?: unknown[]): Array<Record<string, unknown>>;
    binaryToString(data: Uint8Array): string;
  }
  type RpcFunction = (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string;
  type MatchmakerMatchedFunction = (ctx: Context, logger: Logger, nk: Nakama, matchedUsers: MatchmakerUser[]) => string;
  type BeforeHookFunction<T> = (ctx: Context, logger: Logger, nk: Nakama, envelope: T) => T;
  interface Initializer {
    registerMatch(name: string, handler: MatchHandler<any>): void;
    registerMatchmakerMatched(fn: MatchmakerMatchedFunction): void;
    registerRtBefore(name: string, fn: BeforeHookFunction<any>): void;
    registerRpc(name: string, fn: RpcFunction): void;
  }
  type InitModule = (ctx: Context, logger: Logger, nk: Nakama, initializer: Initializer) => void;

  type MatchInitFunction<T> = (ctx: Context, logger: Logger, nk: Nakama, params: Record<string, unknown>) => {
    state: T;
    tickRate: number;
    label: string;
  };
  type MatchJoinAttemptFunction<T> = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: T,
    presence: Presence,
    metadata: Record<string, unknown>
  ) => { state: T; accept: boolean; rejectMessage?: string };
  type MatchJoinFunction<T> = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: T,
    presences: Presence[]
  ) => { state: T };
  type MatchLeaveFunction<T> = MatchJoinFunction<T>;
  type MatchLoopFunction<T> = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: T,
    messages: MatchData[]
  ) => { state: T } | null;
  type MatchTerminateFunction<T> = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: T,
    graceSeconds: number
  ) => { state: T };
  type MatchSignalFunction<T> = (
    ctx: Context,
    logger: Logger,
    nk: Nakama,
    dispatcher: MatchDispatcher,
    tick: number,
    state: T,
    data: string
  ) => { state: T; data: string };
  interface MatchHandler<T> {
    matchInit: MatchInitFunction<T>;
    matchJoinAttempt: MatchJoinAttemptFunction<T>;
    matchJoin: MatchJoinFunction<T>;
    matchLeave: MatchLeaveFunction<T>;
    matchLoop: MatchLoopFunction<T>;
    matchTerminate: MatchTerminateFunction<T>;
    matchSignal: MatchSignalFunction<T>;
  }
}
