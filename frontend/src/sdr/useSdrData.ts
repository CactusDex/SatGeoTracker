import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { loadSdrTransmitters } from "../api";
import { availableModes, availableServices, groupTransmittersByNorad } from "./sdrFilters";
import type { SdrFilters, SdrTransmitter } from "./sdrTypes";

export type SdrLoadState = "idle" | "loading" | "ready" | "error";

export interface SdrDataSystem {
  transmitters: SdrTransmitter[];
  byNorad: Map<number, SdrTransmitter[]>;
  filteredByNorad: Map<number, SdrTransmitter[]>;
  modes: string[];
  services: string[];
  state: SdrLoadState;
  message: string;
  source: string;
  filters: SdrFilters;
  setFilters: Dispatch<SetStateAction<SdrFilters>>;
  refresh: () => void;
}

const DEFAULT_FILTERS: SdrFilters = {
  band: "ALL",
  mode: "ALL",
  service: "ALL",
  activeOnly: true,
  visibleNowOnly: false,
};

export function useSdrData(): SdrDataSystem {
  const [transmitters, setTransmitters] = useState<SdrTransmitter[]>([]);
  const [state, setState] = useState<SdrLoadState>("idle");
  const [message, setMessage] = useState("Данные SDR не загружены");
  const [source, setSource] = useState("");
  const [filters, setFilters] = useState<SdrFilters>(DEFAULT_FILTERS);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setMessage("Загрузка базы передатчиков SatNOGS…");

    void loadSdrTransmitters()
      .then((response) => {
        if (cancelled) return;
        setTransmitters(response.data);
        setSource(response.source);
        setState("ready");
        setMessage(`Записей передатчиков: ${response.count.toLocaleString()}`);
      })
      .catch((cause) => {
        if (cancelled) return;
        setState("error");
        setMessage(cause instanceof Error ? cause.message : "Не удалось загрузить данные SatNOGS");
      });

    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  const byNorad = useMemo(() => groupTransmittersByNorad(transmitters), [transmitters]);
  const filteredByNorad = useMemo(
    () => groupTransmittersByNorad(transmitters, filters),
    [transmitters, filters]
  );

  return {
    transmitters,
    byNorad,
    filteredByNorad,
    modes: useMemo(() => availableModes(transmitters), [transmitters]),
    services: useMemo(() => availableServices(transmitters), [transmitters]),
    state,
    message,
    source,
    filters,
    setFilters,
    refresh: () => setRefreshNonce((value) => value + 1),
  };
}
