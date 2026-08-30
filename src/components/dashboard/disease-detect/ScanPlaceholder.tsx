import { Cpu, Images, Sun, Target } from "lucide-react";

import { ALL_DISEASES, SEVERITY_META } from "@/lib/disease-info";

const SHOOTING_TIPS = [
  {
    icon: <Target className="size-4" />,
    title: "Fill the frame",
    detail: "One leaf, centred, taking up most of the photo.",
  },
  {
    icon: <Sun className="size-4" />,
    title: "Shoot in daylight",
    detail: "Indirect light with no harsh shadow across the leaf.",
  },
  {
    icon: <Images className="size-4" />,
    title: "Plain background",
    detail: "A hand, paper or cloth behind the leaf helps a lot.",
  },
];

/** Shown before the first scan, in place of the result column. */
function ScanPlaceholder() {
  return (
    <div className="grid gap-5">
      <div className="surface-card p-5 sm:p-6">
        <span className="eyebrow">
          <Cpu className="size-3.5" />
          Ready
        </span>

        <h2 className="mt-3 font-display text-lg font-bold text-leaf-strong">
          Your diagnosis will appear here
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Upload or capture a tea leaf photo and the trained Keras model will
          return the condition, how confident it is, and a step-by-step
          treatment plan you can act on today.
        </p>

        <ul className="mt-5 grid gap-3">
          {SHOOTING_TIPS.map((tip) => (
            <li key={tip.title} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-leaf-soft text-leaf-strong">
                {tip.icon}
              </span>

              <div>
                <p className="text-sm font-semibold text-foreground">{tip.title}</p>

                <p className="text-sm text-muted-foreground">{tip.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="surface-card p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-leaf-strong">
          Eight Classified Conditions
        </h2>

        <p className="mt-1 text-xs text-muted-foreground">
          Every class the model can return, with its field severity.
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {ALL_DISEASES.map((disease) => (
            <li
              key={disease.key}
              className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-xs font-medium text-foreground">
                {disease.label}
              </span>

              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                  SEVERITY_META[disease.severity].chip
                }`}
              >
                {disease.severity === "healthy"
                  ? "Healthy"
                  : SEVERITY_META[disease.severity].label.replace(" severity", "")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ScanPlaceholder;
