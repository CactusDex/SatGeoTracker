import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  Ellipsoid,
  GeoJsonDataSource,
  HorizontalOrigin,
  LabelCollection,
  LabelStyle,
  NearFarScalar,
  PointPrimitiveCollection,
  VerticalOrigin,
  Viewer,
} from "cesium";

interface CountryLabelData {
  name: string;
  lat: number;
  lon: number;
  rank: number;
}

interface CityLabelData {
  name: string;
  country: string;
  lat: number;
  lon: number;
  rank: number;
  capital: boolean;
}

interface MapLabelsPayload {
  countries: CountryLabelData[];
  cities: CityLabelData[];
}

const BORDERS_SHOW_BELOW_METERS = 18_000_000;
const COUNTRIES_SHOW_BELOW_METERS = 13_000_000;
const CITIES_SHOW_BELOW_METERS = 6_500_000;

/**
 * Small, fully local geographic context layer.
 *
 * Country borders and labels no longer depend on the legacy ArcGIS reference
 * MapServer. This makes labels deterministic even when the high-resolution
 * imagery service is slow or temporarily unavailable.
 */
export class LocalMapContextController {
  private borders: GeoJsonDataSource | null = null;
  private countryLabels: LabelCollection | null = null;
  private cityLabels: LabelCollection | null = null;
  private cityPoints: PointPrimitiveCollection | null = null;
  private destroyed = false;
  private lastVisibilityBucket = "";

  constructor(private readonly viewer: Viewer) {
    this.viewer.scene.postRender.addEventListener(this.updateVisibility);
  }

  async initialize(): Promise<void> {
    const [bordersResult, labelsResult] = await Promise.allSettled([
      this.loadBorders(),
      this.loadLabels(),
    ]);

    if (bordersResult.status === "rejected") {
      console.warn("SatGeoTracker: local country borders failed to load.", bordersResult.reason);
    }
    if (labelsResult.status === "rejected") {
      console.warn("SatGeoTracker: local country/city labels failed to load.", labelsResult.reason);
    }

    this.lastVisibilityBucket = "";
    this.updateVisibility();
  }

  destroy(): void {
    this.destroyed = true;

    if (!this.viewer.isDestroyed()) {
      this.viewer.scene.postRender.removeEventListener(this.updateVisibility);

      if (this.borders) {
        this.viewer.dataSources.remove(this.borders, true);
      }
      if (this.countryLabels) {
        this.viewer.scene.primitives.remove(this.countryLabels);
      }
      if (this.cityLabels) {
        this.viewer.scene.primitives.remove(this.cityLabels);
      }
      if (this.cityPoints) {
        this.viewer.scene.primitives.remove(this.cityPoints);
      }
    }

    this.borders = null;
    this.countryLabels = null;
    this.cityLabels = null;
    this.cityPoints = null;
  }

  private async loadBorders(): Promise<void> {
    const dataSource = await GeoJsonDataSource.load(
      "/map-data/country-borders.geojson",
      {
        clampToGround: true,
        stroke: Color.fromCssColorString("#c9dcff").withAlpha(0.34),
        strokeWidth: 1.1,
      }
    );

    if (this.destroyed || this.viewer.isDestroyed()) {
      return;
    }

    dataSource.name = "SGT local country borders";
    dataSource.show = false;
    await this.viewer.dataSources.add(dataSource);
    this.borders = dataSource;
  }

  private async loadLabels(): Promise<void> {
    const response = await fetch("/map-data/map-labels.json", {
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`map-labels.json returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as MapLabelsPayload;
    if (this.destroyed || this.viewer.isDestroyed()) return;

    const countryLabels = new LabelCollection({ scene: this.viewer.scene });
    const cityLabels = new LabelCollection({ scene: this.viewer.scene });
    const cityPoints = new PointPrimitiveCollection();

    for (const country of payload.countries) {
      const maxDistance =
        country.rank >= 3 ? 18_000_000 : country.rank === 2 ? 14_000_000 : 10_000_000;

      countryLabels.add({
        id: `map-country:${country.name}`,
        position: Cartesian3.fromDegrees(country.lon, country.lat, 16_000),
        text: country.name.toUpperCase(),
        font: country.rank >= 3 ? "600 15px sans-serif" : "600 13px sans-serif",
        fillColor: Color.WHITE.withAlpha(country.rank >= 3 ? 0.86 : 0.72),
        outlineColor: Color.BLACK.withAlpha(0.88),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.CENTER,
        verticalOrigin: VerticalOrigin.CENTER,
        distanceDisplayCondition: new DistanceDisplayCondition(0, maxDistance),
        scaleByDistance: new NearFarScalar(600_000, 1.0, maxDistance, 0.72),
        translucencyByDistance: new NearFarScalar(
          700_000,
          1.0,
          maxDistance,
          0.18
        ),
        disableDepthTestDistance: 0,
      });
    }

    for (const city of payload.cities) {
      const maxDistance = city.rank >= 3 ? 7_500_000 : city.rank === 2 ? 4_700_000 : 2_700_000;
      const pointSize = city.capital || city.rank >= 3 ? 4.5 : 3.2;

      cityPoints.add({
        id: `map-city-point:${city.name}`,
        position: Cartesian3.fromDegrees(city.lon, city.lat, 8_000),
        pixelSize: pointSize,
        color: Color.fromCssColorString("#e8f4ff").withAlpha(0.82),
        outlineColor: Color.BLACK.withAlpha(0.75),
        outlineWidth: 1,
        distanceDisplayCondition: new DistanceDisplayCondition(0, maxDistance),
        disableDepthTestDistance: 0,
      });

      cityLabels.add({
        id: `map-city:${city.name}`,
        position: Cartesian3.fromDegrees(city.lon, city.lat, 8_000),
        text: city.name,
        font:
          city.capital || city.rank >= 3
            ? "600 13px sans-serif"
            : "500 12px sans-serif",
        fillColor: Color.fromCssColorString("#eef7ff").withAlpha(0.9),
        outlineColor: Color.BLACK.withAlpha(0.92),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(7, 0),
        distanceDisplayCondition: new DistanceDisplayCondition(0, maxDistance),
        scaleByDistance: new NearFarScalar(250_000, 1.0, maxDistance, 0.75),
        translucencyByDistance: new NearFarScalar(
          350_000,
          1.0,
          maxDistance,
          0.12
        ),
        disableDepthTestDistance: 0,
      });
    }

    countryLabels.show = false;
    cityLabels.show = false;
    cityPoints.show = false;

    this.viewer.scene.primitives.add(countryLabels);
    this.viewer.scene.primitives.add(cityPoints);
    this.viewer.scene.primitives.add(cityLabels);

    this.countryLabels = countryLabels;
    this.cityLabels = cityLabels;
    this.cityPoints = cityPoints;
  }

  private readonly updateVisibility = (): void => {
    if (this.destroyed || this.viewer.isDestroyed()) return;

    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(
      this.viewer.camera.positionWC
    );
    if (!cartographic) return;

    const height = Math.max(0, cartographic.height);
    const showBorders = height < BORDERS_SHOW_BELOW_METERS;
    const showCountries = height < COUNTRIES_SHOW_BELOW_METERS;
    const showCities = height < CITIES_SHOW_BELOW_METERS;
    const bucket = `${showBorders ? 1 : 0}${showCountries ? 1 : 0}${showCities ? 1 : 0}`;

    if (bucket === this.lastVisibilityBucket) return;
    this.lastVisibilityBucket = bucket;

    if (this.borders) this.borders.show = showBorders;
    if (this.countryLabels) this.countryLabels.show = showCountries;
    if (this.cityLabels) this.cityLabels.show = showCities;
    if (this.cityPoints) this.cityPoints.show = showCities;
  };
}
