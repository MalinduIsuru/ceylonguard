import Image from "next/image";
import { ShieldCheck, ScanLine, Sparkles } from "lucide-react";

import leafImage from "@public/tea-leaf-scan.jpg";

const LeafScanCard = () => {
  return (
    <div className="surface-card p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-leaf-strong">
          <ScanLine className="size-4" /> Leaf Analysis
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-1 text-[0.7rem] font-semibold text-leaf-strong">
          <span className="size-1.5 animate-pulse rounded-full bg-verified" />{" "}
          AI Scan
        </span>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl">
        <Image
          src={leafImage}
          alt="Close-up of a fresh Ceylon tea leaf being analysed for disease"
          width={1024}
          height={1024}
          className="aspect-4/3 w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-6 rounded-xl border-2 border-primary-foreground/70" />
          <span className="absolute left-4 top-4 size-6 rounded-tl-lg border-l-3 border-t-3 border-verified" />
          <span className="absolute right-4 top-4 size-6 rounded-tr-lg border-r-3 border-t-3 border-verified" />
          <span className="absolute bottom-4 left-4 size-6 rounded-bl-lg border-b-3 border-l-3 border-verified" />
          <span className="absolute bottom-4 right-4 size-6 rounded-br-lg border-b-3 border-r-3 border-verified" />
          <span className="absolute left-6 right-6 h-0.5 animate-scanline bg-primary-foreground shadow-[0_0_16px_oklch(0.66_0.16_143)]" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-xs font-medium text-muted-foreground">Result</p>
          <p className="font-display text-lg font-bold text-leaf-strong">
            Healthy
          </p>
        </div>
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Confidence
          </p>
          <p className="font-display text-lg font-bold text-leaf-strong">
            96.8%
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl gradient-deep p-3.5 text-primary-foreground">
        <ShieldCheck className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            No Disease Detected
          </p>
          <p className="truncate text-xs opacity-80">
            Keep to the routine care schedule
          </p>
        </div>
        <Sparkles className="ml-auto size-4 shrink-0 opacity-80" />
      </div>
    </div>
  );
};

export default LeafScanCard;
