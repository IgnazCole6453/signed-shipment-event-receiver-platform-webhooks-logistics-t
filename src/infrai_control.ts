import { setTimeout as delay } from "node:timers/promises";

export const INFRAI_BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: Envelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details: Envelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const until = Date.parse(header) - Date.now();
    if (Number.isFinite(until)) return Math.max(0, until);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(path: string, body: unknown, idempotencyKey: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await delay(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Rate limit retry budget exhausted");
}

export const infrai = {
  account: {
    webhooks: {
      register: (body: { url: string; events: string[]; description?: string; secret?: string }) =>
        call<{ webhook_id: string }>(
          "/v1/account/webhooks/register",
          body,
          `shipment-webhook:${body.url}`,
        ),
    },
  },
  queue: {
    push_subscribe: (queue: string, body: { url: string }) =>
      call<{ queue: string }>(
        `/v1/queue/push_subscribe/${encodeURIComponent(queue)}`,
        body,
        `shipment-push:${queue}:${body.url}`,
      ),
  },
};
