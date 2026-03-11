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
    <div className="grid grid-cols-[120px_1fr] gap-2 items-start text-sm sm:grid-cols-[1fr] sm:gap-0.5">
      <span className="text-muted shrink-0">{label}</span>
      <span
        className={`text-[#f5f0eb] break-words ${isDecoded ? 'whitespace-pre-wrap text-[0.85rem] leading-snug' : ''}`}
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
      <div className="w-full">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-2">History</h1>
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-2">History</h1>
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold mb-1">History</h1>
          <p className="text-muted text-sm sm:text-base mb-0">Analysed wine bottles. Click a card to expand.</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg border border-border bg-transparent text-muted cursor-pointer hover:text-error hover:border-red-500/40 disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
            onClick={handleDeleteAll}
            disabled={!!deletingId}
          >
            {deletingId === 'all' ? 'Deleting…' : 'Delete all'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-muted text-sm">No analyses yet. Analyse a label on the Analyse page.</p>
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
                className={`bg-surface border rounded-xl px-4 py-3 sm:px-5 cursor-pointer transition-colors min-h-[44px] hover:border-accent-dim ${isExpanded ? 'border-accent-dim' : 'border-border'}`}
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
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="font-semibold text-[#f5f0eb] max-w-[140px] sm:max-w-[100px] truncate shrink-0">
                    {item.data?.Name?.trim() || 'Unnamed'}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-muted">{overview || '—'}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-border text-muted shrink-0">{count}/6</span>
                  <span className="text-muted text-xs shrink-0">{formatDate(item.created_at)}</span>
                  <button
                    type="button"
                    className="w-6 h-6 p-0 rounded border-0 bg-transparent text-muted text-lg leading-none cursor-pointer shrink-0 flex items-center justify-center hover:text-error hover:bg-red-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={(e) => handleDeleteOne(e, item.id)}
                    disabled={!!deletingId}
                    title="Delete"
                    aria-label="Delete this wine"
                  >
                    {deletingId === item.id ? '…' : '×'}
                  </button>
                  <span
                    className={`text-muted text-[0.6rem] shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
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
