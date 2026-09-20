const express = require('express');
const env = require('../config/env');
const authMw = require('../middleware/auth');
const { asyncHandler } = require('../middleware/handlers');

const router = express.Router();

router.post('/assist', authMw.requireAnyRole, asyncHandler(async (req, res) => {
  if (!env.AI_API_KEY && !env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI assistance is not configured on this server yet.' });
  }

  const title = String(req.body.title || '').trim().slice(0, 160);
  const description = String(req.body.description || '').trim().slice(0, 4000);
  const category = String(req.body.category || '').trim().slice(0, 80);
  if (description.length < 10) {
    return res.status(400).json({ error: 'Please enter at least a short problem description first.' });
  }

  const validCategories = [
    'water', 'roads_transport', 'electricity', 'health', 'education', 'sanitation',
    'agriculture', 'environment', 'infrastructure', 'accessibility', 'public_services',
    'women_child', 'tribal_welfare', 'digital', 'housing', 'others'
  ];

  function localNlpProcess() {
    const { autoTagSector } = require('../utils/categories');
    const detected = autoTagSector(title, description);
    const words = `${title} ${description}`.toLowerCase().match(/\b[a-zA-Z\u0900-\u097F]{4,}\b/g) || [];
    const uniqueTags = [...new Set(words.filter(w => !['this', 'that', 'from', 'with', 'have', 'there', 'their', 'problem', 'village'].includes(w)))].slice(0, 5);
    return {
      title: title ? (title.charAt(0).toUpperCase() + title.slice(1)) : 'Civic Issue Report',
      description: description,
      category: validCategories.includes(detected) ? detected : (category || 'others'),
      tags: uniqueTags,
      extracted_location: '',
    };
  }

  // If no external keys configured, use the built-in local NLP engine immediately
  if (!env.AI_API_KEY && !env.GEMINI_API_KEY) {
    return res.json(localNlpProcess());
  }

  const instruction = `You are the Platform AI Engine for JanSetu (Smart India Hackathon).
Analyze and process the civic issue reported by the citizen.
Return ONLY valid JSON with keys:
- "improved_title": clear, factual headline (max 120 chars)
- "improved_description": structured, detailed explanation keeping original facts
- "category": best matching category from this exact list: [${validCategories.join(', ')}]
- "tags": array of 3 to 6 short relevant keyword strings
- "extracted_location": any village, block, or district mentioned in the text (or empty string if none)
Write in the same language as the input (Hindi / English / Santhali).`;

  const prompt = JSON.stringify({ title, category, description });
  const useGemini = Boolean(env.GEMINI_API_KEY) && !env.AI_API_KEY;
  let response;
  try {
    response = useGemini
      ? await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: instruction + '\nInput: ' + prompt }] }] }),
      })
      : await fetch(env.AI_BASE_URL + '/chat/completions', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.AI_API_KEY },
        body: JSON.stringify({ model: env.AI_MODEL, temperature: 0.2, max_tokens: 600, messages: [{ role: 'system', content: instruction }, { role: 'user', content: prompt }] }),
      });
  } catch (netErr) {
    console.warn('[AI WARN] External AI network error, using local NLP engine:', netErr.message);
    return res.json(localNlpProcess());
  }

  if (!response.ok) {
    const detail = await response.text();
    console.warn('[AI WARN] External AI call returned ' + response.status + ', using local NLP engine fallback.');
    return res.json(localNlpProcess());
  }

  const payload = await response.json();
  const content = useGemini
    ? payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts && payload.candidates[0].content.parts[0] && payload.candidates[0].content.parts[0].text
    : payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if (!content) return res.json(localNlpProcess());

  let result;
  try {
    result = JSON.parse(String(content).replace(/^```json\s*|\s*```$/g, '').trim());
  } catch (e) {
    return res.json(localNlpProcess());
  }

  const predictedCategory = validCategories.includes(result.category) ? result.category : (category || 'others');

  res.json({
    title: String(result.improved_title || title).slice(0, 160),
    description: String(result.improved_description || description).slice(0, 4000),
    category: predictedCategory,
    tags: Array.isArray(result.tags) ? result.tags.map((tag) => String(tag).slice(0, 40)).slice(0, 8) : [],
    extracted_location: String(result.extracted_location || '').slice(0, 100),
  });
}));

module.exports = router;