import Link from "next/link";

import { LogoMark } from "@/components/Logo";

const Footer = () => {
  const columns = [
    {
      title: "Platform",
      items: [
        {
          label: "AI Disease Detection",
          href: "/#ai-detection",
        },
        { label: "Marketplace", href: "/#marketplace" },
        {
          label: "How It Works",
          href: "/#how-it-works",
        },
      ],
    },
    {
      title: "Users",
      items: [
        { label: "For Farmers", href: "/#farmers" },
        {
          label: "For Factory Managers",
          href: "/#factories",
        },
        { label: "Log In", href: "/login" },
        { label: "Register", href: "/register" },
      ],
    },
    {
      title: "Project",
      items: [
        {
          label: "About CeylonGuard",
          href: "/#about",
        },
        { label: "Privacy", href: "/#about" },
        { label: "Terms", href: "/#about" },
        { label: "Contact", href: "/#about" },
      ],
    },
  ];
  return (
    <footer className="border-t border-border bg-leaf-soft/50">
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoMark />
              <span className="font-display text-lg font-bold text-leaf-strong">
                CeylonGuard
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI powered tea health verification and smart agricultural
              marketplace for Sri Lanka.
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-leaf-strong">
                {column.title}
              </h3>
              <ul className="mt-4 grid gap-2.5">
                {column.items.map((item) => (
                  <li key={item.label}>
                    {item.href.startsWith("/#") ? (
                      <a
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-leaf-strong"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-leaf-strong"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © 2026 CeylonGuard. All rights reserved.
          </p>
          <p className="text-xs font-semibold text-leaf-strong">
            Final Year Research Project
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
