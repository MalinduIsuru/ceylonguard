import React from "react";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-surface-gradient">
      <Navbar />
      <main>
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
