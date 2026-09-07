import { Factory, Sprout } from "lucide-react";

import factoryImage from "@public/factory-portal.jpg";
import farmerImage from "@public/farmer-portal.jpg";
import { RoleCard } from "@/components/landing/RoleCard";
import { SectionHeading } from "@/components/landing/SectionHeading";

const PortalsSection = () => {
  return (
    <section
      id="farmers"
      className="border-y border-border bg-leaf-soft/40 py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Two Portals"
          title="Built for Both Sides of the Tea Supply Chain"
          description="Farmers and factory managers each get a workspace designed around their own decisions."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <RoleCard
            tone="farmer"
            icon={Sprout}
            image={farmerImage.src}
            imageAlt="Sri Lankan tea farmer plucking fresh leaves on a hillside plantation"
            title="For Tea Farmers"
            description="Protect your crop, check your leaves for disease, publish available harvests and connect directly with factory buyers."
            features={[
              "AI Tea Leaf Disease Detection",
              "Sinhala Friendly Interface",
              "Treatment Guidance",
              "Post Harvest Listings",
              "Receive Buyer Offers",
              "Direct Chat",
            ]}
            cta="Continue as Farmer"
            to="/register/farmer"
          />
          <div id="factories" className="scroll-mt-28">
            <RoleCard
              tone="factory"
              icon={Factory}
              image={factoryImage.src}
              imageAlt="Manager inspecting fresh tea leaves inside a Sri Lankan tea factory"
              title="For Factory Managers"
              description="Discover tea harvests from regional farmers, compare price and quantity, and make direct offers."
              features={[
                "Browse the Harvest Marketplace",
                "Filter by District",
                "Compare Price and Quantity",
                "Make Direct Offers",

                "Track Orders and Procurement",
              ]}
              cta="Continue as Factory Manager"
              to="/register/factory"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default PortalsSection;
