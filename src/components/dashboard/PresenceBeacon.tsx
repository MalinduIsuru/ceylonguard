"use client";

import { useOnlineUsers } from "@/hooks/use-presence";

/**
 * Announces that this account has CeylonGuard open. Draws nothing.
 *
 * It lives in the dashboard layout rather than in the chat page on purpose. An
 * online dot beside a trader is only worth anything if it means "reachable",
 * and the person you want to message is usually on the marketplace or their
 * offers inbox rather than sitting in the chat. Joining from the layout is
 * what makes the dot true for the whole dashboard.
 */
const PresenceBeacon = () => {
  useOnlineUsers();

  return null;
};

export default PresenceBeacon;
