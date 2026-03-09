import { Router } from 'express';
import { extractWineLabelData } from '../lib/openai.js';
import { supabase, bucketName } from '../lib/supabase.js';
import { compressImage } from '../lib/compress.js';

export const analyzeRouter = Router();

/**
 * POST /api/analyze
 * Body: { frontImage: base64, backImage: base64 }
 * Both required. Compresses images, uploads to Supabase, runs OpenAI, saves record.
 */
analyzeRouter.post('/', async (req, res) => {
  try {
    const { frontImage, backImage } = req.body || {};
    if (!frontImage || !backImage) {
      return res.status(400).json({
        error: 'Both frontImage and backImage (base64) are required.',
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured.' });
    }
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured.' });
    }

    // Decode base64 to buffer for compression
    const toBuffer = (b64) => {
      const base64 = b64.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(base64, 'base64');
    };

    const [frontBuf, backBuf] = [toBuffer(frontImage), toBuffer(backImage)];
    const [frontCompressed, backCompressed] = await Promise.all([
      compressImage(frontBuf),
      compressImage(backBuf),
    ]);

    const id = crypto.randomUUID();
    const frontPath = `${id}/front.jpg`;
    const backPath = `${id}/back.jpg`;

    const [frontUp, backUp] = await Promise.all([
      supabase.storage.from(bucketName).upload(frontPath, frontCompressed, {
        contentType: 'image/jpeg',
        upsert: false,
      }),
      supabase.storage.from(bucketName).upload(backPath, backCompressed, {
        contentType: 'image/jpeg',
        upsert: false,
      }),
    ]);

    if (frontUp.error) throw new Error(`Front upload: ${frontUp.error.message}`);
    if (backUp.error) throw new Error(`Back upload: ${backUp.error.message}`);

    const { data: frontUrl } = supabase.storage.from(bucketName).getPublicUrl(frontPath);
    const { data: backUrl } = supabase.storage.from(bucketName).getPublicUrl(backPath);

    const extracted = await extractWineLabelData(frontImage, backImage);

    const row = {
      id,
      name: extracted.Name ?? '',
      winery: extracted.Winery ?? '',
      vintage: extracted.Vintage ?? '',
      grape_variety: extracted['Grape Variety'] ?? '',
      vineyard_location: extracted['Vineyard Location'] ?? '',
      country: extracted.Country ?? '',
      front_image_url: frontUrl.publicUrl,
      back_image_url: backUrl.publicUrl,
    };

    const { error: insertError } = await supabase.from('wine_analyses').insert(row);
    if (insertError) throw insertError;

    res.json({
      id: row.id,
      data: {
        Name: row.name,
        Winery: row.winery,
        Vintage: row.vintage,
        'Grape Variety': row.grape_variety,
        'Vineyard Location': row.vineyard_location,
        Country: row.country,
      },
      frontImageUrl: row.front_image_url,
      backImageUrl: row.back_image_url,
    });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({
      error: err.message || 'Analysis failed.',
    });
  }
});
