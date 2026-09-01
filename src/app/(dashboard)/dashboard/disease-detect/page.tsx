"use client";

import Link from "next/link";
import {
  CircleX,
  History,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import ScanHistory from "@/components/dashboard/disease-detect/ScanHistory";
import ScanPlaceholder from "@/components/dashboard/disease-detect/ScanPlaceholder";
import ScanResult from "@/components/dashboard/disease-detect/ScanResult";
import ScanUploader, {
  type ScanStatus,
} from "@/components/dashboard/disease-detect/ScanUploader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MAX_IMAGE_BYTES,
  type HealthResponse,
  type HistoryResponse,
  type ScanFailure,
  type ScanResponse,
  type ScanSuccess,
} from "@/lib/disease-detect";
import { isHealthy } from "@/lib/disease-info";

/**
 * Real inference takes anywhere from a few hundred ms to several seconds, so
 * the bar creeps toward this ceiling and only completes when the response lands.
 */
const PROGRESS_CEILING = 92;

function ScanPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [progress, setProgress] = useState(0);

  const [result, setResult] = useState<ScanSuccess | null>(null);
  const [failure, setFailure] = useState<ScanFailure | null>(null);
  const [serviceOnline, setServiceOnline] = useState<boolean | null>(null);

  const [tab, setTab] = useState<"scan" | "history">("scan");
  /** Bumped after a scan is archived so the history tab reloads. */
  const [historyKey, setHistoryKey] = useState(0);
  const [historyCount, setHistoryCount] = useState<number | null>(null);

  const previewUrlRef = useRef<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  // Tell the farmer up front whether the model service is reachable.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/disease-detect/health", { cache: "no-store" })
      .then((response) => response.json() as Promise<HealthResponse>)
      .then((health) => {
        if (!cancelled) setServiceOnline(Boolean(health.online));
      })
      .catch(() => {
        if (!cancelled) setServiceOnline(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Badge the history tab straight away; the grid itself loads when opened.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/disease-detect/history?limit=1", { cache: "no-store" })
      .then((response) => response.json() as Promise<HistoryResponse>)
      .then((payload) => {
        if (!cancelled && payload.ok) setHistoryCount(payload.stats.total);
      })
      .catch(() => {
        // A missing badge is not worth surfacing; the tab still works.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Blob URLs and the progress timer both leak if the page unmounts mid-scan.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, []);

  const stopTicker = () => {
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const showPreviewFor = (file: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    const url = file ? URL.createObjectURL(file) : null;

    previewUrlRef.current = url;
    setPreview(url);
    setFileName(file?.name ?? null);
  };

  const runScan = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setFailure({
        ok: false,
        error: "That file is not an image. Pick a JPG or PNG photo.",
      });
      setStatus("error");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setFailure({
        ok: false,
        error: "That image is larger than 10 MB.",
        hint: "Most phone cameras have a lower-resolution setting that works fine here.",
      });
      setStatus("error");
      return;
    }

    showPreviewFor(file);
    setResult(null);
    setFailure(null);
    setStatus("scanning");
    setProgress(8);

    stopTicker();
    tickerRef.current = window.setInterval(() => {
      setProgress((current) =>
        current >= PROGRESS_CEILING
          ? PROGRESS_CEILING
          : current +
            Math.max(1, Math.round((PROGRESS_CEILING - current) * 0.09)),
      );
    }, 200);

    try {
      const body = new FormData();
      body.append("image", file);

      const response = await fetch("/api/disease-detect", {
        method: "POST",
        body,
      });

      let payload: ScanResponse;

      try {
        payload = (await response.json()) as ScanResponse;
      } catch {
        payload = {
          ok: false,
          error: `The server responded with status ${response.status}.`,
        };
      }

      if (payload.ok) {
        setResult(payload);
        setStatus("done");
        setServiceOnline(true);

        if (payload.saved) {
          setHistoryCount((current) => (current ?? 0) + 1);
          setHistoryKey((current) => current + 1);
        }
      } else {
        setFailure(payload);
        setStatus("error");

        if (response.status === 503 || response.status === 504)
          setServiceOnline(false);
      }
    } catch {
      setFailure({
        ok: false,
        error: "Could not reach the CeylonGuard server.",
        hint: "Check your connection and that the Next.js dev server is still running.",
      });
      setStatus("error");
    } finally {
      stopTicker();
      setProgress(100);
    }
  };

  const resetScan = () => {
    stopTicker();
    showPreviewFor(null);
    setResult(null);
    setFailure(null);
    setProgress(0);
    setStatus("idle");
  };

  const goToScanTab = useCallback(() => setTab("scan"), []);
  const handleHistoryTotal = useCallback(
    (total: number) => setHistoryCount(total),
    [],
  );

  const healthy = result !== null && isHealthy(result.info);

  return (
    <div className="grid gap-6">
      <header>
        <span className="eyebrow">
          <Sprout className="size-3.5" /> Farmer Portal · AI Disease Detection
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-leaf-strong sm:text-4xl">
          AI Disease Detection
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Upload or capture a tea leaf photo. The trained model classifies it
          into one of eight conditions and returns a confidence score with a
          treatment plan you can follow in the field.
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "scan" | "history")}
        className="gap-6"
      >
        <TabsList className="min-h-11 w-full rounded-2xl bg-secondary p-1 sm:w-fit">
          <TabsTrigger
            value="scan"
            className="h-full flex-1 gap-2 rounded-xl px-4 text-sm font-semibold data-active:bg-card data-active:text-leaf-strong data-active:shadow-sm sm:flex-none sm:px-6"
          >
            <ScanLine className="size-4" />
            New Scan
          </TabsTrigger>

          <TabsTrigger
            value="history"
            className="h-full flex-1 gap-2 rounded-xl px-4 text-sm font-semibold data-active:bg-card data-active:text-leaf-strong data-active:shadow-sm sm:flex-none sm:px-6"
          >
            <History className="size-4" />
            Scan History
            {historyCount !== null && historyCount > 0 && (
              <span className="rounded-full bg-leaf-soft px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums text-leaf-strong">
                {historyCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-6">
              <ScanUploader
                preview={preview}
                fileName={fileName}
                status={status}
                progress={progress}
                onFile={runScan}
                onReset={resetScan}
                serviceOnline={serviceOnline}
              />
            </div>

            <div className="grid gap-5">
              {failure && (
                <div className="animate-rise rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <CircleX className="mt-0.5 size-5 shrink-0 text-red-600" />

                    <div className="min-w-0">
                      <p className="font-display text-base font-bold text-red-900">
                        Scan failed
                      </p>

                      <p className="mt-1 text-sm leading-relaxed text-red-800">
                        {failure.error}
                      </p>

                      {failure.hint && (
                        <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 font-mono text-xs leading-relaxed text-red-900">
                          {failure.hint}
                        </p>
                      )}

                      <Button
                        variant="leafOutline"
                        size="sm"
                        className="mt-4"
                        onClick={resetScan}
                      >
                        Try another photo
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {result && !result.saved && (
                <div className="animate-rise flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />

                  <p className="text-xs leading-relaxed text-amber-900">
                    {result.saveError ??
                      "This result could not be added to your scan history."}{" "}
                    The diagnosis below is still valid — take a screenshot if
                    you need to keep it.
                  </p>
                </div>
              )}

              {result && <ScanResult result={result} />}

              {result && (
                <div
                  className={`animate-rise rounded-3xl p-5 sm:p-6 ${
                    healthy
                      ? "gradient-deep text-primary-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-5 shrink-0" />

                    <p className="font-display text-base font-bold">
                      AI Disease Free Stamp
                    </p>

                    {healthy && (
                      <Sparkles className="ml-auto size-4 opacity-80" />
                    )}
                  </div>

                  <p
                    className={`mt-2 text-sm leading-relaxed ${
                      healthy ? "opacity-85" : "text-muted-foreground"
                    }`}
                  >
                    {healthy
                      ? "This leaf was classified as healthy, so the AI Disease Free Stamp is issued. You can now create a harvest marketplace listing."
                      : "The stamp is only issued when a leaf is classified as Healthy. Treat the block using the plan above, then scan again."}
                  </p>

                  {healthy && (
                    <Button asChild variant="soft" size="lg" className="mt-4">
                      <Link href="/dashboard/listings">
                        Post a Harvest Listing
                      </Link>
                    </Button>
                  )}
                </div>
              )}

              {!result && !failure && <ScanPlaceholder />}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <ScanHistory
            refreshKey={historyKey}
            onStartScan={goToScanTab}
            onTotalChange={handleHistoryTotal}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ScanPage;
