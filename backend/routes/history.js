import { Router } from 'express';
import { supabase, bucketName } from '../lib/supabase.js';
import { extractWineLabelData, DEFAULT_EXTRACTION_PROMPT } from '../lib/openai.js';

export const historyRouter = Router();

/**
 * GET /api/history
 * Returns all wine analyses with extracted fields and image URLs.
 */
historyRouter.get('/', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured.' });
    }

    const { data, error } = await supabase
      .from('wine_analyses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const items = (data || []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      frontImageUrl: row.front_image_url,
      backImageUrl: row.back_image_url,
      extractionPrompt: row.extraction_prompt ?? null,
      data: {
        Name: row.name ?? '',
        Winery: row.winery ?? '',
        Vintage: row.vintage ?? '',
        'Grape Variety': row.grape_variety ?? '',
        'Vineyard Location': row.vineyard_location ?? '',
        Country: row.country ?? '',
        DecodedText: row.decoded_text ?? '',
      },
    }));

    res.json({ items });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({
      error: err.message || 'Failed to load history.',
    });
  }
});

/**
 * Run re-analysis for an existing record. Shared by Express route and Vercel serverless.
 * @param {string} id - wine_analyses id
 * @param {{ prompt?: string }} body - optional prompt
 * @returns {Promise<object>} updated item shape
 */
export async function runReanalyse(id, body = {}) {
  const customPrompt = body.prompt;
  if (!id) throw new Error('Missing id.');
  if (!supabase) throw new Error('Supabase not configured.');
  if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured.');

  const { data: row, error: fetchError } = await supabase.from('wine_analyses').select('*').eq('id', id).single();
  if (fetchError || !row) throw new Error('Analysis not found.');

  if (!bucketName) throw new Error('Storage not configured.');

  const [frontRes, backRes] = await Promise.all([
    supabase.storage.from(bucketName).download(`${id}/front.jpg`),
    supabase.storage.from(bucketName).download(`${id}/back.jpg`),
  ]);
  if (frontRes.error || !frontRes.data) throw new Error('Front image not found in storage.');
  if (backRes.error || !backRes.data) throw new Error('Back image not found in storage.');

  const toBase64 = async (blob) => Buffer.from(await blob.arrayBuffer()).toString('base64');
  const [frontBase64, backBase64] = await Promise.all([toBase64(frontRes.data), toBase64(backRes.data)]);

  const promptUsed =
    typeof customPrompt === 'string' && customPrompt.trim()
      ? customPrompt.trim()
      : (row.extraction_prompt || DEFAULT_EXTRACTION_PROMPT);

  const extracted = await extractWineLabelData(frontBase64, backBase64, promptUsed);

  const updates = {
    name: extracted.Name ?? '',
    winery: extracted.Winery ?? '',
    vintage: extracted.Vintage ?? '',
    grape_variety: extracted['Grape Variety'] ?? '',
    vineyard_location: extracted['Vineyard Location'] ?? '',
    country: extracted.Country ?? '',
    decoded_text: extracted.DecodedText ?? '',
    extraction_prompt: promptUsed,
  };

  const { error: updateError } = await supabase.from('wine_analyses').update(updates).eq('id', id);
  if (updateError) throw updateError;

  return {
    id: row.id,
    created_at: row.created_at,
    frontImageUrl: row.front_image_url,
    backImageUrl: row.back_image_url,
    extractionPrompt: updates.extraction_prompt,
    data: {
      Name: updates.name,
      Winery: updates.winery,
      Vintage: updates.vintage,
      'Grape Variety': updates.grape_variety,
      'Vineyard Location': updates.vineyard_location,
      Country: updates.country,
      DecodedText: updates.decoded_text ?? '',
    },
  };
}

/**
 * POST /api/history/:id/reanalyse
 * Re-runs extraction on the existing item's stored images and updates the row (no new item).
 * Body: { prompt?: string } — optional; if omitted, uses the existing extraction_prompt.
 */
historyRouter.post('/:id/reanalyse', async (req, res) => {
  try {
    const out = await runReanalyse(req.params.id, req.body || {});
    res.json(out);
  } catch (err) {
    console.error('Reanalyse error:', err);
    const status = err.message === 'Missing id.' ? 400 : err.message === 'Analysis not found.' ? 404 : err.message.includes('not found') ? 400 : 500;
    res.status(status).json({ error: err.message || 'Re-analysis failed.' });
  }
});

/**
 * DELETE /api/history/:id
 * Deletes one wine analysis and its storage images.
 */
historyRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing id.' });
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured.' });

    const { error: deleteError } = await supabase.from('wine_analyses').delete().eq('id', id);
    if (deleteError) throw deleteError;

    if (bucketName) {
      await supabase.storage.from(bucketName).remove([`${id}/front.jpg`, `${id}/back.jpg`]);
    }
    res.status(204).send();
  } catch (err) {
    console.error('History delete error:', err);
    res.status(500).json({ error: err.message || 'Delete failed.' });
  }
});

/**
 * DELETE /api/history
 * Deletes all wine analyses. Optional: remove all objects from bucket (list by prefix is per-id).
 */
historyRouter.delete('/', async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured.' });

    const { data: rows } = await supabase.from('wine_analyses').select('id');
    if (rows?.length && bucketName) {
      const paths = rows.flatMap((r) => [`${r.id}/front.jpg`, `${r.id}/back.jpg`]);
      await supabase.storage.from(bucketName).remove(paths);
    }
    const { error } = await supabase.from('wine_analyses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    res.status(204).send();
  } catch (err) {
    console.error('History delete all error:', err);
    res.status(500).json({ error: err.message || 'Delete all failed.' });
  }
});
