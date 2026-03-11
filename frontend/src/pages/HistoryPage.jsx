import { useState, useEffect } from 'react';
import { getHistory, deleteWine, deleteAllWines } from '../lib/api';
import styles from './HistoryPage.module.css';

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
  if (label === 'Decoded text') {
    return (
      <div className={styles.line}>
        <span className={styles.lineLabel}>{label}</span>
        <span className={styles.lineValueDecoded}>{v || '—'}</span>
      </div>
    );
  }
  return (
    <div className={styles.line}>
      <span className={styles.lineLabel}>{label}</span>
      <span className={styles.lineValue}>{v || '—'}</span>
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
      <div className={styles.page}>
        <h1 className={styles.title}>History</h1>
        <p className={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>History</h1>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>History</h1>
          <p className={styles.subtitle}>Analysed wine bottles. Click a card to expand.</p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            className={styles.deleteAllBtn}
            onClick={handleDeleteAll}
            disabled={!!deletingId}
          >
            {deletingId === 'all' ? 'Deleting…' : 'Delete all'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>No analyses yet. Analyse a label on the Analyse page.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const count = getExtractedCount(item.data);
            const overview = KEY_FIELDS.filter((f) => item.data?.[f.key]?.trim())
              .map((f) => item.data[f.key].trim())
              .join(' · ');
            return (
              <li
                key={item.id}
                className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}
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
                <div className={styles.cardRow}>
                  <span className={styles.name}>{item.data?.Name?.trim() || 'Unnamed'}</span>
                  <span className={styles.overviewText}>{overview || '—'}</span>
                  <span className={styles.badge}>{count}/6</span>
                  <span className={styles.date}>{formatDate(item.created_at)}</span>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteOne(e, item.id)}
                    disabled={!!deletingId}
                    title="Delete"
                    aria-label="Delete this wine"
                  >
                    {deletingId === item.id ? '…' : '×'}
                  </button>
                  <span className={styles.chevron} aria-hidden>▼</span>
                </div>
                {isExpanded && (
                  <div className={styles.cardBody}>
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
