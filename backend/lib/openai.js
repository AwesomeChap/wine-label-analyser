import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EXTRACTION_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'wine_label_data',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        Name: { type: 'string', description: 'Wine name from the label' },
        Winery: { type: 'string', description: 'Winery or producer name' },
        Vintage: { type: 'string', description: 'Vintage year' },
        'Grape Variety': { type: 'string', description: 'Grape variety or varieties' },
        'Vineyard Location': { type: 'string', description: 'Vineyard or region location' },
        Country: { type: 'string', description: 'Country of origin' },
        DecodedText: { type: 'string', description: 'Overall text read from both labels combined, as it appears' },
      },
      required: ['Name', 'Winery', 'Vintage', 'Grape Variety', 'Vineyard Location', 'Country', 'DecodedText'],
      additionalProperties: false,
    },
  },
};

/**
 * @param {string} frontBase64 - base64 image (with or without data URL prefix)
 * @param {string} backBase64 - base64 image
 * @returns {Promise<{Name:string,Winery:string,Vintage:string,'Grape Variety':string,'Vineyard Location':string,Country:string}>}
 */
export async function extractWineLabelData(frontBase64, backBase64) {
  const clean = (b) => (b.replace(/^data:image\/\w+;base64,/, ''));

  const content = [
    {
      type: 'text',
      text: `You are a wine label expert. Analyze the TWO images provided: the first is the FRONT label of a wine bottle, the second is the BACK label. Extract the structured fields (Name, Winery, Vintage, Grape Variety, Vineyard Location, Country). Also provide DecodedText: the main text content read from both labels combined, in reading order (front then back), as it appears on the labels. Use empty string "" if not found. Return valid JSON with keys: Name, Winery, Vintage, Grape Variety, Vineyard Location, Country, DecodedText.`,
    },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${clean(frontBase64)}` },
    },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${clean(backBase64)}` },
    },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content }],
    response_format: EXTRACTION_SCHEMA,
    max_tokens: 1000,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('No extraction result from OpenAI');
  return JSON.parse(raw);
}
