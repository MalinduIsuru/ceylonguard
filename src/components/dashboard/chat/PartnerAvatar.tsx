"use client";

import { initialsOf, type ChatParticipant } from "@/lib/chat";

/**
 * The other side of the trade, as a circle.
 *
 * Profile photos come from Clerk and are already served from a remote host, so
 * this stays a plain `img` rather than `next/image` — the app has no remote
 * pattern configured, and an avatar is not worth adding one for.
 *
 * The live ring is only drawn when someone actually has the thread open, which
 * is what the presence channel reports.
 */

type Props = {
  participant: ChatParticipant;
  size?: "sm" | "md" | "lg";
  online?: boolean;
};

const SIZES = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-12 text-base",
} as const;

const DOT = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-3.5",
} as const;

const PartnerAvatar = ({ participant, size = "md", online }: Props) => (
  <span className="relative shrink-0">
    <span
      className={`grid ${SIZES[size]} place-items-center overflow-hidden rounded-full font-semibold ring-2 ring-white ${
        participant.role === "factory"
          ? "gradient-deep text-white"
          : "gradient-leaf text-white"
      }`}
    >
      {participant.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={participant.imageUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        initialsOf(participant.name)
      )}
    </span>

    {online ? (
      <span
        className={`absolute -bottom-0.5 -right-0.5 ${DOT[size]} rounded-full border-2 border-white bg-leaf`}
      >
        <span className="absolute inset-0 animate-halo rounded-full bg-leaf" />
      </span>
    ) : null}
  </span>
);

export default PartnerAvatar;
