import { Leaf, ShieldCheck } from "lucide-react";

const VerificationHighlight = () => {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
      <div className="surface-card grid items-center gap-10 overflow-hidden bg-leaf-soft p-8 lg:grid-cols-[auto_1fr] lg:p-12">
        <div className="relative mx-auto grid size-40 place-items-center rounded-full bg-card shadow-card">
          <span className="grid size-28 place-items-center rounded-full gradient-deep text-primary-foreground">
            <ShieldCheck className="size-12" />
          </span>
          <span className="absolute bottom-3 right-3 grid size-11 place-items-center rounded-full gradient-leaf text-primary-foreground shadow-(--shadow-leaf)">
            <Leaf className="size-5" />
          </span>
        </div>
        <div>
          <span className="eyebrow">Quality Signal</span>
          <h2 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
            Verified Health Before Marketplace Listing
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Farmers can create harvest listings only after receiving the AI
            Disease Free verification, keeping the marketplace focused on
            healthy tea leaves.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold text-leaf-strong shadow-soft">
            <ShieldCheck className="size-4 text-verified" /> AI Disease Free
            Verified
          </div>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground">
            Healthy leaf verification creates an additional quality signal for
            factory buyers.
          </p>
        </div>
      </div>
    </section>
  );
};

export default VerificationHighlight;
