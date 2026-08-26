import { ScanFace, ShieldCheck, Tag, Store } from "lucide-react";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { SectionHeading } from "@/components/landing/SectionHeading";

const PlatformIntro = () => {
  const features = [
    {
      icon: ScanFace,
      title: "AI Disease Detection",
      description:
        "Farmers upload or capture a tea leaf image and AI analyses the leaf for common tea diseases.",
    },
    {
      icon: ShieldCheck,
      title: "Disease Free Verification",
      description:
        "Healthy leaves receive an AI Disease Free verification that allows farmers to create marketplace listings.",
    },
    {
      icon: Tag,
      title: "Direct Buyer Offers",
      description:
        "Factory managers browse verified harvest listings and send price offers straight to the farmer.",
    },
    {
      icon: Store,
      title: "Direct Marketplace",
      description:
        "Farmers and factory managers can communicate, negotiate and trade without unnecessary intermediaries.",
    },
  ];
  return (
    <section
      id="about"
      className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24"
    >
      <SectionHeading
        eyebrow="One Platform for Better Tea Agriculture"
        title="From Leaf Health to Factory Connection"
        description="CeylonGuard brings crop health assessment and agricultural trading together in one digital platform, so a healthy harvest becomes a verified, sellable harvest in a few simple steps."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  );
};

export default PlatformIntro;
