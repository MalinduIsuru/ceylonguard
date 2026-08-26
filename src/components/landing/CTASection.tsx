import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import plantation from "@public/plantation-wide.jpg";
import { Button } from "@/components/ui/button";
const CTASection = () => {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src={plantation}
        alt="Terraced Sri Lankan tea plantation hills at sunrise"
        width={1920}
        height={1024}
        loading="lazy"
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <div className="absolute inset-0 -z-10 gradient-deep opacity-[0.94]" />

      <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:py-28">
        <h2 className="font-display text-3xl font-extrabold leading-tight text-primary-foreground sm:text-4xl lg:text-5xl">
          Ready to Build a Smarter Tea Supply Chain?
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-primary-foreground/85">
          Join CeylonGuard as a farmer or factory manager and experience AI
          assisted tea agriculture and direct digital trading.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="soft" size="xl">
            Get Started <ArrowRight className="size-4" />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="xl"
            className="border border-primary-foreground/35 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link href="/login">Log In</Link>
          </Button>
        </div>

        <p className="mt-8 text-sm text-primary-foreground/75">
          Choose your role during registration
        </p>
        <p className="mt-1 text-sm font-semibold text-primary-foreground">
          Farmer <span className="opacity-50">|</span> Factory Manager
        </p>
      </div>
    </section>
  );
};

export default CTASection;
