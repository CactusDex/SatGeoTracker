import { useCallback, useEffect, useRef, useState } from "react";

import type { OmmRecord } from "../types";
import {
  clearSavedObserver,
  loadMinimumElevation,
  loadObserver,
  saveMinimumElevation,
  saveObserver,
} from "./observerStorage";
import type {
  ObserverLocation,
  PassPredictionRequest,
  PassPredictionResponse,
  SatellitePass,
} from "./observerTypes";

const DEFAULT_HORIZON_MINUTES = 60;
const AUTO_REFRESH_MS = 5 * 60_000;

export type PassPredictionState = "idle" | "calculating" | "ready" | "error";

export interface ObserverPassSystem {
  observer: ObserverLocation | null;
  minElevationDeg: number;
  passes: SatellitePass[];
  predictionState: PassPredictionState;
  predictionMessage: string;
  locationMessage: string;
  horizonMinutes: number;
  requestDeviceLocation: () => void;
  setManualLocation: (
    latitudeDeg: number,
    longitudeDeg: number,
    altitudeM: number
  ) => string | null;
  clearObserver: () => void;
  setMinimumElevation: (value: number) => void;
  refreshPasses: () => void;
}

export function useObserverPasses(records: OmmRecord[]): ObserverPassSystem {
  const [observer, setObserver] = useState<ObserverLocation | null>(() =>
    loadObserver()
  );
  const [minElevationDeg, setMinElevationDeg] = useState(() =>
    loadMinimumElevation(10)
  );
  const [passes, setPasses] = useState<SatellitePass[]>([]);
  const [predictionState, setPredictionState] =
    useState<PassPredictionState>("idle");
  const [predictionMessage, setPredictionMessage] = useState(
    "Задайте координаты наблюдателя для расчёта пролётов"
  );
  const [locationMessage, setLocationMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL("./passPredictionWorker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<PassPredictionResponse>) => {
      const response = event.data;
      if (!response || response.requestId !== requestIdRef.current) return;

      if (response.type === "error") {
        setPredictionState("error");
        setPredictionMessage(response.message);
        return;
      }

      setPasses(response.passes);
      setPredictionState("ready");
      setPredictionMessage(
        `${response.passes.length.toLocaleString()} пролётов · ${Math.round(response.elapsedMs)} мс`
      );
    };

    worker.onerror = (event) => {
      setPredictionState("error");
      setPredictionMessage(event.message || "Ошибка модуля расчёта пролётов");
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!observer) {
      setPasses([]);
      setPredictionState("idle");
      setPredictionMessage("Задайте координаты наблюдателя для расчёта пролётов");
      return;
    }

    if (records.length === 0 || !workerRef.current) {
      setPredictionState("idle");
      setPredictionMessage("Ожидание орбитального каталога…");
      return;
    }

    const requestId = ++requestIdRef.current;
    setPredictionState("calculating");
    setPredictionMessage(`Анализ объектов: ${records.length.toLocaleString()}…`);

    const request: PassPredictionRequest = {
      type: "predict",
      requestId,
      records,
      observer,
      startMs: Date.now(),
      horizonMinutes: DEFAULT_HORIZON_MINUTES,
      minElevationDeg,
    };

    workerRef.current.postMessage(request);
  }, [observer, minElevationDeg, records, refreshNonce]);

  useEffect(() => {
    if (!observer || records.length === 0) return;

    const timer = window.setInterval(() => {
      setRefreshNonce((value) => value + 1);
    }, AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [observer, records.length]);

  const requestDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationMessage("Геолокация в браузере недоступна");
      return;
    }

    setLocationMessage("Запрос геолокации устройства…");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: ObserverLocation = {
          latitudeDeg: position.coords.latitude,
          longitudeDeg: position.coords.longitude,
          altitudeM: position.coords.altitude ?? 0,
          accuracyM: position.coords.accuracy,
          source: "browser",
        };

        setObserver(next);
        saveObserver(next);
        setLocationMessage(
          `Координаты получены · ±${Math.round(position.coords.accuracy)} м`
        );
      },
      (error) => {
        setLocationMessage(formatGeolocationError(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      }
    );
  }, []);

  const setManualLocation = useCallback(
    (latitudeDeg: number, longitudeDeg: number, altitudeM: number): string | null => {
      if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) {
        return "Широта должна быть от -90 до 90";
      }
      if (
        !Number.isFinite(longitudeDeg) ||
        longitudeDeg < -180 ||
        longitudeDeg > 180
      ) {
        return "Долгота должна быть от -180 до 180";
      }
      if (!Number.isFinite(altitudeM) || altitudeM < -500 || altitudeM > 10_000) {
        return "Высота должна быть от -500 до 10000 м";
      }

      const next: ObserverLocation = {
        latitudeDeg,
        longitudeDeg,
        altitudeM,
        source: "manual",
      };

      setObserver(next);
      saveObserver(next);
      setLocationMessage("Координаты наблюдателя сохранены локально");
      return null;
    },
    []
  );

  const clearObserver = useCallback(() => {
    setObserver(null);
    setPasses([]);
    setLocationMessage("");
    clearSavedObserver();
  }, []);

  const setMinimumElevation = useCallback((value: number) => {
    const safe = Math.min(90, Math.max(0, value));
    setMinElevationDeg(safe);
    saveMinimumElevation(safe);
  }, []);

  const refreshPasses = useCallback(() => {
    setRefreshNonce((value) => value + 1);
  }, []);

  return {
    observer,
    minElevationDeg,
    passes,
    predictionState,
    predictionMessage,
    locationMessage,
    horizonMinutes: DEFAULT_HORIZON_MINUTES,
    requestDeviceLocation,
    setManualLocation,
    clearObserver,
    setMinimumElevation,
    refreshPasses,
  };
}

function formatGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Доступ к геолокации запрещён · укажите координаты вручную";
    case error.POSITION_UNAVAILABLE:
      return "Геолокация устройства недоступна · укажите координаты вручную";
    case error.TIMEOUT:
      return "Время запроса геолокации истекло · повторите или укажите координаты вручную";
    default:
      return error.message || "Не удалось получить геолокацию устройства";
  }
}
