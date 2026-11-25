import fs from 'fs';
import path from 'path';
import { decodeHTML, fetchHtml, loadPlacesCache, lookupOperatingHours } from './scraper_utils.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENT_URL = 'https://everout.com/portland/events/the-portland-mercurys-holiday-drink-week-2026/e222752/';

function extractText(html, regex) {
  const m = html.match(regex);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

const GEO_UA = 'pdx-food-week-app/1.0';
const GEO_DELAY = 1100;
const geoCache = new Map();
let lastGeoAt = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    const hit = data && data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    geoCache.set(address, hit);
    return hit;
  } catch (e) {
    console.error(`Geocode error for ${address}:`, e.message);
    return null;
  }
}

async function scrapeDish(url, cacheMap, existingMap, placesCache) {
  if (cacheMap.has(url)) return cacheMap.get(url);
  const html = await fetchHtml(url);

  const dish = extractText(html, /<div class="text-center fs-2 fw-bold m-0 p-0">([\s\S]*?)<\/div>/);
  const restaurant = extractText(html, /<p class="fs-4 mb-1">([\s\S]*?)<\/p>/);
  const addressMatch = html.match(/<p class="mb-0 ff-condensed">([\s\S]*?)<span/);
  let address = addressMatch ? addressMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
  if (!address) {
    const addressMatchAlt = html.match(/<p class="mb-0 ff-condensed">([\s\S]*?)<\/p>/);
    address = addressMatchAlt ? addressMatchAlt[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null;
  }

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

  if (!dish || !restaurant) return null;

  let finalAddress = address;
  if (finalAddress && !finalAddress.includes('Portland') && !/\bOR\b/.test(finalAddress)) {
    finalAddress += ', Portland, OR';
  }

  const isAlcoholFree = /^yes\b/i.test((qa['Alcohol Free?'] || qa['Non-Alcoholic?'] || qa['Zero Proof?'] || '').trim());
  const minors = /(yes|allowed|ok|pizzeria)/i.test((qa['Allow Minors?'] || qa['Minors Allowed?'] || '').trim());
  const takeout = /(yes|allowed|ok)/i.test((qa['Allow Takeout?'] || qa['Takeout?'] || '').trim());
  const description = qa['What They Say...'] || qa['What They Say'] || qa['Description'] || '';
  const ingredients = qa["What's In It?"] || qa["What's In It"] || qa['Ingredients'] || '';

  const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const image = imgMatch ? imgMatch[1] : '';

  let restaurantUrl = '';
  const locMatch = html.match(/<a href="([^"]+\/locations\/[^"]+)">/);
  if (locMatch) {
    try {
      const locHtml = await fetchHtml(locMatch[1]);
      const webMatch = locHtml.match(/<div class="row website">[\s\S]*?<a href="([^"]+)"[^>]*>website<\/a>/i);
      if (webMatch) restaurantUrl = webMatch[1];
    } catch (e) {}
  }

  const id = parseInt(url.match(/\/e(\d+)\/?/)[1], 10);

  let isNew = false;
  if (existingMap.has(id)) {
    isNew = !!existingMap.get(id).isNew;
  } else if (existingMap.size > 0) {
    isNew = true;
  }

  const decodedRestaurant = decodeHTML(restaurant);
  const existing = existingMap.get(id);
  let coords = (existing && existing.lat && existing.lng)
    ? { lat: existing.lat, lng: existing.lng }
    : await geocode(finalAddress);
  if (!coords && finalAddress) {
    const simplified = finalAddress.replace(/\b(?:STE|SUITE|UNIT|#)\.?\s*[A-Z0-9-]+/gi, '').replace(/\s+/g, ' ').trim();
    if (simplified !== finalAddress) {
      coords = await geocode(simplified);
    }
  }

  const hours = lookupOperatingHours(decodedRestaurant, finalAddress, placesCache, existingMap);

  const parsed = {
    id,
    weekId: 'holiday-drink-2026',
    isNew,
    restaurant: decodedRestaurant,
    dish: decodeHTML(dish),
    address: finalAddress,
    lat: coords ? coords.lat : undefined,
    lng: coords ? coords.lng : undefined,
    desc: description || ingredients,
    whatsOnIt: ingredients,
    whatTheySay: description,
    alcoholFree: isAlcoholFree,
    minors,
    takeout,
    emoji: '🍸',
    image,
    restaurantUrl,
    url,
    hours
  };

  cacheMap.set(url, parsed);
  return parsed;
}

async function main() {
  const OUT_FILE = path.resolve(__dirname, '../data/holidaydrink2026.js');
  let existingListings = [];
  try {
    const raw = fs.readFileSync(OUT_FILE, 'utf8');
    const m = raw.match(/const newItems = (\[.*\]);\s*window\.RESTAURANTS\.push/s);
    if (m) {
      existingListings = JSON.parse(m[1]);
    }
  } catch (e) {}

  const existingMap = new Map();
  for (const l of existingListings) existingMap.set(l.id, l);

  const placesCache = loadPlacesCache();
  const indexHtml = await fetchHtml(EVENT_URL);
  const re = /\/portland\/events\/[a-z0-9-]+\/e\d+\//gi;
  let links = [...new Set([...indexHtml.matchAll(re)].map(m => 'https://everout.com' + m[0]))];
  links = links.filter(l => !l.includes('holiday-drink-week-2026') && !l.includes('holiday-drink-week-2025'));

  console.log('Found', links.length, 'links.');

  const entries = [];
  const cacheMap = new Map();

  for (let i = 0; i < links.length; i++) {
    const url = links[i];
    try {
      const parsed = await scrapeDish(url, cacheMap, existingMap, placesCache);
      if (parsed) {
        entries.push(parsed);
        console.log(`[${i + 1}/${links.length}] ${parsed.dish} @ ${parsed.restaurant}`);
      } else {
        console.log(`[${i + 1}/${links.length}] Skipped ${url}`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${links.length}] Error ${url}: ${err.message}`);
    }
  }

  const jsContent = `// Auto-generated by scrape_holiday_drinks.js
window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "holiday-drink-2026",
  name: "Holiday Drink Week 2026",
  organizer: "Portland Mercury",
  startDate: "2026-12-07",
  endDate: "2026-12-13",
  dates: "December 7–13, 2026",
  pricePills: ["$10 holiday drinks"],
  color: "#C2185B",
  emoji: "🍸",
  totalLocations: ${entries.length},
  url: "${EVENT_URL}"
});
window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  window.RESTAURANTS.push(...newItems);
})();
`;
  fs.writeFileSync(OUT_FILE, jsContent, 'utf8');
  console.log(`Done! Wrote ${entries.length} items to ${OUT_FILE}`);
}

main();
