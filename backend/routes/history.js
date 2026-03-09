import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

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
      fields: {
        'Front Image': !!row.front_image_url,
        'Back Image': !!row.back_image_url,
        Name: !!row.name?.trim(),
        Winery: !!row.winery?.trim(),
        Vintage: !!row.vintage?.trim(),
        'Grape Variety': !!row.grape_variety?.trim(),
        'Vineyard Location': !!row.vineyard_location?.trim(),
        Country: !!row.country?.trim(),
      },
      data: {
        Name: row.name ?? '',
        Winery: row.winery ?? '',
        Vintage: row.vintage ?? '',
        'Grape Variety': row.grape_variety ?? '',
        'Vineyard Location': row.vineyard_location ?? '',
        Country: row.country ?? '',
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
