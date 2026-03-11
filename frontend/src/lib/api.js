const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function getDefaultPrompt() {
  const res = await fetch(`${API_BASE}/api/analyze/prompt`);
  if (!res.ok) throw new Error('Failed to load default prompt');
  const data = await res.json();
  return data.prompt ?? '';
}

export async function analyzeLabels(frontBase64, backBase64, prompt) {
  const body = { frontImage: frontBase64, backImage: backBase64 };
  if (typeof prompt === 'string' && prompt.trim()) body.prompt = prompt.trim();
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Analysis failed');
  }
  return res.json();
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Failed to load history');
  }
  return res.json();
}

export async function deleteWine(id) {
  const res = await fetch(`${API_BASE}/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Delete failed');
  }
}

export async function deleteAllWines() {
  const res = await fetch(`${API_BASE}/api/history`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || 'Delete all failed');
  }
}
