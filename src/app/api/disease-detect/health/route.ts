import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { mlServiceUrl, type HealthResponse } from "@/lib/disease-detect";

/** Lets the scan page show whether the Keras model service is actually up. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEALTH_TIMEOUT_MS = 5_000;

export async function GET() {
  const { userId } = await auth();
  const serviceUrl = mlServiceUrl();

  if (!userId) {
    return NextResponse.json<HealthResponse>(
      { online: false, serviceUrl, error: "Not signed in." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${serviceUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json<HealthResponse>({
        online: false,
        serviceUrl,
        error: `Model service returned status ${response.status}.`,
      });
    }

    const payload = (await response.json()) as {
      model?: string;
      classes?: string[];
    };

    return NextResponse.json<HealthResponse>({
      online: true,
      serviceUrl,
      model: payload.model,
      classes: payload.classes,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";

    return NextResponse.json<HealthResponse>({
      online: false,
      serviceUrl,
      error: timedOut
        ? "Model service did not respond in time."
        : "Model service is not running.",
    });
  }
}
