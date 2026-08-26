import {
  ArrowRight,
  Leaf,
  ShieldCheck,
  Sparkles,
  Handshake,
} from "lucide-react";

import LeafScanCard from "@/components/landing/LeafScanCard";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  const indicators = [
    {
      icon: Sparkles,
      label: "AI Powered Disease Detection",
    },
    {
      icon: ShieldCheck,
      label: "Disease Free Verification",
    },
    {
      icon: Handshake,
      label: "Direct Factory Deals",
    },
  ];
  return (
    <section id="top" className="relative overflow-hidden gradient-mist">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-40 size-136 rounded-full bg-sage opacity-50 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-28 lg:pt-20">
        <div className="animate-rise">
          <span className="eyebrow">
            <Leaf className="size-3.5" /> Sri Lankan AgriTech
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] text-leaf-strong sm:text-5xl lg:text-6xl">
            Healthier Tea.
            <br />
            Smarter Trading.
            <br />
            Stronger Connections.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            CeylonGuard combines AI powered tea leaf disease detection with a
            smart agricultural marketplace, helping Sri Lankan tea farmers
            protect their harvests and connect directly with suitable factory
            buyers.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button variant="hero" size="xl">
              Get Started
              <ArrowRight className="size-4" />
            </Button>
            <Button asChild variant="leafOutline" size="xl">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>

          <p className="mt-7 text-sm font-medium text-muted-foreground">
            Built for Sri Lanka's tea farming community
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {indicators.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-leaf-strong shadow-soft"
              >
                <item.icon className="size-3.5 text-leaf" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-rise [animation-delay:120ms]">
          <LeafScanCard />
        </div>
      </div>
    </section>
  );
};

export { HeroSection };
export default HeroSection;
