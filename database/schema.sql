-- SatGeoTracker MVP
-- PostgreSQL 16+
--
-- Мы НЕ сохраняем текущие координаты/скорость каждую секунду.
-- Они являются вычисляемым состоянием:
-- OMM + UTC -> SGP4 -> position / velocity.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS satellites (
    norad_cat_id            BIGINT PRIMARY KEY,
    international_designator VARCHAR(32),
    object_name             VARCHAR(255) NOT NULL,
    object_type             VARCHAR(32),
    owner_code              VARCHAR(32),
    launch_date             DATE,
    orbit_type              VARCHAR(16),

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_satellites_name_trgm
    ON satellites
    USING GIN (object_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_satellites_orbit_type
    ON satellites (orbit_type);

CREATE INDEX IF NOT EXISTS ix_satellites_owner_code
    ON satellites (owner_code);


CREATE TABLE IF NOT EXISTS orbital_elements (
    id                      BIGSERIAL PRIMARY KEY,

    norad_cat_id            BIGINT NOT NULL
        REFERENCES satellites(norad_cat_id)
        ON DELETE CASCADE,

    epoch                   TIMESTAMPTZ NOT NULL,

    mean_motion             DOUBLE PRECISION NOT NULL,
    eccentricity            DOUBLE PRECISION NOT NULL,
    inclination             DOUBLE PRECISION NOT NULL,
    ra_of_asc_node          DOUBLE PRECISION NOT NULL,
    arg_of_pericenter       DOUBLE PRECISION NOT NULL,
    mean_anomaly            DOUBLE PRECISION NOT NULL,

    ephemeris_type          INTEGER,
    classification_type     VARCHAR(4),
    element_set_no          INTEGER,
    rev_at_epoch            INTEGER,

    bstar                   DOUBLE PRECISION,
    mean_motion_dot         DOUBLE PRECISION,
    mean_motion_ddot        DOUBLE PRECISION,

    source                  VARCHAR(64) NOT NULL DEFAULT 'celestrak',
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_orbital_elements_norad_epoch
        UNIQUE (norad_cat_id, epoch)
);

CREATE INDEX IF NOT EXISTS ix_orbital_elements_norad_epoch
    ON orbital_elements (norad_cat_id, epoch DESC);


CREATE TABLE IF NOT EXISTS sync_runs (
    id                      BIGSERIAL PRIMARY KEY,

    source                  VARCHAR(64) NOT NULL,
    dataset                 VARCHAR(64) NOT NULL,

    status                  VARCHAR(24) NOT NULL,
    rows_received           INTEGER NOT NULL DEFAULT 0,

    started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at             TIMESTAMPTZ,

    error_message           TEXT
);

CREATE INDEX IF NOT EXISTS ix_sync_runs_started_at
    ON sync_runs (started_at DESC);


-- LATER, НЕ для первой сборки:
--
-- owners (
--     code PK,
--     display_name,
--     country_code,
--     kind -- country / organization / joint
-- )
--
-- news_items (...)
-- users (...)
-- favorites (...)
