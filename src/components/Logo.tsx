import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-2xl gradient-leaf shadow-(--shadow-leaf)",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-6" fill="none">
        <path
          d="M16 3.2 26.4 6.8v8.9c0 6.6-4.3 11.2-10.4 13.1C9.9 26.9 5.6 22.3 5.6 15.7V6.8L16 3.2Z"
          fill="oklch(1 0 0 / 0.16)"
          stroke="oklch(1 0 0 / 0.9)"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M16 9.4c3.9 1.6 5.8 4.5 5.5 8.2-.2 2.4-1.9 4.4-5.5 6-3.6-1.6-5.3-3.6-5.5-6-.3-3.7 1.6-6.6 5.5-8.2Z"
          fill="oklch(1 0 0 / 0.95)"
        />
        <path
          d="M16 10.6v11.4"
          stroke="oklch(0.45 0.11 152)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ withTagline = false }: { withTagline?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <LogoMark />
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-bold tracking-tight text-leaf-strong">
          CeylonGuard
        </span>
        {withTagline ? (
          <span className="hidden truncate text-[0.68rem] font-medium text-muted-foreground lg:block">
            Smart Tea. Healthy Harvests. Better Connections.
          </span>
        ) : null}
      </span>
    </span>
  );
}
