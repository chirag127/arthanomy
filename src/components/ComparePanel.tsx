/**
 * ComparePanel — side-by-side comparison of up to four avenues.
 *
 * The panel deliberately refuses to produce a single score. It shows the
 * underlying facts and then states where a comparison is illegitimate —
 * because a contractual yield, a market return and an appraisal value are
 * not the same quantity and cannot be ranked against each other.
 */
import { useMemo, useState } from 'react';

export interface CompareItem {
  id: string;
  name: string;
  group: string;
  oneLiner: string;
  returnMechanism: string;
  expectedReturn?: string;
  volatility: string;
  liquidity: string;
  lockIn?: string;
  minimumInvestment?: string;
  taxTreatment: string;
  fees: string;
  inflationProtection: string;
  currencyExposure: string;
  counterpartyRisk: string;
  creditRisk: string;
  regulatoryProtection: string;
  leverageEmbedded: string;
  complexity: string;
  diversification: string;
  evidenceQuality: string;
  dataConfidence: string;
  relatedCalculators: string[];
}

const RETURN_BASIS: Record<string, { basis: string; note: string }> = {
  'cash-equivalents': { basis: 'Contractual / administered rate', note: 'The rate is stated in advance by the institution or the regulator.' },
  'bank-deposits': { basis: 'Contractual yield', note: 'The interest rate is fixed by contract at the time of deposit (floating for some products).' },
  'government-securities': { basis: 'Contractual coupon plus market price change', note: 'Coupon is contractual; the total return depends on resale prices if sold before maturity.' },
  'high-grade-debt': { basis: 'Contractual coupon plus market price change', note: 'Funds also carry expense drag and interest-rate risk on the NAV.' },
  'credit-debt': { basis: 'Contractual yield plus credit risk', note: 'Higher coupons are compensation for default risk, not extra skill.' },
  'indian-equity': { basis: 'Market-based total return', note: 'No contractual return exists; historical averages are not promises.' },
  'international-equity': { basis: 'Market-based total return plus currency', note: 'Returns measured in rupees also depend on the exchange rate.' },
  'precious-metals': { basis: 'Market price only', note: 'No income is produced; the entire return is price movement.' },
  'real-estate': { basis: 'Rent (contractual) plus appraisal-based price', note: 'Sale prices are appraisals of comparable transactions, not continuous market quotes.' },
  'reits-invits': { basis: 'Distributions (contractual-ish) plus listed price', note: 'Listed and traded daily, unlike direct property, but distributions can include return of capital.' },
  'alternative-credit': { basis: 'Contractual yield plus default risk', note: 'Unsecured or lightly secured lending to borrowers outside the banking system.' },
  'private-markets': { basis: 'Discretionary cash flows plus appraised valuation', note: 'Interim values are opinions until a sale occurs; returns are computed on past cash flows.' },
  'agriculture-natural': { basis: 'Commodity price / contractual scheme (varies)', note: 'Some routes are contractual schemes whose promised returns have failed historically; verify the structure.' },
  commodities: { basis: 'Derivative of spot price movement', note: 'Futures are zero-sum contracts with margin mechanics, not holdings of the commodity.' },
  'insurance-pensions': { basis: 'Contractual guarantee plus participating upside', note: 'Costs are embedded rather than disclosed line by line; compare on IRR of actual cash flows.' },
  'digital-assets': { basis: 'Market price only', note: 'No issuer, no cash flows, no legal claim; the entire return is price movement.' },
};

function pickTone(value: string): string {
  const risky = ['very-high', 'high', 'illiquid', 'years', 'specialist', 'weak', 'unregulated-relative', 'prohibited', 'self-custody', 'sub-investment-grade', 'unrated'];
  const safe = ['very-low', 'low', 'same-day', 'simple', 'strong', 'statutory', 'sovereign', 'high-grade'];
  if (risky.includes(value)) return 'text-[var(--color-loss-700)] dark:text-[var(--color-loss-400)]';
  if (safe.includes(value)) return 'text-[var(--color-gain-700)] dark:text-[var(--color-gain-400)]';
  return 'text-[var(--color-ink-body)]';
}

export default function ComparePanel({ items }: { items: CompareItem[] }) {
  const [selected, setSelected] = useState<string[]>(() => items.slice(0, 2).map((i) => i.id));
  const chosen = useMemo(() => selected.map((id) => items.find((i) => i.id === id)).filter((i): i is CompareItem => i !== undefined), [items, selected]);

  const toggle = (id: string) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= 4) return current;
      return [...current, id];
    });
  };

  const conflict = useMemo(() => {
    const notes: string[] = [];
    if (chosen.length < 2) return notes;
    const bases = new Set(chosen.map((i) => RETURN_BASIS[i.group]?.basis ?? 'Unknown basis'));
    if (bases.size > 1) {
      notes.push(`Return bases differ: ${[...bases].join(' · ')}. Ranking these against each other is comparing a promise, a market price and an appraisal in one column.`);
    }
    const protections = new Set(chosen.map((i) => i.regulatoryProtection));
    if (protections.size > 1) {
      notes.push(`Regulatory protection differs (${[...protections].join(' vs ')}). One avenue may have a statutory compensation route; another may have none.`);
    }
    if (chosen.some((i) => i.volatility === 'very-high') && chosen.some((i) => i.volatility === 'very-low')) {
      notes.push('Volatility differs by three or more categories. The average return comparison says nothing about the path, and the path is what determines whether an investor can hold on.');
    }
    if (new Set(chosen.map((i) => i.currencyExposure)).size > 1) {
      notes.push('Currency exposure differs; rupee returns of foreign assets also depend on the exchange rate.');
    }
    return notes;
  }, [chosen]);

  const fields: { label: string; render: (item: CompareItem) => React.ReactNode }[] = [
    { label: 'Group', render: (i) => i.group.replaceAll('-', ' ') },
    { label: 'Return basis', render: (i) => RETURN_BASIS[i.group]?.basis ?? 'See mechanism' },
    { label: 'Mechanism', render: (i) => i.returnMechanism },
    { label: 'Expected return', render: (i) => i.expectedReturn ?? 'Not stated — no verifiable figure' },
    { label: 'Volatility', render: (i) => <span className={pickTone(i.volatility)}>{i.volatility.replaceAll('-', ' ')}</span> },
    { label: 'Liquidity', render: (i) => <span className={pickTone(i.liquidity)}>{i.liquidity.replaceAll('-', ' ')}</span> },
    { label: 'Lock-in', render: (i) => i.lockIn ?? 'None stated' },
    { label: 'Minimum', render: (i) => i.minimumInvestment ?? 'Not stated' },
    { label: 'Tax treatment', render: (i) => i.taxTreatment },
    { label: 'Fees', render: (i) => i.fees },
    { label: 'Inflation protection', render: (i) => i.inflationProtection },
    { label: 'Counterparty', render: (i) => i.counterpartyRisk.replaceAll('-', ' ') },
    { label: 'Credit risk', render: (i) => i.creditRisk.replaceAll('-', ' ') },
    { label: 'Regulatory protection', render: (i) => <span className={pickTone(i.regulatoryProtection)}>{i.regulatoryProtection.replaceAll('-', ' ')}</span> },
    { label: 'Complexity', render: (i) => i.complexity },
    { label: 'Diversification', render: (i) => i.diversification.replaceAll('-', ' ') },
    { label: 'Evidence quality', render: (i) => <span className={pickTone(i.evidenceQuality)}>{i.evidenceQuality}</span> },
    {
      label: 'Calculators',
      render: (i) => (
        <span className="flex flex-wrap gap-1.5">
          {i.relatedCalculators.slice(0, 3).map((calc) => (
            <a key={calc} href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/calculators/${calc}`} className="text-xs text-[var(--color-link)] underline decoration-1 underline-offset-2">
              {calc.replaceAll('-', ' ')}
            </a>
          ))}
        </span>
      ),
    },
  ];

  return (
    <div className="not-prose">
      <div className="card max-h-72 overflow-y-auto scrollbar-thin p-4">
        <p className="eyebrow">Choose two to four avenues</p>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {items.map((item) => {
            const active = selected.includes(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-pressed={active}
                  className={`w-full cursor-pointer rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? 'border-[var(--color-brass-500)] bg-[var(--color-brass-50)] text-[var(--color-ink-body)] dark:bg-[color-mix(in_srgb,var(--color-brass-950)_40%,transparent)]'
                      : 'border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {chosen.length < 2 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-muted)]">Select at least two avenues to see the comparison.</p>
      ) : (
        <>
          {conflict.length > 0 && (
            <section className="callout callout-caution mt-6" aria-label="Comparison warnings">
              <p className="callout-title">Before you compare</p>
              <ul className="m-0 space-y-2 text-sm">
                {conflict.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-2)]">
                  <th scope="col" className="border-b border-[var(--color-border)] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)]">
                    Attribute
                  </th>
                  {chosen.map((item) => (
                    <th key={item.id} scope="col" className="border-b border-[var(--color-border)] px-3 py-2.5 text-sm font-semibold text-[var(--color-ink-body)]">
                      {item.name}
                      <span className="mt-0.5 block text-xs font-normal text-[var(--color-ink-faint)]">{item.oneLiner}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.label} className="align-top odd:bg-[var(--color-surface)] even:bg-[var(--color-surface-2)]">
                    <th scope="row" className="w-40 border-b border-[var(--color-border)] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-ink-faint)]">
                      {field.label}
                    </th>
                    {chosen.map((item) => (
                      <td key={item.id} className="border-b border-[var(--color-border)] px-3 py-2.5 text-xs leading-5 text-[var(--color-ink-muted)]">
                        {field.render(item)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--color-ink-faint)]">
            This table shows facts side by side. It produces no score and no ranking, because there is no honest way
            to collapse credit risk, liquidity, tax and return basis into one number.
          </p>
        </>
      )}
    </div>
  );
}
