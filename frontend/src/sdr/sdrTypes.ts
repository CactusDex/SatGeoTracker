export type SdrBand = "ALL" | "VHF" | "UHF" | "L" | "S" | "X";

export interface SdrTransmitter {
  uuid: string;
  description?: string | null;
  alive?: boolean | null;
  type?: string | null;
  uplink_low?: number | null;
  uplink_high?: number | null;
  uplink_drift?: number | null;
  downlink_low?: number | null;
  downlink_high?: number | null;
  downlink_drift?: number | null;
  mode?: string | null;
  mode_id?: number | null;
  uplink_mode?: string | null;
  invert?: boolean | null;
  baud?: number | null;
  norad_cat_id: number;
  status?: string | null;
  updated?: string | null;
  citation?: string | null;
  service?: string | null;
  coordination?: string | null;
  coordination_url?: string | null;
}

export interface SdrResponse {
  count: number;
  source: string;
  data: SdrTransmitter[];
}

export interface SdrFilters {
  band: SdrBand;
  mode: string;
  service: string;
  activeOnly: boolean;
  visibleNowOnly: boolean;
}

export interface DopplerResult {
  carrierHz: number;
  radialVelocityMps: number;
  shiftHz: number;
  receiveHz: number;
}
