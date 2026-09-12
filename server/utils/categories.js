/**
 * JanSetu – Domain vocabulary: sectors, categories, keyword auto-tagging.
 */

const CATEGORIES = [
  { key: 'education', label: 'Education / शिक्षा', icon: '🎓' },
  { key: 'health', label: 'Health / स्वास्थ्य', icon: '🏥' },
  { key: 'water', label: 'Drinking Water / पेयजल', icon: '💧' },
  { key: 'sanitation', label: 'Sanitation / स्वच्छता', icon: '🚻' },
  { key: 'agriculture', label: 'Agriculture & Livelihood / कृषि व आजीविका', icon: '🌾' },
  { key: 'roads_transport', label: 'Roads & Transport / सड़क व परिवहन', icon: '🛣️' },
  { key: 'electricity', label: 'Electricity / बिजली', icon: '⚡' },
  { key: 'environment', label: 'Environment / पर्यावरण', icon: '🌳' },
  { key: 'infrastructure', label: 'Urban & Rural Infrastructure / बुनियादी ढांचा', icon: '🏗️' },
  { key: 'accessibility', label: 'Accessibility & Disability / पहुंच', icon: '♿' },
  { key: 'public_services', label: 'Public Services / लोक सेवाएं', icon: '🏛️' },
  { key: 'women_child', label: 'Women & Child Welfare / महिला-बाल कल्याण', icon: '👩‍👧' },
  { key: 'tribal_welfare', label: 'Tribal Welfare / जनजातीय कल्याण', icon: '🪕' },
  { key: 'digital', label: 'Digital / Internet Access', icon: '📡' },
  { key: 'housing', label: 'Housing / आवास', icon: '🏠' },
  { key: 'others', label: 'Others / अन्य', icon: '📌' },
];

/** Keyword map: sector key -> array of english+hindi keywords */
const SECTOR_KEYWORDS = {
  education: ['school', 'teacher', 'college', 'university', 'education', 'classroom', 'student', 'saraswati', 'mid-day', 'scholarship', 'vidyalay', 'school me', 'pustak', 'adhyapak', 'स्कूल', 'शिक्षा', 'विद्यालय', 'अध्यापक', 'शिक्षक', 'पढ़ाई', 'सरस्वती', 'छात्र'],
  health: ['hospital', 'doctor', 'health', 'medicine', 'clinic', 'anganwadi', 'asha', 'dawa', 'treatment', 'sick', 'immunization', 'swasthya', 'aspataal', 'aspatale', 'दवा', 'डॉक्टर', 'अस्पताल', 'स्वास्थ्य', 'आंगनवाड़ी', 'इलाज', 'बीमार'],
  water: ['water', 'drinking water', 'tanki', 'handpump', 'hand pump', 'borewell', 'well', 'jal', 'peyjal', 'paani', 'water supply', 'shortage of water', 'पानी', 'पेयजल', 'हैंडपंप', 'टंकी', 'नल', 'कुंआ', 'बोरवेल', 'जल'],
  sanitation: ['toilet', 'sanitation', 'sewage', 'drain', 'garbage', 'waste', 'safai', 'shochalay', 'nalli', 'kuda', 'swachh', 'शौचालय', 'सफाई', 'कूड़ा', 'सीवेज', 'नाली', 'गंदगी', 'स्वच्छता'],
  agriculture: ['agriculture', 'crop', 'farmer', 'irrigation', 'seed', 'fertilizer', 'mandi', 'kisan', 'fasal', 'krishi', 'sichai', 'khet', 'kisaan', 'खेती', 'किसान', 'फसल', 'सिंचाई', 'कृषि', 'खाद', 'बीज', 'मंडी'],
  roads_transport: ['road', 'street', 'pothole', 'bridge', 'bus', 'transport', 'sadak', 'pul', 'rasta', 'jhoola', 'सड़क', 'पुल', 'रास्ता', 'बस', 'परिवहन', 'गड्ढे'],
  electricity: ['electricity', 'power', 'bijli', 'transformer', 'wire', 'voltage', 'light', 'बिजली', 'रोशनी', 'ट्रांसफार्मर', 'पावर', 'लाइट'],
  environment: ['environment', 'forest', 'pollution', 'deforestation', 'coal', 'mining', 'tree', 'air', 'smoke', 'paryavaran', 'van', 'pradushan', 'पर्यावरण', 'प्रदूषण', 'जंगल', 'पेड़', 'कोयला', 'खनन'],
  infrastructure: ['building', 'building construction', 'anganwadi bhavan', 'school building', 'pipeline', 'culvert', 'bhavan', 'nirmaan', 'भवन', 'निर्माण', 'पाइपलाइन', 'पुलिया', 'इमारत'],
  accessibility: ['wheelchair', 'disabled', 'pwd', 'ramp', 'accessibility', 'viklang', 'divyang', 'दिव्यांग', 'रैंप', 'विकलांग', 'पहुंच'],
  public_services: ['bpl', 'ration', 'card', 'pension', 'aadhaar', 'passbook', 'job card', 'mgnrega', 'pds', 'सरकारी', 'राशन', 'पेंशन', 'आधार', 'जॉब कार्ड', 'पासबुक', 'लोक सेवा', 'राशन कार्ड'],
  women_child: ['women', 'mahila', 'child', 'girl', 'self help group', 'shg', 'balka', 'balika', 'बच्चा', 'बच्ची', 'महिला', 'बालिका', 'शिशु', 'सेल्फ हेल्प'],
  tribal_welfare: ['tribal', 'adivasi', 'jharkhand', 'sarna', 'pahan', 'haat', 'आदिवासी', 'जनजाति', 'सरना', 'हाट'],
  digital: ['internet', 'mobile network', 'network', '4g', 'wifi', 'broadband', 'signal', 'नैटवर्क', 'इंटरनेट', 'सिग्नल', 'नेटवर्क'],
  housing: ['house', 'housing', 'pradhan mantri awas', 'pmay', 'ghar', 'awas', 'मकान', 'आवास', 'घर', 'प्रधानमंत्री आवास'],
};

function normalizeText(text) {
  return String(text || '').toLowerCase();
}

/**
 * Auto-detect the sector for a problem based on title + description keywords.
 * Returns the matching sector key or 'others'.
 */
function autoTagSector(title, description) {
  const haystack = normalizeText(`${title} ${description}`);
  let best = null;
  let bestScore = 0;
  for (const [sector, words] of Object.entries(SECTOR_KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      if (haystack.includes(w.toLowerCase())) score += w.trim().length > 5 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sector;
    }
  }
  return best || 'others';
}

/**
 * Simple deterministic severity score 0-100.
 *  - 30 base, +10 long description, +10 media, +15 urgency keywords,
 *  - +votes contribution (capped at 20)
 */
const URGENCY_WORDS = ['kids', 'children', 'accident', 'death', 'flood', 'disease', 'outbreak', 'leakage', 'collapse', 'poison', 'dangerous', 'many families', 'hundreds', 'widespread', 'contaminated', 'broken pipe', 'no water', 'बच्चे', 'दुर्घटना', 'मौत', 'बाढ़', 'बीमारी', 'रिसाव', 'गिरने', 'खतरनाक', 'कई परिवार', 'गंदा', 'पानी नहीं'];

function computeSeverity(problem) {
  let score = 30;
  const text = normalizeText(`${problem.title} ${problem.description}`);
  if ((problem.description || '').length > 400) score += 8;
  if ((problem.media || []).length > 0) score += 7;
  for (const w of URGENCY_WORDS) if (text.includes(w.toLowerCase())) { score += 9; break; }
  score += Math.min((problem.votes || 0) * 3, 20);
  score += (problem.district ? 5 : 0);
  return Math.min(100, Math.max(10, score));
}

function validCategory(key) {
  return CATEGORIES.some((c) => c.key === key) ? key : 'others';
}

module.exports = { CATEGORIES, autoTagSector, computeSeverity, validCategory };