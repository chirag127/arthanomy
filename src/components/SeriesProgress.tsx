/**
 * SeriesProgress — per-series reading checklist that persists in localStorage.
 *
 * Drop onto a series page with the series id and the ordered list of article ids.
 * Ticking an article stores the id; the count updates reactively. No backend,
 * no account — purely local. A "reset" button clears the series.
 *
 * Progressive enhancement: renders nothing special without JS.
 */
import { useEffect, useMemo, useState } from 'react';

interface ArticleRef {
  id: string;
  title: string;
}

interface Props {
  seriesId: string;
  articles: ArticleRef[];
}

const storageKey = (seriesId: string) => `arthanomy-series-progress::${seriesId}`;

const readChecked = (seriesId: string): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(seriesId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

export default function SeriesProgress({ seriesId, articles }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setChecked(readChecked(seriesId));
    setHydrated(true);
  }, [seriesId]);

  const persist = (next: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(seriesId), JSON.stringify([...next]));
    } catch {
      // ignore quota / privacy-mode failures
    }
  };

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persist(next);
      return next;
    });
  };

  const reset = () => {
    setChecked(new Set());
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey(seriesId));
      } catch {
        // ignore
      }
    }
  };

  const count = checked.size;
  const total = articles.length;
  const ratio = total > 0 ? count / total : 0;
  const ordered = useMemo(
    () => articles.map((a) => ({ ...a, done: checked.has(a.id) })),
    [articles, checked],
  );

  return (
    <div
      className="mt-6 rounded-xl border border-[var(--color-ink-100)] bg-[var(--color-paper-warm)] p-4 dark:border-[var(--color-ink-800)] dark:bg-[var(--color-ink-900)]"
      aria-label="Series reading progress"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Reading progress (local)</p>
          <p className="mt-1 text-sm font-medium">
            {count} of {total} {total === 1 ? 'article' : 'articles'} read ·{' '}
            {Math.round(ratio * 100)}%
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-[var(--color-ink-faint)] underline hover:text-[var(--color-ink-muted)]"
        >
          reset
        </button>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-ink-100)] dark:bg-[var(--color-ink-800)]"
        role="progressbar"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-[var(--color-brass-500)] transition-all"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {ordered.map((a) => (
          <li key={a.id}>
            <label className="flex cursor-pointer items-start gap-2 leading-6">
              <input
                type="checkbox"
                checked={hydrated ? a.done : false}
                onChange={() => toggle(a.id)}
                className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-brass-600)]"
              />
              <span
                className={
                  a.done
                    ? 'text-[var(--color-ink-faint)] line-through'
                    : 'text-[var(--color-ink)]'
                }
              >
                {a.title}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
