/**
 * Calculator computation registry.
 *
 * Maps every calculator id in `src/data/calculators/definitions.json` to the
 * function that performs its arithmetic. The definitions drive the user
 * interface; this layer supplies the numbers.
 *
 * `missingCalculators` exists so the build can assert that the two stay in
 * step: a definition without a computation is a broken page, and a computation
 * without a definition is dead code.
 */
import { returnsCalculators } from './returns';
import { fixedIncomeCalculators } from './fixed-income';
import { portfolioCalculators } from './portfolio';
import { planningCalculators } from './planning';
import { propertyCalculators } from './property-business';
import { derivativesCalculators } from './derivatives';
import type { CalcFn, CalcResult, InputRecord } from './types';

export type { CalcFn, CalcOutput, CalcResult, InputRecord } from './types';

export const COMPUTE: Record<string, CalcFn> = {
  ...returnsCalculators,
  ...fixedIncomeCalculators,
  ...portfolioCalculators,
  ...planningCalculators,
  ...propertyCalculators,
  ...derivativesCalculators,
};

/** Run a calculator by id. Returns null for an unknown id rather than throwing. */
export function compute(id: string, values: InputRecord): CalcResult | null {
  const fn = COMPUTE[id];
  if (!fn) return null;
  return fn(values);
}

/** Ids from a definitions file that have no computation function. */
export function missingCalculators(ids: string[]): string[] {
  return ids.filter((id) => !(id in COMPUTE));
}
