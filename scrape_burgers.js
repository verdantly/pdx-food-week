#!/usr/bin/env node
/**
 * PDX Food Week Scraper — structured extraction from EverOut Burger Week dish pages.
 *
 * Usage:
 *   node scrape_burgers.js
 *
 * Output: data/burgerweek2026.js (overwritten)
 */

import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decodeHTML, fetchHtml } from './scraper_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL    = 'https://everout.com';
const WEEK_URL    = 'https://everout.com/portland/events/the-portland-mercurys-burger-week-2026/e222750/';
const PARENT_EID  = 'e222750'; // exclude the burger-week event itself from sub-event list
const PAGE_DELAY  = 600;       // ms between dish pages
const GEO_DELAY   = 1100;      // Nominatim policy: <= 1 req/sec

const GEO_UA = 'pdx-food-week-app/1.0 (https://github.com/verdantly/pdx-food-week)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Geocoding via Nominatim, with in-process cache + rate-limiter ─────────────
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

  const whatsOnIt = qa["What's On It..."] || qa['What’s On It...'] || '';
  const whatTheySay = qa['What They Say...'] || '';
  const desc = decodeHTML((whatsOnIt || whatTheySay || descText));

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

  const yesno = v => /^yes\b/i.test((v || '').trim());

  const minors = /(yes|allowed|ok|restaurant|pub|bar)/i.test((qa['Allow Minors?'] || qa['Minors Allowed?'] || '').trim());
  const takeout = /(yes|allowed|ok)/i.test((qa['Allow Takeout?'] || qa['Takeout?'] || '').trim());

  if (!dish || !restaurant) return null;

  // Emoji heuristic for burgers
  const dishLc = dish.toLowerCase();
  const descLc = desc.toLowerCase();
  const both = dishLc + ' ' + descLc;
  const emoji = type === 'vegan' ? '🌱'
    : type === 'vegetarian' ? '🌿'
    : /bacon/.test(both) ? '🥓'
    : /cheese|cheddar|brie|gouda|swiss|blue/.test(both) ? '🧀'
    : /mushroom/.test(both) ? '🍄'
    : /jalapeño|jalapeno|spicy|chili|habanero/.test(both) ? '🌶️'
    : /pork|bbq|pulled/.test(both) ? '🥩'
    : '🍔';

  return {
    dish,
    restaurant,
    neighborhood,
    address: fullAddress || streetAddress,
    streetAddress,
    type,
    vegOption,
    veganOption,
    glutenFree: yesno(qa['Gluten Free?']),
    minors,
    takeout,
    desc: desc.replace(/\s+/g, ' ').slice(0, 300),
    emoji,
    image,
    url,
  };
}

// ── Find all dish sub-event URLs on the week index page ───────────────────────
async function getDishLinks() {
  console.log('Fetching Burger Week index…');
  const html = await fetchHtml(WEEK_URL);
  const re = /\/portland\/events\/[a-z0-9-]+\/e\d+\//gi;
  const set = new Set();
  for (const m of html.matchAll(re)) {
    const p = m[0];
    if (p.includes(PARENT_EID)) continue;
    set.add(BASE_URL + p);
  }
  const links = [...set];
  console.log(`Found ${links.length} potential links.`);
  return links;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dishLinks = await getDishLinks();
  if (dishLinks.length === 0) {
    console.error('No dish links found.');
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

    console.log(`  → ${parsed.dish} @ ${parsed.restaurant} (${parsed.neighborhood || 'no hood'})`);

    const coords = await geocodeWithFallbacks(parsed.address, parsed.streetAddress);
    if (!coords) {
      fallbackCount++;
      console.warn(`  ⚠ No coords: ${parsed.address}`);
    }

    const eidMatch = parsed.url.match(/\/e(\d+)\//);
    const id = eidMatch ? parseInt(eidMatch[1], 10) : entries.length + 1;

    entries.push({
      id,
      weekId: 'burger-2026',
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
      desc: parsed.desc,
      emoji: parsed.emoji,
      image: parsed.image,
      url: parsed.url,
    });

    await sleep(PAGE_DELAY);
  }

  entries.sort((a, b) => a.id - b.id);

  const outDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'burgerweek2026.js');

  const header = `// Portland Mercury's Burger Week 2026 — scraped ${new Date().toISOString().slice(0, 10)}
// ${entries.length} locations (skipped: ${skipped}, geocode fallbacks: ${fallbackCount})
// Source: ${WEEK_URL}
`;

  const weeksBlock = `window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push(
  {
    id: "burger-2026",
    name: "Burger Week 2026",
    organizer: "Portland Mercury",
    dates: "August 10–16, 2026",
    startDate: "2026-08-10",
    endDate: "2026-08-16",
    pricePills: ["$10 burger"],
    color: "#E65100",
    emoji: "🍔",
    totalLocations: ${entries.length},
    url: "${WEEK_URL}",
  }
);\n`;

  const restaurantsBlock = `window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  newItems.forEach(item => {
    if (!window.RESTAURANTS.some(r => r.id === item.id)) {
      window.RESTAURANTS.push(item);
    }
  });
})();\n`;

  fs.writeFileSync(outPath, header + '\n' + weeksBlock + '\n' + restaurantsBlock);

  console.log(`\n✅ Wrote ${entries.length} restaurants to ${outPath}`);
  console.log(`   Skipped: ${skipped}, geocode fallbacks: ${fallbackCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
