import { ArrowRight, CircleCheck } from "lucide-react";

import LeafScanCard from "@/components/landing/LeafScanCard";
import { Button } from "@/components/ui/button";

const AIDetectionPreview = () => {
  const conditions = [
    "Healthy",
    "Anthracnose",
    "Algal Leaf Spot",
    "Bird's Eye Spot",
    "Brown Blight",
    "Gray Blight",
    "Red Leaf Spot",
    "White Spot",
  ];
  return (
    <section
      id="ai-detection"
      className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24"
    >
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 lg:order-1">
          <LeafScanCard />
        </div>

        <div className="order-1 lg:order-2">
          <span className="eyebrow">Core Capability</span>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-leaf-strong sm:text-4xl">
            AI Powered Tea Leaf Health Analysis
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            CeylonGuard uses image based machine learning to identify tea leaf
            health conditions quickly and present farmers with understandable
            results.
          </p>

          <p className="mt-8 text-sm font-semibold text-leaf-strong">
            Sample detected conditions
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {conditions.map((condition) => (
              <li
                key={condition}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
              >
                {condition}
              </li>
            ))}
          </ul>

          <div className="surface-card mt-8 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-leaf-strong">
              <CircleCheck className="size-4 text-verified" /> Analysis Complete
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-xs text-muted-foreground">Condition</dt>
                <dd className="mt-1 font-display text-base font-bold text-leaf-strong">
                  Healthy
                </dd>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-xs text-muted-foreground">Confidence</dt>
                <dd className="mt-1 font-display text-base font-bold text-leaf-strong">
                  96.8%
                </dd>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1 font-display text-base font-bold text-verified">
                  Disease Free Verified
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Predictions are a product capability demonstration and support
              farmer decision making rather than replacing agricultural
              expertise.
            </p>
          </div>

          <Button variant="hero" size="xl" className="mt-7">
            Explore AI Detection
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default AIDetectionPreview;
