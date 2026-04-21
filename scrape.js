#!/usr/bin/env node
/**
 * PDX Food Week Scraper — structured extraction from EverOut dish pages.
 *
 * Usage:
 *   npm install
 *   npm run scrape
 *
 * Output: data/pizzaweek2026.js (overwritten)
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BASE_URL    = 'https://everout.com';
const WEEK_URL    = 'https://everout.com/portland/events/the-portland-mercurys-pizza-week-2026/e222744/';
const PARENT_EID  = 'e222744'; // exclude the pizza-week event itself from sub-event list
const PAGE_DELAY  = 600;       // ms between dish pages
const GEO_DELAY   = 1100;      // Nominatim policy: <= 1 req/sec

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const GEO_UA = 'pdx-food-week-app/1.0 (https://github.com/oberonix/pdx-food-week)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function httpGet(url, ua = UA) {
  const res = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'text/html,*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// ── Geocoding via Nominatim, with in-process cache + rate-limiter ─────────────
// Rate limit enforced inside geocode() so cache hits don't pay the delay.
const geoCache = new Map();
let lastGeoAt = 0;

async function geocode(address) {
  if (!address) return null;
  if (geoCache.has(address)) return geoCache.get(address);

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

// Portland-metro zip → city. Used to normalize a retry variant when the
// full address doesn't geocode, without silently relocating a suburb venue
// into Portland.
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

// Normalize common address quirks Nominatim stumbles on: spelled-out ordinals,
// full street-type words, unit/building suffixes.
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

// Try several geocoding variants before giving up. Each variant is a distinct
// phrasing of the same physical address; we cache per-string so no redundant
// network work.
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

// ── Parse a single dish page ──────────────────────────────────────────────────
function parseDishPage(html, url) {
  const $ = cheerio.load(html);
  const answerList = $('.answer-list').first();
  if (answerList.length === 0) return null; // not a dish event

  const dish = answerList.find('.fs-2').first().text().trim();
  const restaurant = answerList.find('.fs-4').first().text().trim();
  const addressLine = answerList.find('.ff-condensed').first();
  const neighborhood = addressLine.find('.text-muted').first().text().trim().replace(/^\(|\)$/g, '');
  const streetAddress = addressLine.clone().children('.text-muted').remove().end().text().replace(/\s+/g, ' ').trim();

  // Full address with ZIP lives in the Google Maps iframe "q=" param.
  let fullAddress = streetAddress;
  const iframeSrc = $('.map iframe').attr('src') || '';
  const qMatch = iframeSrc.match(/[?&]q=([^&]+)/);
  if (qMatch) {
    try { fullAddress = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')); } catch (e) {}
  }

  // Hero image — the og:image meta tag is the dish's canonical photo.
  // Fall back to the inline .item-image img if og:image is missing.
  const image = $('meta[property="og:image"]').attr('content')
    || $('.item-image img.img-fluid').attr('src')
    || '';

  // Build a map of question → answer from the Q&A block.
  const qa = {};
  answerList.find('.answer').each((_, el) => {
    const q = $(el).find('.question-text').text().trim().replace(/[\s ]+/g, ' ');
    const a = $(el).find('.answer-text').text().trim();
    if (q) qa[q] = a;
  });

  const whatsOnIt = qa["What's On It..."] || qa['What’s On It...'] || '';
  const whatTheySay = qa['What They Say...'] || '';
  const desc = (whatsOnIt || whatTheySay).slice(0, 260);

  // EverOut's "Meat or Vegetarian?" is multi-select: e.g. "Meat, Vegetarian"
  // means a meat pizza with a veg version available. Primary type prefers
  // meat (because a meat pizza IS served), otherwise vegan (most restrictive
  // available), otherwise vegetarian.
  const typeRaw = (qa['Meat or Vegetarian?'] || '').toLowerCase();
  const hasMeat  = /\bmeat\b/.test(typeRaw);
  const hasVegan = /\bvegan\b/.test(typeRaw);
  const hasVeg   = /\bvegetarian\b/.test(typeRaw);
  const type = hasMeat ? 'meat'
    : hasVegan ? 'vegan'
    : hasVeg ? 'vegetarian'
    : 'meat';

  const sliceOrPie = (qa['By the Slice or Whole Pie?'] || '').toLowerCase();
  const wholePie = sliceOrPie.includes('whole') || sliceOrPie.includes('pie');

  const yesno = v => /^yes\b/i.test((v || '').trim());

  if (!dish || !restaurant) return null;

  // Emoji heuristic
  const dishLc = dish.toLowerCase();
  const descLc = desc.toLowerCase();
  const both = dishLc + ' ' + descLc;
  const emoji = type === 'vegan' ? '🌱'
    : type === 'vegetarian' ? '🌿'
    : /bacon/.test(both) ? '🥓'
    : /mushroom/.test(both) ? '🍄'
    : /buffalo|hot chicken/.test(both) ? '🌶️'
    : /breakfast|egg\b/.test(both) ? '🍳'
    : /shrimp|seafood|clam|crab/.test(both) ? '🦐'
    : /truffle/.test(both) ? '🫐'
    : /sausage|pork|lamb/.test(both) ? '🥩'
    : '🍕';

  return {
    dish,
    restaurant,
    neighborhood,
    address: fullAddress || streetAddress,
    streetAddress,
    type,
    glutenFree: yesno(qa['Gluten Free?']),
    wholePie,
    minors: yesno(qa['Allow Minors?']),
    takeout: yesno(qa['Allow Takeout?']),
    desc,
    emoji,
    image,
    url,
  };
}

// ── Find all dish sub-event URLs on the week index page ───────────────────────
async function getDishLinks() {
  console.log('Fetching Pizza Week index…');
  const html = await httpGet(WEEK_URL);
  const re = /\/portland\/events\/[a-z0-9-]+\/e\d+\//gi;
  const set = new Set();
  for (const m of html.matchAll(re)) {
    const p = m[0];
    if (p.includes(PARENT_EID)) continue;
    set.add(BASE_URL + p);
  }
  const links = [...set];
  console.log(`Found ${links.length} dish links.`);
  return links;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dishLinks = await getDishLinks();
  if (dishLinks.length === 0) {
    console.error('No dish links. EverOut markup may have changed.');
    process.exit(1);
  }

  const entries = [];
  let fallbackCount = 0;
  let skipped = 0;

  for (let i = 0; i < dishLinks.length; i++) {
    const url = dishLinks[i];
    console.log(`\n[${i + 1}/${dishLinks.length}] ${url}`);
    let parsed;
    try {
      const html = await httpGet(url);
      parsed = parseDishPage(html, url);
    } catch (e) {
      console.warn(`  ⚠ Fetch/parse failed: ${e.message}`);
      skipped++;
      await sleep(PAGE_DELAY);
      continue;
    }

    if (!parsed) {
      console.warn(`  ⚠ Skipped (no .answer-list): ${url}`);
      skipped++;
      await sleep(PAGE_DELAY);
      continue;
    }

    console.log(`  → ${parsed.dish} @ ${parsed.restaurant} (${parsed.neighborhood || 'no hood'})`);

    const coords = await geocodeWithFallbacks(parsed.address, parsed.streetAddress);
    if (!coords) {
      fallbackCount++;
      console.warn(`  ⚠ No coords: ${parsed.address}`);
    }

    // Stable per-dish ID from the EverOut event number (e.g. .../e234906/).
    // This keeps saved bookmarks / share codes valid across re-scrapes even
    // when the week's dish list reorders or shrinks.
    const eidMatch = parsed.url.match(/\/e(\d+)\//);
    const id = eidMatch ? parseInt(eidMatch[1], 10) : entries.length + 1;

    entries.push({
      id,
      weekId: 'pizza-2026',
      dish: parsed.dish,
      restaurant: parsed.restaurant,
      neighborhood: parsed.neighborhood,
      address: parsed.address,
      lat: coords ? coords.lat : 45.5231,
      lng: coords ? coords.lng : -122.6765,
      type: parsed.type,
      glutenFree: parsed.glutenFree,
      wholePie: parsed.wholePie,
      minors: parsed.minors,
      takeout: parsed.takeout,
      desc: parsed.desc,
      emoji: parsed.emoji,
      image: parsed.image,
      url: parsed.url,
    });

    await sleep(PAGE_DELAY);
  }

  entries.sort((a, b) => a.id - b.id);

  // ── Write output ────────────────────────────────────────────────────────────
  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'pizzaweek2026.js');

  const header = `// Portland Mercury's Pizza Week 2026 — scraped ${new Date().toISOString().slice(0, 10)}
// ${entries.length} locations (skipped: ${skipped}, geocode fallbacks: ${fallbackCount})
// Source: ${WEEK_URL}
`;

  const weeksBlock = `window.FOOD_WEEKS = [
  {
    id: "pizza-2026",
    name: "Pizza Week 2026",
    organizer: "Portland Mercury",
    dates: "April 20–26, 2026",
    priceSlice: "$4",
    pricePie: "$25",
    color: "#C94B2C",
    emoji: "🍕",
    totalLocations: ${entries.length},
    url: "${WEEK_URL}",
  }
];\n`;

  const restaurantsBlock = `window.RESTAURANTS = ${JSON.stringify(entries, null, 2)};\n`;
  fs.writeFileSync(outPath, header + '\n' + weeksBlock + '\n' + restaurantsBlock);

  console.log(`\n✅ Wrote ${entries.length} restaurants to ${outPath}`);
  console.log(`   Skipped: ${skipped}, geocode fallbacks: ${fallbackCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
