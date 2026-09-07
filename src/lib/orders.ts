import type { OrderStatus } from "@/lib/models/Order";

/**
 * Shared contract between /api/orders and the order tracking screen.
 *
 * Both sides of the trade read this. An order is described from the point of
 * view of whoever asked for it — `viewerRole` says which side that is, and the
 * transition table below says what that side is allowed to do next — so the
 * page never has to work out which of two clerk ids belongs to it, and the
 * buttons it draws are the ones the route will actually accept.
 */

export type { OrderStatus };

export type OrderRole = "farmer" | "factory";

/** The stages leaf physically moves through. Cancelling leaves this track. */
export type OrderStage = Exclude<OrderStatus, "cancelled">;

export const ORDER_STAGES: OrderStage[] = [
  "confirmed",
  "in_transit",
  "delivered",
];

/** The other party on an order, as far as the viewer needs them. */
export type OrderParty = {
  /** Mill name for a factory, person's name for a farmer. */
  name: string;
  district?: string;
  phone?: string;
};

export type OrderEvent = {
  status: OrderStatus;
  /** ISO 8601. */
  at: string;
  byClerkId: string;
  /** Which side made the move, resolved against the order's two ids. */
  byRole: OrderRole;
};

export type OrderItem = {
  id: string;
  /** Short human reference for phone calls and delivery notes, "CG-4F2A9C". */
  reference: string;
  offerId: string;
  listingId: string;

  farmer: OrderParty;
  factory: OrderParty;
  /** Which side of the trade the viewer is on. */
  viewerRole: OrderRole;

  /** The harvest's district, frozen at acceptance. */
  district: string;
  /** Calendar day as `YYYY-MM-DD`. */
  harvestDate: string;

  weightKg: number;
  pricePerKg: number;
  /** `weightKg * pricePerKg`, computed once on the server. */
  totalValue: number;

  status: OrderStatus;
  /** ISO 8601 — when the offer was accepted. */
  placedAt: string;
  /** ISO 8601 — the last status change. */
  updatedAt: string;
  /** Oldest first, starting at the acceptance. */
  timeline: OrderEvent[];

  cancelledReason?: string;
};

/** Totals across every order on this side of the trade. */
export type OrderStats = {
  confirmed: number;
  inTransit: number;
  delivered: number;
  cancelled: number;
  /** Kilograms under an order that has not been cancelled. */
  totalWeightKg: number;
  /** Rupees committed to orders still moving — confirmed plus in transit. */
  openValue: number;
  /** Rupees across delivered orders. */
  settledValue: number;
};

export type OrdersSuccess = {
  ok: true;
  /** Orders matching the filter, newest first. */
  items: OrderItem[];
  /** Totals over every order, filter or not. */
  stats: OrderStats;
  /** Which side of the trade is reading, so the page can title itself. */
  viewerRole: OrderRole;
};

export type OrderFailure = {
  ok: false;
  error: string;
  hint?: string;
};

export type OrdersResponse = OrdersSuccess | OrderFailure;

export type UpdateOrderSuccess = {
  ok: true;
  /** The order as it now stands. */
  order: OrderItem;
};

export type UpdateOrderResponse = UpdateOrderSuccess | OrderFailure;

/** What the tracking buttons send: the state the order should move to. */
export type UpdateOrderInput = {
  status: OrderStatus;
  /** Only read when cancelling. */
  reason?: string;
};

/** Which slice to read. "all" hides cancelled orders. */
export type OrderFilter = "all" | OrderStatus;

export const ORDER_FILTERS: OrderFilter[] = [
  "all",
  "confirmed",
  "in_transit",
  "delivered",
  "cancelled",
];

export function isOrderFilter(value: unknown): value is OrderFilter {
  return (
    typeof value === "string" && ORDER_FILTERS.includes(value as OrderFilter)
  );
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    ["confirmed", "in_transit", "delivered", "cancelled"].includes(value)
  );
}

export const ORDERS_PAGE_SIZE = 30;
export const ORDERS_MAX_PAGE_SIZE = 100;
export const ORDER_LIMITS = {
  maxReasonLength: 300,
} as const;

/** Filter to a query string; an untouched screen asks for the plain feed. */
export function ordersQueryString(filter: OrderFilter): string {
  return filter === "all" ? "" : `?status=${filter}`;
}

/**
 * Who may move an order where.
 *
 * Keyed on the destination, because `confirmed` is only ever reached by the
 * accept and is not a move anyone can make. The rules follow who is holding
 * the leaf: either side can say it has left the estate — the farmer dispatches
 * it, or the mill's lorry collects it — but only the mill can say it arrived,
 * because the mill is what it arrives at. Cancelling is open to both, and only
 * while nothing has moved yet.
 */
export type OrderTransition = {
  from: OrderStatus[];
  by: OrderRole[];
  /** Button label on the side that may make the move. */
  action: string;
};

/** A state somebody can move an order to, which `confirmed` is not. */
export type OrderMove = Exclude<OrderStatus, "confirmed">;

export const ORDER_TRANSITIONS: Record<OrderMove, OrderTransition> = {
  in_transit: {
    from: ["confirmed"],
    by: ["farmer", "factory"],
    action: "Mark as in transit",
  },
  delivered: {
    from: ["in_transit"],
    by: ["factory"],
    action: "Mark as delivered",
  },
  cancelled: {
    from: ["confirmed"],
    by: ["farmer", "factory"],
    action: "Cancel order",
  },
};

/**
 * Whether `role` can move an order from `from` to `to`.
 *
 * Runs on both sides: the page uses it to decide which buttons a card gets,
 * and the route runs it again because a hidden button is not a guarantee.
 */
export function canTransition(
  role: OrderRole,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (to === "confirmed") return false;

  const rule = ORDER_TRANSITIONS[to];

  return rule.from.includes(from) && rule.by.includes(role);
}

/** The stage this order moves to next, ignoring who is allowed to move it. */
export function nextStage(status: OrderStatus): OrderStage | null {
  if (status === "cancelled") return null;

  const index = ORDER_STAGES.indexOf(status as OrderStage);

  return index >= 0 && index < ORDER_STAGES.length - 1
    ? ORDER_STAGES[index + 1]
    : null;
}

/** How far along the three-stage track an order is; -1 once cancelled. */
export function stageIndex(status: OrderStatus): number {
  return status === "cancelled"
    ? -1
    : ORDER_STAGES.indexOf(status as OrderStage);
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  confirmed: {
    label: "Confirmed",
    className: "bg-amber-50 text-amber-800",
  },
  in_transit: {
    label: "In Transit",
    className: "bg-leaf-soft text-leaf-strong",
  },
  delivered: {
    label: "Delivered",
    className: "bg-leaf-soft text-leaf-strong",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-secondary text-muted-foreground",
  },
};

/**
 * A short reference derived from the order id rather than stored beside it.
 *
 * The tail of an ObjectId is the counter and the machine bytes, so two orders
 * written seconds apart do not collide — which is all this has to be good for,
 * since it is a label to read down a phone, not a key anything looks up by.
 */
export function orderReference(id: string): string {
  return `CG-${id.slice(-6).toUpperCase()}`;
}
