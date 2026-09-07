import { Camera, Cpu, ShieldCheck, Upload, Handshake } from "lucide-react";

import { SectionHeading } from "@/components/landing/SectionHeading";

const HowItWorks = () => {
  const steps = [
    {
      icon: Camera,
      title: "Scan Your Tea Leaf",
      description: "Farmer uploads or captures a tea leaf image.",
    },
    {
      icon: Cpu,
      title: "AI Analyses the Leaf",
      description:
        "The trained AI model checks the leaf condition and provides a prediction with confidence score.",
    },
    {
      icon: ShieldCheck,
      title: "Read the Diagnosis",
      description:
        "Every scan comes back with the symptoms to look for and a treatment plan for the block.",
    },
    {
      icon: Upload,
      title: "Publish Your Harvest",
      description:
        "List your available tea harvest at any time — quantity, price, district and harvest date.",
    },
    {
      icon: Handshake,
      title: "Deal Directly with Factories",
      description:
        "Factory managers browse the marketplace, send price offers and negotiate with you in chat — no middleman.",
    },
  ];
  return (
    <section
      id="how-it-works"
      className="border-y border-border bg-leaf-soft/40 py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Process"
          title="How CeylonGuard Works"
          description="A smarter path from tea leaf inspection to successful sale."
        />

        <ol className="relative mt-12 grid gap-5 lg:grid-cols-5">
          <span
            aria-hidden="true"
            className="absolute left-[7%] right-[7%] top-9 hidden h-0.5 bg-sage lg:block"
          />
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="surface-card h-full p-5 transition-all hover:-translate-y-1 hover:shadow-card">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl gradient-leaf text-primary-foreground shadow-(--shadow-leaf)">
                    <step.icon className="size-5" />
                  </span>
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-leaf-strong">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default HowItWorks;
