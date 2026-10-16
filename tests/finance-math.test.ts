/**
 * Known-value tests for the finance library.
 *
 * Every assertion is a value that can be reproduced from the standard closed
 * formulas by hand. These tests exist to catch sign errors, rate-convention
 * mistakes (fraction vs percent, annual vs monthly) and drift introduced by
 * later edits — the class of bug that silently changes every calculator at
 * once.
 */
import { describe, expect, it } from 'vitest';
import { cagr, lumpsumFutureValue, realReturn, sipFutureValue, xirr } from '../src/lib/finance/returns';
import { emi } from '../src/lib/finance/realestate';
import { priceBond, priceChangeEstimate, expectedCreditLoss } from '../src/lib/finance/bonds';
import { blackScholes } from '../src/lib/finance/options';
import { monteCarlo } from '../src/lib/finance/statistics';
import { postTaxAssetReturn } from '../src/lib/tax/engine';

describe('compound growth', () => {
  it('CAGR of a doubling over five years is 14.87%', () => {
    expect(cagr(100000, 200000, 5)).toBeCloseTo(0.148698, 5);
  });

  it('a lump sum at 12% for ten years is 3.1058 times the principal', () => {
    const result = lumpsumFutureValue(100000, 0.12, 10);
    expect(result.futureValue).toBeCloseTo(310584.82, 1);
  });

  it('SIP of 10,000 for ten years at 12% (begin mode) is about 23.23 lakh', () => {
    const result = sipFutureValue(10000, 0.12, 10, { timing: 'begin' });
    expect(result.futureValue).toBeGreaterThan(2_300_000);
    expect(result.futureValue).toBeLessThan(2_350_000);
  });

  it('the SIP timing convention matters and is not silently applied', () => {
    const begin = sipFutureValue(10000, 0.12, 10, { timing: 'begin' }).futureValue;
    const end = sipFutureValue(10000, 0.12, 10, { timing: 'end' }).futureValue;
    expect(begin).toBeGreaterThan(end);
  });
});

describe('real returns', () => {
  it('the exact real return of 8% against 6% inflation is 1.887%', () => {
    expect(realReturn(0.08, 0.06)).toBeCloseTo(0.018868, 5);
  });

  it('a nominal 6% deposit under 6% inflation has a zero real return', () => {
    expect(realReturn(0.06, 0.06)).toBeCloseTo(0, 8);
  });
});

describe('XIRR', () => {
  it('finds 10% for a one-year 100 to 110 investment', () => {
    const result = xirr([
      { date: new Date('2026-01-01T00:00:00Z'), amount: -100000 },
      { date: new Date('2027-01-01T00:00:00Z'), amount: 110000 },
    ]);
    expect(result.rate).not.toBeNull();
    expect(result.rate as number).toBeCloseTo(0.0997, 2);
  });

  it('is undefined without a sign change', () => {
    const result = xirr([
      { date: new Date('2026-01-01T00:00:00Z'), amount: -100000 },
      { date: new Date('2027-01-01T00:00:00Z'), amount: -50000 },
    ]);
    expect(result.rate === null || result.warning !== undefined).toBe(true);
  });
});

describe('loan mathematics', () => {
  it('EMI on 10 lakh at 9% over 240 months is about 8,997', () => {
    expect(emi(1000000, 0.09, 240)).toBeCloseTo(8997.26, 1);
  });

  it('a zero-rate loan divides principal evenly', () => {
    expect(emi(120000, 0, 12)).toBeCloseTo(10000, 6);
  });
});

describe('bond mathematics', () => {
  it('a bond priced at its coupon yield trades at par', () => {
    const priced = priceBond({ couponRate: 0.0725, frequency: 2, yearsToMaturity: 10 }, 0.0725);
    expect(priced.cleanPrice).toBeCloseTo(100, 1);
  });

  it('when yields rise the price falls, and convexity makes the gain exceed the loss', () => {
    const estimate = priceChangeEstimate(5, 50, 0.01);
    expect(estimate.linearOnly).toBeCloseTo(-0.05, 6);
    expect(estimate.withConvexity).toBeCloseTo(-0.0475, 6);
  });

  it('expected credit loss is PD times LGD times exposure', () => {
    const loss = expectedCreditLoss(1000000, 0.02, 0.4);
    expect(loss.lossGivenDefault).toBeCloseTo(0.6, 10);
    expect(loss.expectedLoss).toBeCloseTo(12000, 6);
  });
});

describe('options mathematics', () => {
  it('an at-the-money one-year call at 20% volatility prices near 7.97', () => {
    const result = blackScholes(
      { spot: 100, strike: 100, timeToExpiry: 1, riskFreeRate: 0, volatility: 0.2 },
      'call',
    );
    expect(result.price).toBeCloseTo(7.9656, 2);
  });

  it('put-call parity holds for the same inputs', () => {
    const call = blackScholes({ spot: 100, strike: 100, timeToExpiry: 1, riskFreeRate: 0.05, volatility: 0.25 }, 'call');
    const put = blackScholes({ spot: 100, strike: 100, timeToExpiry: 1, riskFreeRate: 0.05, volatility: 0.25 }, 'put');
    // C - P = S - K·e^(−rT)
    const parity = 100 - 100 * Math.exp(-0.05);
    expect(call.price - put.price).toBeCloseTo(parity, 3);
  });
});

describe('monte carlo', () => {
  it('is deterministic for a fixed seed', () => {
    const options = {
      initialValue: 1000000,
      annualReturn: 0.1,
      annualVolatility: 0.15,
      years: 10,
      simulations: 500,
      seed: 42,
    };
    const first = monteCarlo(options);
    const second = monteCarlo(options);
    expect(first.percentiles.p50).toBe(second.percentiles.p50);
    expect(first.percentiles.p5).toBeLessThan(first.percentiles.p50);
    expect(first.percentiles.p50).toBeLessThan(first.percentiles.p95);
  });
});

describe('tax engine invariants', () => {
  it('a five-year equity gain inside the ₹1.25 lakh exemption is untaxed and untouched', () => {
    // Per ₹1,00,000 invested at 12%, five years produces a gain of about
    // ₹76,000, below the annual ₹1,25,000 threshold, so no tax is due.
    const result = postTaxAssetReturn({
      assetLabel: 'Listed equity',
      taxClass: 'equity-listed',
      grossReturn: 0.12,
      holdingYears: 5,
      marginalSlabRate: 0.3,
      totalIncome: 2000000,
    });
    expect(result.postTaxTerminalMultiple).toBeCloseTo(result.preTaxTerminalMultiple, 9);
    expect(result.effectiveTaxRateOnGain).toBeCloseTo(0, 9);
  });

  it('a twenty-five year equity gain is taxed above the exemption only', () => {
    const result = postTaxAssetReturn({
      assetLabel: 'Listed equity',
      taxClass: 'equity-listed',
      grossReturn: 0.12,
      holdingYears: 25,
      marginalSlabRate: 0.3,
      totalIncome: 2000000,
    });
    expect(result.postTaxTerminalMultiple).toBeLessThan(result.preTaxTerminalMultiple);
    expect(result.annualisedPostTaxReturn).toBeLessThan(0.12);
    expect(result.effectiveTaxRateOnGain).toBeGreaterThan(0.09);
    expect(result.effectiveTaxRateOnGain).toBeLessThan(0.14);
  });

  it('a tax-exempt class is not taxed', () => {
    const result = postTaxAssetReturn({
      assetLabel: 'PPF',
      taxClass: 'ppf-exempt',
      grossReturn: 0.071,
      holdingYears: 15,
      marginalSlabRate: 0.3,
    });
    expect(result.postTaxTerminalMultiple).toBeCloseTo(result.preTaxTerminalMultiple, 6);
  });
});
