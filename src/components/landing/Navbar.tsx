"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all ${
        scrolled
          ? "border-b border-border/70 bg-background/85 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
        <Link href="/" className="min-w-0">
          <Logo withTagline />
        </Link>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="hidden sm:inline-flex"
          >
            <Link href="/login">Log In</Link>
          </Button>
          <Button variant="hero" size="lg" className="hidden sm:inline-flex">
            Get Started
          </Button>
          <button
            type="button"
            aria-label={openMenu ? "Close menu" : "Open menu"}
            onClick={() => setOpenMenu((v) => !v)}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-leaf-strong xl:hidden"
          >
            {openMenu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {openMenu ? (
        <div className="border-t border-border bg-background px-5 pb-6 pt-3 xl:hidden">
          <div className="mt-4 grid gap-2">
            <div className="flex justify-center"></div>
            <Button asChild variant="leafOutline" size="xl">
              <Link href="/login">Log In</Link>
            </Button>
            <Button variant="hero" size="xl">
              Get Started
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
