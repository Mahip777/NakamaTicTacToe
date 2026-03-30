/**
 * Turns fetch/Nakama errors (often a Response or plain object) into text for alerts.
 */
export async function errorMessage(error: unknown): Promise<string> {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") {
      return o.message;
    }
    if (typeof o.error === "string") {
      return o.error;
    }
  }
  if (typeof Response !== "undefined" && error instanceof Response) {
    let body = "";
    try {
      body = (await error.text()).trim();
    } catch {
      /* ignore */
    }
    const snippet = body.length > 400 ? `${body.slice(0, 400)}…` : body;
    return `HTTP ${error.status}${snippet ? `: ${snippet}` : ""}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
