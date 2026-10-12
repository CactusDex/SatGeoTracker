import type { OmmRecord } from "./types";
import type { SdrResponse } from "./sdr/sdrTypes";

export interface SatelliteResponse {
  count: number;
  source: string;
  data: OmmRecord[];
}

interface BackendErrorPayload {
  detail?: unknown;
}

function stringifyDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail == null) return "Неизвестная ошибка backend";

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export async function loadSatellites(): Promise<SatelliteResponse> {
  let response: Response;

  try {
    // Relative URL deliberately goes through the Vite dev proxy.
    // This keeps frontend startup independent of localhost/127.0.0.1 CORS details.
    response = await fetch("/api/satellites");
  } catch (error) {
    throw new Error(
      `Backend недоступен: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    let payload: BackendErrorPayload | null = null;

    try {
      payload = (await response.json()) as BackendErrorPayload;
    } catch {
      // Keep the status-only fallback below.
    }

    throw new Error(
      `Ошибка backend HTTP ${response.status}: ${stringifyDetail(payload?.detail)}`
    );
  }

  return response.json() as Promise<SatelliteResponse>;
}

export async function loadSdrTransmitters(): Promise<SdrResponse> {
  let response: Response;

  try {
    response = await fetch("/api/sdr/transmitters");
  } catch (error) {
    throw new Error(
      `SDR backend недоступен: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok) {
    let payload: BackendErrorPayload | null = null;
    try {
      payload = (await response.json()) as BackendErrorPayload;
    } catch {
      // status fallback below
    }
    throw new Error(
      `Ошибка SDR backend HTTP ${response.status}: ${stringifyDetail(payload?.detail)}`
    );
  }

  return response.json() as Promise<SdrResponse>;
}
