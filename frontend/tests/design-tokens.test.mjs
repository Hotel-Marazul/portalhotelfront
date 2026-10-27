import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/globals.css', import.meta.url), 'utf8');
// Só os tokens com hexadecimal do primeiro :root; os apelidos com var() ficam de fora.
const root = css.match(/:root\s*{([^}]*)}/)[1];
const tokens = Object.fromEntries([...root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, hex]) => [name, hex]));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Texto sobre fundo, como o design.md permite. Ficam de fora de propósito: --fg-3 sobre --muted (4,48:1) e --warn sobre --warn-bg (4,2:1).
const PAIRS = [
  ['fg', 'bg'], ['fg', 'surface'], ['fg', 'muted'],
  ['fg-2', 'bg'], ['fg-2', 'surface'], ['fg-2', 'muted'], ['fg-2', 'done-bg'],
  ['fg-3', 'bg'], ['fg-3', 'surface'], ['fg-3', 'command-bg'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accent-100'],
  ['accent-700', 'accent-100'], ['accent-700', 'accent-50'],
  ['on-dark', 'fg'], ['on-dark', 'accent'],
  ['warn', 'surface'], ['warn-fg', 'warn-bg'],
  ['danger', 'surface'], ['danger', 'danger-bg'],
];

test('contrast formula matches WCAG reference values', () => {
  assert.equal(contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(2), '4.48');
});

test('every token in the pairs is defined with a hex value in globals.css', () => {
  const missing = [...new Set(PAIRS.flat())].filter(name => !tokens[name]);
  assert.deepEqual(missing, []);
});

for (const [text, background] of PAIRS) {
  test(`--${text} on --${background} reaches 4.5:1`, () => {
    const ratio = contrast(tokens[text], tokens[background]);
    assert.ok(ratio >= 4.5, `--${text} ${tokens[text]} on --${background} ${tokens[background]} gives ${ratio.toFixed(2)}:1`);
  });
}
