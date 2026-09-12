/**
 * JanSetu – shared aggregate statistics used by both the public impact
 * dashboard and the admin dashboard.
 */
const { CATEGORIES } = require('./categories');

function emptyCategoryMap() {
  const map = {};
  for (const c of CATEGORIES) map[c.key] = 0;
  return map;
}

const MODERN_STATUSES = ['assigned', 'in_progress', 'piloted', 'deployed'];

function computeStats(problems, projects, users) {
  const byCategory = emptyCategoryMap();
  const byDistrict = {};
  const byStatus = {};
  const byMonth = {};

  (problems || []).forEach((p) => {
    if (!byCategory[p.category]) byCategory[p.category] = 0;
    byCategory[p.category] += 1;
    if (p.district) byDistrict[p.district] = (byDistrict[p.district] || 0) + 1;
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    const m = String(p.created_at || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(m)) byMonth[m] = (byMonth[m] || 0) + 1;
  });

  // Fill the last 6 months
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ month: key, count: byMonth[key] || 0 });
  }

  const totalProblems = (problems || []).length;
  const solvedProblems = (problems || []).filter((p) => p.status === 'closed').length;
  const activeProjects = (projects || []).filter((p) => MODERN_STATUSES.includes(p.status)).length;
  const completedProjects = (projects || []).filter((p) => p.status === 'closed').length;

  const institutions = (users || []).filter((u) => u.role === 'institution').length;
  const industryPartners = (users || []).filter((u) => u.role === 'industry').length;
  const citizens = (users || []).filter((u) => u.role === 'citizen').length;

  const totalVotes = (problems || []).reduce((acc, p) => acc + (p.votes || 0), 0);

  return {
    totalProblems,
    solvedProblems,
    activeProjects,
    completedProjects,
    institutions,
    industryPartners,
    citizens,
    totalVotes,
    byCategory,
    byDistrict: Object.entries(byDistrict).sort((a, b) => b[1] - a[1]).slice(0, 8),
    byStatus,
    monthly: months,
    resolutionRate: totalProblems
      ? Math.round((solvedProblems / totalProblems) * 1000) / 10
      : 0,
  };
}

module.exports = { computeStats };