import { auth } from "@clerk/nextjs/server";
import { isValidObjectId } from "mongoose";
import { NextResponse } from "next/server";

import {
  ORDER_LIMITS,
  ORDER_STATUS_META,
  ORDER_TRANSITIONS,
  isOrderStatus,
  type OrderFailure,
  type OrderRole,
  type UpdateOrderInput,
  type UpdateOrderSuccess,
} from "@/lib/orders";
import { hydrateOrder, requireTradeAccount } from "@/lib/orders.server";
import connectDB from "@/lib/mongodb";
import Order, { type IOrder } from "@/lib/models/Order";

/**
 * Moving one order along.
 *
 * The client names the state it wants rather than asking to "advance", so two
 * screens open on the same order cannot both press the same button and move it
 * two stages: the second request names a state the order has already left, and
 * is told so. The final write is conditional on the status the caller read, so
 * even a genuine tie has one winner.
 *
 * Who may make which move lives in `ORDER_TRANSITIONS`, which the page reads
 * too — the difference is that here it is enforced. The order is fetched
 * scoped to the caller's own side of the trade, so an id guessed from someone
 * else's order book reads as "not found" rather than acting on it.
 *
 * Cancelling does not put the harvest back on the marketplace. The listing was
 * marked sold when the offer was accepted, and it stays that way: green leaf
 * does not keep, so by the time a consignment falls through the farmer has a
 * different lot to sell, and re-opening a stale listing would advertise leaf
 * that no longer exists. They are told to publish a fresh one instead.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, body: OrderFailure) {
  return NextResponse.json(body, { status });
}

const NOT_FOUND: OrderFailure = {
  ok: false,
  error: "That order no longer exists.",
};

/** "the factory" / "the farmer", for a rule only one side may use. */
function nameFor(role: OrderRole): string {
  return role === "factory" ? "the factory" : "the farmer";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();

  if (!userId) {
    return fail(401, {
      ok: false,
      error: "You need to be signed in to update an order.",
    });
  }

  const { id } = await params;

  if (!isValidObjectId(id)) return fail(404, NOT_FOUND);

  let payload: Partial<UpdateOrderInput>;

  try {
    payload = (await request.json()) as Partial<UpdateOrderInput>;
  } catch {
    return fail(400, { ok: false, error: "The request could not be read." });
  }

  const target = payload.status;

  if (!isOrderStatus(target)) {
    return fail(422, {
      ok: false,
      error: "That is not a state an order can be in.",
    });
  }

  if (target === "confirmed") {
    return fail(422, {
      ok: false,
      error: "An order is confirmed when the farmer accepts the offer.",
    });
  }

  const reason =
    typeof payload.reason === "string"
      ? payload.reason.trim().slice(0, ORDER_LIMITS.maxReasonLength)
      : "";

  try {
    await connectDB();

    const access = await requireTradeAccount(userId);

    if (!access.ok) {
      return fail(access.status, { ok: false, error: access.error });
    }

    const { account } = access;

    const scope =
      account.role === "factory"
        ? { factoryClerkId: account.clerkId }
        : { farmerClerkId: account.clerkId };

    const order = await Order.findOne({
      _id: id,
      ...scope,
    }).lean<IOrder | null>();

    if (!order) return fail(404, NOT_FOUND);

    if (order.status === target) {
      return fail(409, {
        ok: false,
        error: `That order already reads as ${ORDER_STATUS_META[target].label.toLowerCase()}.`,
      });
    }

    const rule = ORDER_TRANSITIONS[target];

    if (!rule.from.includes(order.status)) {
      return fail(409, {
        ok: false,
        error: `An order cannot go from ${ORDER_STATUS_META[
          order.status
        ].label.toLowerCase()} to ${ORDER_STATUS_META[
          target
        ].label.toLowerCase()}.`,
        ...(order.status === "cancelled"
          ? { hint: "A cancelled order is closed for good." }
          : {}),
      });
    }

    if (!rule.by.includes(account.role)) {
      return fail(403, {
        ok: false,
        error: `Only ${nameFor(rule.by[0])} can ${rule.action.toLowerCase()}.`,
        ...(target === "delivered"
          ? { hint: "The mill confirms the leaf once it is weighed in." }
          : {}),
      });
    }

    // Conditional on the status that was just read, so the loser of a tie is
    // told the order moved rather than writing a second event over the top.
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, ...scope, status: order.status },
      {
        $set: {
          status: target,
          ...(target === "cancelled"
            ? {
                cancelledByClerkId: account.clerkId,
                ...(reason ? { cancelledReason: reason } : {}),
              }
            : {}),
        },
        $push: {
          timeline: {
            status: target,
            at: new Date(),
            byClerkId: account.clerkId,
          },
        },
      },
      { new: true },
    ).lean<IOrder | null>();

    if (!updated) {
      return fail(409, {
        ok: false,
        error: "That order was updated from another screen.",
        hint: "Reload the page to see where it stands now.",
      });
    }

    const body: UpdateOrderSuccess = {
      ok: true,
      order: await hydrateOrder(updated, account.role),
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[orders] Could not update the order", error);

    return fail(503, {
      ok: false,
      error: "The order could not be updated right now.",
      hint: "Check that the database connection in .env.local is reachable.",
    });
  }
}
