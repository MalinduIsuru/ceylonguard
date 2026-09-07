import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  ORDERS_MAX_PAGE_SIZE,
  ORDERS_PAGE_SIZE,
  type OrderFailure,
  type OrderStats,
  type OrdersSuccess,
} from "@/lib/orders";
import {
  buildOrderFilter,
  ensureOrdersForAcceptedOffers,
  readOrderFilter,
  requireTradeAccount,
  resolveOrderParties,
  toOrderItem,
} from "@/lib/orders.server";
import connectDB from "@/lib/mongodb";
import Order, { type IOrder } from "@/lib/models/Order";

/**
 * The confirmed purchases the signed-in account is a party to.
 *
 * One route serves both sides of the trade. Orders are the only screen where
 * that is true — a listing belongs to a farmer and a marketplace read belongs
 * to a mill, but a consignment belongs to both — so the role decides which
 * clerk id the read is scoped by rather than whether the read is allowed. The
 * role comes back in the payload so the page can title itself and draw only
 * the buttons that side is allowed to press.
 *
 * There is no POST here. An order is what an accepted offer becomes, so it is
 * written by `/api/offers/[id]` and never by a client; the reconciliation at
 * the top of the read is what covers sales that were struck before this
 * feature existed, or whose accept died halfway through.
 *
 * The totals are counted over every order rather than the filtered slice, so
 * narrowing the list does not make the tonnage move.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: OrderFailure) {
  return NextResponse.json(body, { status });
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to view your orders.",
    });
  }

  const params = new URL(request.url).searchParams;
  const filter = readOrderFilter(params);

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), ORDERS_MAX_PAGE_SIZE)
      : ORDERS_PAGE_SIZE;

  try {
    await connectDB();

    const access = await requireTradeAccount(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const { account } = access;

    // Before reading, not after: an order written here has to appear in the
    // same response, or the page would need a second request to see it. It is
    // a repair rather than the read itself, though, so one unwritable row —
    // an old sale whose harvest details no longer validate, say — must not
    // cost the caller the orders that are already there.
    try {
      await ensureOrdersForAcceptedOffers(account);
    } catch (error) {
      console.error("[orders] Could not reconcile accepted offers", error);
    }

    const scope =
      account.role === "factory"
        ? { factoryClerkId: account.clerkId }
        : { farmerClerkId: account.clerkId };

    const [rows, totals] = await Promise.all([
      Order.find(buildOrderFilter(account, filter))
        .sort({ placedAt: -1 })
        .limit(limit)
        .lean<IOrder[]>(),
      Order.aggregate<{
        _id: null;
        confirmed: number;
        inTransit: number;
        delivered: number;
        cancelled: number;
        totalWeightKg: number;
        openValue: number;
        settledValue: number;
      }>([
        { $match: scope },
        {
          $group: {
            _id: null,
            confirmed: {
              $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] },
            },
            inTransit: {
              $sum: { $cond: [{ $eq: ["$status", "in_transit"] }, 1, 0] },
            },
            delivered: {
              $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
            },
            cancelled: {
              $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
            },
            // A cancelled order bought nothing, so it weighs nothing here.
            totalWeightKg: {
              $sum: {
                $cond: [{ $ne: ["$status", "cancelled"] }, "$weightKg", 0],
              },
            },
            // Split by whether the leaf has arrived: what is still owed on
            // the road, and what has actually been taken in.
            openValue: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["confirmed", "in_transit"]] },
                  { $multiply: ["$pricePerKg", "$weightKg"] },
                  0,
                ],
              },
            },
            settledValue: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "delivered"] },
                  { $multiply: ["$pricePerKg", "$weightKg"] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const parties = await resolveOrderParties(rows);

    const summary = totals[0];

    const stats: OrderStats = {
      confirmed: summary?.confirmed ?? 0,
      inTransit: summary?.inTransit ?? 0,
      delivered: summary?.delivered ?? 0,
      cancelled: summary?.cancelled ?? 0,
      totalWeightKg: summary?.totalWeightKg ?? 0,
      openValue: summary?.openValue ?? 0,
      settledValue: summary?.settledValue ?? 0,
    };

    const body: OrdersSuccess = {
      ok: true,
      items: rows.map((row) => toOrderItem(row, account.role, parties)),
      stats,
      viewerRole: account.role,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[orders] Could not read the order book", error);

    return fail(503, {
      ok: false,
      error: "Your orders could not be loaded right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
