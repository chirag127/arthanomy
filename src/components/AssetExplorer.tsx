/**
 * AssetExplorer — sortable, filterable table of the investment universe.
 *
 * Sorting and filtering machinery comes from TanStack Table's legacy API; the
 * cells are rendered from the raw asset records so that no value is ever
 * reinterpreted on its way to the screen.
 */
import { useMemo, useState } from 'react';
import { useLegacyTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, type LegacyColumnDef } from '@tanstack/react-table/legacy';

export interface AssetRow {
  id: string;
  name: string;
  group: string;
  category: string;
  oneLiner: string;
  returnMechanism: string;
  expectedReturn?: string;
  historicalReturnNote?: string;
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
  investorEligibility: string;
  operationalWorkload: string;
  leverageEmbedded: string;
  complexity: string;
  diversification: string;
  evidenceQuality: string;
  dataConfidence: string;
  risks: string[];
  suitability: string;
  commonMistakes: string[];
  relatedCalculators: string[];
  illustrativeMetrics?: { expectedReturnPct?: number; volatilityPct?: number; note: string };
}

const volatilityRank: Record<string, number> = { 'very-low': 0, low: 1, moderate: 2, high: 3, 'very-high': 4, unavailable: -1 };
const liquidityRank: Record<string, number> = { 'same-day': 0, days: 1, weeks: 2, months: 3, years: 4, illiquid: 5 };
const complexityRank: Record<string, number> = { simple: 0, moderate: 1, complex: 2, specialist: 3 };
const evidenceRank: Record<string, number> = { strong: 0, moderate: 1, limited: 2, weak: 3 };
const protectionRank: Record<string, number> = { statutory: 0, regulated: 1, 'light-touch': 2, 'unregulated-relative': 3, prohibited: 4 };

const label = (value: string): string => value.replaceAll('-', ' ');

function Badge({ value }: { value: string }) {
  const risky = ['very-high', 'high', 'illiquid', 'years', 'specialist', 'weak', 'unregulated-relative', 'prohibited', 'self-custody', 'sub-investment-grade', 'unrated', 'business-level'];
  const safe = ['very-low', 'low', 'same-day', 'simple', 'strong', 'statutory', 'sovereign', 'high-grade'];
  const cls = risky.includes(value)
    ? 'badge badge-caution'
    : safe.includes(value)
      ? 'badge badge-gain'
      : 'badge badge-neutral';
  return <span className={cls}>{label(value)}</span>;
}

export default function AssetExplorer({ assets, groups }: { assets: AssetRow[]; groups: { id: string; name: string }[] }) {
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => (group === 'all' || a.group === group) && (q === '' || `${a.name} ${a.oneLiner} ${a.taxTreatment}`.toLowerCase().includes(q)));
  }, [assets, group, query]);

  const columns = useMemo<LegacyColumnDef<AssetRow>[]>(
    () => [
      { id: 'name', header: 'Avenue', accessorFn: (row) => row.name },
      { id: 'volatility', header: 'Volatility', accessorFn: (row) => volatilityRank[row.volatility] ?? -1 },
      { id: 'liquidity', header: 'Liquidity', accessorFn: (row) => liquidityRank[row.liquidity] ?? -1 },
      { id: 'complexity', header: 'Complexity', accessorFn: (row) => complexityRank[row.complexity] ?? -1 },
      { id: 'protection', header: 'Protection', accessorFn: (row) => protectionRank[row.regulatoryProtection] ?? -1 },
      { id: 'evidence', header: 'Evidence', accessorFn: (row) => evidenceRank[row.evidenceQuality] ?? -1 },
    ],
    [],
  );

  const table = useLegacyTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="not-prose">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56">
          <label htmlFor="asset-search" className="eyebrow block">Search</label>
          <input
            id="asset-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. liquid, gilt, small-cap"
            className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          />
        </div>
        <div className="min-w-48">
          <label htmlFor="asset-group" className="eyebrow block">Asset group</label>
          <select
            id="asset-group"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <option value="all">All {assets.length} avenues</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <p className="pb-2 font-mono text-xs text-[var(--color-ink-faint)]" aria-live="polite">
          {rows.length} shown
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-[var(--color-surface-2)]">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className="border-b border-[var(--color-border)] px-3 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)]">
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="flex cursor-pointer items-center gap-1.5 bg-transparent text-left uppercase tracking-[0.05em]"
                    >
                      {String(header.column.columnDef.header)}
                      <span aria-hidden="true" className="text-[var(--color-ink-faint)]">
                        {header.column.getIsSorted() === 'asc' ? '↑' : header.column.getIsSorted() === 'desc' ? '↓' : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="border-b border-[var(--color-border)] px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-ink-muted)]">
                  Detail
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => {
              const asset = row.original;
              const open = expanded === asset.id;
              return (
                <>
                  <tr key={asset.id} className="align-top hover:bg-[var(--color-surface-2)]">
                    <td className="border-b border-[var(--color-border)] px-3 py-3">
                      <span className="block font-medium text-[var(--color-ink-body)]">{asset.name}</span>
                      <span className="mt-0.5 block max-w-sm text-xs leading-5 text-[var(--color-ink-muted)]">{asset.oneLiner}</span>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3"><Badge value={asset.volatility} /></td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3"><Badge value={asset.liquidity} /></td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3"><Badge value={asset.complexity} /></td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3"><Badge value={asset.regulatoryProtection} /></td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3"><Badge value={asset.evidenceQuality} /></td>
                    <td className="border-b border-[var(--color-border)] px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : asset.id)}
                        aria-expanded={open}
                        className="cursor-pointer whitespace-nowrap rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-ink-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-body)]"
                      >
                        {open ? 'Close' : 'Open'}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr key={`${asset.id}-detail`} className="bg-[var(--color-surface-2)]">
                      <td colSpan={7} className="border-b border-[var(--color-border)] px-3 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">How the return is produced</p>
                            <p className="mt-1.5 text-sm leading-6 text-[var(--color-ink-body)] dark:text-[var(--color-ink-200)]">{asset.returnMechanism}</p>
                            {asset.expectedReturn && (
                              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]"><strong className="font-medium">Expected return:</strong> {asset.expectedReturn}</p>
                            )}
                            {asset.historicalReturnNote && (
                              <p className="mt-1.5 text-sm leading-6 text-[var(--color-ink-muted)]"><strong className="font-medium">History:</strong> {asset.historicalReturnNote}</p>
                            )}
                            {asset.illustrativeMetrics && (
                              <p className="mt-1.5 rounded border border-[var(--color-caution-300)] bg-[var(--color-caution-50)] px-2 py-1.5 text-xs leading-5 text-[var(--color-caution-900)] dark:border-[var(--color-caution-900)] dark:bg-transparent dark:text-[var(--color-caution-300)]">
                                Illustrative only: {asset.illustrativeMetrics.note}
                              </p>
                            )}
                            <p className="mt-2 text-xs leading-5 text-[var(--color-ink-muted)]"><strong className="font-medium">Fees:</strong> {asset.fees}</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--color-ink-muted)]"><strong className="font-medium">Tax:</strong> {asset.taxTreatment}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">Risk & access</p>
                            <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--color-ink-muted)]" role="list">
                              <li>Counterparty: {label(asset.counterpartyRisk)} · Credit: {label(asset.creditRisk)}</li>
                              <li>Currency: {asset.currencyExposure} · Inflation: {label(asset.inflationProtection)}</li>
                              <li>Leverage: {label(asset.leverageEmbedded)} · Diversification: {label(asset.diversification)}</li>
                              <li>Workload: {label(asset.operationalWorkload)} · Evidence: {label(asset.evidenceQuality)} · Data confidence: {label(asset.dataConfidence)}</li>
                              {asset.minimumInvestment && <li>Minimum: {asset.minimumInvestment}</li>}
                              {asset.lockIn && <li>Lock-in: {asset.lockIn}</li>}
                            </ul>
                            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">Suitability</p>
                            <p className="mt-1 text-xs leading-5 text-[var(--color-ink-muted)]">{asset.suitability}</p>
                          </div>
                          {asset.risks.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">Principal risks</p>
                              <ul className="mt-1.5 grid gap-1 text-xs leading-5 text-[var(--color-ink-muted)] sm:grid-cols-2" role="list">
                                {asset.risks.map((risk) => (
                                  <li key={risk}>{risk}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {asset.commonMistakes.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">Common mistakes</p>
                              <ul className="mt-1.5 grid gap-1 text-xs leading-5 text-[var(--color-ink-muted)] sm:grid-cols-2" role="list">
                                {asset.commonMistakes.map((mistake) => (
                                  <li key={mistake}>{mistake}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {asset.relatedCalculators.length > 0 && (
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">Run the numbers</p>
                              <p className="mt-1.5 flex flex-wrap gap-2">
                                {asset.relatedCalculators.map((calc) => (
                                  <a key={calc} href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/calculators/${calc}`} className="text-xs text-[var(--color-link)] underline decoration-1 underline-offset-2">
                                    {label(calc)}
                                  </a>
                                ))}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--color-ink-faint)]">
        Quantitative columns are qualitative ordinals — “volatility: high” sorts after “volatility: moderate”.
        No asset is marked a winner: avenues with different risk, liquidity and tax structures are not comparable on a
        single score.
      </p>
    </div>
  );
}
