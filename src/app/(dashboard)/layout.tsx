"use client";

import { useUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import React, { useState } from "react";
import DashboardNav from "@/components/dashboard/DashboardNav";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoaded } = useUser();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isLoaded) return null;

  if (!user) return redirect("/");

  const role = (user.publicMetadata?.role as "farmer" | "factory") || undefined;

  const userName = user.firstName || "User";

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 z-30 lg:hidden bg-card border-b border-gray-200 h-14 flex items-center px-4">
        <button
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <DashboardNav
          role={role}
          userName={userName}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          isMobileMenuOpen={isMobileMenuOpen}
        />
      </aside>

      <main className=" bg-secondary/40 flex-1 overflow-y-auto pt-14 lg:pt-0">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
