#!/usr/bin/env node
/**
 * PDX Food Week Scraper — structured extraction from EverOut Sandwich Week dish pages.
 *
 * Usage:
 *   node scrapers/scrape_sandwiches.js [--force]
 *
 * Output: data/sandwichweek2026.js (overwritten)
 */

import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decodeHTML, fetchHtml, loadExistingData, updateMetaTotalLocations } from './scraper_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL    = 'https://everout.com';
const WEEK_URL    = 'https://everout.com/portland/events/the-portland-mercurys-sandwich-week-2026/e222742/';
const PARENT_EID  = 'e222742'; // exclude the parent sandwich-week event itself
const PAGE_DELAY  = 600;       // ms between dish pages
const GEO_DELAY   = 1100;      // Nominatim policy: <= 1 req/sec

const GEO_UA = 'pdx-food-week-app/1.0 (https://github.com/verdantly/pdx-food-week)';

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
    `${normalizeAddress(streetAddr)}, ${city}, OR`,
    `${streetAddr}, ${city}, OR`,
  ];
  const seen = new Set();
  for (const v of variants) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    const hit = await geocode(v);
    if (hit) return hit;
  }
  return null;
}

function parseDishPage(html, url) {
  const $ = cheerio.load(html);
  const answerList = $('.answer-list').first();
  if (answerList.length === 0) return null; // not a dish event

  // QA extraction
  const qa = {};
  const sectionMatch = html.match(/class="answer-list[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  if (sectionMatch) {
    const section = sectionMatch[1];
    const regex = /<div class="question-text[^>]*>([\s\S]*?)<\/div>\s*<div class="answer-text[^>]*>([\s\S]*?)<\/div>/g;
    let m;
    while ((m = regex.exec(section)) !== null) {
      const key = decodeHTML(m[1].replace(/<[^>]+>/g, '').trim());
      const val = decodeHTML(m[2].replace(/<[^>]+>/g, '').trim());
      if (key && val) qa[key] = val;
    }
  }

  const dish = decodeHTML(answerList.find('.fs-2').first().text().trim());
  const restaurant = decodeHTML(answerList.find('.fs-4').first().text().trim());
  const addressLine = answerList.find('.ff-condensed').first();
  const neighborhood = decodeHTML(addressLine.find('.text-muted').first().text().trim().replace(/^\(|\)$/g, ''));
  const streetAddress = addressLine.clone().children('.text-muted').remove().end().text().replace(/\s+/g, ' ').trim();

  // Full address with ZIP lives in the Google Maps iframe "q=" param.
  let fullAddress = streetAddress;
  const iframeSrc = $('.map iframe').attr('src') || '';
  const qMatch = iframeSrc.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    try { fullAddress = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')); } catch (e) {}
  }

  const image = $('meta[property="og:image"]').attr('content')
    || $('.item-image img.img-fluid').attr('src')
    || '';

  let descText = $('[itemprop="description"] p, [class*="description"] p, .event-body p').first().text().trim();
  if (!descText) {
    descText = $('[itemprop="description"], [class*="description"], .event-body').first().text().trim();
  }
  descText = descText 
    || $('meta[property="og:description"]').attr('content')?.trim()
    || $('meta[name="description"]').attr('content')?.trim()
    || '';

  // Match QA keys flexibly (case-insensitive and handle smart/straight apostrophes)
  const findQA = (pattern) => {
    for (const [k, v] of Object.entries(qa)) {
      if (pattern.test(k)) return v;
    }
    return '';
  };

  const whatsOnThem = findQA(/what['’]s\s+on\s+(them|it)/i);
  const whatTheySay = findQA(/what\s+they\s+say/i);
  // Do not fall back to descText if it matches restaurant name
  const safeDescText = (descText && descText.toLowerCase() === restaurant.toLowerCase()) ? '' : descText;
  const desc = decodeHTML((whatsOnThem || whatTheySay || safeDescText));

  const typeRaw = (qa['Meat or Vegetarian?'] || '').toLowerCase();
  const hasMeat  = /\bmeat\b/.test(typeRaw);
  const hasVegan = /\bvegan\b/.test(typeRaw);
  const hasVeg   = /\bvegetarian\b/.test(typeRaw);
  const type = hasMeat ? 'meat'
    : hasVegan ? 'vegan'
    : hasVeg ? 'vegetarian'
    : 'meat';
  const vegOption = hasMeat && hasVeg;
  const veganOption = hasVegan && (hasMeat || hasVeg);

  const gfRaw = (qa['Gluten Free?'] || '').toLowerCase();
  const glutenFree = /^(yes|available)/i.test(gfRaw.trim());

  const minors = /(yes|allowed|ok|restaurant|pub|bar)/i.test((qa['Allow Minors?'] || qa['Minors Allowed?'] || '').trim());
  const takeout = /(yes|allowed|ok)/i.test((qa['Allow Takeout?'] || qa['Takeout?'] || '').trim());

  if (!dish || !restaurant) return null;

  // Emoji & spicy heuristic for sandwiches
  const dishLc = dish.toLowerCase();
  const descLc = desc.toLowerCase();
  const both = dishLc + ' ' + descLc;
  const isSpicy = /spicy|hot|habanero|jalapeño|jalapeno|ghost|reaper|chili|fire|dracarys|cayenne|sriracha/i.test(both);
  const emoji = type === 'vegan' ? '🌱'
    : type === 'vegetarian' ? '🌿'
    : isSpicy ? '🔥'
    : /burger/.test(both) ? '🍔'
    : /cheese|melt/.test(both) ? '🧀'
    : '🥪';

  return {
    dish,
    restaurant,
    neighborhood,
    address: fullAddress || streetAddress,
    streetAddress,
    type,
    vegOption,
    veganOption,
    glutenFree,
    minors,
    takeout,
    spicy: isSpicy,
    ...(whatsOnThem ? { whatsOnIt: decodeHTML(whatsOnThem) } : {}),
    ...(whatTheySay ? { whatTheySay: decodeHTML(whatTheySay) } : {}),
    desc: desc.replace(/\s+/g, ' ').slice(0, 300),
    emoji,
    image,
    url,
  };
}

// ── Find all dish sub-event URLs on the week index page ───────────────────────
async function getDishLinks() {
  console.log('Fetching Sandwich Week index…');
  const html = await fetchHtml(WEEK_URL);
  const $ = cheerio.load(html);
  const links = [];
  $('.group-item').each((i, el) => {
    const link = $(el).find('h3 a').attr('href');
    if (link) links.push(link.startsWith('http') ? link : BASE_URL + link);
  });

  if (links.length === 0) {
    const re = /\/portland\/events\/[a-z0-9-]+\/e\d+\//gi;
    const set = new Set();
    for (const m of html.matchAll(re)) {
      const p = m[0];
      if (p.includes(PARENT_EID) || p.includes('patio-pages')) continue;
      set.add(BASE_URL + p);
    }
    return [...set];
  }
  console.log(`Found ${links.length} dish links.`);
  return links;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const isForce = process.argv.includes('--force') || process.argv.includes('--all');
  const outDir = path.resolve(__dirname, '../data');
  const outPath = path.join(outDir, 'sandwichweek2026.js');
  const existingMap = isForce ? new Map() : loadExistingData(outPath);

  if (existingMap.size > 0) {
    console.log(`⚡ Incremental mode: Loaded ${existingMap.size} existing entries from ${outPath}`);
  } else if (isForce) {
    console.log(`🔄 Force mode enabled: Re-scraping all dishes from scratch.`);
  }

  const dishLinks = await getDishLinks();
  if (dishLinks.length === 0) {
    console.error('No dish links found.');
    process.exit(1);
  }

  const entries = [];
  let fallbackCount = 0;
  let skipped = 0;
  let reusedCount = 0;
  let newCount = 0;

  for (let i = 0; i < dishLinks.length; i++) {
    const url = dishLinks[i];
    const eidMatch = url.match(/\/e(\d+)\//);
    const existing = existingMap.get(url);

    if (existing) {
      reusedCount++;
      console.log(`  ✓ [Existing] ${existing.dish} @ ${existing.restaurant}`);
      entries.push(existing);
      continue;
    }

    console.log(`\n[${i + 1}/${dishLinks.length}] ${url}`);
    let parsed;
    try {
      const html = await fetchHtml(url);
      parsed = parseDishPage(html, url);
    } catch (e) {
      console.warn(`  ⚠ Fetch/parse failed: ${e.message}`);
      skipped++;
      await sleep(PAGE_DELAY);
      continue;
    }

    if (!parsed) {
      console.warn(`  ⚠ Skipped (not a dish page): ${url}`);
      skipped++;
      await sleep(PAGE_DELAY);
      continue;
    }

    newCount++;
    console.log(`  → ${parsed.dish} @ ${parsed.restaurant} (${parsed.neighborhood || 'no hood'})`);

    const coords = await geocodeWithFallbacks(parsed.address, parsed.streetAddress);
    if (!coords) {
      fallbackCount++;
      console.warn(`  ⚠ No coords: ${parsed.address}`);
    }

    const id = eidMatch ? parseInt(eidMatch[1], 10) : entries.length + 1;

    entries.push({
      id,
      weekId: 'sandwich-2026',
      dish: parsed.dish,
      restaurant: parsed.restaurant,
      neighborhood: parsed.neighborhood,
      address: parsed.address,
      lat: coords ? coords.lat : 45.5231,
      lng: coords ? coords.lng : -122.6765,
      type: parsed.type,
      vegOption: parsed.vegOption,
      veganOption: parsed.veganOption,
      glutenFree: parsed.glutenFree,
      minors: parsed.minors,
      takeout: parsed.takeout,
      spicy: parsed.spicy,
      ...(parsed.whatsOnIt ? { whatsOnIt: parsed.whatsOnIt } : {}),
      ...(parsed.whatTheySay ? { whatTheySay: parsed.whatTheySay } : {}),
      desc: parsed.desc,
      emoji: parsed.emoji,
      image: parsed.image,
      url: parsed.url,
      isNew: true
    });

    await sleep(PAGE_DELAY);
  }

  entries.sort((a, b) => a.id - b.id);

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const header = `// Portland Mercury's Sandwich Week 2026 — scraped ${new Date().toISOString().slice(0, 10)}
// ${entries.length} locations (skipped: ${skipped}, reused: ${reusedCount}, new: ${newCount}, geocode fallbacks: ${fallbackCount})
// Source: ${WEEK_URL}
`;

  const weeksBlock = `window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push(
  {
    id: "sandwich-2026",
    name: "Sandwich Week 2026",
    organizer: "Portland Mercury",
    dates: "March 2–8, 2026",
    startDate: "2026-03-02",
    endDate: "2026-03-08",
    pricePills: ["$10 sandwiches"],
    color: "#00897B",
    colorDark: "#00564D",
    colorLight: "#B2DFDB",
    colorPale: "#E0F2F1",
    emoji: "🥪",
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
  updateMetaTotalLocations('sandwich-2026', entries.length, path.resolve(__dirname, '../js/meta.js'));

  console.log(`\n✅ Wrote ${entries.length} restaurants to ${outPath}`);
  console.log(`   Skipped: ${skipped}, geocode fallbacks: ${fallbackCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
