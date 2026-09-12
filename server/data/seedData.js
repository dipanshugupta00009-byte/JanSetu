/**
 * JanSetu – shared demo seed data (used by memory store and Supabase store).
 */
const SEED_USERS = [
  { name: 'Ram Kumar', email: 'ram@example.com', phone: '9876543210', password: 'Demo@123', role: 'citizen', district: 'Ranchi', language: 'hi' },
  { name: 'Dr. Anita Sinha', email: 'sinha@example.com', phone: '9876543211', password: 'Demo@123', role: 'evaluator', district: 'Ranchi' },
  { name: 'Prof. Ramesh Nirmal', email: 'nirmal@example.com', phone: '9876543212', password: 'Demo@123', role: 'institution', org_name: 'Birla Institute of Technology, Mesra', district: 'Ranchi' },
  { name: 'Meena Agarwal', email: 'meena@example.com', phone: '9876543213', password: 'Demo@123', role: 'industry', org_name: 'Tata Steel Foundation', district: 'East Singhbhum' },
];

const SEED_PROBLEMS = [
  {
    title: 'Handpump water not working in Bandgaon village', byEmail: 'ram@example.com', at: -32, status: 'approved', votes: 42,
    category: 'water', district: 'East Singhbhum', block: 'Bandgaon', village: 'Bandgaon', lat: 22.4476, lng: 85.7448,
    description: 'The community handpump in Bandgaon panchayat has been dry for the last three weeks. Women and children walk 2 km daily to fetch drinking water. About 250 families are affected. Summer is approaching and there is no alternative source of clean water.',
    media: [],
  },
  {
    title: 'Government school building needs urgent roof repair', byEmail: 'ram@example.com', at: -25, status: 'approved', votes: 27,
    category: 'education', district: 'Ranchi', block: 'Kanke', village: 'Kanke', lat: 23.4035, lng: 85.4036,
    description: 'The roof of the middle school in village Kanke has severe leakage. During monsoon classes cannot be conducted. 6 teachers and 180 students are affected. The school building is under PM SHRI scheme but repairs have not happened in the last 2 years.',
    media: [],
  },
  {
    title: 'No street lights on Main Road in Dhanbad', byEmail: 'meena@example.com', at: -20, status: 'in_progress', votes: 19,
    category: 'electricity', district: 'Dhanbad', block: 'Dhanbad', village: 'Dhanbad Town', lat: 23.7957, lng: 86.4304,
    description: 'Main Road stretch from the bus stand to Koyalnagar has no functional street lights for 8 months. Accidents at night have increased and locals feel unsafe. Widows and daily wage workers returning at dawn are particularly at risk.',
    media: [],
  },
  {
    title: 'Contaminated drinking water causing stomach illness in Khunti', byEmail: 'ram@example.com', at: -3, status: 'submitted', votes: 61,
    category: 'health', district: 'Khunti', block: 'Rukka', village: 'Rukka', lat: 23.0500, lng: 85.1500,
    description: 'Since the open drain overflow started, the borewell water in Rukka village has turned yellowish. At least 30 people reported stomach illness last month. Test report from the district lab shows high coliform count. Urgent need for a safe water solution.',
    media: [],
  },
  {
    title: 'No vocational training centre for youth in Chaibasa', byEmail: 'nirmal@example.com', at: -90, status: 'deployed', votes: 15,
    category: 'public_services', district: 'West Singhbhum', block: 'Chaibasa', village: 'Chaibasa', lat: 22.5610, lng: 85.8160,
    description: 'Class 12 pass youth in Chaibasa have no access to skill development. ITI seats are limited and far. Industry offers jobs in Ranchi and Jamshedpur but youth lack basic vocational certifications. Community wants a local skill hub.',
    media: [],
  },
];

const SEED_PROJECT = {
  problemIndex: 2, // No street lights – in_progress
  institutionEmail: 'nirmal@example.com',
  milestones: [
    { title: 'Proposal submitted', type: 'proposal', at: -18, status: 'submitted', notes: 'Solar + grid hybrid street lighting proposal accepted.' },
    { title: 'Prototype / pilot on 1 km stretch', type: 'prototype', at: -6, status: 'submitted', notes: 'Pilot installed on Main Road; 40% energy saving recorded.' },
  ],
};

module.exports = { SEED_USERS, SEED_PROBLEMS, SEED_PROJECT };