import { Router } from 'express';
import { supabase, bucketName } from '../lib/supabase.js';

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
