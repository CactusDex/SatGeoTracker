import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
const camera = readFileSync(resolve(root, 'src/camera/CameraManager.ts'), 'utf8');

test('hover card is rendered for every mode, not gated by SDR or a transmitter', () => {
  assert.match(app, /\{hovered && \(\s*<div className="sat-hover-card/);
  assert.doesNotMatch(app, /\{appMode === "SDR" && hovered && hoveredRadio/);
  for (const mode of ['КАРТА · СПУТНИК', 'SDR · СПУТНИК', 'ПРОЛЁТЫ · СПУТНИК']) {
    assert.ok(app.includes(mode), `${mode} missing`);
  }
});

test('hover is read-only: uses preloaded data and does not call selection or camera functions', () => {
  const block = app.split('{hovered && (')[1]?.split('{(loadingText || error) && (')[0];
  assert.ok(block, 'hover markup not found');
  assert.match(block, /NORAD \{hovered\.noradId\}/);
  assert.match(block, /formatHoverAltitude\(hovered\.altitudeKm\)/);
  assert.match(block, /formatHoverSpeed\(hovered\.speedKmS\)/);
  assert.match(block, /appMode === "SDR" && hoveredRadio/);
  assert.match(block, /appMode === "PASSES" && hoveredPass/);
  assert.doesNotMatch(block, /selectSatellite\(|focusSatellite\(|fetch\(/);
  assert.match(css, /\.sat-hover-card\s*\{[^}]*pointer-events:\s*none;/);
});

test('existing hover picking uses Cesium scene.pick and clears on canvas leave', () => {
  assert.match(camera, /this\.viewer\.scene\.pick\(position\)/);
  assert.match(camera, /this\.options\.onHoverSatellite\?\.\(nextId\)/);
  assert.match(camera, /private readonly onPointerLeave/);
  assert.match(camera, /this\.options\.onHoverSatellite\?\.\(null\)/);
});

test('touch devices do not show inert hover overlays', () => {
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\)\s*\{\s*\.sat-hover-card\s*\{\s*display: none;/);
});
