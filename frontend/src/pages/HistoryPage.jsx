import { useState, useEffect } from 'react';
import { getHistory, deleteWine, deleteAllWines } from '../lib/api';

const KEY_FIELDS = [
  { key: 'Name', label: 'Name' },
  { key: 'Winery', label: 'Winery' },
  { key: 'Vintage', label: 'Vintage' },
  { key: 'Grape Variety', label: 'Grape variety' },
  { key: 'Vineyard Location', label: 'Vineyard location' },
  { key: 'Country', label: 'Country' },
];

const ALL_FIELDS = [...KEY_FIELDS, { key: 'DecodedText', label: 'Decoded text' }];

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso || '—';
  }
}

function getExtractedCount(data) {
  return KEY_FIELDS.filter((f) => data?.[f.key]?.trim()).length;
}

function Line({ label, value }) {
  const v = value?.trim();
  const isDecoded = label === 'Decoded text';
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-start text-sm sm:grid-cols-1 sm:gap-0.5">
      <span className="text-muted/90 shrink-0 text-xs font-medium uppercase tracking-wider">{label}</span>
      <span
        className={`text-[#f5f0eb] break-words ${isDecoded ? 'whitespace-pre-wrap text-[0.85rem] leading-relaxed' : ''}`}
      >
        {v || '—'}
      </span>
    </div>
  );
}

export function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadHistory = () => {
    getHistory()
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteOne = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this wine from history?')) return;
    setDeletingId(id);
    try {
      await deleteWine(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete all wines from history? This cannot be undone.')) return;
    setDeletingId('all');
    try {
      await deleteAllWines();
      setItems([]);
      setExpandedId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <header className="mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#f5f0eb] mb-2">
            History
          </h1>
          <p className="text-muted text-base">Loading…</p>
        </header>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <header className="mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#f5f0eb] mb-2">
            History
          </h1>
        </header>
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-error text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#f5f0eb] mb-2">
              History
            </h1>
            <p className="text-muted text-base leading-relaxed">
              Past analyses. Click a row to expand and see extracted details.
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-error hover:border-red-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              onClick={handleDeleteAll}
              disabled={!!deletingId}
            >
              {deletingId === 'all' ? 'Deleting…' : 'Delete all'}
            </button>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-surface/40 border border-white/5 p-8 text-center">
          <p className="text-muted text-base m-0">No analyses yet.</p>
          <p className="text-muted text-sm mt-1 m-0">Analyse wine labels on the Analyse page to see them here.</p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 flex flex-col gap-3">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const count = getExtractedCount(item.data);
            const overview = KEY_FIELDS.filter((f) => item.data?.[f.key]?.trim())
              .map((f) => item.data[f.key].trim())
              .join(' · ');
            return (
              <li
                key={item.id}
                className={`rounded-2xl bg-surface/60 border overflow-hidden cursor-pointer transition-all duration-200 min-h-0 ${
                  isExpanded
                    ? 'border-accent/30 ring-1 ring-accent/20'
                    : 'border-white/5 hover:border-white/10 hover:bg-surface/80'
                }`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : item.id);
                  }
                }}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 px-4 py-2 sm:px-5 text-sm min-w-0">
                  <span className="font-semibold text-[#f5f0eb] max-w-[140px] sm:max-w-[100px] truncate shrink-0">
                    {item.data?.Name?.trim() || 'Unnamed'}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-muted/90 text-[0.9rem]">{overview || '—'}</span>
                  <span className="text-[0.7rem] px-2 py-0.5 rounded-md bg-white/10 text-muted shrink-0 font-medium">
                    {count}/6
                  </span>
                  <span className="text-muted/80 text-xs shrink-0">{formatDate(item.created_at)}</span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border-0 bg-transparent text-muted/80 hover:text-error hover:bg-red-500/10 flex items-center justify-center shrink-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-lg leading-none"
                    onClick={(e) => handleDeleteOne(e, item.id)}
                    disabled={!!deletingId}
                    title="Delete"
                    aria-label="Delete this wine"
                  >
                    {deletingId === item.id ? '…' : '×'}
                  </button>
                  <span
                    className={`text-muted/70 text-[0.6rem] shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
                {isExpanded && (
                  <div className="px-4 py-4 sm:px-5 border-t border-white/5 flex flex-col gap-4">
                    {ALL_FIELDS.map(({ key, label }) => (
                      <Line key={key} label={label} value={item.data?.[key]} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
