import { useMemo, useState } from "react";
import type { FavoriteSatellite } from "../favoritesStorage";
import type { SatelliteRuntime } from "../types";

interface FavoritesPanelProps {
  favorites: readonly FavoriteSatellite[];
  satellitesByNorad: Map<number, SatelliteRuntime>;
  storageError: string | null;
  catalogLoading: boolean;
  catalogError: boolean;
  limit: number;
  onSelectSatellite: (noradId: number) => void;
  onRemoveFavorite: (noradId: number) => void;
  onClose: () => void;
}

export function FavoritesPanel({
  favorites,
  satellitesByNorad,
  storageError,
  catalogLoading,
  catalogError,
  limit,
  onSelectSatellite,
  onRemoveFavorite,
  onClose,
}: FavoritesPanelProps) {
  const [filter, setFilter] = useState("");
  const matching = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    return favorites.filter((favorite) => {
      const live = satellitesByNorad.get(favorite.noradId);
      const searchable = `${live?.name ?? favorite.name} ${favorite.name} ${favorite.noradId}`;
      return searchable.toLocaleLowerCase().includes(needle);
    });
  }, [filter, favorites, satellitesByNorad]);

  return (
    <section className="favorites-menu surface-card" aria-label="Избранные спутники">
      <div className="favorites-heading">
        <div>
          <span className="tool-kicker">МОИ СПУТНИКИ</span>
          <strong>ИЗБРАННОЕ</strong>
          <small>{favorites.length} / {limit}</small>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть избранное">×</button>
      </div>
      <label className="favorites-search-label" htmlFor="sgt-favorites-search">Поиск по сохранённым объектам</label>
      <input
        id="sgt-favorites-search"
        className="favorites-search"
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Название или NORAD ID"
      />
      {storageError && <p className="favorites-warning" role="status">{storageError}</p>}
      {favorites.length === 0 ? (
        <p className="favorites-empty">Список пуст. Выбери спутник на карте и нажми ☆ в его панели.</p>
      ) : matching.length === 0 ? (
        <p className="favorites-empty">В избранном ничего не найдено.</p>
      ) : (
        <div className="favorites-list">
          {matching.map((favorite) => {
            const live = satellitesByNorad.get(favorite.noradId);
            return (
              <div className={`favorite-row ${live ? "" : "unavailable"}`} key={favorite.noradId}>
                <button
                  type="button"
                  className="favorite-target"
                  disabled={!live}
                  title={live ? `Перейти к ${live.name}` : "Нет в текущем каталоге"}
                  onClick={() => onSelectSatellite(favorite.noradId)}
                >
                  <span className="favorite-star" aria-hidden="true">★</span>
                  <span className="favorite-info">
                    <strong>{live?.name ?? favorite.name}</strong>
                    <small>{`NORAD ${favorite.noradId}`}{live ? ` · ${live.orbitType}` : catalogLoading ? " · ЗАГРУЗКА КАТАЛОГА" : catalogError ? " · КАТАЛОГ НЕДОСТУПЕН" : " · НЕТ В КАТАЛОГЕ"}</small>
                  </span>
                  {live && <span className="favorite-arrow" aria-hidden="true">›</span>}
                </button>
                <button
                  type="button"
                  className="favorite-remove"
                  title={`Удалить ${live?.name ?? favorite.name} из избранного`}
                  aria-label={`Удалить ${live?.name ?? favorite.name} из избранного`}
                  onClick={() => onRemoveFavorite(favorite.noradId)}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
      <p className="favorites-footnote">Хранится локально в браузере. Недоступные спутники не удаляются автоматически.</p>
    </section>
  );
}
