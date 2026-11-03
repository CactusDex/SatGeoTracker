import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FAVORITES,
  addFavorite,
  parseFavorites,
  removeFavorite,
  sanitizeFavorites,
} from "../src/favoritesStorage.ts";

test("favorites serialize as NORAD ID + cached name, preserving order", () => {
  const saved = [{ noradId: 25544, name: "ISS (ZARYA)" }, { noradId: 48274, name: "CSS (TIANHE)" }];
  assert.deepEqual(parseFavorites(JSON.stringify(saved)), saved);
});

test("corrupted or disabled storage data is safely ignored", () => {
  assert.deepEqual(parseFavorites("{broken"), []);
  assert.deepEqual(parseFavorites(null), []);
  assert.deepEqual(parseFavorites('"not-a-list"'), []);
});

test("duplicate or invalid NORAD IDs do not enter storage", () => {
  const rows = sanitizeFavorites([
    { noradId: 25544, name: "ISS" },
    { noradId: 25544, name: "ISS duplicate" },
    { noradId: -1, name: "bad" },
    { noradId: "48274", name: "bad" },
    { noradId: Number.NaN, name: "bad" },
    { noradId: 48274, name: "   " },
  ]);
  assert.deepEqual(rows, [
    { noradId: 25544, name: "ISS" },
    { noradId: 48274, name: "NORAD 48274" },
  ]);
});

test("toggling a favorite never silently discards another favorite", () => {
  let rows = addFavorite([], { noradId: 25544, name: "ISS (ZARYA)" });
  rows = addFavorite(rows, { noradId: 48274, name: "CSS" });
  rows = addFavorite(rows, { noradId: 25544, name: "ISS duplicate" });
  assert.equal(rows.length, 2);
  rows = removeFavorite(rows, 25544);
  assert.deepEqual(rows, [{ noradId: 48274, name: "CSS" }]);
});

test("a missing catalog item remains saved and removable", () => {
  const initial = parseFavorites('[{"noradId":42075,"name":"WGS F9"}]');
  assert.equal(initial.length, 1);
  assert.deepEqual(removeFavorite(initial, 42075), []);
});

test("storage caps excessive payloads to protect browser performance", () => {
  const huge = Array.from({ length: MAX_FAVORITES + 15 }, (_, i) => ({ noradId: i + 1, name: `Sat ${i}` }));
  assert.equal(sanitizeFavorites(huge).length, MAX_FAVORITES);
});
