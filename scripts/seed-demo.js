/**
 * JanSetu – demo seed script.
 * Boots the app's data layer in memory mode and prints seeded counts,
 * then starts seeding the optional demo accounts.
 * Usage:  node scripts/seed-demo.js
 */
require('dotenv').config();
const store = require('../server/data/store');

(async () => {
  await store.seedDefaults();
  const users = await store.listUsers();
  const problems = await store.listProblems({ publicOnly: true });
  console.log('=====================================');
  console.log('JanSetu demo data ready.');
  console.log(`  Users    : ${users.length}`);
  console.log(`  Problems : ${problems.length}`);
  console.log('-------------------------------------');
  console.log('Demo accounts (password for all: Demo@123):');
  for (const u of users.filter((x) => x.role !== 'admin')) {
    console.log(`  - ${u.role.padEnd(11)} ${u.email || u.phone}`);
  }
  console.log(`  - ${'admin'.padEnd(11)} username=${process.env.ADMIN_USERNAME || 'admin'}  password=${process.env.ADMIN_PASSWORD || 'Jansetu@2024'}`);
  console.log('=====================================');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});