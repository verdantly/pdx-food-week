#!/usr/bin/env node
/**
 * PDX Food Week Scraper — Oregonian Dumpling Week scraper from Squarespace.
 *
 * Usage:
 *   node scrapers/scrape_dumplings.js [--force]
 *
 * Output: data/dumplingweek2026.js (overwritten)
 */

import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decodeHTML, fetchHtml, loadExistingData, updateMetaTotalLocations } from './scraper_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WEEK_URL    = 'https://www.dumplingweek.com/';
const GEO_DELAY   = 1100; // Nominatim policy: <= 1 req/sec
const GEO_UA      = 'pdx-food-week-app/1.0 (https://github.com/verdantly/pdx-food-week)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Geocoding via Nominatim, with in-process cache + rate-limiter ─────────────
const geoCache = new Map();
let lastGeoAt = 0;

// Preload disk cache if available
const DISK_CACHE_PATH = path.resolve(__dirname, '../data/geocode_cache.json');
let diskGeoCache = {};
if (fs.existsSync(DISK_CACHE_PATH)) {
  try {
    diskGeoCache = JSON.parse(fs.readFileSync(DISK_CACHE_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {}
}

async function geocode(address) {
  if (!address) return null;
  if (geoCache.has(address)) return geoCache.get(address);

  // Check disk cache first
  for (const [key, val] of Object.entries(diskGeoCache)) {
    if (val && val.address && (val.address.toLowerCase() === address.toLowerCase() || address.toLowerCase().includes(val.streetAddress?.toLowerCase()))) {
      const coords = key.split(',').map(Number);
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        const hit = { lat: coords[0], lng: coords[1] };
        geoCache.set(address, hit);
        return hit;
      }
    }
  }

  const wait = Math.max(0, GEO_DELAY - (Date.now() - lastGeoAt));
  if (wait > 0) await sleep(wait);

  try {
    const q = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { 'User-Agent': GEO_UA } });
    lastGeoAt = Date.now();
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = await res.json();
    const hit = data && data[0]
      ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      : null;
    geoCache.set(address, hit);
    return hit;
  } catch (e) {
    lastGeoAt = Date.now();
    console.warn(`  ⚠ Geocode failed: ${address} (${e.message})`);
    geoCache.set(address, null);
    return null;
  }
}

// Portland-metro zip → city normalization
const ZIP_CITY = {
  '97005': 'Beaverton', '97006': 'Beaverton', '97007': 'Beaverton', '97008': 'Beaverton',
  '97015': 'Clackamas', '97027': 'Clackamas', '97086': 'Happy Valley',
  '97034': 'Lake Oswego', '97035': 'Lake Oswego',
  '97062': 'Tualatin', '97140': 'Sherwood',
  '97223': 'Tigard', '97224': 'Tigard',
  '97060': 'Troutdale', '97030': 'Gresham', '97080': 'Gresham',
};
function cityFromZip(addr) {
  const m = addr && addr.match(/\b(\d{5})\b/);
  return m && ZIP_CITY[m[1]] ? ZIP_CITY[m[1]] : 'Portland';
}

function normalizeAddress(addr) {
  return addr
    .replace(/,?\s+(Unit|Ste|Suite|Building|Bldg|Apt)\s+\S+/i, '')
    .replace(/\bStreet\b/i, 'St')
    .replace(/\bAvenue\b/i, 'Ave')
    .replace(/\bBoulevard\b/i, 'Blvd')
    .replace(/\bFirst\b/gi, '1st').replace(/\bSecond\b/gi, '2nd')
    .replace(/\bThird\b/gi, '3rd').replace(/\bFourth\b/gi, '4th')
    .replace(/\bFifth\b/gi, '5th').replace(/\bSixth\b/gi, '6th')
    .replace(/\bSeventh\b/gi, '7th').replace(/\bEighth\b/gi, '8th')
    .replace(/\bNinth\b/gi, '9th').replace(/\bTenth\b/gi, '10th')
    .replace(/\s+/g, ' ')
    .trim();
}

async function geocodeWithFallbacks(fullAddr, streetAddr) {
  if (!fullAddr) return null;
  const city = cityFromZip(fullAddr);
  const variants = [
    fullAddr,
    normalizeAddress(fullAddr),
    streetAddr ? `${normalizeAddress(streetAddr)}, ${city}, OR` : null,
    streetAddr ? `${streetAddr}, ${city}, OR` : null,
    fullAddr.includes('Portland') ? fullAddr : `${fullAddr}, Portland, OR`
  ].filter(Boolean);

  const seen = new Set();
  for (const v of variants) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const hit = await geocode(v);
    if (hit) return hit;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const isForce = process.argv.includes('--force') || process.argv.includes('--all');
  const outDir = path.resolve(__dirname, '../data');
  const outPath = path.join(outDir, 'dumplingweek2026.js');
  const existingMap = isForce ? new Map() : loadExistingData(outPath);

  if (existingMap.size > 0) {
    console.log(`⚡ Incremental mode: Loaded ${existingMap.size} existing entries from ${outPath}`);
  } else if (isForce) {
    console.log(`🔄 Force mode enabled: Re-scraping all dishes from scratch.`);
  }

  console.log('Fetching Dumpling Week index…');
  const html = await fetchHtml(WEEK_URL);
  const $ = cheerio.load(html);

  const listItems = $('li.list-item');
  console.log(`Found ${listItems.length} candidate items.`);

  const rawEntries = [];
  listItems.each((i, el) => {
    const $el = $(el);
    const restaurant = decodeHTML($el.find('h2').text().trim());
    if (!restaurant) return;
    const lower = restaurant.toLowerCase();
    if (lower.includes('wrap') || lower.includes('restaurant') && lower.includes('map') || lower === 'participating restaurants') {
      return;
    }

    const image = $el.find('img').attr('data-src') || $el.find('img').attr('src') || '';
    const descContainer = $el.find('.list-item-content__description');
    
    // Dish title is usually inside <strong> or the second paragraph
    let dish = '';
    const strong = descContainer.find('strong').first().text().trim();
    if (strong) {
      dish = decodeHTML(strong.replace(/[!.]+$/, '').trim());
    }

    // Paragraphs
    const paras = descContainer.find('p').map((_, p) => $(p).text().trim()).get().filter(Boolean);
    let addressLine = '';
    let descriptionText = '';

    if (paras.length > 0) {
      // First paragraph usually has address and "Dine In | Take Out"
      const p0 = paras[0];
      const dineIdx = p0.search(/dine\s*in|take\s*out/i);
      if (dineIdx !== -1) {
        addressLine = p0.slice(0, dineIdx).replace(/\s*[|•-]\s*$/, '').trim();
      } else {
        addressLine = p0;
      }

      // Rest of paragraphs contain description
      descriptionText = paras.slice(1).join(' ').trim();
      if (!descriptionText && dineIdx !== -1) {
        descriptionText = p0.slice(dineIdx).trim();
      }
    } else {
      descriptionText = descContainer.text().trim();
    }

    // If strong wasn't found or was huge, refine dish
    if (!dish && paras.length > 1) {
      dish = paras[1].split(/[\n\r.]/)[0].trim();
    }
    if (!dish) {
      dish = `${restaurant} Dumpling Special`;
    }

    // Clean price if in dish title
    let price = '';
    const priceMatch = dish.match(/\$([0-9]+(\.[0-9]{2})?)/);
    if (priceMatch) {
      price = `$${priceMatch[1]}`;
      dish = dish.replace(/\$([0-9]+(\.[0-9]{2})?)/, '').replace(/[!\-,]+$/, '').trim();
    }

    // Delivery / takeout / dine-in flags
    const fullText = descContainer.text();
    const takeout = /take\s*out/i.test(fullText);
    const minors = !/21\s*\+|bars?\s+only/i.test(fullText);

    // Dietary heuristic
    const lowerAll = (dish + ' ' + descriptionText).toLowerCase();
    const isVegan = /\bvegan\b/.test(lowerAll);
    const isVeg = /\bvegetarian\b|\bveggie\b/.test(lowerAll);
    const hasMeat = /pork|beef|chicken|duck|crab|shrimp|lamb|meat/i.test(lowerAll);
    const type = isVegan ? 'vegan' : (isVeg && !hasMeat) ? 'vegetarian' : 'meat';
    const vegOption = isVeg || /vegetarian option/i.test(lowerAll);
    const veganOption = isVegan || /vegan option/i.test(lowerAll);
    const glutenFree = /gluten-free|gluten free|gf\b/i.test(lowerAll);

    // Multi-location handling (e.g. ¿Por Que No?)
    // If address contains " and ", take the first one or clean it up
    let primaryAddress = addressLine.replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
    if (primaryAddress.includes(' and ')) {
      primaryAddress = primaryAddress.split(' and ')[0].trim();
    }

    rawEntries.push({
      restaurant,
      dish,
      address: primaryAddress || 'Portland, OR',
      desc: descriptionText.replace(/\s+/g, ' ').slice(0, 300),
      image,
      takeout,
      minors,
      type,
      vegOption,
      veganOption,
      glutenFree,
      price: price || '$12–$15',
    });
  });

  console.log(`Parsed ${rawEntries.length} dumpling items.`);

  const entries = [];
  let fallbackCount = 0;
  let skipped = 0;
  let reusedCount = 0;
  let newCount = 0;

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const key = `${raw.dish} @ ${raw.restaurant}`;
    const existing = existingMap.get(key) || existingMap.get(raw.restaurant);

    if (existing) {
      reusedCount++;
      console.log(`  ✓ [Existing] ${existing.dish} @ ${existing.restaurant}`);
      entries.push(existing);
      continue;
    }

    newCount++;
    console.log(`\n[${i + 1}/${rawEntries.length}] ${raw.dish} @ ${raw.restaurant}`);
    console.log(`  Address: ${raw.address}`);

    const coords = await geocodeWithFallbacks(raw.address, raw.address);
    if (!coords) {
      fallbackCount++;
      console.warn(`  ⚠ No coords: ${raw.address}`);
    }

    const id = 22274100 + (i + 1);

    // Emoji heuristic
    const isSpicy = /spicy|chili|sichuan|hot|habanero|jalapeño/i.test(raw.dish + ' ' + raw.desc);
    const emoji = raw.type === 'vegan' ? '🌱'
      : raw.type === 'vegetarian' ? '🌿'
      : isSpicy ? '🔥'
      : '🥟';

    entries.push({
      id,
      weekId: 'dumpling-2026',
      dish: raw.dish,
      restaurant: raw.restaurant,
      neighborhood: '',
      address: raw.address,
      lat: coords ? coords.lat : 45.5231,
      lng: coords ? coords.lng : -122.6765,
      type: raw.type,
      vegOption: raw.vegOption,
      veganOption: raw.veganOption,
      glutenFree: raw.glutenFree,
      minors: raw.minors,
      takeout: raw.takeout,
      desc: raw.desc,
      emoji,
      price: raw.price,
      image: raw.image,
      url: WEEK_URL,
      isNew: true
    });
  }

  entries.sort((a, b) => a.id - b.id);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const header = `// The Oregonian's Dumpling Week 2026 — scraped ${new Date().toISOString().slice(0, 10)}
// ${entries.length} locations (skipped: ${skipped}, reused: ${reusedCount}, new: ${newCount}, geocode fallbacks: ${fallbackCount})
// Source: ${WEEK_URL}
`;

  const weeksBlock = `window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push(
  {
    id: "dumpling-2026",
    name: "Dumpling Week 2026",
    organizer: "The Oregonian",
    dates: "February 15–21, 2026",
    startDate: "2026-02-15",
    endDate: "2026-02-21",
    pricePills: ["$12–$15 dumplings"],
    color: "#8E24AA",
    colorDark: "#5C007A",
    colorLight: "#E1BEE7",
    colorPale: "#F3E5F5",
    emoji: "🥟",
    totalLocations: ${entries.length},
    url: "${WEEK_URL}",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  }
);\n`;

  const restaurantsBlock = `window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  newItems.forEach(item => {
    if (!window.RESTAURANTS.some(r => r.id === item.id && r.weekId === item.weekId)) {
      window.RESTAURANTS.push(item);
    }
  });
})();\n`;

  fs.writeFileSync(outPath, header + '\n' + weeksBlock + '\n' + restaurantsBlock);
  updateMetaTotalLocations('dumpling-2026', entries.length, path.resolve(__dirname, '../js/meta.js'));

  console.log(`\n✅ Wrote ${entries.length} restaurants to ${outPath}`);
  console.log(`   Skipped: ${skipped}, geocode fallbacks: ${fallbackCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
