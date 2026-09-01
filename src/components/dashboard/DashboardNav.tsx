"use client";

import Link from "next/link";
import { UserButton, useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ScanLine,
  Store,
  Tag,
  MessageCircle,
  Truck,
  BarChart3,
  LogOut,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useUnreadChatCount } from "@/hooks/use-unread-chat";
import { Logo } from "../Logo";

/** The one link that carries a live count. */
const CHAT_HREF = "/dashboard/chat";

interface DashboardNavProps {
  role: "farmer" | "factory";
  userName?: string;
  onCloseMobile?: () => void;
  isMobileMenuOpen?: boolean;
}

type NavLink = {
  href: string;
  label: string;
  icon: ReactNode;
  divider?: boolean;
};

export default function DashboardNav({
  role,
  userName,
  onCloseMobile,
  isMobileMenuOpen,
}: DashboardNavProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const unreadMessages = useUnreadChatCount();

  const farmerLinks: NavLink[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4.5 w-4.5" />,
    },
    {
      label: "AI Disease Detection",
      href: "/dashboard/disease-detect",
      icon: <ScanLine className="h-4.5 w-4.5" />,
    },
    {
      label: "Harvest Marketplace",
      href: "/dashboard/listings",
      icon: <Store className="h-4.5 w-4.5" />,
    },
    {
      label: "Offers Received",
      href: "/dashboard/offers",
      icon: <Tag className="h-4.5 w-4.5" />,
    },
    {
      label: "Chat",
      href: "/dashboard/chat",
      icon: <MessageCircle className="h-4.5 w-4.5" />,
    },
  ];

  const factoryLinks: NavLink[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-4.5 w-4.5" />,
    },
    {
      href: "/dashboard/marketplace",
      label: "Browse Marketplace",
      icon: <Store className="h-4.5 w-4.5" />,
    },
    {
      href: "/dashboard/orders",
      label: "Orders",
      icon: <Truck className="h-4.5 w-4.5" />,
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-4.5 w-4.5" />,
    },
    {
      label: "Chat",
      href: "/dashboard/chat",
      icon: <MessageCircle className="h-4.5 w-4.5" />,
    },
  ];

  const links =
    role === "farmer" ? farmerLinks : role === "factory" ? factoryLinks : [];

  const roleLabel =
    role === "farmer" ? "Farmer" : role === "factory" ? "Factory" : "";

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-linear-to-b from-white via-white to-leaf-soft/50 shadow-xl lg:shadow-none">
      {/* Logo/Header */}
      <div className="flex h-18 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4">
        <Link
          href="/dashboard"
          onClick={handleLinkClick}
          className="min-w-0 rounded-2xl transition-opacity hover:opacity-85"
        >
          <Logo />
        </Link>

        {/* Mobile Close Button */}
        {isMobileMenuOpen && onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="shrink-0 cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4 scrollbar-thin">
        <p className="mb-2.5 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Main Menu
        </p>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <div key={link.href}>
              {link.divider && <div className="my-2 border-t border-border" />}
              <Link
                href={link.href}
                onClick={handleLinkClick}
                aria-current={isActive ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-full border px-4 py-2.5 transition-all duration-200 ${
                  isActive
                    ? "gradient-leaf border-leaf-strong text-white shadow-(--shadow-leaf)"
                    : "border-border bg-white text-muted-foreground hover:translate-x-0.5 hover:border-leaf/35 hover:bg-leaf-soft hover:text-leaf-strong hover:shadow-soft"
                }`}
              >
                <span
                  className={`shrink-0 transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-leaf-strong/60 group-hover:text-leaf-strong"
                  }`}
                >
                  {link.icon}
                </span>
                <span className="truncate text-sm font-medium">
                  {link.label}
                </span>

                {link.href === CHAT_HREF && unreadMessages > 0 ? (
                  <span
                    className={`ml-auto grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-white text-leaf-strong"
                        : "gradient-leaf text-white"
                    }`}
                    aria-label={`${unreadMessages} unread messages`}
                  >
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                ) : isActive ? (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white/80" />
                ) : null}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="shrink-0 space-y-2 border-t border-border/70 px-3 py-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white p-2.5 shadow-soft">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-9 h-9",
              },
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {userName || "User"}
            </p>
            {roleLabel && (
              <span className="mt-0.5 inline-flex rounded-full bg-leaf-soft px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wider text-leaf-strong">
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => signOut()}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
