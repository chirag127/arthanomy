/**
 * Calculator computations — derivatives.
 *
 * Every calculator here states the model it assumes. The Black–Scholes family
 * keeps its European-option, constant-volatility and continuous-hedging
 * assumptions visible in the output rather than in a footnote, because the
 * price it produces is a model output, not an observed fact.
 */
import {
  analyseStrategy,
  blackScholes,
  greeks as computeGreeks,
  impliedVolatility,
  marginStress,
  type Leg,
  type OptionType,
} from '../finance/options';
import { n, out, pct, res, s, round } from './types';
import type { CalcResult, InputRecord } from './types';

const PCT = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : round(x * 100, 2));

const optionTypeOf = (raw: string): OptionType => (raw === 'put' ? 'put' : 'call');
const directionOf = (raw: string): 'long' | 'short' => (raw === 'short' ? 'short' : 'long');

export const derivativesCalculators: Record<string, (v: InputRecord) => CalcResult> = {
  'option-payoff'(v) {
    const type = optionTypeOf(s(v, 'optionType', 'call'));
    const direction = directionOf(s(v, 'direction', 'long'));
    const spot = n(v, 'spot', 0);
    const strike = n(v, 'strike', 0);
    const premium = n(v, 'premium', 0);
    const quantity = Math.max(1, n(v, 'quantity', 1));
    const movePercent = pct(v, 'movePercent');
    const expirySpot = spot * (1 + movePercent);
    const intrinsic = type === 'call' ? Math.max(0, expirySpot - strike) : Math.max(0, strike - expirySpot);
    const sign = direction === 'long' ? 1 : -1;
    const profit = sign * quantity * intrinsic - sign * quantity * premium;
    const premiumTotal = premium * quantity;
    const breakEven = type === 'call' ? strike + premium : Math.max(0, strike - premium);
    return res(
      [
        out('Spot price at expiry in this scenario', round(expirySpot, 2), 'currency'),
        out('Intrinsic value per unit', round(intrinsic, 2), 'currency'),
        out('Premium ' + (direction === 'long' ? 'paid' : 'received') + ' in total', round(premiumTotal, 0), 'currency'),
        out('Profit or loss at that price', round(profit, 0), 'currency', {
          tone: profit >= 0 ? 'positive' : 'negative',
        }),
        out('Break-even spot at expiry', round(breakEven, 2), 'currency'),
        out('Loss if the option expires worthless', direction === 'long' ? round(-premiumTotal, 0) : round(premiumTotal, 0), 'currency', {
          note: 'For a long option this is the maximum loss. For a short option it is the maximum gain.',
        }),
      ],
      [
        direction === 'short' && type === 'call' && movePercent > 0.2
          ? 'A short call has unbounded loss potential: the underlying can rise without limit, and the loss is not capped by the premium received.'
          : 'This ignores brokerage, exchange fees, stamp duty, GST and the bid-ask spread, all of which are charged on both legs of an entry and exit.',
        'In India, index and stock options are cash-settled or physically settled at expiry depending on the contract and series; check which applies before treating this payoff as final.',
      ],
      ['The position is assumed to be held to expiry with no adjustment. Payoffs are per the quantity entered.'],
    );
  },

  'option-strategy-builder'(v) {
    const quantity = Math.max(1, n(v, 'quantity', 1));
    const spot = n(v, 'spot', 100);
    const leg1: Leg = {
      type: optionTypeOf(s(v, 'leg1Type', 'call')),
      direction: directionOf(s(v, 'leg1Direction', 'long')),
      strike: n(v, 'leg1Strike', 0),
      premium: n(v, 'leg1Premium', 0),
      quantity,
    };
    const leg2: Leg = {
      type: optionTypeOf(s(v, 'leg2Type', 'put')),
      direction: directionOf(s(v, 'leg2Direction', 'long')),
      strike: n(v, 'leg2Strike', 0),
      premium: n(v, 'leg2Premium', 0),
      quantity,
    };
    const analysis = analyseStrategy([leg1, leg2], { min: spot * 0.7, max: spot * 1.3, steps: 121 });
    const atSpot = analysis.points.reduce(
      (best, point) => (Math.abs(point.spotAtExpiry - spot) < Math.abs(best.spotAtExpiry - spot) ? point : best),
      analysis.points[0] as { spotAtExpiry: number; payoff: number; profit: number },
    );
    return res(
      [
        out('Net premium ' + (analysis.netPremium >= 0 ? 'paid' : 'received'), round(Math.abs(analysis.netPremium), 0), 'currency'),
        out('Maximum profit in the range tested', analysis.maxProfit === null ? 'Unbounded within the range tested' : round(analysis.maxProfit, 0), 'currency', typeof analysis.maxProfit === 'number' ? { note: 'Over a spot range of ±30% around the current price.' } : {}),
        out('Maximum loss in the range tested', analysis.maxLoss === null ? 'Unbounded within the range tested' : round(analysis.maxLoss, 0), 'currency', {
          tone: 'caution',
        }),
        out('Break-even points', analysis.breakEvens.length === 0 ? 'None within the range' : analysis.breakEvens.map((b) => round(b, 2)).join(', '), 'text'),
        out('Profit or loss at the current spot', round(atSpot.profit, 0), 'currency', {
          tone: atSpot.profit >= 0 ? 'positive' : 'negative',
        }),
        out('Payoff sign changes within the range', analysis.balancedPoints, 'number', {
          note: 'Each change is a break-even the position crosses.',
        }),
      ],
      [
        ...analysis.notes,
        'Multi-leg positions carry margin requirements on each leg and the margin can rise quickly when the position moves against you. The payoff diagram says nothing about whether the position can be held to expiry.',
        'Liquidity differs sharply by strike and expiry. A structure assembled from illiquid options pays a spread on entry and again on exit.',
      ],
      [],
    );
  },

  'black-scholes'(v) {
    const type = optionTypeOf(s(v, 'optionType', 'call'));
    const spot = n(v, 'spot', 0);
    const strike = n(v, 'strike', 0);
    const days = n(v, 'days', 30);
    const input = {
      spot,
      strike,
      timeToExpiry: days / 365,
      riskFreeRate: pct(v, 'riskFreeRate'),
      volatility: pct(v, 'volatility'),
      dividendYield: pct(v, 'dividendYield'),
    };
    const result = blackScholes(input, type);
    return res(
      [
        out('Model price', round(result.price, 2), 'currency'),
        out('Intrinsic value', round(result.intrinsicValue, 2), 'currency'),
        out('Time value', round(result.timeValue, 2), 'currency', {
          note: 'What the market is paying for the possibility of a further move. It decays to zero at expiry.',
        }),
        out('d1', round(result.d1, 4), 'number'),
        out('d2', round(result.d2, 4), 'number'),
        out('Price as a share of the underlying', spot > 0 ? PCT(result.price / spot) : null, 'percent'),
      ],
      result.warnings,
      result.assumptions,
    );
  },

  'implied-volatility'(v) {
    const type = optionTypeOf(s(v, 'optionType', 'call'));
    const marketPrice = n(v, 'marketPrice', 0);
    const spot = n(v, 'spot', 0);
    const strike = n(v, 'strike', 0);
    const days = n(v, 'days', 30);
    const result = impliedVolatility(marketPrice, {
      spot,
      strike,
      timeToExpiry: days / 365,
      riskFreeRate: pct(v, 'riskFreeRate'),
    }, type);
    const warnings: string[] = [];
    if (result.error) warnings.push(result.error);
    return res(
      [
        out('Implied volatility', PCT(result.volatility), 'percent', {
          note: 'The annualised volatility that makes the model reproduce the observed price.',
        }),
        out('Converged', result.converged ? 'Yes' : 'No', 'text', { tone: result.converged ? 'positive' : 'negative' }),
        out('Iterations used', result.iterations, 'number'),
        out('Intrinsic value of the option', type === 'call' ? round(Math.max(0, spot - strike), 2) : round(Math.max(0, strike - spot), 2), 'currency'),
        out('Time value in the observed price', round(marketPrice - (type === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot)), 2), 'currency'),
      ],
      [
        ...warnings,
        'An implied volatility is a translation of a price into model language, not an estimate of the future. It embeds the market’s risk appetite, the liquidity of that strike, and any dividends or corporate actions the model ignores.',
      ],
      [
        'The model assumes European exercise. Indian index options are European-style, but stock options are physically settled and American in character, so the comparison is approximate for them.',
      ],
    );
  },

  greeks(v) {
    const type = optionTypeOf(s(v, 'optionType', 'call'));
    const spot = n(v, 'spot', 0);
    const strike = n(v, 'strike', 0);
    const days = n(v, 'days', 30);
    const input = {
      spot,
      strike,
      timeToExpiry: days / 365,
      riskFreeRate: pct(v, 'riskFreeRate'),
      volatility: pct(v, 'volatility'),
      dividendYield: pct(v, 'dividendYield'),
    };
    const g = computeGreeks(input, type);
    return res(
      [
        out('Delta', round(g.delta, 4), 'number', {
          note: type === 'call' ? 'Approximate change in the option price per ₹1 change in the underlying.' : 'Negative for a long put.',
        }),
        out('Gamma', round(g.gamma, 5), 'number', {
          note: 'The rate at which delta changes. Gamma is highest near expiry for at-the-money options, which is why those positions move fastest.',
        }),
        out('Theta per calendar day', round(g.thetaPerDay, 3), 'currency', {
          note: 'The time decay the holder pays and the writer collects, before any market move.',
          tone: g.thetaPerDay < 0 ? 'negative' : 'neutral',
        }),
        out('Vega per volatility point', round(g.vegaPerPercent, 3), 'currency'),
        out('Rho per interest-rate point', round(g.rhoPerPercent, 3), 'currency', {
          note: 'Smallest of the greeks for short-dated Indian options, but not zero in a rate-tightening market.',
        }),
        out('Days to expiry', round(days, 0), 'number'),
      ],
      [
        'Greeks are local derivatives: they describe what happens for a small move from the current state, and they themselves change as the underlying moves.',
        'The model assumes volatility is constant. In practice volatility and price move together, so the delta of a real option is not the delta computed here.',
      ],
      [],
    );
  },

  'margin-requirement'(v) {
    const notional = n(v, 'notional', 0);
    const marginRate = pct(v, 'marginRate');
    const adverseMove = pct(v, 'adverseMove');
    const maintenanceRate = pct(v, 'maintenanceMargin');
    const result = marginStress(notional, marginRate, adverseMove);
    const maintenanceRequired = notional * maintenanceRate;
    const marginRemaining = Math.max(0, result.marginRemaining);
    const shortfall = Math.max(0, maintenanceRequired - marginRemaining);
    return res(
      [
        out('Margin posted', round(result.marginPosted, 0), 'currency'),
        out('Effective leverage', Number.isFinite(result.impliedLeverage) ? `${round(result.impliedLeverage, 1)}×` : '—', 'text', {
          note: 'A margin requirement of 5% is 20× leverage. Framing it as a small percentage hides this.',
        }),
        out('Loss on the adverse move', round(result.lossOnMove, 0), 'currency', { tone: 'negative' }),
        out('Margin remaining', round(marginRemaining, 0), 'currency'),
        out('Margin call', shortfall > 0 ? 'Triggered' : result.marginCallTriggered ? 'Likely' : 'Not triggered', 'text', {
          tone: shortfall > 0 ? 'negative' : 'positive',
        }),
        out('Additional cash required to restore the maintenance margin', round(shortfall, 0), 'currency'),
        out('Move that consumes the entire margin', PCT(result.moveToWipeOutMargin), 'percent', {
          note: 'Against a notional position. Daily index moves of this size have occurred in India within living memory.',
          tone: 'caution',
        }),
      ],
      [
        'Exchange margin requirements can be raised at short notice during volatile sessions, so the margin posted today is not the margin that will be required tomorrow.',
        'Leverage does not change the expected return of the underlying. It magnifies both directions and adds the possibility of a forced exit at the worst point.',
        'In a gap move — an earnings surprise or an unanticipated announcement — the position can trade through the margin level before any action is possible.',
      ],
      [],
    );
  },

  'futures-fair-value'(v) {
    const spot = n(v, 'spot', 0);
    const days = n(v, 'days', 30);
    const riskFreeRate = pct(v, 'riskFreeRate');
    const dividendYield = pct(v, 'dividendYield');
    const observed = n(v, 'observedFutures', 0);
    const t = days / 365;
    const fair = spot * Math.exp((riskFreeRate - dividendYield) * t);
    const basis = observed - fair;
    const basisPoints = fair > 0 ? (observed / fair - 1) * 10_000 : null;
    const impliedCarry = spot > 0 && t > 0 ? (observed / spot) ** (1 / t) - 1 : null;
    const annualisedBasis = fair > 0 && t > 0 ? (observed / fair) ** (1 / t) - 1 : null;
    return res(
      [
        out('Fair (cost-of-carry) value', round(fair, 2), 'currency'),
        out('Observed futures price', round(observed, 2), 'currency'),
        out('Basis', round(basis, 2), 'currency', {
          note: basis > 0 ? 'Futures trade above fair value: the market is paying to hold the position.' : 'Futures trade below fair value.',
        }),
        out('Basis in points per ten thousand', basisPoints === null ? null : round(basisPoints, 1), 'number'),
        out('Annualised basis', PCT(annualisedBasis), 'percent'),
        out('Implied financing rate in the futures price', PCT(impliedCarry), 'percent', {
          note: 'The rate the market is effectively charging for carrying the position, including the assumed dividend treatment.',
        }),
      ],
      [
        'In India, single-stock futures settle in cash against the settlement price, but the contract carries the cost of carry that this formula models. Dividend estimates enter through the dividend-yield input and are the largest source of error here.',
        'A basis that differs from the fair value can be a real market signal or an artefact of stale prices, low liquidity or a corporate action. One observation proves nothing either way.',
      ],
      [],
    );
  },
};
