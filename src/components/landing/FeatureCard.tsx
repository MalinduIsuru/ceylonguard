import type { LucideIcon } from "lucide-react";

export function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <article className="surface-card group h-full p-6 transition-all hover:-translate-y-1 hover:shadow-card">
      <span className="grid size-12 place-items-center rounded-2xl bg-leaf-soft text-leaf-strong transition-colors group-hover:gradient-leaf group-hover:text-primary-foreground">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-5 font-display text-lg font-semibold text-leaf-strong">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
