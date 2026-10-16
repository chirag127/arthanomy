/**
 * Calculator island.
 *
 * The arithmetic runs in the browser through the same compute registry that
 * the Vitest suite exercises, so the page and the tests can never diverge.
 * Values are reflected into the query string, which makes every result a
 * shareable link and keeps the page fully static.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { compute, type InputRecord } from '../lib/calculators';
import { formatINR, formatNumber } from '../lib/format';

interface InputDef {
  id: string;
  label: string;
  kind: 'currency' | 'percent' | 'number' | 'years' | 'date' | 'select' | 'toggle';
  unit?: string;
  min?: number;
  max?: number;
  default: number | string | boolean;
  help?: string;
  options?: { value: string; label: string }[];
}

export interface CalculatorDefinition {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  formulas: { latex: string; label: string; assumption?: string }[];
  inputs: InputDef[];
  limitations: string[];
}

interface OutputLine {
  label: string;
  value: number | string | null;
  kind?: string;
  note?: string;
  tone?: string;
}

const toneClass: Record<string, string> = {
  positive: 'text-[var(--color-gain-700)] dark:text-[var(--color-gain-400)]',
  negative: 'text-[var(--color-loss-700)] dark:text-[var(--color-loss-400)]',
  caution: 'text-[var(--color-caution-800)] dark:text-[var(--color-caution-300)]',
  neutral: 'text-[var(--color-ink-950)] dark:text-[var(--color-ink-50)]',
};

function formatOutput(output: OutputLine): string {
  if (output.value === null) return 'Not meaningful with these inputs';
  if (typeof output.value === 'string') return output.value;
  const value = output.value;
  switch (output.kind) {
    case 'currency':
      return Math.abs(value) >= 100_000 ? formatINR(value) : formatINR(value, { paise: true });
    case 'percent':
      return `${formatNumber(value)}%`;
    case 'years':
      return `${formatNumber(value, 1)} ${Math.abs(value) === 1 ? 'year' : 'years'}`;
    case 'multiple':
      return `${formatNumber(value)}×`;
    default:
      return formatNumber(value);
  }
}

export default function Calculator({ definition }: { definition: CalculatorDefinition }) {
  const defaults = useMemo<InputRecord>(() => {
    const record: InputRecord = {};
    for (const input of definition.inputs) record[input.id] = input.default;
    return record;
  }, [definition]);

  const [values, setValues] = useState<InputRecord>(defaults);

  // Restore shared values from the query string on first load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;
    const next: InputRecord = { ...defaults };
    for (const input of definition.inputs) {
      const raw = params.get(input.id);
      if (raw === null) continue;
      if (input.kind === 'toggle') next[input.id] = raw === 'true';
      else if (input.kind === 'select') next[input.id] = raw;
      else next[input.id] = Number(raw);
      changed = true;
    }
    if (changed) setValues(next);
  }, []);

  const result = useMemo(() => compute(definition.id, values), [definition.id, values]);

  const update = useCallback(
    (id: string, value: number | string | boolean) => {
      setValues((current) => {
        const next = { ...current, [id]: value };
        const params = new URLSearchParams();
        for (const input of definition.inputs) {
          const currentValue = next[input.id];
          if (currentValue !== undefined && currentValue !== defaults[input.id]) {
            params.set(input.id, String(currentValue));
          }
        }
        const query = params.toString();
        window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
        return next;
      });
    },
    [definition.inputs, defaults],
  );

  const reset = useCallback(() => {
    setValues(defaults);
    window.history.replaceState(null, '', window.location.pathname);
  }, [defaults]);

  return (
    <div className="not-prose grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form
        className="card h-fit p-5"
        onSubmit={(event) => event.preventDefault()}
        aria-label={`${definition.name} inputs`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="eyebrow m-0">Inputs</h2>
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-border-strong)] hover:text-[var(--color-ink-body)]"
          >
            Reset
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {definition.inputs.map((input) => (
            <div key={input.id}>
              <label htmlFor={`f-${input.id}`} className="block text-sm font-medium text-[var(--color-ink-body)]">
                {input.label}
                {input.unit && <span className="ml-1 text-xs text-[var(--color-ink-faint)]">({input.unit})</span>}
              </label>
              {input.kind === 'select' ? (
                <select
                  id={`f-${input.id}`}
                  value={String(values[input.id] ?? input.default)}
                  onChange={(event) => update(input.id, event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-sm"
                >
                  {(input.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : input.kind === 'toggle' ? (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  <input
                    id={`f-${input.id}`}
                    type="checkbox"
                    checked={Boolean(values[input.id])}
                    onChange={(event) => update(input.id, event.target.checked)}
                    className="h-4 w-4 accent-[var(--color-brass-600)]"
                  />
                  {input.help ?? 'Yes'}
                </label>
              ) : (
                <input
                  id={`f-${input.id}`}
                  type={input.kind === 'date' ? 'date' : 'number'}
                  value={String(values[input.id] ?? '')}
                  min={input.min}
                  max={input.max}
                  step={input.kind === 'currency' || input.kind === 'number' || input.kind === 'years' ? 'any' : '0.01'}
                  onChange={(event) => update(input.id, input.kind === 'date' ? event.target.value : Number(event.target.value))}
                  className="mt-1.5 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 font-mono text-sm"
                />
              )}
              {input.kind !== 'toggle' && input.help && (
                <p className="mt-1 text-xs leading-5 text-[var(--color-ink-faint)]">{input.help}</p>
              )}
            </div>
          ))}
        </div>
      </form>

      <div className="min-w-0 space-y-5">
        <section className="card p-5" aria-live="polite">
          <h2 className="eyebrow m-0">Results</h2>
          {result ? (
            <dl className="mt-4 divide-y divide-[var(--color-border)]">
              {result.outputs.map((output) => (
                <div key={output.label} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-6">
                  <dt className="text-sm leading-6 text-[var(--color-ink-muted)]">
                    {output.label}
                    {output.note && <span className="mt-0.5 block text-xs leading-5 text-[var(--color-ink-faint)]">{output.note}</span>}
                  </dt>
                  <dd className={`m-0 text-right font-mono text-base font-semibold ${toneClass[output.tone ?? 'neutral'] ?? toneClass.neutral}`}>
                    {formatOutput(output)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-muted)]">This calculator could not be evaluated.</p>
          )}
        </section>

        {result && result.warnings.length > 0 && (
          <section className="callout callout-caution" aria-label="Warnings">
            <p className="callout-title">Read this before using the numbers</p>
            <ul className="m-0 space-y-1.5 text-sm">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        )}

        {result && result.assumptions.length > 0 && (
          <section className="callout callout-note" aria-label="Assumptions">
            <p className="callout-title">Assumptions</p>
            <ul className="m-0 space-y-1.5 text-sm">
              {result.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </section>
        )}

        {result && result.steps && result.steps.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="eyebrow m-0 border-b border-[var(--color-border)] px-5 py-3">Period by period</h2>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              <table className="w-full text-left text-xs">
                <tbody className="divide-y divide-[var(--color-border)]">
                  {result.steps.map((step) => (
                    <tr key={step.label}>
                      <th scope="row" className="px-5 py-2 font-mono font-medium text-[var(--color-ink-muted)]">
                        {step.label}
                      </th>
                      <td className="px-5 py-2 text-[var(--color-ink-body)]">{step.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-xs leading-5 text-[var(--color-ink-faint)]">
          Values in the address bar make this result shareable. The arithmetic runs entirely in your browser; nothing
          is sent anywhere.
        </p>
      </div>
    </div>
  );
}
