"use client";

import {
  BarChart3,
  Coins,
  MapPin,
  Scale,
  Store,
  TrendingUp,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { formatRupees } from "@/lib/listings";

/**
 * Procurement Analytics.
 *
 * Frontend only for now: every figure on this page is derived from the mock
 * purchases in `MOCK_ORDERS`, so the numbers are stable and the page renders
 * without a session or a database. When the procurement API lands, swap the
 * constant for a fetch — the derivations and the markup stay as they are.
 */

type CompletedOrder = {
  id: string;
  farmer: string;
  district: string;
  weightKg: number;
  pricePerKg: number;
};

const MOCK_ORDERS: CompletedOrder[] = [
  {
    id: "ord-1",
    farmer: "Sunil Rathnayake",
    district: "Nuwara Eliya",
    weightKg: 480,
    pricePerKg: 285,
  },
  {
    id: "ord-2",
    farmer: "Kamala Wijesinghe",
    district: "Kandy",
    weightKg: 320,
    pricePerKg: 262,
  },
  {
    id: "ord-3",
    farmer: "Nimal Perera",
    district: "Badulla",
    weightKg: 750,
    pricePerKg: 240,
  },
  {
    id: "ord-4",
    farmer: "Anoma Gunasekara",
    district: "Ratnapura",
    weightKg: 210,
    pricePerKg: 298,
  },
  {
    id: "ord-5",
    farmer: "Ruwan Dissanayake",
    district: "Nuwara Eliya",
    weightKg: 540,
    pricePerKg: 292,
  },
  {
    id: "ord-6",
    farmer: "Chamari Silva",
    district: "Kandy",
    weightKg: 415,
    pricePerKg: 271,
  },
  {
    id: "ord-7",
    farmer: "Priyantha Bandara",
    district: "Badulla",
    weightKg: 360,
    pricePerKg: 244,
  },
  {
    id: "ord-8",
    farmer: "Malini Fernando",
    district: "Matara",
    weightKg: 180,
    pricePerKg: 232,
  },
];

const AnalyticsPage = () => {
  const orders = MOCK_ORDERS;

  const totalSpend = orders.reduce(
    (sum, order) => sum + order.weightKg * order.pricePerKg,
    0,
  );
  const totalKg = orders.reduce((sum, order) => sum + order.weightKg, 0);
  const avgPrice = totalKg > 0 ? totalSpend / totalKg : 0;

  const byDistrict = Object.entries(
    orders.reduce<Record<string, { kg: number; spend: number }>>(
      (acc, order) => {
        const current = acc[order.district] ?? { kg: 0, spend: 0 };
        acc[order.district] = {
          kg: current.kg + order.weightKg,
          spend: current.spend + order.weightKg * order.pricePerKg,
        };
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b[1].kg - a[1].kg);

  const topKg = byDistrict[0]?.[1].kg ?? 1;

  const stats = [
    { label: "Total spend", value: formatRupees(totalSpend), icon: Coins },
    {
      label: "Total purchased",
      value: `${totalKg.toLocaleString()} kg`,
      icon: Scale,
    },
    {
      label: "Average price",
      value: `${formatRupees(avgPrice)}/kg`,
      icon: TrendingUp,
    },
    {
      label: "Orders",
      value: orders.length.toLocaleString(),
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Store className="size-3.5" /> Factory Portal · Analytics
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Procurement Analytics
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A live summary of what your factory has bought, what it cost and which
          supplier districts deliver the most verified leaf.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-card p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-leaf-soft text-leaf-strong">
              <stat.icon className="size-5" />
            </span>
            <p className="mt-4 font-display text-2xl font-bold text-leaf-strong">
              {stat.value}
            </p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-leaf-strong">
          <MapPin className="size-4" /> Top supplier districts
        </h2>
        <ul className="mt-5 grid gap-4">
          {byDistrict.map(([district, data]) => (
            <li key={district}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-leaf-strong">
                  {district}
                </span>
                <span className="text-muted-foreground">
                  {data.kg.toLocaleString()} kg · {formatRupees(data.spend)}
                </span>
              </div>
              <Progress
                value={(data.kg / topKg) * 100}
                className="mt-2 **:data-[slot=progress-track]:h-2"
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AnalyticsPage;
