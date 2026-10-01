import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayColor } from '../public/js/format.js';

test('displayColor: alte Standardfarben bekommen ein festes Pastell-Gegenstück', () => {
  assert.equal(displayColor('#2E7CF6'), '#BDE3FF');
  assert.equal(displayColor('#26c839'), '#B8F2D0'); // Groß-/Kleinschreibung egal
  assert.equal(displayColor('#145F1E'), '#FFC2B4');
  assert.equal(displayColor('#808080'), '#E6DFD3');
});

test('displayColor: helle Farben bleiben unverändert', () => {
  assert.equal(displayColor('#FFE58F'), '#FFE58F');
  assert.equal(displayColor('#D9C8FF'), '#D9C8FF');
  assert.equal(displayColor('#FFFFFF'), '#FFFFFF');
});

test('displayColor: unbekannte dunkle Farben werden aufgehellt, damit schwarze Schrift lesbar bleibt', () => {
  const light = displayColor('#000080');
  assert.match(light, /^#[0-9A-F]{6}$/);
  assert.notEqual(light, '#000080');
  // Jeder Kanal liegt nach dem Aufhellen über 165 (255 - 255 * 0.35)
  const n = parseInt(light.slice(1), 16);
  for (const c of [n >> 16, (n >> 8) & 255, n & 255]) assert.ok(c >= 165);
});

test('displayColor: ungültige Werte fallen auf ein neutrales Grau zurück', () => {
  assert.equal(displayColor(undefined), '#E6DFD3');
  assert.equal(displayColor('blau'), '#E6DFD3');
});
