import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { decodeHTML, isAllCaps, toTitleCase, toSentenceCase, cleanName } from './scraper_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.resolve(__dirname, '../data/geocode_cache.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/friedchickenweek2026.js');
const KML_URL = 'https://www.google.com/maps/d/kml?mid=1NEzohls7shUUctvrNP17KyBczQuwJPs&forcekml=1';
const LOCATIONS_URL = 'https://www.theactualportland.com/friedchickenlocations';

const GEO_UA = 'pdx-food-week-app/1.0 (https://github.com/verdantly/pdx-food-week)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

const DISH_OVERRIDES = {
  'Meesen Thai Eatery': { dish: 'Zabb Wings', spicy: true },
  'Kau Kau PDX': { dish: 'Crispy Ginger Chicken' },
  'Curbside Cravings': { dish: 'Sweet Chili & BBQ Wings', spicy: true },
  'Hunny Beez': { dish: 'Crispy Patis-Glazed Chicken' },
  'Salvi PDX': { dish: '75-Year Mole Fried Chicken', glutenFree: true },
  'Salvi PDX at Level 2': { dish: '75-Year Mole Fried Chicken', glutenFree: true },
  'Happy Valley Wok': { dish: 'Orange, Sesame & Salt Pepper Chicken' },
  'Bhuna Indian Restaurant': { dish: 'Indian Spiced Fried Chicken Sandwich', spicy: true },
  "Uncle Earl's BBQ Bistro": { dish: 'Southern Fried Chicken Wings' },
  'Fabos Tacos Cart': { dish: 'Crispy Fried Chicken Tacos' },
  'Parallel': { dish: 'Fried Chicken Wings & Biscuit' },
  'Tacos Fita Co': { dish: 'Gluten-Free Tenderloin Taco', glutenFree: true }
};

async function scrape() {
  console.log('Fetching live Squarespace locations page & Google Maps KML...');
  const [resLoc, resKml] = await Promise.all([
    fetch(LOCATIONS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }),
    fetch(KML_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  ]);

  if (!resLoc.ok) throw new Error(`Failed to fetch locations page: HTTP ${resLoc.status}`);
  if (!resKml.ok) throw new Error(`Failed to fetch KML map: HTTP ${resKml.status}`);

  const htmlText = await resLoc.text();
  const kmlText = await resKml.text();

  const $html = cheerio.load(htmlText);
  const squarespaceMap = {};

  $html('li.list-item, .user-items-list-item-container').each((i, el) => {
    const rawTitle = $html(el).find('h2').text().trim();
    if (!rawTitle || rawTitle.includes('Coming Soon') || rawTitle.includes('Locations.')) return;

    const desc = $html(el).find('.list-item-content__description').text().trim();
    const img = $html(el).find('img').attr('data-src') || $html(el).find('img').attr('src') || '';
    const key = cleanName(rawTitle);
    
    if (key) {
      squarespaceMap[key] = {
        title: rawTitle,
        description: desc,
        image: img
      };
    }
  });

  console.log(`Parsed ${Object.keys(squarespaceMap).length} items from Squarespace page.`);

  const $kml = cheerio.load(kmlText, { xmlMode: true });
  const entries = [];
  let counter = 1;

  const NAME_MAP = {
    '10barrelbrewingportland': '10barrelbrewing',
    'bigschickenalabamafriedchicken': 'bigschicken',
    'fabostacoscart': 'fabostacos',
    'bhunaindianrestaurant': 'bhuna',
    'salvipdxatlevel2': 'salvipdxatlevel2',
    'migrationbrewingwilliamsx5star': 'migrationbrewingwilliamsx5star',
    'migrationbrewingglisan': 'migrationbrewingglisan'
  };

  const placemarks = $kml('Placemark').toArray();
  console.log(`Found ${placemarks.length} Placemarks in KML map.`);

  for (const pm of placemarks) {
    const name = decodeHTML($kml(pm).find('name').text().trim());
    if (!name || name.includes('Coming Soon')) continue;

    const descHtml = $kml(pm).find('description').text().trim();
    const coordsText = $kml(pm).find('coordinates').text().trim();
    if (!coordsText) continue;

    const [lngStr, latStr] = coordsText.split(',');
    const lng = parseFloat(lngStr);
    const lat = parseFloat(latStr);
    if (isNaN(lat) || isNaN(lng)) continue;

    const cleanKey = cleanName(name);
    let sqItem = squarespaceMap[cleanKey] || (NAME_MAP[cleanKey] && squarespaceMap[NAME_MAP[cleanKey]]);

    // Image resolution
    let image = (sqItem && sqItem.image) || '';
    if (!image) {
      const imgMatch = descHtml.match(/src="([^"]+)"/);
      if (imgMatch) image = imgMatch[1];
    }
    if (image.startsWith('//')) image = 'https:' + image;

    // Clean description
    let rawText = descHtml
      .replace(/<img[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawText && sqItem && sqItem.description) {
      rawText = sqItem.description.replace(/<[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim();
    }
    rawText = decodeHTML(rawText);

    // Split into Dish title and Description
    let dish = 'Fried Chicken Special';
    let desc = rawText;

    const splitMatch = rawText.match(/^([^—\-–:]{3,60})\s*[—\-–:]\s*(.+)$/i);
    if (splitMatch) {
      const lead = splitMatch[1].trim();
      const rest = splitMatch[2].trim();

      if (/^(gluten free|vegan|vegetarian)$/i.test(lead)) {
        dish = 'Fried Chicken Special';
        desc = rest;
      } else {
        dish = lead;
        desc = rest;
      }
    } else if (rawText.includes('|')) {
      dish = 'Fried Chicken Trio';
      desc = rawText;
    } else if (rawText.length > 0 && rawText.length < 50) {
      dish = rawText;
      desc = rawText;
    }

    if (DISH_OVERRIDES[name]) {
      if (DISH_OVERRIDES[name].dish) dish = DISH_OVERRIDES[name].dish;
    }

    dish = toTitleCase(dish);
    desc = toSentenceCase(desc);

    // Reverse Geocoding
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
        await sleep(1200);
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

    // Dietary parsing
    const combined = `${name} ${dish} ${desc} ${rawText}`.toLowerCase();
    const isVegan = combined.includes('(vegan)') || combined.includes('chickn') || combined.includes('vegan buffalo') || (combined.includes('vegan') && !combined.includes('non-vegan'));
    const isVegetarian = isVegan || combined.includes('tofu') || combined.includes('vegetarian');
    let isGlutenFree = combined.includes('gluten free') || combined.includes('gluten-free') || combined.includes('100% gluten-free');
    let isSpicy = /spicy|hot|chile|chili|gochujang|buffalo|serrano|sambal|habanero|cajun|pepper/i.test(combined);

    if (DISH_OVERRIDES[name]) {
      if (DISH_OVERRIDES[name].glutenFree !== undefined) isGlutenFree = DISH_OVERRIDES[name].glutenFree;
      if (DISH_OVERRIDES[name].spicy !== undefined) isSpicy = DISH_OVERRIDES[name].spicy;
    }

    let type = 'meat';
    if (isVegan) {
      type = 'vegan';
    } else if (isVegetarian) {
      type = 'vegetarian';
    }

    let emoji = '🍗';
    if (type === 'vegan') emoji = '🌱';
    else if (type === 'vegetarian') emoji = '🌿';
    else if (/wings/i.test(dish) || /wings/i.test(desc)) emoji = '🍗';
    else if (/sando|sandwich|burger|hoagie/i.test(dish) || /sandwich/i.test(desc)) emoji = '🥪';
    else if (/taco/i.test(dish) || /taco/i.test(name)) emoji = '🌮';
    else if (/curry/i.test(dish)) emoji = '🍛';
    else if (/tenders/i.test(dish)) emoji = '🍗';

    entries.push({
      id: counter,
      weekId: 'fried-chicken-2026',
      dish,
      restaurant: name,
      neighborhood: neighborhood || 'Portland',
      address,
      lat,
      lng,
      type,
      vegOption: isVegetarian,
      veganOption: isVegan,
      glutenFree: isGlutenFree,
      spicy: isSpicy,
      minors: true,
      takeout: true,
      desc,
      emoji,
      image,
      url: 'https://www.theactualportland.com/friedchickenlocations'
    });

    counter++;
  }

  const fileContent = `// The Actual Portland's Fried Chicken Week 2026
// ${entries.length} locations
// Source: ${LOCATIONS_URL}

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push(
  {
    id: "fried-chicken-2026",
    name: "Fried Chicken Week 2026",
    organizer: "The Actual Portland",
    dates: "September 14–20, 2026",
    startDate: "2026-09-14",
    endDate: "2026-09-20",
    pricePills: ["$10 special"],
    color: "#D97706",
    emoji: "🍗",
    totalLocations: ${entries.length},
    url: "${LOCATIONS_URL}",
  }
);

window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  const seen = new Set(window.RESTAURANTS.map(r => r.id));
  for (const item of newItems) {
    if (!seen.has(item.id)) {
      window.RESTAURANTS.push(item);
      seen.add(item.id);
    }
  }
})();
`;

  fs.writeFileSync(OUTPUT_PATH, fileContent, 'utf8');
  console.log(`Successfully generated ${OUTPUT_PATH} with ${entries.length} locations.`);
}

scrape().catch(err => {
  console.error('Scraping error:', err);
  process.exit(1);
});
