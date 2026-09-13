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

  const instruction = 'You help Jharkhand citizens improve civic problem reports. Return only valid JSON with keys: improved_title, improved_description, tags. Keep the facts supplied by the user, do not invent numbers or causes, and write in the same language as the input.';
  const prompt = JSON.stringify({ title, category, description });
  const useGemini = Boolean(env.GEMINI_API_KEY) && !env.AI_API_KEY;
  const response = useGemini
    ? await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: instruction + '\nInput: ' + prompt }] }] }),
    })
    : await fetch(env.AI_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.AI_API_KEY },
      body: JSON.stringify({ model: env.AI_MODEL, temperature: 0.2, max_tokens: 500, messages: [{ role: 'system', content: instruction }, { role: 'user', content: prompt }] }),
    });

  if (!response.ok) {
    const detail = await response.text();
    console.error('[AI ERROR]', response.status, detail.slice(0, 500));
    return res.status(502).json({ error: 'The AI provider could not process the request. Please try again.' });
  }

  const payload = await response.json();
  const content = useGemini
    ? payload.candidates && payload.candidates[0] && payload.candidates[0].content && payload.candidates[0].content.parts && payload.candidates[0].content.parts[0] && payload.candidates[0].content.parts[0].text
    : payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
  if (!content) return res.status(502).json({ error: 'The AI provider returned an empty response.' });

  let result;
  try {
    result = JSON.parse(String(content).replace(/^```json\s*|\s*```$/g, '').trim());
  } catch (e) {
    return res.status(502).json({ error: 'The AI provider returned an invalid response.' });
  }
  res.json({
    title: String(result.improved_title || title).slice(0, 160),
    description: String(result.improved_description || description).slice(0, 4000),
    tags: Array.isArray(result.tags) ? result.tags.map((tag) => String(tag).slice(0, 40)).slice(0, 8) : [],
  });
}));

module.exports = router;