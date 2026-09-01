"use client";

import { ArrowLeft, MapPin, Phone, WifiOff } from "lucide-react";

import PartnerAvatar from "@/components/dashboard/chat/PartnerAvatar";
import { Button } from "@/components/ui/button";
import type { ChatConversation } from "@/lib/chat";

/**
 * Who you are talking to.
 *
 * Two presence signals reach here and they are not the same thing. `inThread`
 * comes off the thread's own presence channel and means they are reading this
 * conversation right now; `online` comes off the app-wide roster and only
 * means they have CeylonGuard open. The dot reports the second — reachable is
 * what a dot means everywhere else in the app — and the line underneath is
 * where the sharper one gets said out loud.
 */

type Props = {
  conversation: ChatConversation;
  /** True while the other side has this same thread open. */
  inThread: boolean;
  /** True while they have CeylonGuard open anywhere. Implied by `inThread`. */
  online: boolean;
  /** False when events are not arriving — the header says so rather than lie. */
  live: boolean;
  onBack: () => void;
};

const ThreadHeader = ({
  conversation,
  inThread,
  online,
  live,
  onBack,
}: Props) => {
  const { partner } = conversation;

  return (
    <header className="shrink-0 border-b border-border/70 bg-white/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="size-4" />
        </Button>

        {/* The dot means the same thing everywhere: reachable right now.
            Which screen they are on is left to the line underneath. */}
        <PartnerAvatar
          participant={partner}
          size="lg"
          online={online || inThread}
        />

        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-bold text-leaf-strong">
            {partner.name}
          </h2>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="rounded-full bg-secondary px-1.5 py-0.5 font-semibold uppercase tracking-wide">
              {partner.role === "factory" ? "Tea factory" : "Tea farmer"}
            </span>

            {inThread ? (
              <span className="font-semibold text-leaf-strong">
                Active in this chat
              </span>
            ) : online ? (
              <span className="font-semibold text-leaf-strong">Online</span>
            ) : live ? (
              <span>Offline</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <WifiOff className="size-3" /> Reconnecting
              </span>
            )}

            {partner.district ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {partner.district}
              </span>
            ) : null}
          </p>
        </div>

        {partner.phone ? (
          <Button asChild variant="leafOutline" size="sm" className="shrink-0">
            <a href={`tel:${partner.phone}`}>
              <Phone className="size-3.5" />
              <span className="hidden sm:inline">Call</span>
            </a>
          </Button>
        ) : null}
      </div>
    </header>
  );
};

export default ThreadHeader;
