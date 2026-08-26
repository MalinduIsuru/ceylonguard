import { Eye, Leaf, LineChart, Users } from "lucide-react";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { SectionHeading } from "@/components/landing/SectionHeading";

const BenefitsSection = () => {
  const benefits = [
    {
      icon: Leaf,
      title: "Protect Crop Quality",
      description:
        "Detect possible tea leaf diseases before publishing harvests.",
    },
    {
      icon: Users,
      title: "Improve Market Access",
      description:
        "Help farmers connect directly with suitable factory buyers.",
    },
    {
      icon: LineChart,
      title: "Smarter Procurement",
      description:
        "Allow factories to discover compatible supplies more efficiently.",
    },
    {
      icon: Eye,
      title: "Better Transparency",
      description:
        "Use AI verification and structured marketplace information to create clearer transactions.",
    },
  ];
  return (
    <section className="border-t border-border bg-leaf-soft/40 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Why CeylonGuard"
          title="Value for the Whole Supply Chain"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <FeatureCard key={benefit.title} {...benefit} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsSection;
