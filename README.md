# SatGeoTracker MVP v0.8.5

SatGeoTracker (SGT) — одностраничный 3D-трекер реальных искусственных спутников вокруг Земли.

Проект получает OMM JSON из CelesTrak, передает данные через FastAPI, рассчитывает положение и скорость через `satellite.js` / SGP4 и визуализирует тысячи реальных объектов в CesiumJS.

## Что нового в v0.8.5 — Dynamic Camera FOV

- `Ctrl + колесо` над картой плавно меняет угол обзора камеры в диапазоне `25–110°`;
- управление FOV работает и в режиме Земли, и при tracking спутника;
- обычное колесо сохраняет прежнее поведение: zoom Земли в `КАРТА` и range до цели в satellite tracking;
- `Ctrl + 0` плавно возвращает стандартный FOV `60°`;
- при изменении появляется компактный временный HUD `FOV xx°`, который автоматически скрывается;
- Ctrl+Wheel перехватывается до штатного Cesium/browser zoom, поэтому одно действие не вызывает два разных движения камеры;
- используется обычная perspective projection без shader-fisheye: Cesium picking остаётся геометрически корректным;
- Camera state machine, SGP4, Earth/ISS 3D, Observer/Pass Engine и SDR backend не переписывались.

## Что нового в v0.8.4 — Russian UI Adaptation

- основной интерфейс адаптирован на русский язык без изменения внутренней логики режимов;
- `MAP` отображается как `КАРТА`, `PASSES` — как `ПРОЛЁТЫ`, а технический термин `SDR` сохранён;
- переведены поиск, `ИНСТРУМЕНТЫ`, `ПАНЕЛЬ`, состояния загрузки, workspace-сводки и карточка выбранного объекта;
- переведены Observer controls, сообщения геолокации, прогноз пролётов и нижний pass drawer;
- переведены SDR-фильтры, статусы и радиопанель, при этом VHF/UHF/L/S/X, NORAD, UTC, RX, SGP4/OMM и другие технические обозначения сохранены;
- направления азимута адаптированы на `С / СВ / В / ЮВ / Ю / ЮЗ / З / СЗ`;
- логотип/favicon по-прежнему не подключены;
- Camera, SGP4/orbit core, Earth/ISS 3D, Observer/Pass Engine и SDR backend не изменялись функционально.

## Что нового в v0.8.3 — Workspace Layout Cleanup

- `TOOLS` уменьшен до компактного временного popover без служебных карточек статистики.
- Правая `PANEL` стала docked inspector у края окна вместо большой floating-карточки.
- Нижняя лента пролётов стала компактным drawer: одна строка по умолчанию, многострочный список по кнопке раскрытия.
- Карточки пролётов в свернутом состоянии показывают только имя, статус/время и максимальную высоту.
- Основная telemetry выбранного спутника и observer geometry уплотнены в линейные readout-блоки.
- NORAD/International ID/координаты/epoch перенесены в раскрываемый `TECHNICAL DATA`.
- Выбор спутника автоматически закрывает временное меню `TOOLS`.
- Camera, SGP4, Earth/ISS 3D, Observer/Pass Engine и SDR backend не изменены.
- Логотип и favicon по-прежнему намеренно не подключены.

## Что нового в v0.8.2 — Mode Wiring + Working Controls

- `MAP` показывает полный орбитальный workspace с активным orbit filter;
- `SDR` фильтрует карту и поиск по спутникам, подходящим под текущие SDR filters;
- в `SDR` при заданном Observer появляется лента ближайших радиопролётов;
- `PASSES` фильтрует карту и поиск по спутникам, у которых есть рассчитанный пролёт в текущем горизонте;
- orbit filter теперь также ограничивает карточки пролётов, не меняя сам Pass Engine;
- `PANEL` работает без выбранного спутника и показывает сводку текущего режима;
- при выборе спутника правая панель автоматически становится контекстной для `MAP / SDR / PASSES`;
- `TOOLS` показывает рабочие контролы текущего режима, Observer и orbit filters;
- исправлено восстановление видимости точки после снятия tracking при переключении режимов;
- Camera, SGP4, Earth/ISS 3D, Observer/Pass Engine и SDR backend не переписывались.

Логотип и favicon в v0.8.2 намеренно не подключены.

## Что нового в v0.8.0 — SDR Data Layer

- отдельный режим `MAP / SDR`;
- SatNOGS DB transmitter catalog через backend proxy;
- общий 6-часовой кэш `%LOCALAPPDATA%\SatGeoTracker\cache\satnogs-transmitters.json`;
- привязка передатчиков к объектам по NORAD ID;
- фильтры по диапазонам `VHF / UHF / L / S / X`, mode, service и active status;
- опциональный фильтр только объектов, которые сейчас выше observer mask;
- SDR-информация при наведении на спутник;
- downlink/mode/service/status/baud в карточке выбранного спутника;
- расчёт Doppler shift и текущей рекомендуемой `RX NOW` частоты по изменению slant range;
- SDR-фильтрация ленты ближайших пролётов.

Источник RF-метаданных: SatNOGS DB. Орбитальная модель по-прежнему CelesTrak OMM + SGP4.

---

## Hotfix v0.4.1

Исправлен возврат `SATELLITE -> EARTH`: camera transform теперь сбрасывается в `Matrix4.IDENTITY`, затем выполняется короткий стабильный Earth-return flight, и только после него управление возвращается штатному Cesium controller. Это устраняет сломанное/непредсказуемое управление после tracking mode.

## Что нового в v0.4

### KSP-style target camera

Старая экспериментальная v0.3 camera заменена на отдельный `CameraManager`.

Главная модель:

```text
TARGET + HEADING + PITCH + RANGE
```

Режимы:

```text
EARTH -> TRANSITION -> SATELLITE
  ^                      |
  |______________________|
      Earth click / ESC
```

Поведение:

- наведение на спутник только подсвечивает его;
- клик по спутнику плавно переводит камеру к объекту;
- выбранный спутник становится настоящим moving camera target;
- выбранный объект пересчитывается SGP4 каждый render frame;
- камера следует за ним без секундных рывков;
- LMB drag вращает камеру вокруг выбранного спутника;
- wheel плавно меняет расстояние до спутника;
- клик по Земле или ESC полностью снимает satellite focus и возвращает управление планетой;
- клик по другому спутнику корректно переключает target;
- `F8` включает camera debug overlay.

Текстура Земли в v0.4 намеренно не менялась.

Подробности: `docs/CAMERA.md`.

### Общий CelesTrak cache

Кэш больше не привязан к папке конкретной версии проекта.

Windows:

```text
%LOCALAPPDATA%\SatGeoTracker\cache\celestrak-active.json
```

Linux/macOS fallback:

```text
~/.cache/satgeotracker/celestrak-active.json
```

Если при обновлении поверх старой версии существует `backend/.cache/celestrak-active.json`, backend автоматически копирует его в новое общее хранилище. Поэтому переходы v0.4 -> v0.5 больше не должны вызывать повторный `GROUP=ACTIVE` только из-за новой папки проекта.

---

## Быстрый запуск Windows

Первый запуск:

```powershell
.\setup.cmd
.\dev.cmd
```

Все последующие:

```powershell
.\dev.cmd
```

Остановка:

```powershell
.\stop-dev.cmd
```

Dev endpoints:

- Frontend: `http://127.0.0.1:5173/`
- Backend: `http://127.0.0.1:8000/`
- Health: `http://127.0.0.1:8000/health`
- Satellites: `http://127.0.0.1:8000/api/satellites`
- ISS model: `http://127.0.0.1:8000/api/models/iss.glb`

Vite proxy направляет `/api/*` с `:5173` на FastAPI `:8000`.

---

## Источник данных

По умолчанию:

```text
https://celestrak.org/NORAD/elements/gp.php?GROUP=ACTIVE&FORMAT=JSON
```

Формат: OMM JSON.

Диагностический ISS-only режим:

```powershell
$env:CELESTRAK_URL="https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=JSON"
.\dev.cmd
```

Вернуть ACTIVE:

```powershell
Remove-Item Env:CELESTRAK_URL -ErrorAction SilentlyContinue
```

TTL cache по умолчанию: 7200 секунд. Если upstream недоступен/отвечает 403, но cache существует, используется `stale-cache`.

---

## Runtime data model

Текущие координаты и скорость не сохраняются каждую секунду:

```text
OMM + current UTC
       ↓
      SGP4
       ↓
ECI position / velocity
       ↓
geodetic conversion
       ↓
lat / lon / altitude / speed
```

Для всех объектов глобальный MVP update loop работает примерно раз в секунду.

Для выбранного camera target:

```text
Cesium postUpdate / render frame
       ↓
SGP4(selected)
       ↓
same position
 ├─ PointPrimitive
 ├─ selected 3D model
 └─ Camera target
```

---

## Структура

```text
SatGeoTracker-MVP/
├─ AGENTS.md
├─ README.md
├─ setup.cmd / setup.ps1
├─ dev.cmd / dev.ps1
├─ stop-dev.cmd / stop-dev.ps1
├─ scripts/
├─ docs/
├─ backend/
│  └─ app/main.py
├─ frontend/
│  ├─ src/
│  │  ├─ App.tsx
│  │  ├─ orbit.ts
│  │  ├─ camera/
│  │  │  ├─ CameraManager.ts
│  │  │  ├─ cameraConfig.ts
│  │  │  ├─ cameraMath.ts
│  │  │  └─ cameraTypes.ts
│  │  ├─ models/
│  │  │  ├─ SatelliteModelManager.ts
│  │  │  ├─ satelliteModelRegistry.ts
│  │  │  ├─ modelOrientation.ts
│  │  │  └─ modelTypes.ts
│  │  └─ observer/
│  │     ├─ useObserverPasses.ts
│  │     ├─ passPredictionWorker.ts
│  │     ├─ observerMath.ts
│  │     ├─ ObserverPanel.tsx
│  │     └─ PassStrip.tsx
│  ├─ vite.config.ts
│  └─ package.json
└─ database/
   └─ schema.sql
```

## Документация

- `docs/CAMERA.md` — Camera System v0.4 и acceptance tests.
- `docs/MODELS.md` — v0.6.2 selected-satellite 3D model architecture.
- `docs/OBSERVER_PASSES.md` — v0.7.0 ground observer and pass prediction architecture.
- `docs/ARCHITECTURE.md` — runtime/data flow.
- `docs/DEVELOPMENT.md` — локальный запуск и диагностика.
- `docs/DATABASE.md` — модель БД.
- `docs/ROADMAP.md` — этапы проекта.

---

## v0.5 — Earth Visual Upgrade

v0.5 keeps the stable v0.4.1 target camera intact and upgrades only the Earth presentation.

Added:

- ArcGIS World Imagery as the preferred online basemap;
- bundled Natural Earth II as an automatic offline/error fallback;
- fixed HIGH-quality Earth presentation (quality selector removed from UI);
- improved `SkyAtmosphere` and ground atmosphere;
- Sun-driven atmosphere and globe lighting;
- HDR where supported;
- live UTC synchronization for Earth lighting;
- isolated `EarthVisualController` subsystem.

See `docs/EARTH_VISUALS.md`.

## v0.5.3 — fast high-resolution Earth

- restores/preserves the ArcGIS World Imagery + World Boundaries and Places look;
- skips ArcGIS MapServer metadata initialization by using direct cached tile URLs;
- mounts the local Natural Earth underlay immediately so the globe never has to wait for an online provider before rendering;
- delays reference-layer network traffic until camera zoom makes borders/cities useful;
- keeps HIGH render quality and the existing atmosphere profile;
- Camera System v0.4.1 is unchanged.

See `docs/EARTH_VISUALS.md`.


## v0.5.6 — HIGH-only Earth mode

- removes the LOW / MED / HIGH selector from the application UI;
- starts directly in HIGH Earth quality on every launch;
- preserves v0.5.3 direct ArcGIS World Imagery tile loading and adaptive borders/cities;
- keeps the local Natural Earth layer only as a fast underlay/fallback;
- Camera System v0.4.1 is unchanged.


## v0.5.6 — restored map context + non-blocking startup

- Restores the ArcGIS MapServer provider path from v0.5.1 for World Imagery and World Boundaries and Places.
- Country borders, country names and city labels again use the known-good reference service.
- Natural Earth II mounts immediately; ArcGIS initializes in the background and no longer blocks app startup.
- HIGH remains the only user-facing Earth quality mode.
- Camera v0.4.1 is unchanged.


## v0.5.6 — reliable high-resolution map

- HIGH is the only Earth quality mode.
- World Imagery uses direct cached tile requests through FastAPI instead of a browser-side ArcGIS metadata handshake.
- Successful map tiles are persisted between project versions.
- Country borders, country names and city labels are bundled locally and no longer depend on the legacy ArcGIS reference service.
- Natural Earth II remains as a fallback underlay; it never replaces the requested HIGH layer when online tiles are available.
- Camera v0.4.1 is unchanged.

## v0.5.7 — Adaptive high-resolution Earth

v0.5.7 restores the direct Cesium `ArcGisMapServerImageryProvider` path used by the visually successful v0.5 Earth, while keeping the local country/city overlay introduced later. `ImageryLayer.fromProviderAsync` prevents ArcGIS provider initialization from blocking the viewer. Cesium globe LOD is now adaptive: `maximumScreenSpaceError` tightens progressively as the camera approaches Earth, and the globe tile cache is increased to make previously viewed regions sharpen faster on return.

The public viewer remains HIGH-only. Camera v0.4.1 is unchanged.


## v0.6.2 — Selected Satellite 3D Mode

- Adds a dedicated `SatelliteModelManager` and model registry.
- NORAD `25544` (ISS) uses the official NASA **International Space Station (ISS) (B)** GLB.
- FastAPI proxies and persistently caches the NASA model under the shared SatGeoTracker cache.
- The ISS model is normalized to the 109 m physical reference span and rendered with no screen-space minimum-size inflation.
- The same render-frame SGP4 Cartesian position feeds the marker, model, and CameraManager target.
- Visual orientation follows the propagated orbital path; it is not presented as real spacecraft attitude telemetry.
- The cyan point remains as distant/loading/error fallback and disappears only in close 3D view.
- ISS requests a 4 km initial camera range; the satellite camera can zoom down to 250 m.
- Earth v0.5.7 rendering is unchanged. Camera v0.4.1 state machine / Earth-return logic is unchanged.

See `docs/MODELS.md`.


## v0.7.0 — Observer & Pass Engine

SatGeoTracker can now work from a real receiving location instead of only showing geocentric satellite positions.

Added:

- browser geolocation with explicit user permission;
- manual latitude / longitude / altitude input;
- local-only persistence of observer coordinates in browser storage;
- observer marker on the Cesium globe;
- live azimuth, elevation and slant range for the selected satellite;
- configurable minimum elevation mask: `5° / 10° / 20° / 30°`;
- Web Worker pass prediction so scanning the active catalog does not freeze the 3D renderer;
- next-60-minute AOS / TCA / LOS prediction;
- maximum pass elevation and azimuth at TCA;
- bottom pass strip with active-pass countdown and click-to-track;
- automatic pass refresh every five minutes plus manual refresh.

The pass engine is deliberately isolated from Camera v0.4.1 and Earth v0.5.7. It is the base for the next SDR layer: downlink frequencies, modulation, transmitter status and Doppler correction.

See `docs/OBSERVER_PASSES.md`.
