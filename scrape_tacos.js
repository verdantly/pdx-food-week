import fs from 'fs';
import path from 'path';
import { decodeHTML, isAllCaps, toTitleCase, toSentenceCase, cleanName } from './scraper_utils.js';

const KML_PATH = './taco_map.kml';
const JSON_PATH = './context_2.json';
const CACHE_PATH = './data/geocode_cache.json';
const OUTPUT_PATH = './data/tacoweek2026.js';

const GEO_UA = 'pdx-food-week-app/1.0 (https://github.com/oberonix/pdx-food-week)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utilities now imported from scraper_utils.js

// 2. Load cache
let geocodeCache = {};
if (fs.existsSync(CACHE_PATH)) {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf8').replace(/^\uFEFF/, '');
    geocodeCache = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(geocodeCache).length} cached coordinates.`);
  } catch (e) {
    console.warn('Failed to load geocode cache, starting fresh:', e.message);
  }
}

function saveGeocodeCache() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(geocodeCache, null, 2), 'utf8');
}

// 3. Load Squarespace context JSON
console.log('Loading Squarespace context JSON...');
const NAME_MAP = {
  'missdeltarestaurantandbar': 'missdelta',
  'migrationbrewing5stardivebarwilliams': 'migrationbrewingwilliams',
  'levelbeerlevel2multnomahvillagesalvipdx': 'salvipdxlevelbeerlevel2multnomahvillage',
  'phiphiislandthaifoodcart': 'phiphithaicart',
  'arelispdx': 'arelismexicancart',
  'kayosramenbar': 'kayosramen',
  'swandive': 'theobertosatswandive',
  'verduremalpractice': 'verduremalpracticevegan',
  'nomnomasiantapasandbar': 'nomnomasiantapasbar',
  'nachoshousemexicankitchen2': 'nachoshouse',
  'fatsoscheketos': 'fatsoscheketosglutenfree'
};

let squarespaceMap = {};
if (fs.existsSync(JSON_PATH)) {
  let raw = fs.readFileSync(JSON_PATH, 'utf8').replace(/^\uFEFF/, '');
  // Clean encoding issues
  raw = raw
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '–')
    .replace(/â€™/g, '’')
    .replace(/â€œ/g, '“')
    .replace(/â€\x9D/g, '”')
    .replace(/â€¦/g, '…')
    .replace(/â€¯/g, ' ');
  const jsonContent = JSON.parse(raw);
  const items = jsonContent.userItems || [];
  for (const item of items) {
    const key = cleanName(item.title);
    if (key) {
      squarespaceMap[key] = item;
    }
  }
}


// 4. Parse KML Map via Regex (pure vanilla, no cheerio required)
console.log('Parsing KML map...');
const kmlContent = fs.readFileSync(KML_PATH, 'utf8');

const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
const entries = [];
let counter = 1;
let match;

while ((match = placemarkRegex.exec(kmlContent)) !== null) {
  const pmContent = match[1];

  // Extract name
  const nameMatch = pmContent.match(/<name>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/name>/);
  if (!nameMatch) continue;
  const name = decodeHTML((nameMatch[1] || nameMatch[2] || '').trim());

  // Skip placeholders or empty names
  if (name.includes('Coming Soon') || !name) {
    continue;
  }

  // Extract description
  const descMatch = pmContent.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/);
  const descHtml = descMatch ? (descMatch[1] || descMatch[2] || '') : '';

  // Extract coordinates
  const coordsMatch = pmContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
  if (!coordsMatch) continue;
  const coordsText = coordsMatch[1].trim();

  // Parse coords: lng,lat,0
  const parts = coordsText.split(',');
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);

  // Get Squarespace item
  let squarespaceItem = null;
  const key = cleanName(name);
  if (squarespaceMap[key]) {
    squarespaceItem = squarespaceMap[key];
  } else if (NAME_MAP[key] && squarespaceMap[NAME_MAP[key]]) {
    squarespaceItem = squarespaceMap[NAME_MAP[key]];
  }

  // Image resolution: Squarespace JSON vs KML
  let image = '';
  if (squarespaceItem) {
    image = squarespaceItem.image?.assetUrl || '';
  }

  // Fallback to KML description image URL if not found in JSON
  if (!image) {
    const imgMatch = descHtml.match(/src="([^"]+)"/);
    if (imgMatch) {
      image = imgMatch[1];
    }
  }

  // Clean description HTML from KML
  let textOnly = descHtml
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If description not in KML, fall back to Squarespace description
  if (!textOnly && squarespaceItem && squarespaceItem.description) {
    textOnly = squarespaceItem.description
      .replace(/<[^>]*>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  textOnly = decodeHTML(textOnly);

  // Split description into dish and description text
  let dish = 'Special Taco';
  let desc = textOnly;
  const colonIdx = textOnly.indexOf(':');
  if (colonIdx !== -1) {
    dish = textOnly.substring(0, colonIdx).trim();
    desc = textOnly.substring(colonIdx + 1).trim();
  } else {
    const calledMatch = textOnly.match(/IT IS CALLED THE (.*?)\.?$/i);
    if (calledMatch) {
      dish = calledMatch[1].trim();
    }
  }

  // Normalize casings
  dish = toTitleCase(dish);
  desc = toSentenceCase(desc);

  // Reverse geocode
  const cacheKey = `${lat},${lng}`;
  let address = '';
  let streetAddress = '';
  let neighborhood = '';

  if (geocodeCache[cacheKey]) {
    const cached = geocodeCache[cacheKey];
    address = cached.address;
    streetAddress = cached.streetAddress;
    neighborhood = cached.neighborhood;
  } else {
    console.log(`[${counter}] Reverse geocoding ${name} (${cacheKey})...`);
    const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

    try {
      const res = await fetch(geoUrl, { headers: { 'User-Agent': GEO_UA } });
      await sleep(1200); // rate limiting
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const addr = data.address || {};
      
      const houseNum = addr.house_number || '';
      const road = addr.road || '';
      
      neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.village || addr.town || '';
      
      let city = addr.city || addr.town || addr.village || 'Portland';
      const postcode = addr.postcode || '';

      if (houseNum && road) {
        streetAddress = `${houseNum} ${road}`;
      } else if (road) {
        streetAddress = road;
      } else {
        streetAddress = data.display_name.split(',')[0].trim();
      }

      // Shorten street terms
      streetAddress = streetAddress
        .replace(/\bStreet\b/g, 'St')
        .replace(/\bAvenue\b/g, 'Ave')
        .replace(/\bBoulevard\b/g, 'Blvd')
        .replace(/\bRoad\b/g, 'Rd');

      address = `${streetAddress}, ${city}, OR`;
      if (postcode) address += ` ${postcode}`;

      geocodeCache[cacheKey] = { address, streetAddress, neighborhood };
      saveGeocodeCache();
    } catch (e) {
      console.warn(`  ⚠ Geocoding failed for ${name}:`, e.message);
      address = 'Portland, OR';
      streetAddress = '';
      neighborhood = '';
    }
  }

  // Dietary type and tags
  const sqTitle = squarespaceItem ? (squarespaceItem.title || '') : '';
  const bothText = `${dish} ${desc} ${sqTitle}`.toLowerCase();

  const isMushroomBirria = (bothText.includes('mushroom') || bothText.includes('hongos') || bothText.includes('lion’s mane') || bothText.includes('lion\'s mane')) && !bothText.includes('beef') && !bothText.includes('pork') && !bothText.includes('chicken');
  const isSoyCurlAsada = bothText.includes('soy curl');

  const hasRealMeat = /chicken|pollo|tinga|beef|steak|asada|birria|carnitas|pork|bacon|chorizo|longaniza|ribeye|rib eye|brisket|chicharron|shrimp|seafood|fish|salmon|crab|cod|ostrich|kebab|char siu/i.test(bothText) 
    && !isSoyCurlAsada 
    && !isMushroomBirria;

  let type = 'meat';
  if (!hasRealMeat) {
    if (bothText.includes('vegan') || isSoyCurlAsada) {
      type = 'vegan';
    } else if (bothText.includes('vegetarian') || bothText.includes('veggie') || bothText.includes('vegetariano') || bothText.includes('tofu') || isMushroomBirria || bothText.includes('avocado') || bothText.includes('s’more') || bothText.includes('s'more') || bothText.includes('tres leches') || name.includes('Bring! Treats for Dogs')) {
      type = 'vegetarian';
    }
  }

  const glutenFree = bothText.includes('gluten-free') || bothText.includes('gluten free') || bothText.includes('gf');
  const spicy = bothText.includes('spicy') || bothText.includes('chile') || bothText.includes('jalapeno') || bothText.includes('serrano') || bothText.includes('habanero') || bothText.includes('hot');

  // Emoji heuristic
  let emoji = '🌮';
  if (/shrimp|seafood|fish|salmon|crab|cod/.test(bothText)) emoji = '🐟';
  else if (/chicken|pollo/.test(bothText)) emoji = '🍗';
  else if (/pork|carnitas|chorizo|al pastor|ham|bacon|char siu/.test(bothText)) emoji = '🐖';
  else if (/beef|steak|asada|birria|carne|brisket/.test(bothText) && !isSoyCurlAsada && !isMushroomBirria) emoji = '🥩';
  else if (/ostrich/.test(bothText)) emoji = '🦤';
  else if (/mushroom|hongos/.test(bothText)) emoji = '🍄';
  else if (/avocado/.test(bothText)) emoji = '🥑';
  else if (type === 'vegan') emoji = '🌱';
  else if (type === 'vegetarian') emoji = '🌿';
  else if (/spicy|hot|chile/.test(bothText)) emoji = '🌶️';

  entries.push({
    id: counter,
    weekId: 'taco-2026',
    dish,
    restaurant: name,
    neighborhood,
    address,
    lat,
    lng,
    type,
    glutenFree,
    spicy,
    minors: true,
    takeout: true,
    desc,
    emoji,
    image,
    url: 'https://www.theactualportland.com/locations'
  });
  
  counter++;
}

// 5. Sort & Write JavaScript File
entries.sort((a, b) => a.id - b.id);

const header = `// The Actual Portland's Taco Week 2026 — scraped ${new Date().toISOString().slice(0, 10)}
// ${entries.length} locations
// Source: https://www.theactualportland.com/locations
`;

const weeksBlock = `window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "taco-2026",
  name: "Taco Week 2026",
  organizer: "The Actual Portland",
  dates: "June 1–7, 2026",
  pricePills: ["$5 taco", "2 for $5"],
  color: "#D48C2C",
  colorDark: "#945B13",
  colorLight: "#FCEFD8",
  colorPale: "#FEF9F0",
  emoji: "🌮",
  totalLocations: ${entries.length},
  url: "https://www.theactualportland.com/locations"
});
`;

const restaurantsBlock = `window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  newItems.forEach(item => {
    if (!window.RESTAURANTS.some(r => r.id === item.id && r.weekId === item.weekId)) {
      window.RESTAURANTS.push(item);
    }
  });
})();
`;

const outDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, header + '\n' + weeksBlock + '\n' + restaurantsBlock, 'utf8');

console.log(`\n✅ Successfully generated ${OUTPUT_PATH} with ${entries.length} locations.`);
