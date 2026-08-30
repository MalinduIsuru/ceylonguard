type ConfidenceRingProps = {
  /** Percentage, 0 to 100. */
  value: number;
  /** Any CSS colour — pass SEVERITY_META[...].stroke. */
  stroke: string;
  size?: number;
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Radial gauge for the winning class probability. */
function ConfidenceRing({ value, stroke, size = 104 }: ConfidenceRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Model confidence ${clamped.toFixed(1)} percent`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          className="stroke-muted"
        />

        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold tabular-nums text-leaf-strong">
          {clamped.toFixed(1)}
          <span className="text-sm">%</span>
        </span>

        <span className="-mt-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Confidence
        </span>
      </div>
    </div>
  );
}

export default ConfidenceRing;
