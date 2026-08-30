"use client";

import { Camera, ImageUp, RotateCcw, ScanLine, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { MODEL_INPUT_SIZE } from "@/lib/disease-info";

export type ScanStatus = "idle" | "scanning" | "done" | "error";

type ScanUploaderProps = {
  preview: string | null;
  fileName: string | null;
  status: ScanStatus;
  progress: number;
  onFile: (file: File) => void;
  onReset: () => void;
  serviceOnline: boolean | null;
};

function ServicePill({ online }: { online: boolean | null }) {
  if (online === null) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground">
        <span className="size-1.5 rounded-full bg-muted-foreground/50" />
        Checking model
      </span>
    );
  }

  return online ? (
    <span className="flex items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-1 text-[0.7rem] font-semibold text-leaf-strong">
      <span className="size-1.5 animate-pulse rounded-full bg-verified" />
      Model online
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[0.7rem] font-semibold text-red-700">
      <span className="size-1.5 rounded-full bg-red-500" />
      Model offline
    </span>
  );
}

function ScanUploader({
  preview,
  fileName,
  status,
  progress,
  onFile,
  onReset,
  serviceOnline,
}: ScanUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const isScanning = status === "scanning";

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (isScanning) return;

    const file = event.dataTransfer.files?.[0];

    if (file) onFile(file);
  };

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-leaf-strong">
          <ScanLine className="size-4" />
          Leaf Image
        </span>

        <ServicePill online={serviceOnline} />
      </div>

      {/* Preview / drop target */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isScanning) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative mt-4 overflow-hidden rounded-2xl border-2 transition-colors ${
          isDragging
            ? "border-dashed border-leaf bg-leaf-soft"
            : preview
              ? "border-solid border-border bg-secondary"
              : "border-dashed border-border bg-secondary/60"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Tea leaf selected for AI disease analysis"
            className="aspect-4/3 w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-leaf-soft text-leaf-strong">
              <ImageUp className="size-6" />
            </span>

            <span className="font-display text-base font-bold text-leaf-strong">
              Drop a tea leaf photo here
            </span>

            <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Fill the frame with a single leaf in daylight. JPG or PNG, up to
              10 MB — resized to {MODEL_INPUT_SIZE} × {MODEL_INPUT_SIZE} before
              it reaches the model.
            </span>
          </button>
        )}

        {isScanning && (
          <div className="pointer-events-none absolute inset-0 bg-leaf-strong/10">
            <div className="absolute inset-6 rounded-xl border-2 border-primary-foreground/70" />

            <span className="absolute left-4 top-4 size-6 rounded-tl-lg border-l-3 border-t-3 border-verified" />
            <span className="absolute right-4 top-4 size-6 rounded-tr-lg border-r-3 border-t-3 border-verified" />
            <span className="absolute bottom-4 left-4 size-6 rounded-bl-lg border-b-3 border-l-3 border-verified" />
            <span className="absolute bottom-4 right-4 size-6 rounded-br-lg border-b-3 border-r-3 border-verified" />

            <span className="absolute left-6 right-6 h-0.5 animate-scanline bg-primary-foreground shadow-[0_0_16px_oklch(0.66_0.16_143)]" />
          </div>
        )}
      </div>

      {fileName && (
        <p className="mt-2.5 truncate text-xs text-muted-foreground" title={fileName}>
          {fileName}
        </p>
      )}

      {/* Inference progress */}
      {isScanning && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Running tea_trained_model.keras…
            </p>

            <p className="text-xs font-semibold tabular-nums text-leaf-strong">
              {progress}%
            </p>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[image:var(--gradient-leaf)] transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear the input so re-picking the same file still fires onChange.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear the input so re-picking the same file still fires onChange.
          event.target.value = "";
          if (file) onFile(file);
        }}
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button
          variant="hero"
          size="xl"
          disabled={isScanning}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          Upload Image
        </Button>

        <Button
          variant="leafOutline"
          size="xl"
          disabled={isScanning}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="size-4" />
          Capture Photo
        </Button>
      </div>

      {preview && !isScanning && (
        <Button variant="ghost" size="lg" className="mt-3 w-full" onClick={onReset}>
          <RotateCcw className="size-4" />
          Scan Another Leaf
        </Button>
      )}
    </section>
  );
}

export default ScanUploader;
