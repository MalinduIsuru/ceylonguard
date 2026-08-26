import Link from "next/link";
import { ArrowRight, Check, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RoleCard({
  icon: Icon,
  title,
  description,
  features,
  cta,
  to,
  image,
  imageAlt,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  cta: string;
  to: "/register/farmer" | "/register/factory";
  image: string;
  imageAlt: string;
  tone: "farmer" | "factory";
}) {
  const isFarmer = tone === "farmer";
  return (
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-3xl border shadow-soft transition-all hover:-translate-y-1 hover:shadow-card",
        isFarmer ? "border-leaf/35 bg-card" : "border-border bg-secondary",
      )}
    >
      <div className="relative">
        <img
          src={image}
          alt={imageAlt}
          width={1024}
          height={768}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
        <span
          className={cn(
            "absolute left-4 top-4 grid size-11 place-items-center rounded-2xl text-primary-foreground shadow-(--shadow-leaf)",
            isFarmer ? "gradient-leaf" : "gradient-deep",
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6 lg:p-7">
        <h3 className="font-display text-2xl font-bold text-leaf-strong">
          {title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-foreground"
            >
              <Check
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  isFarmer ? "text-leaf" : "text-leaf-strong",
                )}
              />
              {feature}
            </li>
          ))}
        </ul>

        <Button
          asChild
          variant={isFarmer ? "hero" : "leafOutline"}
          size="xl"
          className="mt-8 w-full"
        >
          <Link href={to}>
            {cta} <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
