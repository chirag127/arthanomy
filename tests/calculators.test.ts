/**
 * Every calculator, executed with its own default inputs.
 *
 * This is the contract between `definitions.json` (the UI) and the compute
 * registry (the arithmetic): if a definition names a computation that does not
 * exist, or a default produces a non-finite number, a page is broken for every
 * reader. The suite fails on both.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COMPUTE, compute, missingCalculators } from '../src/lib/calculators';
import type { InputRecord } from '../src/lib/calculators';

interface InputDef {
  id: string;
  kind: string;
  default?: unknown;
  options?: { value: string }[];
}

interface CalculatorDef {
  id: string;
  title: string;
  category: string;
  inputs: InputDef[];
  outputs?: unknown[];
  limitations?: string[];
  engine?: string;
}

const url = new URL('../src/data/calculators/definitions.json', import.meta.url);
const definitions = JSON.parse(readFileSync(url, 'utf8')) as CalculatorDef[];

function defaultsFor(def: CalculatorDef): InputRecord {
  const values: InputRecord = {};
  for (const input of def.inputs) {
    if (input.default === undefined || input.default === null) continue;
    values[input.id] = input.default as InputRecord[string];
  }
  return values;
}

describe('definition and computation coverage', () => {
  it('every definition has a computation', () => {
    const missing = missingCalculators(definitions.map((d) => d.id));
    expect(missing, `missing computations for: ${missing.join(', ')}`).toEqual([]);
  });

  it('every computation has a definition', () => {
    const defined = new Set(definitions.map((d) => d.id));
    const orphans = Object.keys(COMPUTE).filter((id) => !defined.has(id));
    expect(orphans, `computations without definitions: ${orphans.join(', ')}`).toEqual([]);
  });

  it('calculator count is stable', () => {
    expect(definitions.length).toBeGreaterThanOrEqual(60);
  });
});

const NUMERIC_KINDS = new Set(['currency', 'percent', 'number', 'years', 'multiple']);

describe('every calculator produces a coherent result with its defaults', () => {
  for (const def of definitions) {
    it(`${def.id} (${def.title})`, () => {
      const result = compute(def.id, defaultsFor(def));
      expect(result, `${def.id} returned null`).not.toBeNull();
      if (!result) return;

      expect(Array.isArray(result.outputs), `${def.id} outputs`).toBe(true);
      expect(result.outputs.length, `${def.id} has no outputs`).toBeGreaterThan(0);
      expect(Array.isArray(result.warnings), `${def.id} warnings`).toBe(true);
      expect(Array.isArray(result.assumptions), `${def.id} assumptions`).toBe(true);

      for (const output of result.outputs) {
        expect(output.label.length, `${def.id}: empty output label`).toBeGreaterThan(0);
        if (output.kind) {
          expect(
            ['currency', 'percent', 'number', 'years', 'text', 'multiple'].includes(output.kind),
            `${def.id}: bad kind ${output.kind}`,
          ).toBe(true);
        }
        if (output.value === null) continue; // explicitly unavailable is allowed
        if (typeof output.value === 'string') continue;
        expect(Number.isFinite(output.value), `${def.id}: non-finite output for "${output.label}"`).toBe(true);
        if (NUMERIC_KINDS.has(output.kind ?? 'number')) {
          expect(Math.abs(output.value), `${def.id}: implausible magnitude for "${output.label}"`).toBeLessThan(1e15);
        }
      }

      for (const warning of result.warnings) {
        expect(typeof warning, `${def.id}: non-string warning`).toBe('string');
        expect(warning.length, `${def.id}: empty warning`).toBeGreaterThan(0);
      }
      for (const assumption of result.assumptions) {
        expect(typeof assumption, `${def.id}: non-string assumption`).toBe('string');
        expect(assumption.length, `${def.id}: empty assumption`).toBeGreaterThan(0);
      }
    });
  }
});

describe('unknown calculator ids', () => {
  it('returns null rather than throwing', () => {
    expect(compute('no-such-calculator', {})).toBeNull();
  });
});
