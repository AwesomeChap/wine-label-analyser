import { useState, useEffect } from 'react';
import { getHistory, deleteWine, deleteAllWines, reanalyseWine } from '../lib/api';

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

function Line({ label, value, preWrap }) {
  const v = value?.trim();
  const usePreWrap = preWrap ?? (label === 'Extracted text' || label === 'Extraction prompt');
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-start text-sm sm:grid-cols-1 sm:gap-0.5">
      <span className="text-muted/90 shrink-0 text-xs font-medium uppercase tracking-wider">{label}</span>
      <span
        className={`text-[#f5f0eb] break-words ${usePreWrap ? 'whitespace-pre-wrap text-[0.85rem] leading-relaxed' : ''}`}
      >
        {v || '—'}
      </span>
    </div>
  );
}

function SkeletonLine({ label }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-center text-sm sm:grid-cols-1 sm:gap-1">
      <span className="text-muted/90 shrink-0 text-xs font-medium uppercase tracking-wider">{label}</span>
      <span className="h-4 w-full max-w-[200px] rounded bg-white/10 animate-pulse" aria-hidden />
    </div>
  );
}

export function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingImagesId, setViewingImagesId] = useState(null);
  const [imagesModalClosing, setImagesModalClosing] = useState(false);
  const [imagesModalMounted, setImagesModalMounted] = useState(false);
  const IMAGES_MODAL_DURATION_MS = 200;
  const [editedPrompt, setEditedPrompt] = useState('');
  const [reAnalyzingId, setReAnalyzingId] = useState(null);
  const [editingPromptId, setEditingPromptId] = useState(null);

  useEffect(() => {
    const item = items.find((i) => i.id === expandedId);
    setEditedPrompt(item?.extractionPrompt ?? '');
  }, [expandedId, items]);

  useEffect(() => {
    if (expandedId !== editingPromptId) setEditingPromptId(null);
  }, [expandedId]);

  const loadHistory = () => {
    getHistory()
      .then((res) => setItems(res.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (viewingImagesId) {
      const t = requestAnimationFrame(() => setImagesModalMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setImagesModalMounted(false);
  }, [viewingImagesId]);

  const closeImagesModal = () => {
    setImagesModalClosing(true);
    setTimeout(() => {
      setViewingImagesId(null);
      setImagesModalClosing(false);
    }, IMAGES_MODAL_DURATION_MS);
  };

  const handleReAnalyze = async (e, item) => {
    e.stopPropagation();
    const prompt = typeof editedPrompt === 'string' ? editedPrompt.trim() : '';
    setReAnalyzingId(item.id);
    setError(null);
    try {
      await reanalyseWine(item.id, prompt || undefined);
      await loadHistory();
    } catch (err) {
      setError(err.message || 'Re-analysis failed.');
    } finally {
      setReAnalyzingId(null);
    }
  };

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
                    className="w-7 h-7 rounded-lg border-0 bg-transparent text-muted/80 hover:text-error hover:bg-red-500/10 flex items-center justify-center shrink-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={(e) => handleDeleteOne(e, item.id)}
                    disabled={!!deletingId}
                    title="Delete"
                    aria-label="Delete this wine"
                  >
                    {deletingId === item.id ? (
                      <span className="text-sm">…</span>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`text-muted/70 text-[0.6rem] shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    aria-hidden
                  >
                    ▼
                  </span>
                </div>
                {isExpanded && (
                  <div
                    className="px-4 py-4 sm:px-5 border-t border-white/5 flex flex-col gap-4 relative cursor-default"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {(item.frontImageUrl || item.backImageUrl) && (
                      <button
                        type="button"
                        className="absolute top-4 right-4 sm:top-4 sm:right-5 z-10 px-3 py-1.5 rounded-lg text-xs font-medium text-muted bg-white/5 border border-white/10 hover:bg-white/10 hover:text-[#f5f0eb] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingImagesId(item.id);
                        }}
                        aria-label="View label images"
                      >
                        View images
                      </button>
                    )}
                    {reAnalyzingId === item.id ? (
                      <>
                        {ALL_FIELDS.map(({ key, label }) => (
                          <SkeletonLine key={key} label={label} />
                        ))}
                        <Line label="Extraction prompt" value={editedPrompt ?? ''} />
                        <p className="text-muted text-xs mt-1" aria-live="polite">
                          Re-analysing…
                        </p>
                      </>
                    ) : (
                      <>
                        {ALL_FIELDS.map(({ key, label }) => (
                          <Line key={key} label={label} value={item.data?.[key]} />
                        ))}
                        {editingPromptId === item.id ? (
                      <div className="grid grid-cols-[120px_1fr] gap-3 items-start text-sm sm:grid-cols-1 sm:gap-1">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted/90 text-xs font-medium uppercase tracking-wider">
                            Extraction prompt
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded text-muted/80 hover:text-[#f5f0eb] hover:bg-white/5 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPromptId(null);
                              setEditedPrompt(item.extractionPrompt ?? '');
                            }}
                            aria-label="Close edit"
                            title="Close"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex flex-col gap-4 min-w-0">
                          <textarea
                            value={editedPrompt}
                            onChange={(e) => setEditedPrompt(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-bg/80 text-[#f5f0eb] text-[0.85rem] font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 placeholder:text-muted/60"
                            placeholder="Extraction prompt used for this analysis..."
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[120px_1fr] gap-3 items-start text-sm sm:grid-cols-1 sm:gap-1">
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted/90 text-xs font-medium uppercase tracking-wider">
                            Extraction prompt
                          </span>
                          <button
                            type="button"
                            className="p-1 rounded text-muted/80 hover:text-accent hover:bg-white/5 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPromptId(item.id);
                              setEditedPrompt(item.extractionPrompt ?? '');
                            }}
                            aria-label="Edit extraction prompt"
                            title="Edit prompt"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                        <span className="text-[#f5f0eb] break-words whitespace-pre-wrap text-[0.85rem] leading-relaxed">
                          {item.extractionPrompt?.trim() || '—'}
                        </span>
                      </div>
                    )}
                        <button
                          type="button"
                          className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30 hover:border-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent/20 disabled:hover:border-accent/40 mt-1"
                          disabled={reAnalyzingId === item.id}
                          onClick={(e) => handleReAnalyze(e, item)}
                        >
                          {reAnalyzingId === item.id ? 'Re-analysing…' : 'Re-analyse'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {viewingImagesId && (() => {
        const item = items.find((i) => i.id === viewingImagesId);
        const hasImages = item?.frontImageUrl || item?.backImageUrl;
        const overlayVisible = imagesModalMounted && !imagesModalClosing;
        return (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 transition-all duration-200 ease-out ${
              overlayVisible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 backdrop-blur-none'
            } ${imagesModalClosing ? 'pointer-events-none' : ''}`}
            onClick={closeImagesModal}
            role="dialog"
            aria-modal="true"
            aria-label="Label images"
          >
            <div
              className={`flex flex-col sm:flex-row gap-4 max-w-4xl w-full max-h-[90vh] overflow-auto transition-all duration-200 ease-out ${
                overlayVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {hasImages ? (
                <>
                  {item.frontImageUrl && (
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted/90">Front label</span>
                      <img
                        src={item.frontImageUrl}
                        alt="Front label"
                        className="w-full h-auto object-contain rounded-xl border border-white/10 max-h-[70vh]"
                      />
                    </div>
                  )}
                  {item.backImageUrl && (
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted/90">Back label</span>
                      <img
                        src={item.backImageUrl}
                        alt="Back label"
                        className="w-full h-auto object-contain rounded-xl border border-white/10 max-h-[70vh]"
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted text-sm">No images available.</p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
