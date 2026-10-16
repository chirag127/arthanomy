/**
 * Calculator computations — property, private business and gold routes.
 */
import {
  amortisationSchedule,
  emi as computeEmi,
  leverageAdjustedReturn,
  netRentalYield,
  propertyAcquisitionCost,
  propertyInvestmentModel,
} from '../finance/realestate';
import { xirr, type CashFlow } from '../finance/returns';
import { n, out, pct, res, s, round } from './types';
import type { CalcResult, InputRecord } from './types';

const PCT = (x: number | null): number | null => (x === null || !Number.isFinite(x) ? null : round(x * 100, 2));

const dateAtYear = (year: number): Date => new Date(Date.UTC(2026 + year, 0, 1));

function irrOf(flows: CashFlow[]): ReturnType<typeof xirr> {
  const sorted = [...flows].sort((a, z) => a.date.getTime() - z.date.getTime());
  return xirr(sorted);
}

export const propertyCalculators: Record<string, (v: InputRecord) => CalcResult> = {
  'rental-yield'(v) {
    const price = n(v, 'price', 0);
    const monthlyRent = n(v, 'monthlyRent', 0);
    const stampDuty = pct(v, 'stampDuty');
    const result = netRentalYield({
      annualRent: monthlyRent * 12,
      price,
      vacancyMonths: n(v, 'vacancyMonths', 0),
      annualMaintenance: n(v, 'annualMaintenance', 0),
      annualPropertyTax: n(v, 'annualPropertyTax', 0),
      societyChargesAnnual: n(v, 'societyCharges', 0),
      marginalTaxRate: pct(v, 'marginalRate'),
    });
    const acquisition = propertyAcquisitionCost({
      price,
      stampDutyRate: stampDuty,
      registrationRate: 0.01,
      legalCosts: 0,
    });
    return res(
      [
        out('Gross rental yield', PCT(result.grossYield), 'percent', {
          note: 'Annual rent before any cost, as a share of the price.',
        }),
        out('Effective annual rent after vacancy', round(result.effectiveRent, 0), 'currency'),
        out('Operating costs', round(result.operatingCosts, 0), 'currency'),
        out('Tax on rental income', round(result.taxOnRent, 0), 'currency', {
          note: 'Computed on the net annual value with the 30% statutory deduction.',
        }),
        out('Net annual income', round(result.netIncome, 0), 'currency'),
        out('Net yield on the headline price', PCT(result.netYield), 'percent'),
        out('Net yield on the all-in acquisition cost', PCT(result.netYieldOnTotalCost(acquisition.totalCost)), 'percent', {
          note: 'The figure that matters: stamp duty and registration are not recoverable.',
          tone: 'caution',
        }),
        out('One-time acquisition costs as a share of price', PCT(acquisition.incidentalShare), 'percent'),
      ],
      [
        'A maintenance reserve of 0.5% of price a year is included by default. Actual repairs arrive irregularly and in larger amounts than a smooth reserve suggests.',
        'Stamp duty varies by state and by buyer category. Change it to the schedule that applies to you before drawing conclusions.',
      ],
      [
        'Gross yields in Indian residential property have typically been in the low single digits. Any projection materially above the market rate deserves scrutiny.',
      ],
    );
  },

  'property-xirr'(v) {
    const price = n(v, 'price', 0);
    const holdingYears = Math.max(1, Math.round(n(v, 'holdingYears', 10)));
    const loanAmount = n(v, 'loanAmount', 0);
    const monthlyRent = n(v, 'monthlyRent', 0);
    const result = propertyInvestmentModel({
      purchasePrice: price,
      acquisition: {
        price,
        stampDutyRate: pct(v, 'stampDuty'),
        registrationRate: 0.01,
        brokerageRate: pct(v, 'brokerage'),
        legalCosts: 0,
        interiors: n(v, 'interiors', 0),
      },
      loanAmount,
      loanRate: pct(v, 'loanRate'),
      loanTenureMonths: Math.max(1, Math.round(n(v, 'loanTenureMonths', holdingYears * 12))),
      annualRent: monthlyRent * 12,
      rentGrowthRate: pct(v, 'rentGrowth'),
      vacancyMonthsPerYear: n(v, 'vacancyMonths', 1),
      annualOperatingCostRate: 0.008,
      holdingYears,
      appreciationRate: pct(v, 'appreciation'),
      marginalTaxRate: pct(v, 'marginalRate'),
      sellingBrokerageRate: 0.01,
      capitalGainsTaxRate: pct(v, 'capitalGainsRate'),
      alternativeReturn: 0.06,
    });
    const equity = result.equityInvested;
    return res(
      [
        out('All-in acquisition cost', round(result.acquisition.totalCost, 0), 'currency'),
        out('Equity invested', round(equity, 0), 'currency'),
        out('XIRR on equity', PCT(result.xirr.rate), 'percent', {
          note: 'The return on your own money after interest, costs and tax.',
        }),
        out('XIRR with no borrowing', PCT(result.unleveredXirr.rate), 'percent', {
          note: 'The same property, bought for cash. The gap between the two lines is the effect of leverage, not of asset selection.',
        }),
        out('Effect of leverage', result.xirr.rate !== null && result.unleveredXirr.rate !== null ? round((result.xirr.rate - result.unleveredXirr.rate) * 100, 2) : null, 'percent', {
          tone: result.xirr.rate !== null && result.unleveredXirr.rate !== null && result.xirr.rate < result.unleveredXirr.rate ? 'negative' : 'neutral',
        }),
        out('Total rent received (net of vacancy)', round(result.totalRentReceived, 0), 'currency'),
        out('Total interest paid', round(result.totalInterestPaid, 0), 'currency'),
        out('Tax on rent over the period', round(result.totalTaxOnRent, 0), 'currency'),
        out('Net sale proceeds after loan repayment and tax', round(result.netSaleProceeds, 0), 'currency'),
        out('Opportunity cost of equity at 6% a year', round(result.opportunityCostOfEquity, 0), 'currency', {
          note: 'A comparison, not a cash flow, and deliberately excluded from the XIRR.',
        }),
      ],
      result.warnings.length > 0 ? result.warnings : ['The model ignores municipal revaluation, society levies raised in lump sums, and major repairs, all of which occur over a decade.'],
      [
        'Appreciation over ten years is unknowable. The calculator shows what a given assumption implies; it does not validate the assumption.',
        'A property purchased with a loan locks the buyer into interest-rate risk on top of property-price risk. The equity XIRR is far more volatile than the property return itself.',
      ],
    );
  },

  'property-leverage'(v) {
    const assetReturn = pct(v, 'assetReturn');
    const ltv = pct(v, 'loanToValue');
    const debtCost = pct(v, 'debtCost');
    const result = leverageAdjustedReturn(assetReturn, ltv, debtCost);
    const downside = leverageAdjustedReturn(assetReturn - 0.05, ltv, debtCost);
    const upside = leverageAdjustedReturn(assetReturn + 0.05, ltv, debtCost);
    return res(
      [
        out('Return on equity', PCT(Number.isFinite(result.equityReturn) ? result.equityReturn : null), 'percent', Number.isFinite(result.equityReturn) ? {} : {
          note: 'A loan-to-value of 100% leaves no equity and the return is undefined.',
        }),
        out('Amplification factor', round(result.amplificationFactor, 2), 'multiple'),
        out('Asset return at which the equity return is zero', PCT(result.breakEvenAssetReturn), 'percent', {
          note: 'If the property underperforms this figure, the equity return is negative even though the property rose.',
          tone: 'caution',
        }),
        out('Return on equity if the asset falls 5 percentage points short', PCT(Number.isFinite(downside.equityReturn) ? downside.equityReturn : null), 'percent', { tone: 'negative' }),
        out('Return on equity if the asset beats the assumption by 5 points', PCT(Number.isFinite(upside.equityReturn) ? upside.equityReturn : null), 'percent', { tone: 'positive' }),
        out('Gap between the two scenarios', result.amplificationFactor < Number.POSITIVE_INFINITY ? round((upside.equityReturn - downside.equityReturn) * 100, 2) : null, 'percent', {
          note: 'Leverage multiplies the assumption you got wrong as well as the one you got right.',
        }),
      ],
      [
        'This treats debt as a constant. Indian home loans commonly carry floating rates, so the debt cost itself moves with policy rates.',
        'It ignores that the lender can require repayment while the property cannot be sold quickly. Forced sales happen at a discount, which this arithmetic cannot show.',
      ],
      [],
    );
  },

  emi(v) {
    const principal = n(v, 'principal', 0);
    const annualRate = pct(v, 'annualRate');
    const months = Math.max(1, Math.round(n(v, 'months', 1)));
    const monthly = computeEmi(principal, annualRate, months);
    const schedule = amortisationSchedule(principal, annualRate, months);
    const higher = computeEmi(principal, annualRate + 0.01, months);
    return res(
      [
        out('Monthly instalment', round(monthly, 0), 'currency'),
        out('Total payment over the term', round(schedule.totalPaid, 0), 'currency'),
        out('Total interest', round(schedule.totalInterest, 0), 'currency'),
        out('Interest as a share of everything paid', schedule.totalPaid > 0 ? PCT(schedule.totalInterest / schedule.totalPaid) : null, 'percent'),
        out('Instalment if the rate were one point higher', round(higher, 0), 'currency', {
          note: 'A floating-rate loan can make this your actual instalment without any change in your plans.',
          tone: 'caution',
        }),
        out('Extra annual cost of that one point', round((higher - monthly) * 12, 0), 'currency'),
      ],
      [],
      ['The instalment is fixed for a floating-rate loan only until the next reset. Lenders typically extend the tenure before raising the instalment, which increases the total interest while feeling less painful.'],
    );
  },

  'loan-amortisation'(v) {
    const principal = n(v, 'principal', 0);
    const annualRate = pct(v, 'annualRate');
    const months = Math.max(1, Math.round(n(v, 'months', 1)));
    const extraMonthly = n(v, 'extraMonthly', 0);
    const prepayYear = Math.max(1, Math.round(n(v, 'prepaymentYear', 1)));
    const prepayAmount = n(v, 'prepaymentAmount', 0);
    const base = amortisationSchedule(principal, annualRate, months);
    const boosted = amortisationSchedule(principal, annualRate, months, {
      extraMonthlyPayment: extraMonthly,
      prepaymentMonths: { [prepayYear * 12]: prepayAmount },
    });
    const monthsSaved = months - boosted.schedule.length;
    const yearsSaved = monthsSaved / 12;
    return res(
      [
        out('Instalment without prepayment', round(base.schedule[0]?.payment ?? 0, 0), 'currency'),
        out('Total interest without prepayment', round(base.totalInterest, 0), 'currency'),
        out('Total interest with the extra payments', round(boosted.totalInterest, 0), 'currency'),
        out('Interest saved', round(base.totalInterest - boosted.totalInterest, 0), 'currency', { tone: 'positive' }),
        out('Months saved', monthsSaved > 0 ? monthsSaved : 0, 'number'),
        out('Years saved', yearsSaved > 0 ? round(yearsSaved, 1) : 0, 'years'),
        out('Loan closes in', round(boosted.schedule.length / 12, 1), 'years', {
          note: `Against ${round(months / 12, 1)} years without the extra payments.`,
        }),
      ],
      [
        'Many Indian home loans charge no prepayment penalty on floating-rate loans to individuals, but fixed-rate loans may. Confirm the terms before assuming the saving here.',
        'A prepayment is an investment that returns the loan rate, guaranteed and tax-free. It competes with every other use of that rupee, and for most borrowers it is a strong option.',
      ],
      [],
    );
  },

  'business-investment'(v) {
    const capital = n(v, 'initialCapital', 0);
    const revenue = n(v, 'annualRevenue', 0);
    const cogs = pct(v, 'cogsPercent');
    const opex = n(v, 'annualOperatingCosts', 0);
    const rampYears = Math.max(1, Math.round(n(v, 'rampUpYears', 1)));
    const years = Math.max(1, Math.round(n(v, 'years', 5)));
    const terminal = n(v, 'terminalValue', 0);
    const taxRate = pct(v, 'taxRate');
    const flows: CashFlow[] = [{ date: dateAtYear(0), amount: -capital }];
    let cumulative = -capital;
    let paybackYear: number | null = null;
    let totalProfit = 0;
    const rows: { label: string; value: string }[] = [];
    for (let y = 1; y <= years; y += 1) {
      const ramp = Math.min(1, y / rampYears);
      const grossProfit = revenue * ramp * (1 - cogs) - opex;
      const afterTax = grossProfit > 0 ? grossProfit * (1 - taxRate) : grossProfit;
      const cash = afterTax;
      totalProfit += cash;
      cumulative += cash;
      if (cumulative >= 0 && paybackYear === null) paybackYear = y;
      flows.push({ date: dateAtYear(y), amount: cash });
      rows.push({ label: `Year ${y}`, value: `Revenue ₹${Math.round(revenue * ramp).toLocaleString('en-IN')} · cash flow ₹${Math.round(cash).toLocaleString('en-IN')} · cumulative ₹${Math.round(cumulative).toLocaleString('en-IN')}` });
    }
    if (terminal > 0) {
      flows[flows.length - 1] = { date: dateAtYear(years), amount: (flows[flows.length - 1]?.amount ?? 0) + terminal };
    }
    const result = irrOf(flows);
    return res(
      [
        out('Money-weighted return on the capital', PCT(result.rate), 'percent', {
          note: 'The IRR of the actual cash flows, which is the only defensible single figure for an irregular stream.',
        }),
        out('Payback period', paybackYear, 'years', {
          tone: paybackYear === null ? 'negative' : 'neutral',
          ...(paybackYear === null ? { note: 'Not recovered within the modelled horizon.' } : {}),
        }),
        out('Cumulative cash generated', round(totalProfit, 0), 'currency'),
        out('Return multiple on capital', capital > 0 ? round((totalProfit + terminal) / capital, 2) : null, 'multiple'),
        out('Terminal value included', round(terminal, 0), 'currency'),
      ],
      result.warning ? [result.warning] : [],
      [
        'Small-business failure rates are high and the distribution of outcomes is extremely skewed. A single-scenario IRR describes a plan, not a probability.',
        'The most common error in these projections is an optimistic revenue line. Test the model at half the revenue before committing capital.',
        'Revenue and costs are assumed to be uncorrelated with the wider economy, which is contradicted by every recession on record.',
      ],
      rows,
    );
  },

  'private-cashflow'(v) {
    const call1 = n(v, 'call1', 0);
    const distribution = n(v, 'distribution', 0);
    const residual = n(v, 'residualValue', 0);
    const flows: CashFlow[] = [];
    const add = (amount: number, dateRaw: string): void => {
      if (!dateRaw || !Number.isFinite(amount) || amount === 0) return;
      const date = new Date(`${dateRaw}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return;
      flows.push({ date, amount });
    };
    add(-call1, s(v, 'date1', ''));
    add(-n(v, 'call2', 0), s(v, 'date2', ''));
    add(distribution, s(v, 'dateDistribution', ''));
    add(residual, s(v, 'dateValuation', ''));
    if (flows.length < 2) {
      return res([out('Money-weighted return', null, 'percent')], ['At least one call and one return of cash are needed to compute a return.'], []);
    }
    const result = irrOf(flows);
    const totalIn = flows.filter((f) => f.amount < 0).reduce((acc, f) => acc + Math.abs(f.amount), 0);
    const totalOut = flows.filter((f) => f.amount > 0).reduce((acc, f) => acc + f.amount, 0);
    const first = flows[0];
    const last = flows[flows.length - 1];
    const years = first && last ? (last.date.getTime() - first.date.getTime()) / (365.25 * 86_400_000) : 0;
    return res(
      [
        out('Money-weighted return (XIRR)', PCT(result.rate), 'percent'),
        out('Total called', round(totalIn, 0), 'currency'),
        out('Total returned (distributions plus residual)', round(totalOut, 0), 'currency'),
        out('Multiple on invested capital', totalIn > 0 ? round(totalOut / totalIn, 2) : null, 'multiple'),
        out('Holding period', round(years, 2), 'years'),
      ],
      [
        ...(result.warning ? [result.warning] : []),
        'Private-market valuations between funding rounds are opinions, not prices. The residual value entered here is the investor’s estimate, and a mark that has not been tested by a sale should be treated as provisional.',
        'Illiquidity is a feature of the asset class, not a temporary condition. Money committed is typically locked for years.',
      ],
      [],
    );
  },

  'franchise-return'(v) {
    const fee = n(v, 'franchiseFee', 0);
    const capex = n(v, 'capex', 0);
    const revenue = n(v, 'monthlyRevenue', 0);
    const margin = pct(v, 'grossMargin');
    const royalty = pct(v, 'royaltyPercent');
    const fixed = n(v, 'monthlyFixedCosts', 0);
    const years = Math.max(1, Math.round(n(v, 'years', 5)));
    const terminalMultiple = n(v, 'terminalMultiple', 0);
    const upfront = fee + capex;
    const monthlyCash = revenue * margin - revenue * royalty - fixed;
    const annualCash = monthlyCash * 12;
    const terminal = terminalMultiple > 0 ? annualCash * terminalMultiple : 0;
    const flows: CashFlow[] = [{ date: dateAtYear(0), amount: -upfront }];
    for (let y = 1; y <= years; y += 1) {
      flows.push({ date: dateAtYear(y), amount: annualCash + (y === years ? terminal : 0) });
    }
    const result = irrOf(flows);
    return res(
      [
        out('Upfront investment', round(upfront, 0), 'currency'),
        out('Monthly operating cash flow', round(monthlyCash, 0), 'currency', {
          tone: monthlyCash < 0 ? 'negative' : 'neutral',
        }),
        out('Annual operating cash flow', round(annualCash, 0), 'currency'),
        out('Payback period', monthlyCash > 0 ? round(upfront / monthlyCash, 1) : null, 'years', {
          note: monthlyCash > 0 ? 'In months: ' + Math.round(upfront / monthlyCash) : 'Never recovers its capital at these figures.',
        }),
        out('Royalty paid in the first year', round(revenue * royalty * 12, 0), 'currency'),
        out('Money-weighted return including the terminal value', PCT(result.rate), 'percent'),
        out('Terminal value assumed', round(terminal, 0), 'currency'),
      ],
      [
        ...(result.warning ? [result.warning] : []),
        'Franchise agreements commonly levy a percentage of revenue, not profit, so the franchisor is paid before the franchisee earns anything.',
        'A terminal multiple is the most speculative input in this calculation. It assumes someone will buy the business at that price when you decide to leave.',
        'Revenue is assumed to be flat for the whole term. New competitors and changes in the franchisor’s support have ended many franchise arrangements early.',
      ],
      [],
    );
  },

  'reit-distribution'(v) {
    const unitPrice = n(v, 'unitPrice', 0);
    const distribution = n(v, 'distributionPerUnit', 0);
    const interestShare = pct(v, 'interestShare');
    const dividendShare = pct(v, 'dividendShare');
    const marginal = pct(v, 'marginalRate');
    const units = n(v, 'units', 0);
    const yieldRate = unitPrice > 0 ? distribution / unitPrice : null;
    const taxableShare = Math.min(1, interestShare + dividendShare);
    const taxPerUnit = distribution * taxableShare * marginal;
    const netDistribution = distribution - taxPerUnit;
    const netYield = unitPrice > 0 ? netDistribution / unitPrice : null;
    return res(
      [
        out('Distribution yield on the current price', PCT(yieldRate), 'percent'),
        out('Taxable share of the distribution', PCT(taxableShare), 'percent', {
          note: 'Interest and dividend components are both taxed at the investor’s slab rate following the Finance Act 2023 change.',
        }),
        out('Tax per unit at the marginal rate', round(taxPerUnit, 4), 'currency'),
        out('Post-tax distribution yield', PCT(netYield), 'percent', {
          note: 'The figure that compares with a fixed deposit.',
          tone: 'caution',
        }),
        out('Annual post-tax income for the units entered', round(netDistribution * units, 0), 'currency'),
        out('Yield drag caused by tax', yieldRate !== null && netYield !== null ? round((yieldRate - netYield) * 100, 2) : null, 'percent'),
      ],
      [
        'REIT distributions can include a return of capital, which is not income at all. It reduces the cost base and increases the eventual capital-gains liability. Check the composition statement before treating a distribution as income.',
        'The unit price itself moves, and REIT units fall when interest rates rise. A distribution yield is not a total return.',
        'Indian REITs hold a small number of large assets. Occupancy at one property can move the distribution materially.',
      ],
      [],
    );
  },

  'gold-comparison'(v) {
    const amount = n(v, 'amount', 0);
    const growth = pct(v, 'goldGrowth');
    const years = Math.max(1, Math.round(n(v, 'years', 10)));
    const making = pct(v, 'makingCharges');
    const buyback = pct(v, 'buybackDiscount');
    const expense = pct(v, 'etfExpense');
    const sgbCoupon = pct(v, 'sgbCoupon');
    const marginal = pct(v, 'marginalRate');
    const ltcg = pct(v, 'ltcgRate');

    const physicalMetal = amount / (1 + making);
    const physicalValue = physicalMetal * (1 + growth) ** years;
    const physicalProceeds = physicalValue * (1 - buyback);
    const physicalTax = Math.max(0, physicalProceeds - amount) * ltcg;
    const physicalNet = physicalProceeds - physicalTax;

    const etfValue = amount * (1 + growth - expense) ** years;
    const etfTax = Math.max(0, etfValue - amount) * ltcg;
    const etfNet = etfValue - etfTax;

    const sgbGold = amount * (1 + growth) ** years;
    let couponTotal = 0;
    for (let y = 0; y < years; y += 1) {
      couponTotal += amount * sgbCoupon * (1 - marginal);
    }
    const sgbNet = sgbGold + couponTotal;

    const annualised = (value: number): number | null =>
      amount > 0 && years > 0 && value > 0 ? (value / amount) ** (1 / years) - 1 : null;

    return res(
      [
        out('Physical gold: net proceeds after buyback discount and tax', round(physicalNet, 0), 'currency', {
          note: 'Making charges vanish on resale: the metal you own is worth less than the metal you paid for.',
        }),
        out('Physical gold: annualised post-tax return', PCT(annualised(physicalNet)), 'percent'),
        out('Gold ETF: net value after expenses and tax', round(etfNet, 0), 'currency'),
        out('Gold ETF: annualised post-tax return', PCT(annualised(etfNet)), 'percent'),
        out('Sovereign Gold Bond route: redeemable value plus post-tax coupons', round(sgbNet, 0), 'currency', {
          note: 'Assumes redemption at maturity, where the capital gain is exempt and only the coupon is taxed.',
        }),
        out('Sovereign Gold Bond route: annualised post-tax return', PCT(annualised(sgbNet)), 'percent'),
        out('Cost of buying physical rather than the ETF route', round(etfNet - physicalNet, 0), 'currency', { tone: 'caution' }),
      ],
      [
        'The Sovereign Gold Bond route depends on issuance windows set by the government. Tranches are not always open, and the terms of any future tranche may differ. This is a comparison of mechanics, not advice that tranches are available.',
        'Gold pays no interest or dividend. Every route here relies entirely on the price, which has gone through multi-year flat periods after previous peaks.',
        'The LTCG rate applied to the ETF route follows the 12.5% rate for units held long term. Requirements for indexation and holding period must be verified for the year of sale.',
      ],
      [
        `A gold price growth of ${round(growth * 100, 1)}% a year is an assumption supplied by you, not a forecast.`,
      ],
    );
  },

  'currency-impact'(v) {
    const foreign = pct(v, 'foreignReturn');
    const depreciation = pct(v, 'inrDepreciation');
    const years = Math.max(1, Math.round(n(v, 'years', 5)));
    const expense = pct(v, 'fundExpense');
    const tax = pct(v, 'taxRate');
    const netForeign = foreign - expense;
    const inrReturn = (1 + netForeign) * (1 + depreciation) - 1;
    const postTax = inrReturn * (1 - tax);
    const multiple = (1 + postTax) ** years;
    const currencyContribution = (1 + foreign) * depreciation;
    return res(
      [
        out('Foreign asset return after fund expenses', PCT(netForeign), 'percent'),
        out('Return in rupees', PCT(inrReturn), 'percent', {
          note: 'Depreciation of the rupee against the currency of the asset adds to the return of an unhedged Indian investor.',
        }),
        out('Post-tax return in rupees', PCT(postTax), 'percent'),
        out('Contribution of currency movement (approximate)', PCT(currencyContribution), 'percent'),
        out('Multiple of the investment after the period', round(multiple, 2), 'multiple'),
        out('Rupee return if the rupee instead strengthens by the same amount', PCT((1 + netForeign) * (1 - depreciation) - 1), 'percent', {
          tone: 'caution',
          note: 'Currency movement is a two-way risk. A single direction is not a forecast.',
        }),
      ],
      [
        'Currency returns are not dividends. A weaker rupee raises the rupee value of the foreign asset but also raises the cost of the imports that feed domestic inflation.',
        'The post-tax figure applies the tax rate to the whole return, including the currency component. Verification against actual tax computation is required, particularly for debt-oriented foreign funds, which are taxed differently from equity-oriented ones.',
      ],
      [],
    );
  },

  'real-estate-fractional'(v) {
    const investment = n(v, 'investment', 0);
    const grossYield = pct(v, 'grossRentalYield');
    const vacancy = pct(v, 'vacancyRate');
    const platformFee = pct(v, 'platformFee');
    const assetCosts = pct(v, 'assetCosts');
    const appreciation = pct(v, 'appreciation');
    const years = Math.max(1, Math.round(n(v, 'years', 5)));
    const marginal = pct(v, 'marginalRate');
    const exitFee = pct(v, 'exitFee');
    const grossRent = investment * grossYield;
    const effectiveRent = grossRent * (1 - vacancy);
    const netOperating = effectiveRent - grossRent * platformFee - investment * assetCosts;
    const postTaxDistribution = netOperating * (1 - marginal);
    const exitValue = investment * (1 + appreciation) ** years * (1 - exitFee);
    const exitGain = Math.max(0, exitValue - investment);
    const exitTax = exitGain * 0.125;
    const exitProceeds = exitValue - exitTax;
    const flows: CashFlow[] = [{ date: new Date(Date.UTC(2026, 0, 1)), amount: -investment }];
    for (let y = 1; y <= years; y += 1) {
      flows.push({ date: new Date(Date.UTC(2026 + y, 0, 1)), amount: postTaxDistribution + (y === years ? exitProceeds : 0) });
    }
    const result = irrOf(flows);
    return res(
      [
        out('Gross annual rent on the investment', round(grossRent, 0), 'currency'),
        out('Net operating income after vacancy, platform fee and asset costs', round(netOperating, 0), 'currency'),
        out('Post-tax distribution per year', round(postTaxDistribution, 0), 'currency'),
        out('Post-tax distribution yield', investment > 0 ? PCT(postTaxDistribution / investment) : null, 'percent'),
        out('Exit proceeds after fee and tax', round(exitProceeds, 0), 'currency', {
          note: 'Capital gains on fractional property are taxed at 12.5% on the gain in this model; the applicable treatment must be verified with the platform and a professional.',
        }),
        out('Money-weighted return', PCT(result.rate), 'percent'),
      ],
      [
        ...(result.warning ? [result.warning] : []),
        'Fractional platforms add a layer between the investor and the asset. The platform’s solvency, its fee changes and its exit process are risks that the property’s yield cannot capture.',
        'A secondary-market exit at the price you want may not exist. Forced sales have realised discounts in every fractional and managed-real-estate failure to date.',
        'These structures are sold on yield. The comparison that matters is the money-weighted return against a listed REIT, which offers daily liquidity.',
      ],
      [],
    );
  },
};
