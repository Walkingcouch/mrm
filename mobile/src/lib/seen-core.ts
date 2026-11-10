// Pure logic for local seen-state and notification-tap de-duplication, kept
// free of React Native imports so it can be unit-tested with Node.

export interface KV { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> }

const MAX_IDS = 500;

export class IdSet {
  private ids: string[] | null = null;
  private kv: KV;
  private key: string;
  constructor(kv: KV, key: string) { this.kv = kv; this.key = key; }
  private async load(): Promise<string[]> {
    if (this.ids) return this.ids;
    try { this.ids = JSON.parse((await this.kv.get(this.key)) ?? '[]'); } catch { this.ids = []; }
    return this.ids!;
  }
  async has(id: string): Promise<boolean> { return (await this.load()).includes(id); }
  async all(): Promise<Set<string>> { return new Set(await this.load()); }
  /** Returns true if newly added. */
  async add(id: string): Promise<boolean> {
    const ids = await this.load();
    if (ids.includes(id)) return false;
    ids.push(id);
    if (ids.length > MAX_IDS) ids.splice(0, ids.length - MAX_IDS);
    await this.kv.set(this.key, JSON.stringify(ids));
    return true;
  }
}

/**
 * Decide whether a tapped notification should navigate. Each OS notification
 * (identified by its request identifier) navigates at most once, so the
 * cold-start "last response" and the live listener cannot both navigate, and
 * re-renders/resumes never re-open it. Only explicit taps reach this path;
 * received-but-not-tapped notifications never navigate.
 */
export async function shouldNavigateForTap(
  handled: IdSet, notificationId: string, data: unknown, isDefaultAction: boolean,
): Promise<string | null> {
  if (!isDefaultAction) return null;
  const messageId = (data as { message_id?: unknown } | null)?.message_id;
  if (typeof messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(messageId)) return null;
  const isNew = await handled.add(notificationId);
  return isNew ? messageId : null;
}
