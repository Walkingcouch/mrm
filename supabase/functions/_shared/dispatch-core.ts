// Push dispatch logic, free of Deno/Node specifics so it can be unit-tested.
// The database (push_claim_batch etc.) is the source of truth for idempotency
// and the 24-hour deadline; this module only moves batches to Expo.

export interface ClaimedRecipient {
  installation_id: string;
  push_token: string;
  title: string;       // source name, or "Emergency Notification"
  body: string;        // short preview, or a read-now line for emergencies
  expiration: number;  // unix seconds: absolute 24h deadline (never reset)
  message_id: string;
  urgent?: boolean;    // global emergency: Android "Emergency messages" channel
}

export interface DeliveryResult {
  installation_id: string;
  ok: boolean;
  ticket_id?: string;
  error_code?: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { message_id: string };
  expiration: number;
  priority: 'high' | 'default';
  sound: 'default';
  channelId: string;
}

export interface Deps {
  claimBatch(messageId: string, limit: number): Promise<ClaimedRecipient[]>;
  recordResults(messageId: string, results: DeliveryResult[]): Promise<void>;
  finish(messageId: string): Promise<string | null>;
  sendToExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
  now(): number; // unix seconds
}

export type ExpoTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };

export const EXPO_BATCH = 100; // Expo Push API maximum per request
export const ANDROID_CHANNEL = 'messages';
export const ANDROID_EMERGENCY_CHANNEL = 'emergency';

export function toExpoMessage(r: ClaimedRecipient): ExpoMessage {
  return {
    to: r.push_token,
    title: r.title,
    body: r.body,
    // Only the id travels in the payload; the app fetches the message and any
    // attachments after the user taps.
    data: { message_id: r.message_id },
    expiration: r.expiration,
    priority: 'high',
    sound: 'default',
    channelId: r.urgent ? ANDROID_EMERGENCY_CHANNEL : ANDROID_CHANNEL,
  };
}

export function ticketsToResults(batch: ClaimedRecipient[], tickets: ExpoTicket[] | null, transportError?: string): DeliveryResult[] {
  return batch.map((r, i) => {
    const t = tickets?.[i];
    if (!t) return { installation_id: r.installation_id, ok: false, error_code: transportError ?? 'NoTicket' };
    if (t.status === 'ok') return { installation_id: r.installation_id, ok: true, ticket_id: t.id };
    return { installation_id: r.installation_id, ok: false, error_code: t.details?.error ?? 'ExpoError' };
  });
}

export interface DispatchSummary { message_id: string; sent: number; failed: number; status: string | null }

/** Dispatch one message: claim batches until none remain, send, record. */
export async function dispatchMessage(deps: Deps, messageId: string, maxBatches = 200): Promise<DispatchSummary> {
  let sent = 0, failed = 0;
  for (let i = 0; i < maxBatches; i++) {
    const batch = await deps.claimBatch(messageId, EXPO_BATCH);
    if (batch.length === 0) break;
    // Belt and braces: never hand Expo a message whose window has closed.
    const live = batch.filter((r) => r.expiration > deps.now());
    let results: DeliveryResult[];
    let transportFailed = false;
    if (live.length === 0) {
      results = batch.map((r) => ({ installation_id: r.installation_id, ok: false, error_code: 'Expired' }));
    } else {
      try {
        const tickets = await deps.sendToExpo(live.map(toExpoMessage));
        results = ticketsToResults(live, tickets);
      } catch (e) {
        transportFailed = true;
        results = ticketsToResults(live, null, e instanceof Error ? e.name || 'TransportError' : 'TransportError');
      }
      const skipped = batch.filter((r) => !live.includes(r))
        .map((r) => ({ installation_id: r.installation_id, ok: false, error_code: 'Expired' }));
      results = results.concat(skipped);
    }
    await deps.recordResults(messageId, results);
    sent += results.filter((r) => r.ok).length;
    failed += results.filter((r) => !r.ok).length;
    // A transport failure (network/HTTP) is retried by the scheduled sweep,
    // not in this loop, so one outage cannot burn through all attempts.
    if (transportFailed) break;
  }
  const status = await deps.finish(messageId);
  return { message_id: messageId, sent, failed, status };
}

/** POST to the Expo Push API. Throws on HTTP/transport failure. */
export async function sendToExpoHttp(messages: ExpoMessage[], accessToken?: string, fetchImpl: typeof fetch = fetch): Promise<ExpoTicket[]> {
  const res = await fetchImpl('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const err = new Error(`Expo push HTTP ${res.status}`);
    err.name = `ExpoHttp${res.status}`;
    throw err;
  }
  const json = await res.json() as { data?: ExpoTicket[] };
  if (!Array.isArray(json.data)) throw Object.assign(new Error('Malformed Expo response'), { name: 'ExpoMalformed' });
  return json.data;
}
