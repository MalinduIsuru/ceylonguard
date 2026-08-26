import Link from "next/link";
import { CalendarDays, MapPin, ShieldCheck, Star, Weight } from "lucide-react";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { Button } from "@/components/ui/button";

const MarketplacePreview = () => {
  const listings = [
    {
      title: "Nuwara Eliya Fresh Tea Leaves",
      district: "Nuwara Eliya",
      quantity: "450 kg",
      price: "LKR 185/kg",
      harvested: "Harvested Today",
      trust: "4.8",
    },
    {
      title: "Badulla Highland Green Leaf",
      district: "Badulla",
      quantity: "320 kg",
      price: "LKR 178/kg",
      harvested: "Harvested Yesterday",
      trust: "4.6",
    },
    {
      title: "Ratnapura Low Country Leaf",
      district: "Ratnapura",
      quantity: "610 kg",
      price: "LKR 168/kg",
      harvested: "Harvested 2 days ago",
      trust: "4.9",
    },
  ];
  return (
    <section
      id="marketplace"
      className="border-y border-border bg-leaf-soft/40 py-20 lg:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionHeading
          eyebrow="Marketplace Preview"
          title="Discover Verified Tea Harvests"
          description="A glimpse of the harvest listings factory managers browse after signing in."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.title}
              className="surface-card flex h-full flex-col p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-semibold leading-snug text-leaf-strong">
                  {listing.title}
                </h3>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-leaf-soft px-2.5 py-1 text-[0.68rem] font-semibold text-leaf-strong">
                  <ShieldCheck className="size-3.5" /> AI Verified
                </span>
              </div>

              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 shrink-0 text-leaf" />
                  {listing.district}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Weight className="size-4 shrink-0 text-leaf" />
                  {listing.quantity}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0 text-leaf" />
                  {listing.harvested}
                </div>
              </dl>

              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-secondary px-3.5 py-3">
                <span className="font-display text-lg font-bold text-leaf-strong">
                  {listing.price}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <Star className="size-3.5 fill-earth text-earth" />{" "}
                  {listing.trust} trust
                </span>
              </div>

              <Button asChild variant="soft" size="lg" className="mt-5 w-full">
                <Link href="/login">View Listing</Link>
              </Button>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Full marketplace access requires an account.
          <Link
            href="/login"
            className="font-semibold text-leaf-strong underline-offset-4 hover:underline"
          >
            Log in to continue
          </Link>
        </p>
      </div>
    </section>
  );
};

export default MarketplacePreview;
