import "server-only";
import { PostHog } from "posthog-node";
import type { FunnelEventMap, FunnelEventName } from "./events";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!KEY) return null;
  if (client) return client;
  client = new PostHog(KEY, {
    host: HOST,
    flushAt: 1, // serverless: flush immediately, don't batch
    flushInterval: 0,
  });
  return client;
}

/**
 * Fire-and-forget server-side capture. Used by the Asaas webhook and any
 * other server action that needs to record a funnel event the browser
 * cannot see (payment confirmation, subscription started).
 *
 * `distinctId` is the Supabase user id when we know it — matches what the
 * client sends after `identifyUser(userId)`. Anonymous events are not
 * supported on the server path (we'd have no way to tie them to a person).
 */
export async function trackServer<E extends FunnelEventName>(
  distinctId: string,
  event: E,
  properties: FunnelEventMap[E],
): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({
      distinctId,
      event,
      properties: properties as Record<string, unknown>,
    });
    // serverless: ensure delivery before the function exits
    await ph.flush();
  } catch (err) {
    console.warn("[analytics] server capture failed", err);
  }
}
