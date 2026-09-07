"use client";

import {
  CalendarDays,
  CircleX,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Scale,
  Sprout,
  Store,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STATUS_META,
  formatRupees,
  todayString,
  validateListingInput,
  type CreateListingResponse,
  type DeleteListingResponse,
  type ListingFieldErrors,
  type ListingItem,
  type ListingStats,
  type ListingStatus,
  type ListingsResponse,
  type UpdateListingResponse,
} from "@/lib/listings";

/**
 * Post a Harvest Listing.
 *
 * Everything on this page comes from `/api/listings`: the published rows and
 * the totals above them. Publishing happens in the form on the left; editing a
 * published row opens the same four fields in a dialog over the list, so the
 * farmer never loses sight of the row they picked.
 */

const GENERIC_ERROR = "Your listings could not be loaded right now.";

/** Plain request, no state: the caller decides what to do with the payload. */
async function requestListings(): Promise<ListingsResponse> {
  const response = await fetch("/api/listings", { cache: "no-store" });

  return (await response.json()) as ListingsResponse;
}

const EMPTY_STATS: ListingStats = {
  active: 0,
  totalWeightKg: 0,
  averagePricePerKg: 0,
};

/** Reads the harvest details off either form — both use the same field names. */
function readListingForm(form: HTMLFormElement) {
  const data = new FormData(form);

  return {
    weightKg: data.get("weight"),
    pricePerKg: data.get("price"),
    district: data.get("district"),
    harvestDate: data.get("date"),
  };
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <p className="mt-1 text-2xl font-semibold leading-none text-leaf-strong">
        {value}
      </p>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs font-medium text-red-600">{message}</p>;
}

/**
 * The four harvest fields.
 *
 * Shared by the publish form and the edit dialog so the two can never drift
 * apart; `idPrefix` keeps the label targets unique while both are on the page.
 */
function ListingFields({
  idPrefix,
  defaults,
  errors,
}: {
  idPrefix: string;
  /** The row being edited, or null when publishing a new listing. */
  defaults?: ListingItem | null;
  errors: ListingFieldErrors;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-weight`}>Total weight (kg)</Label>
        <Input
          id={`${idPrefix}-weight`}
          name="weight"
          type="number"
          min={1}
          className="h-12"
          placeholder="250"
          defaultValue={defaults?.weightKg ?? ""}
          aria-invalid={Boolean(errors.weightKg)}
          required
        />
        <FieldError message={errors.weightKg} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-price`}>Asking price (Rs. / kg)</Label>
        <Input
          id={`${idPrefix}-price`}
          name="price"
          type="number"
          min={1}
          className="h-12"
          placeholder="130"
          defaultValue={defaults?.pricePerKg ?? ""}
          aria-invalid={Boolean(errors.pricePerKg)}
          required
        />
        <FieldError message={errors.pricePerKg} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-district`}>District</Label>
        <Input
          id={`${idPrefix}-district`}
          name="district"
          className="h-12"
          placeholder="Nuwara Eliya"
          defaultValue={defaults?.district ?? ""}
          aria-invalid={Boolean(errors.district)}
          required
        />
        <FieldError message={errors.district} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-date`}>Harvest date</Label>
        <Input
          id={`${idPrefix}-date`}
          name="date"
          type="date"
          max={todayString()}
          className="h-12"
          defaultValue={defaults?.harvestDate ?? ""}
          aria-invalid={Boolean(errors.harvestDate)}
          required
        />
        <FieldError message={errors.harvestDate} />
      </div>
    </div>
  );
}

const ListingsPage = () => {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [stats, setStats] = useState<ListingStats>(EMPTY_STATS);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishErrors, setPublishErrors] = useState<ListingFieldErrors>({});
  const [publishError, setPublishError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * The row the dialog is showing. Held past the close so the fields do not
   * blank out mid-animation; `editOpen` alone decides whether it is on screen.
   */
  const [editing, setEditing] = useState<ListingItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  /** Bumped on every open so re-opening a row shows saved values, not typing. */
  const [editSession, setEditSession] = useState(0);

  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState<ListingFieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);

  /** Id of the row mid-request, so only that card shows as busy. */
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Bumped by the reload buttons so the effect below is the only loader. */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    requestListings()
      .then((payload) => {
        if (cancelled) return;

        if (payload.ok) {
          setListings(payload.items);
          setStats(payload.stats);
          setLoadError(null);
        } else {
          setLoadError(payload.error || GENERIC_ERROR);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(GENERIC_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setLoading(true);
    setReloadToken((current) => current + 1);
  }, []);

  const openEdit = (listing: ListingItem) => {
    setEditing(listing);
    setEditSession((current) => current + 1);
    setEditErrors({});
    setEditError(null);
    setNotice(null);
    setEditOpen(true);
  };

  const closeEdit = useCallback(() => setEditOpen(false), []);

  const publish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // `currentTarget` is null once the first await resolves, so hold the form.
    const form = event.currentTarget;
    const input = readListingForm(form);

    const validated = validateListingInput(input);

    if (!validated.ok) {
      setPublishErrors(validated.errors);
      setPublishError("Check the highlighted fields and try again.");
      setNotice(null);
      return;
    }

    setPublishing(true);
    setPublishErrors({});
    setPublishError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const payload = (await response.json()) as CreateListingResponse;

      if (payload.ok) {
        form.reset();
        setListings((current) => [payload.listing, ...current]);
        setStats((current) => ({
          active: current.active + 1,
          totalWeightKg: current.totalWeightKg + payload.listing.weightKg,
          averagePricePerKg:
            (current.averagePricePerKg * current.active +
              payload.listing.pricePerKg) /
            (current.active + 1),
        }));
        setNotice("Listing published. Factory buyers can send offers now.");
      } else {
        setPublishErrors(payload.fieldErrors ?? {});
        setPublishError(payload.error);
      }
    } catch {
      setPublishError(
        "Could not reach the CeylonGuard server. Check your connection.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const target = editing;

    if (!target) return;

    const input = readListingForm(event.currentTarget);

    // An edit keeps the day it was already published with, even once that day
    // has aged past the limit a new listing has to meet.
    const validated = validateListingInput(input, {
      currentHarvestDate: target.harvestDate,
    });

    if (!validated.ok) {
      setEditErrors(validated.errors);
      setEditError("Check the highlighted fields and try again.");
      return;
    }

    setSaving(true);
    setEditErrors({});
    setEditError(null);

    try {
      const response = await fetch(`/api/listings/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const payload = (await response.json()) as UpdateListingResponse;

      if (payload.ok) {
        // Weight and price both move the totals, so the list needs a refetch
        // rather than a reproduction of the aggregation here. The button stays
        // in its loading state across it and the dialog closes only once the
        // refreshed rows are in — closing early would drop the farmer back on
        // a list still showing the figures they just changed.
        const refreshed = await requestListings().catch(() => null);

        if (refreshed?.ok) {
          setListings(refreshed.items);
          setStats(refreshed.stats);
          setLoadError(null);
        } else {
          // The edit itself landed; only the totals are behind. Show the saved
          // row and leave the summary to the next reload.
          setListings((current) =>
            current.map((row) => (row.id === target.id ? payload.listing : row)),
          );
        }

        setEditOpen(false);
      } else {
        setEditErrors(payload.fieldErrors ?? {});
        setEditError(payload.error);
      }
    } catch {
      setEditError(
        "Could not reach the CeylonGuard server. Check your connection.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: ListingStatus) => {
    setBusyId(id);
    setNotice(null);

    try {
      const response = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const payload = (await response.json()) as UpdateListingResponse;

      if (payload.ok) {
        setListings((current) =>
          current.map((row) => (row.id === id ? payload.listing : row)),
        );
        // Totals move with status; refetch rather than trying to reproduce the
        // aggregation here.
        reload();
      } else {
        setLoadError(payload.error);
      }
    } catch {
      setLoadError("Could not reach the CeylonGuard server.");
    } finally {
      setBusyId(null);
    }
  };

  const removeListing = async (id: string) => {
    setBusyId(id);
    setNotice(null);

    try {
      const response = await fetch(`/api/listings/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as DeleteListingResponse;

      if (payload.ok) {
        setListings((current) => current.filter((row) => row.id !== id));
        // The row on screen in the dialog has just gone; there is nothing left
        // to save it to.
        if (editing?.id === id) setEditOpen(false);
        reload();
      } else {
        setLoadError(payload.error);
      }
    } catch {
      setLoadError("Could not reach the CeylonGuard server.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Sprout className="size-3.5" /> Farmer Portal · Harvest Marketplace
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          Post a Listing
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Publish your available stock so matched factory managers can send
          offers directly. You can edit the weight, price, district or harvest
          date of anything you have already published.
        </p>
      </header>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <CircleX className="mt-0.5 size-5 shrink-0 text-red-600" />

          <div className="min-w-0 flex-1">
            <p className="text-sm leading-relaxed text-red-800">{loadError}</p>

            <Button
              variant="leafOutline"
              size="sm"
              className="mt-3"
              onClick={reload}
            >
              <RefreshCw className="size-3.5" />
              Try again
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Active listings" value={String(stats.active)} />
        <StatTile
          label="Stock listed"
          value={`${stats.totalWeightKg.toLocaleString()} kg`}
        />
        <StatTile
          label="Avg price"
          value={
            stats.averagePricePerKg > 0
              ? `${formatRupees(stats.averagePricePerKg)}/kg`
              : "—"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl gradient-leaf text-primary-foreground">
              <Store className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-leaf-strong">
                New harvest listing
              </p>
              <p className="text-xs text-muted-foreground">
                Four details and your stock is live to every registered factory.
              </p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={publish}>
            <ListingFields idPrefix="new" errors={publishErrors} />

            <Button type="submit" variant="hero" size="xl" disabled={publishing}>
              {publishing && <Loader2 className="size-4 animate-spin" />}
              {publishing ? "Publishing…" : "Publish listing"}
            </Button>
          </form>

          {publishError && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {publishError}
            </p>
          )}

          {notice && (
            <p className="mt-5 rounded-xl bg-leaf-soft p-3 text-sm text-leaf-strong">
              {notice}
            </p>
          )}
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-leaf-strong">
              My listings
            </h2>

            <Button
              variant="ghost"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Reload listings"
            >
              <RefreshCw
                className={`size-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          {loading && listings.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading your listings…
            </p>
          ) : listings.length === 0 ? (
            <div className="mt-4 grid place-items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
              <Store className="size-6 text-muted-foreground" />
              <p className="max-w-xs text-sm text-muted-foreground">
                No published harvests yet. Your listings appear here with live
                buyer match counts.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3">
              {listings.map((listing) => {
                const status = STATUS_META[listing.status];
                const busy = busyId === listing.id;
                const underEdit = editOpen && editing?.id === listing.id;

                return (
                  <li
                    key={listing.id}
                    className={`rounded-2xl border bg-leaf-soft/40 p-4 transition-opacity ${
                      underEdit ? "border-leaf" : "border-leaf/25"
                    } ${busy ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-lg font-bold text-leaf-strong">
                        {formatRupees(listing.pricePerKg)}/kg
                      </p>

                      {underEdit && (
                        <span className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-leaf-strong">
                          <Pencil className="size-3" />
                          Editing
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <span className="flex items-center gap-1.5">
                        <Scale className="size-3.5" /> {listing.weightKg} kg
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {listing.district}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />{" "}
                        {listing.harvestDate}
                      </span>
                      <span className="font-semibold text-leaf-strong">
                        {formatRupees(listing.totalValue)} total
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-leaf/20 pt-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${status.className}`}
                      >
                        {status.label}
                      </span>

                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => openEdit(listing)}
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>

                        {listing.status === "active" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void changeStatus(listing.id, "sold")
                              }
                            >
                              Mark sold
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void changeStatus(listing.id, "withdrawn")
                              }
                            >
                              Withdraw
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void changeStatus(listing.id, "active")
                            }
                          >
                            Re-open
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void removeListing(listing.id)}
                          aria-label="Delete listing"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={editOpen}
        // A save in flight owns the dialog: dismissing it now would leave the
        // farmer with no idea whether the change landed.
        onOpenChange={(open) => {
          if (!open && !saving) setEditOpen(false);
        }}
      >
        {/*
          No corner "X": the shared close button asks Button for an `icon-sm`
          size the variants do not define, so it renders unpadded. Cancel in
          the footer, Escape and the backdrop all close this anyway.
        */}
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-bold text-leaf-strong">
              Edit listing
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `${editing.weightKg} kg from ${editing.district}, harvested ${editing.harvestDate}.`
                : "Change the harvest details and save."}
            </DialogDescription>
          </DialogHeader>

          {/*
            Keyed by the row and the open that showed it, so re-opening a
            listing always starts from its saved values rather than whatever
            was left in the inputs the last time round.
          */}
          <form
            key={`${editing?.id ?? "none"}-${editSession}`}
            className="grid gap-4"
            onSubmit={saveEdit}
          >
            <ListingFields
              idPrefix="edit"
              defaults={editing}
              errors={editErrors}
            />

            {editError && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {editError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                disabled={saving}
                onClick={closeEdit}
              >
                Cancel
              </Button>

              <Button type="submit" variant="hero" size="lg" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListingsPage;
