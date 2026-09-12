/**
 * JanSetu – public stats + map data for the impact dashboard.
 */
const express = require('express');
const store = require('../data/store');
const { CATEGORIES } = require('../utils/categories');
const { asyncHandler } = require('../middleware/handlers');

const router = express.Router();

// GET /api/public/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const [stats, problems] = await Promise.all([
    store.getStats(),
    store.listProblems({ publicOnly: true }),
  ]);
  const mapPoints = problems
    .filter((p) => p.location_lat && p.location_lng)
    .map((p) => ({
      id: p.public_id,
      title: p.title,
      category: p.category,
      status: p.status,
      severity: p.severity,
      votes: p.votes,
      district: p.district,
      lat: p.location_lat,
      lng: p.location_lng,
    }));
  res.json({ stats, categories: CATEGORIES, mapPoints });
}));

module.exports = router;