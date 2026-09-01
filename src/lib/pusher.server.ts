import "server-only";

import Pusher from "pusher";

/**
 * The Pusher connection the routes broadcast through.
 *
 * Held on `globalThis` for the same reason the Mongo connection is: the dev
 * server re-evaluates modules on every edit, and a fresh HTTP client per edit
 * leaks sockets.
 *
 * Everything here degrades rather than throws when the credentials are absent.
 * A deployment without Pusher keys still has a working chat — messages are
 * persisted and read back over HTTP, they just do not arrive by themselves —
 * and `realtimeConfigured` is what the client polls behind.
 */

const appId = process.env.PUSHER_APP_ID;
const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const realtimeConfigured = Boolean(appId && key && secret && cluster);

declare global {
  var pusherServer: Pusher | undefined;
}

function client(): Pusher | null {
  if (!realtimeConfigured) return null;

  if (!global.pusherServer) {
    global.pusherServer = new Pusher({
      appId: appId!,
      key: key!,
      secret: secret!,
      cluster: cluster!,
      useTLS: true,
    });
  }

  return global.pusherServer;
}

/** The raw client, for the endpoints that have to sign a channel. */
export function pusherServer(): Pusher | null {
  return client();
}

/**
 * Fires an event, and never lets a broadcast failure fail the request.
 *
 * The database write has already happened by the time this is called: if
 * Pusher is down the message still exists, and the recipient sees it on their
 * next read. Turning that into a 5xx would be a worse outcome than a message
 * that arrives a moment late.
 */
export async function broadcast(
  channel: string | string[],
  event: string,
  payload: unknown,
  /**
   * The connection that caused the event, when it should not hear its own
   * echo. Used for typing pings, where the sender already knows.
   */
  exceptSocketId?: string,
): Promise<void> {
  const pusher = client();

  if (!pusher) return;

  try {
    await pusher.trigger(
      channel,
      event,
      payload,
      exceptSocketId ? { socket_id: exceptSocketId } : undefined,
    );
  } catch (error) {
    console.error("[chat] Realtime broadcast failed", { channel, event, error });
  }
}
