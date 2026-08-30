"use client";

import {
  Bug,
  CircleAlert,
  Eye,
  Leaf,
  ShieldCheck,
  Sprout,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";

import ConfidenceRing from "@/components/dashboard/disease-detect/ConfidenceRing";
import { LOW_CONFIDENCE_THRESHOLD, type ScanSuccess } from "@/lib/disease-detect";
import { SEVERITY_META, isHealthy } from "@/lib/disease-info";

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-leaf-strong">
        <span className="grid size-7 place-items-center rounded-lg bg-leaf-soft text-leaf-strong">
          {icon}
        </span>
        {title}
      </h3>

      {children}
    </div>
  );
}

function ScanResult({ result }: { result: ScanSuccess }) {
  const { info, confidence, predictions, model, rawLabel } = result;

  const severity = SEVERITY_META[info.severity];
  const healthy = isHealthy(info);
  const isUncertain = confidence < LOW_CONFIDENCE_THRESHOLD;

  // The winner is already shown in the hero, so only offer the runners-up.
  const alternatives = predictions
    .filter((row) => row.disease !== rawLabel)
    .slice(0, 3);

  return (
    <div className="grid animate-rise gap-5">
      {/* Headline diagnosis */}
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-2xl ${severity.icon}`}
          >
            {healthy ? <Leaf className="size-6" /> : <TriangleAlert className="size-6" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold leading-tight text-leaf-strong">
                {info.label}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${severity.chip}`}
              >
                {severity.label}
              </span>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {info.labelSi} · <span className="italic">{info.pathogen}</span>
            </p>
          </div>

          <ConfidenceRing value={confidence} stroke={severity.stroke} />
        </div>

        <p className="border-t border-border bg-secondary/50 px-5 py-4 text-sm leading-relaxed text-foreground sm:px-6">
          {info.summary}
        </p>

        <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-6">
          Model: <span className="font-medium text-foreground">{model}</span>
          {" · "}
          Raw class: <span className="font-mono">{rawLabel}</span>
        </p>
      </div>

      {isUncertain && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />

          <div>
            <p className="text-sm font-semibold text-amber-900">
              Low confidence prediction
            </p>

            <p className="mt-1 text-sm leading-relaxed text-amber-800">
              The model is only {confidence.toFixed(1)}% sure. Re-shoot the leaf
              filling the frame, in daylight, against a plain background — and
              confirm with an agriculture instructor before spraying anything.
            </p>
          </div>
        </div>
      )}

      {/* Treatment plan — the reason the farmer opened this page */}
      <SectionCard icon={<Stethoscope className="size-4" />} title="Treatment Plan">
        <ol className="mt-4 grid gap-0">
          {info.treatments.map((step, index) => (
            <li key={step.title} className="relative flex gap-4 pb-5 last:pb-0">
              {index < info.treatments.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[0.9375rem] top-9 bottom-1 w-px bg-border"
                />
              )}

              <span
                className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  healthy
                    ? "gradient-leaf text-primary-foreground"
                    : "bg-leaf-strong text-primary-foreground"
                }`}
              >
                {index + 1}
              </span>

              <div className="min-w-0 pt-1">
                <p className="text-sm font-semibold text-leaf-strong">{step.title}</p>

                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 rounded-xl bg-secondary p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="mr-1.5 inline size-3.5 -translate-y-px" />
          Always follow the label rate and pre-harvest interval on any product,
          and check with your TRI advisory officer before treating a full block.
        </p>
      </SectionCard>

      {info.symptoms.length > 0 && (
        <SectionCard icon={<Eye className="size-4" />} title="What to Look For">
          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {info.symptoms.map((symptom) => (
              <li
                key={symptom}
                className="flex gap-2.5 rounded-xl bg-secondary px-3.5 py-3 text-sm leading-relaxed text-foreground"
              >
                <Bug className="mt-0.5 size-4 shrink-0 text-leaf" />
                {symptom}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {info.prevention.length > 0 && (
        <SectionCard icon={<Sprout className="size-4" />} title="Stop It Coming Back">
          <ul className="mt-4 grid gap-2">
            {info.prevention.map((tip) => (
              <li
                key={tip}
                className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-leaf" />
                {tip}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {alternatives.length > 0 && (
        <div className="surface-card p-5 sm:p-6">
          <h3 className="font-display text-base font-bold text-leaf-strong">
            Other Possibilities
          </h3>

          <p className="mt-1 text-xs text-muted-foreground">
            The next most likely classes the model considered.
          </p>

          <ul className="mt-4 grid gap-3">
            {alternatives.map((row) => (
              <li key={row.disease}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-foreground">
                    {row.label}
                  </span>

                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {row.confidence.toFixed(1)}%
                  </span>
                </div>

                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-leaf/60 transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(row.confidence, 0.5)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ScanResult;
