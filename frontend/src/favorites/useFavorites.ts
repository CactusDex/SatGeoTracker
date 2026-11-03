import { useEffect, useState } from "react";
import {
  FAVORITES_STORAGE_KEY,
  MAX_FAVORITES,
  addFavorite,
  parseFavorites,
  removeFavorite,
} from "../favoritesStorage";
import type { FavoriteSatellite } from "../favoritesStorage";

function initialFavorites(): FavoriteSatellite[] {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteSatellite[]>(initialFavorites);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
      setStorageError(null);
    } catch {
      setStorageError("Сохранение избранного недоступно в этом браузере. Список останется только до перезагрузки.");
    }
  }, [favorites]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== FAVORITES_STORAGE_KEY && event.key !== null) return;
      setFavorites(parseFavorites(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function toggle(noradId: number, name: string): void {
    setFavorites((current) =>
      current.some((item) => item.noradId === noradId)
        ? removeFavorite(current, noradId)
        : addFavorite(current, { noradId, name })
    );
  }

  function remove(noradId: number): void {
    setFavorites((current) => removeFavorite(current, noradId));
  }

  return { favorites, storageError, toggle, remove, limit: MAX_FAVORITES };
}
