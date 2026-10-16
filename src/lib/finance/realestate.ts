/**
 * Real-estate economics.
 *
 * The most reliably miscalculated return in Indian personal finance is the
 * return on residential property. The arithmetic almost always omits stamp
 * duty and registration, brokerage, maintenance, vacancy, interior capex,
 * property tax, the tax on rent, and the capital-gains liability on exit —
 * collectively a large fraction of the headline appreciation. This module
 * forces every one of those terms into the calculation.
 */

import { xirr, type CashFlow } from './returns';

/** Equated monthly instalment for a reducing-balance loan. */
export function emi(principal: number, annualRate: number, months: number): number {
  if (months <= 0) return Number.NaN;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export interface AmortisationRow {
  month: number;
  openingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  closingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export function amortisationSchedule(
  principal: number,
  annualRate: number,
  months: number,
  options: { extraMonthlyPayment?: number; prepaymentMonths?: Record<number, number> } = {},
): { schedule: AmortisationRow[]; totalInterest: number; totalPaid: number; monthsSaved: number | null } {
  const baseEmi = emi(principal, annualRate, months);
  const extra = options.extraMonthlyPayment ?? 0;
  const r = annualRate / 12;
  let balance = principal;
  const schedule: AmortisationRow[] = [];
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  let month = 0;

  while (balance > 0.5 && month < months * 3) {
    month += 1;
    const interest = balance * r;
    let payment = baseEmi + extra + (options.prepaymentMonths?.[month] ?? 0);
    if (payment > balance + interest) payment = balance + interest;
    const principalPart = payment - interest;
    balance = Math.max(0, balance - principalPart);
    cumulativeInterest += interest;
    cumulativePrincipal += principalPart;
    schedule.push({
      month,
      openingBalance: balance + principalPart,
      payment,
      interest,
      principal: principalPart,
      closingBalance: balance,
      cumulativeInterest,
      cumulativePrincipal,
    });
  }

  return {
    schedule,
    totalInterest: cumulativeInterest,
    totalPaid: cumulativeInterest + cumulativePrincipal,
    monthsSaved: schedule.length < months ? months - schedule.length : null,
  };
}

export interface PropertyAcquisitionCosts {
  /** Agreed transaction price. */
  price: number;
  /** Stamp duty rate as a fraction of price. State-specific; must be supplied. */
  stampDutyRate: number;
  /** Registration fee rate as a fraction of price. */
  registrationRate: number;
  /** Brokerage rate as a fraction of price. */
  brokerageRate?: number;
  /** Fixed legal and due-diligence costs. */
  legalCosts?: number;
  /** Goods and services tax where applicable (under-construction property). */
  gstRate?: number;
  /** Interior and fit-out spend. */
  interiors?: number;
  /** Other one-time costs (society transfer, documentation). */
  otherCosts?: number;
}

export interface PropertyAcquisitionResult {
  price: number;
  stampDuty: number;
  registration: number;
  brokerage: number;
  gst: number;
  legalCosts: number;
  interiors: number;
  otherCosts: number;
  /** All-in cost of putting the property into service. */
  totalCost: number;
  /** One-time costs as a share of the headline price. */
  incidentalShare: number;
  /** The appreciation required just to break even on the incidental costs. */
  breakEvenAppreciationToRecoverIncidentals: number;
}

export function propertyAcquisitionCost(costs: PropertyAcquisitionCosts): PropertyAcquisitionResult {
  const stampDuty = costs.price * costs.stampDutyRate;
  const registration = costs.price * costs.registrationRate;
  const brokerage = costs.price * (costs.brokerageRate ?? 0);
  const gst = costs.price * (costs.gstRate ?? 0);
  const legalCosts = costs.legalCosts ?? 0;
  const interiors = costs.interiors ?? 0;
  const otherCosts = costs.otherCosts ?? 0;
  const totalCost = costs.price + stampDuty + registration + brokerage + gst + legalCosts + interiors + otherCosts;
  const incidental = totalCost - costs.price;
  return {
    price: costs.price,
    stampDuty,
    registration,
    brokerage,
    gst,
    legalCosts,
    interiors,
    otherCosts,
    totalCost,
    incidentalShare: costs.price > 0 ? incidental / costs.price : 0,
    breakEvenAppreciationToRecoverIncidentals: costs.price > 0 ? incidental / costs.price : 0,
  };
}

/** Gross rental yield: annual rent divided by price. The least meaningful yield. */
export function grossRentalYield(annualRent: number, price: number): number | null {
  if (price <= 0) return null;
  return annualRent / price;
}

export interface NetYieldInputs {
  annualRent: number;
  price: number;
  /** Months per year the property is expected to stand vacant. */
  vacancyMonths?: number;
  annualMaintenance?: number;
  annualPropertyTax?: number;
  societyChargesAnnual?: number;
  insuranceAnnual?: number;
  /** Annual non-recoverable repairs as a fraction of price. */
  maintenanceReserveRate?: number;
  /** Effective marginal tax rate on rental income as a fraction (post 30% deduction). */
  marginalTaxRate?: number;
}

export interface NetYieldResult {
  grossYield: number | null;
  effectiveRent: number;
  operatingCosts: number;
  taxableRentalIncome: number;
  taxOnRent: number;
  netIncome: number;
  netYield: number | null;
  /** Net yield on the all-in acquisition cost rather than on the headline price. */
  netYieldOnTotalCost: (totalCost: number) => number | null;
}

/**
 * Net rental yield.
 *
 * Two conventions matter and are both returned. The 30% statutory deduction
 * from net annual value is a tax provision, not an economic expense — actual
 * maintenance can be higher or lower. This model applies the real cash costs
 * first, then the tax computed with the statutory deduction, so the two are
 * never conflated.
 */
export function netRentalYield(input: NetYieldInputs): NetYieldResult {
  const vacancyMonths = input.vacancyMonths ?? 0;
  const effectiveRent = input.annualRent * (1 - vacancyMonths / 12);
  const maintenanceReserve = input.price * (input.maintenanceReserveRate ?? 0.005);
  const operatingCosts =
    (input.annualMaintenance ?? 0) +
    (input.annualPropertyTax ?? 0) +
    (input.societyChargesAnnual ?? 0) +
    (input.insuranceAnnual ?? 0) +
    maintenanceReserve;

  // Statutory computation: 30% standard deduction from the net annual value,
  // then municipal taxes, then tax at the marginal rate. Capital expenditure
  // is never deductible; only interest on borrowed capital is.
  const netAnnualValue = Math.max(0, effectiveRent - (input.annualPropertyTax ?? 0));
  const taxableRentalIncome = Math.max(0, netAnnualValue * 0.7);
  const taxOnRent = taxableRentalIncome * (input.marginalTaxRate ?? 0);

  const netIncome = effectiveRent - operatingCosts - taxOnRent;

  return {
    grossYield: grossRentalYield(input.annualRent, input.price),
    effectiveRent,
    operatingCosts,
    taxableRentalIncome,
    taxOnRent,
    netIncome,
    netYield: input.price > 0 ? netIncome / input.price : null,
    netYieldOnTotalCost: (totalCost: number) => (totalCost > 0 ? netIncome / totalCost : null),
  };
}

export interface PropertyInvestmentInputs {
  purchasePrice: number;
  acquisition: PropertyAcquisitionCosts;
  /** Loan amount taken against the property; 0 for an all-cash purchase. */
  loanAmount?: number;
  loanRate?: number;
  loanTenureMonths?: number;
  annualRent: number;
  rentGrowthRate: number;
  vacancyMonthsPerYear?: number;
  annualOperatingCostRate?: number;
  propertyTaxGrowthRate?: number;
  holdingYears: number;
  /** Expected compound annual appreciation of the property price. */
  appreciationRate: number;
  /** Rate of increase in the maintenance reserve. */
  costInflation?: number;
  /** Marginal tax rate applied to rental income and to the interest deduction. */
  marginalTaxRate?: number;
  /** Brokerage on sale as a fraction of the sale price. */
  sellingBrokerageRate?: number;
  /** Capital-gains tax rate applied to the gain at sale. */
  capitalGainsTaxRate?: number;
  /** Assumed return on the equity if it were invested elsewhere, for opportunity cost. */
  alternativeReturn?: number;
}

export interface PropertyYearRow {
  year: number;
  rent: number;
  vacancyLoss: number;
  operatingCosts: number;
  interestPaid: number;
  principalPaid: number;
  taxOnRent: number;
  netCashFlow: number;
  loanBalance: number;
  propertyValue: number;
  equity: number;
}

export interface PropertyInvestmentResult {
  acquisition: PropertyAcquisitionResult;
  equityInvested: number;
  years: PropertyYearRow[];
  salePrice: number;
  sellingCosts: number;
  loanRepaidAtSale: number;
  capitalGainsTax: number;
  netSaleProceeds: number;
  /** Money-weighted return on the investor's own equity. */
  xirr: ReturnType<typeof xirr>;
  /** The same return with no leverage, for comparison. */
  unleveredXirr: ReturnType<typeof xirr>;
  totalRentReceived: number;
  totalInterestPaid: number;
  totalOperatingCosts: number;
  totalTaxOnRent: number;
  opportunityCostOfEquity: number;
  warnings: string[];
}

/**
 * Full leveraged property investment model with a money-weighted return.
 *
 * Output design decisions worth noting: the XIRR is computed on the investor's
 * own equity, so a leveraged property can show a very high or a negative
 * equity return from the same price path. The unlevered XIRR is always
 * returned alongside so that the effect of borrowing is visible rather than
 * mistaken for superior asset selection. Opportunity cost is reported as a
 * separate line and never netted into the return, because it is a comparison,
 * not a cash flow.
 */
export function propertyInvestmentModel(input: PropertyInvestmentInputs): PropertyInvestmentResult {
  const warnings: string[] = [];
  const acquisition = propertyAcquisitionCost(input.acquisition);
  const loanAmount = input.loanAmount ?? 0;
  const loanRate = input.loanRate ?? 0;
  const tenureMonths = input.loanTenureMonths ?? input.holdingYears * 12;
  const equityInvested = acquisition.totalCost - loanAmount;

  if (loanAmount > input.purchasePrice * 0.9) {
    warnings.push(
      'A loan above 90% of the property price is unusual for Indian residential lending and would normally require additional security or a higher rate. Confirm the loan-to-value actually available before modelling this structure.',
    );
  }
  if (equityInvested <= 0) {
    warnings.push('The modelled equity contribution is zero or negative; a leveraged return is undefined in that case.');
  }

  const monthlyPayment = loanAmount > 0 ? emi(loanAmount, loanRate, tenureMonths) : 0;
  let loanBalance = loanAmount;
  let propertyValue = input.purchasePrice;
  let rent = input.annualRent;
  let operatingCostRate = input.annualOperatingCostRate ?? 0.008;
  const costInflation = input.costInflation ?? 0.05;
  const vacancyMonths = input.vacancyMonthsPerYear ?? 0;
  const marginalTaxRate = input.marginalTaxRate ?? 0;

  const years: PropertyYearRow[] = [];
  let totalRent = 0;
  let totalInterest = 0;
  let totalOperating = 0;
  let totalTaxOnRent = 0;

  for (let y = 1; y <= input.holdingYears; y += 1) {
    const vacancyLoss = rent * (vacancyMonths / 12);
    const effectiveRent = rent - vacancyLoss;
    const operating = propertyValue * operatingCostRate;
    let interestPaid = 0;
    let principalPaid = 0;
    for (let m = 0; m < 12; m += 1) {
      if (loanBalance <= 0) break;
      const monthlyInterest = loanBalance * (loanRate / 12);
      const monthlyPrincipal = Math.max(0, Math.min(loanBalance, monthlyPayment - monthlyInterest));
      interestPaid += monthlyInterest;
      principalPaid += monthlyPrincipal;
      loanBalance -= monthlyPrincipal;
    }

    // Tax: net annual value less 30% statutory deduction, less interest on
    // borrowed capital. A loss cannot be set off without limit; the model
    // reports the tax effect without assuming set-off against other heads.
    const netAnnualValue = Math.max(0, effectiveRent);
    const statutory = netAnnualValue * 0.7;
    const taxable = Math.max(0, statutory - interestPaid);
    const taxOnRent = taxable * marginalTaxRate;

    const netCashFlow = effectiveRent - operating - interestPaid - principalPaid - taxOnRent;

    totalRent += effectiveRent;
    totalInterest += interestPaid;
    totalOperating += operating;
    totalTaxOnRent += taxOnRent;

    propertyValue *= 1 + input.appreciationRate;
    years.push({
      year: y,
      rent,
      vacancyLoss,
      operatingCosts: operating,
      interestPaid,
      principalPaid,
      taxOnRent,
      netCashFlow,
      loanBalance,
      propertyValue,
      equity: propertyValue - loanBalance,
    });

    rent *= 1 + input.rentGrowthRate;
    operatingCostRate *= 1 + costInflation;
  }

  const salePrice = propertyValue;
  const sellingCosts = salePrice * (input.sellingBrokerageRate ?? 0.01);
  const improvementCost = 0; // interiors are already in the acquisition cost
  const indexedGain = salePrice - sellingCosts - acquisition.totalCost - improvementCost;
  const capitalGainsTax = Math.max(0, indexedGain * (input.capitalGainsTaxRate ?? 0.125));
  const netSaleProceeds = salePrice - sellingCosts - capitalGainsTax - loanBalance;

  if (input.capitalGainsTaxRate === undefined) {
    warnings.push(
      'No capital-gains rate was supplied, so the model applied the 12.5% long-term rate without indexation that applies to transfers on or after 23 July 2024. Where the property was acquired before that date and the seller is a resident individual or HUF, a comparison with the 20%-with-indexation option may be required. Always compute the tax explicitly for the actual acquisition year.',
    );
  }

  // The investor's own cash flow: rent received less operating costs and tax,
  // less the full EMI (interest AND principal). Principal repayment is a real
  // outflow of cash even though it builds equity, because this XIRR measures
  // the return on the equity the investor put in and kept in.
  const flows: CashFlow[] = [
    { date: new Date(Date.UTC(2020, 0, 1)), amount: -equityInvested, label: 'equity invested' },
  ];
  for (const yr of years) {
    const emiPaid = yr.interestPaid + yr.principalPaid;
    const cashToInvestor = yr.rent - yr.vacancyLoss - yr.operatingCosts - emiPaid - yr.taxOnRent;
    flows.push({
      date: new Date(Date.UTC(2020 + yr.year, 0, 1)),
      amount: cashToInvestor,
      label: `year ${yr.year} net cash flow`,
    });
  }
  flows.push({
    date: new Date(Date.UTC(2020 + input.holdingYears, 0, 1)),
    amount: netSaleProceeds,
    label: 'net sale proceeds',
  });

  const unleveredFlows: CashFlow[] = [
    { date: new Date(Date.UTC(2020, 0, 1)), amount: -acquisition.totalCost, label: 'all-cash purchase' },
  ];
  for (const yr of years) {
    const cashToInvestor = yr.rent - yr.vacancyLoss - yr.operatingCosts - yr.taxOnRent;
    unleveredFlows.push({ date: new Date(Date.UTC(2020 + yr.year, 0, 1)), amount: cashToInvestor });
  }
  unleveredFlows.push({
    date: new Date(Date.UTC(2020 + input.holdingYears, 0, 1)),
    amount: salePrice - sellingCosts - capitalGainsTax,
  });

  const opportunityCostOfEquity =
    equityInvested * (Math.pow(1 + (input.alternativeReturn ?? 0), input.holdingYears) - 1);

  return {
    acquisition,
    equityInvested,
    years,
    salePrice,
    sellingCosts,
    loanRepaidAtSale: loanAmount,
    capitalGainsTax,
    netSaleProceeds,
    xirr: xirr(flows),
    unleveredXirr: xirr(unleveredFlows),
    totalRentReceived: totalRent,
    totalInterestPaid: totalInterest,
    totalOperatingCosts: totalOperating,
    totalTaxOnRent: totalTaxOnRent,
    opportunityCostOfEquity,
    warnings,
  };
}

/**
 * Break-even holding period: the number of years of appreciation required for
 * the net sale proceeds to equal the total acquisition cost. This is usually
 * materially longer than buyers assume, because stamp duty, registration,
 * brokerage and the exit tax all have to be recovered before any profit exists.
 */
export function breakEvenHoldYears(
  acquisition: PropertyAcquisitionResult,
  appreciationRate: number,
  sellingBrokerageRate = 0.01,
  capitalGainsTaxRate = 0.125,
): number | null {
  if (appreciationRate <= -1) return null;
  for (let years = 0; years <= 100; years += 0.1) {
    const salePrice = acquisition.price * Math.pow(1 + appreciationRate, years);
    const netProceeds =
      salePrice - salePrice * sellingBrokerageRate - Math.max(0, salePrice * (1 - sellingBrokerageRate) - acquisition.totalCost) * capitalGainsTaxRate;
    if (netProceeds >= acquisition.totalCost) return years;
  }
  return null;
}

/** Capitalisation rate: net operating income divided by price. The institutional yield metric. */
export function capRate(netOperatingIncome: number, price: number): number | null {
  return price > 0 ? netOperatingIncome / price : null;
}

/**
 * Effect of leverage on the equity return for a given asset return.
 *   r_equity = (LTV × r_asset − (LTV − 1) × r_debt) / 1
 * expressed here in a readable form: for a mortgage of LTV, the equity return
 * is the asset return amplified by 1/(1 − LTV), less the cost of debt.
 */
export function leverageAdjustedReturn(
  assetReturn: number,
  loanToValue: number,
  debtCost: number,
): { equityReturn: number; amplificationFactor: number; breakEvenAssetReturn: number } {
  const equityShare = 1 - loanToValue;
  if (equityShare <= 0) {
    return { equityReturn: Number.NaN, amplificationFactor: Number.POSITIVE_INFINITY, breakEvenAssetReturn: debtCost };
  }
  const equityReturn = (assetReturn - loanToValue * debtCost) / equityShare;
  return {
    equityReturn,
    amplificationFactor: 1 / equityShare,
    // The asset return at which the equity return is exactly zero.
    breakEvenAssetReturn: loanToValue * debtCost,
  };
}

/** Rent-versus-buy comparison expressed as a monthly cash cost differential. */
export function rentVsBuyCashCost(
  monthlyRent: number,
  monthlyEmi: number,
  monthlyMaintenance: number,
  monthlyTaxBenefit: number,
): { buyCost: number; rentCost: number; difference: number; note: string } {
  const buyCost = monthlyEmi + monthlyMaintenance - monthlyTaxBenefit;
  return {
    buyCost,
    rentCost: monthlyRent,
    difference: buyCost - monthlyRent,
    note: 'This compares monthly cash cost only. It deliberately excludes the equity build-up from principal repayment and the opportunity cost of the down payment, both of which favour buying over long horizons and can reverse the comparison over short ones.',
  };
}
