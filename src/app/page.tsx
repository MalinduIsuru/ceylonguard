import React from "react";
import Footer from "@/components/landing/Footer";
import Navbar from "@/components/landing/Navbar";
import BenefitsSection from "@/components/landing/BenefitsSection";
import CTASection from "@/components/landing/CTASection";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import MarketplacePreview from "@/components/landing/MarketplacePreview";
import PlatformIntro from "@/components/landing/PlatformIntro";
import PortalsSection from "@/components/landing/PortalsSection";
import VerificationHighlight from "@/components/landing/VerificationHighlight";
import AIDetectionPreview from "@/components/landing/AIDetectionPreview";
import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth";

const Home = async () => {
  const user = await getCurrentUserWithRole();
  if (user) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <HeroSection />
        <PlatformIntro />
        <HowItWorks />
        <AIDetectionPreview />
        <VerificationHighlight />
        <PortalsSection />
        <MarketplacePreview />
        <BenefitsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
