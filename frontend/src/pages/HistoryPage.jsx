import { useState, useEffect } from 'react';
import { getHistory } from '../lib/api';
import styles from './HistoryPage.module.css';

const DATA_FIELDS = ['Name', 'Winery', 'Vintage', 'Grape Variety', 'Vineyard Location', 'Country'];

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return iso || '—';
  }
}

function Summary({ item }) {
  const present = DATA_FIELDS.filter((k) => item.data?.[k]?.trim()).map((k) => item.data[k].trim());
  const count = DATA_FIELDS.filter((k) => item.fields[k]).length;
  return (
    <span className={styles.summary}>
      {present.length ? present.join(' · ') : '—'}
      <span className={styles.badge}>{count}/{DATA_FIELDS.length}</span>
    </span>
  );
}

function DetailRow({ label, hasValue, value }) {
  return (
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={hasValue ? styles.detailOk : styles.detailMissing}>{hasValue ? '✓' : '—'}</span>
      <span className={styles.detailValue}>{hasValue && value != null ? value : '—'}</span>
    </div>
  );
}

export function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    getHistory()
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      <h1 className={styles.title}>History</h1>
      <p className={styles.subtitle}>Analysed wine bottles and extracted details.</p>

      {items.length === 0 ? (
        <p className={styles.empty}>No analyses yet. Analyse a label on the Analyse page.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
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
                  <div className={styles.thumbs}>
                    {item.frontImageUrl ? (
                      <img src={item.frontImageUrl} alt="Front" />
                    ) : (
                      <span className={styles.noImg}>F</span>
                    )}
                    {item.backImageUrl ? (
                      <img src={item.backImageUrl} alt="Back" />
                    ) : (
                      <span className={styles.noImg}>B</span>
                    )}
                  </div>
                  <div className={styles.main}>
                    <div className={styles.name}>
                      {item.data?.Name?.trim() || 'Unnamed'}
                    </div>
                    <div className={styles.meta}>
                      <Summary item={item} />
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <span className={styles.date}>{formatDate(item.created_at)}</span>
                    <span className={styles.chevron} aria-hidden>▼</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className={styles.details}>
                    <div className={styles.detailsTitle}>Extracted details</div>
                    <DetailRow
                      label="Front Image"
                      hasValue={!!item.frontImageUrl}
                      value={item.frontImageUrl ? 'Yes' : null}
                    />
                    <DetailRow
                      label="Back Image"
                      hasValue={!!item.backImageUrl}
                      value={item.backImageUrl ? 'Yes' : null}
                    />
                    {DATA_FIELDS.map((key) => (
                      <DetailRow
                        key={key}
                        label={key}
                        hasValue={!!item.fields[key]}
                        value={item.data?.[key]?.trim()}
                      />
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
