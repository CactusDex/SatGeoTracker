# Database model

PostgreSQL is not required for the first globe demo, but the schema is defined now so runtime calculations do not leak into persistence.

## `satellites`

One row per cataloged object.

Primary key:

- `norad_cat_id`

Important attributes:

- international designator;
- name;
- object type;
- future owner code;
- launch date;
- coarse orbit type.

## `orbital_elements`

Versioned orbital-element sets for a satellite.

One satellite can have many element sets over time.

Important fields:

- epoch;
- mean motion;
- eccentricity;
- inclination;
- RAAN;
- argument of pericenter;
- mean anomaly;
- BSTAR;
- mean-motion derivatives.

## `sync_runs`

Operational journal for CelesTrak synchronization.

Stores:

- source/dataset;
- status;
- rows received;
- timestamps;
- error message.

## Explicit non-goal

Do not create a table receiving all satellite positions every second.

For 16,000 objects this would generate approximately 16,000 rows/second without providing value to the MVP.

Current position is derived on demand from orbital elements and time.
