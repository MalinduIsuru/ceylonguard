"use client";

import { MapPin, PackageCheck, Scale, Store, Truck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/listings";

/**
 * Order Tracking.
 *
 * Frontend only for now: the orders below are mock rows held in component
 * state, so advancing a stage moves the card on screen and nothing else. When
 * the procurement API lands, swap `MOCK_ORDERS` for a fetch and `advance` for
 * a PATCH — the markup does not need to change.
 */

type OrderStatus = "Confirmed" | "In Transit" | "Delivered";

type Order = {
  id: string;
  farmer: string;
  district: string;
  weightKg: number;
  pricePerKg: number;
  placedOn: string;
  status: OrderStatus;
};

/** The three states a purchase moves through, in order. */
const STAGES: OrderStatus[] = ["Confirmed", "In Transit", "Delivered"];

const MOCK_ORDERS: Order[] = [
  {
    id: "ord-1",
    farmer: "Sunil Rathnayake",
    district: "Nuwara Eliya",
    weightKg: 480,
    pricePerKg: 285,
    placedOn: "28 Aug 2026",
    status: "Confirmed",
  },
  {
    id: "ord-2",
    farmer: "Kamala Wijesinghe",
    district: "Kandy",
    weightKg: 320,
    pricePerKg: 262,
    placedOn: "26 Aug 2026",
    status: "In Transit",
  },
  {
    id: "ord-3",
    farmer: "Nimal Perera",
    district: "Badulla",
    weightKg: 750,
    pricePerKg: 240,
    placedOn: "22 Aug 2026",
    status: "Delivered",
  },
  {
    id: "ord-4",
    farmer: "Anoma Gunasekara",
    district: "Ratnapura",
    weightKg: 210,
    pricePerKg: 298,
    placedOn: "21 Aug 2026",
    status: "In Transit",
  },
];

/** The stage a card moves to when its button is pressed. */
function nextStage(status: OrderStatus): OrderStatus | null {
  const index = STAGES.indexOf(status);

  return index < STAGES.length - 1 ? STAGES[index + 1] : null;
}

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);

  const advance = (id: string) => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== id) return order;

        const next = nextStage(order.status);

        return next ? { ...order, status: next } : order;
      }),
    );
  };

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Store className="size-3.5" /> Factory Portal · Orders
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Order Tracking
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Follow each confirmed purchase from offer acceptance to delivery, and
          update the supply chain status as leaf arrives at the factory.
        </p>
      </header>

      <section className="grid gap-4">
        {orders.map((order) => {
          const next = nextStage(order.status);

          return (
            <article key={order.id} className="surface-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-leaf-strong">
                    {order.farmer}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {order.district}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Scale className="size-3.5" />{" "}
                      {order.weightKg.toLocaleString()} kg
                    </span>
                    <span>Placed {order.placedOn}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-bold text-leaf-strong">
                    {formatRupees(order.weightKg * order.pricePerKg)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRupees(order.pricePerKg)}/kg
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {STAGES.map((stage, index) => {
                  const reached = STAGES.indexOf(order.status) >= index;

                  return (
                    <span key={stage} className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          reached
                            ? "gradient-leaf text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {stage}
                      </span>
                      {index < STAGES.length - 1 ? (
                        <span className="h-px w-6 bg-border" aria-hidden />
                      ) : null}
                    </span>
                  );
                })}
              </div>

              {next ? (
                <Button
                  variant="leafOutline"
                  size="lg"
                  className="mt-5"
                  onClick={() => advance(order.id)}
                >
                  {next === "In Transit" ? (
                    <Truck className="size-4" />
                  ) : (
                    <PackageCheck className="size-4" />
                  )}
                  Mark as {next}
                </Button>
              ) : null}
            </article>
          );
        })}

        {orders.length === 0 ? (
          <div className="surface-card grid place-items-center gap-2 p-10 text-center">
            <Truck className="size-6 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">
              No orders yet. Accepted offers from the marketplace appear here as
              confirmed purchases.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default OrdersPage;
