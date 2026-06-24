import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function httpGet(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

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

function decodeHtml(html) {
  return html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
}

async function scrapeDish(url, cacheMap, existingMap) {
  if (cacheMap.has(url)) return cacheMap.get(url);
  const html = await httpGet(url);

  // Name and Location
  let dish = extractText(html, /<div class="text-center fs-2 fw-bold m-0 p-0">([\s\S]*?)<\/div>/);
  let restaurant = extractText(html, /<p class="fs-4 mb-1">([\s\S]*?)<\/p>/);
  let addressMatch = html.match(/<p class="mb-0 ff-condensed">([\s\S]*?)<span/);
  let address = addressMatch ? addressMatch[1].trim() : null;
  if (!address) {
    const addressMatchAlt = html.match(/<p class="mb-0 ff-condensed">([\s\S]*?)<\/p>/);
    address = addressMatchAlt ? addressMatchAlt[1].trim() : null;
  }

  // QA extraction
  const qa = {};
  const sectionMatch = html.match(/class=\"answer-list[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  if (sectionMatch) {
    const section = sectionMatch[1];
    const regex = /<div class=\"question-text[^>]*>([\s\S]*?)<\/div>\s*<div class=\"answer-text[^>]*>([\s\S]*?)<\/div>/g;
    let m;
    while ((m = regex.exec(section)) !== null) {
      const key = decodeHtml(m[1].replace(/<[^>]+>/g, '').trim());
      const val = decodeHtml(m[2].replace(/<[^>]+>/g, '').trim());
      if (key && val) qa[key] = val;
    }
  }

  if (!dish || !restaurant) return null;

  let finalAddress = address;
  if (finalAddress && !finalAddress.includes('Portland')) {
    finalAddress += ', Portland, OR';
  }

  // Booleans
  const isAlcoholFree = /^yes\b/i.test((qa['Alcohol Free?'] || qa['Non-Alcoholic?'] || qa['Zero Proof?'] || '').trim());
  const minors = /(yes|allowed|ok|pizzeria)/i.test((qa['Allow Minors?'] || qa['Minors Allowed?'] || '').trim());
  const takeout = /(yes|allowed|ok)/i.test((qa['Allow Takeout?'] || qa['Takeout?'] || '').trim());
  const description = qa["What They Say..."] || qa["What They Say"] || qa["Description"] || "";
  const ingredients = qa["What's In It?"] || qa["What's In It"] || qa["Ingredients"] || "";

  const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const image = imgMatch ? imgMatch[1] : '';

  let restaurantUrl = '';
  const locMatch = html.match(/<a href="([^"]+\/locations\/[^"]+)">/);
  if (locMatch) {
    try {
      const locHtml = await httpGet(locMatch[1]);
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

  const coords = await geocode(finalAddress);

  const parsed = {
    id,
    weekId: 'slushie-2026',
    isNew,
    restaurant: decodeHtml(restaurant),
    dish: decodeHtml(dish),
    address: finalAddress,
    lat: coords ? coords.lat : undefined,
    lng: coords ? coords.lng : undefined,
    desc: description,
    whatsOnIt: ingredients,
    whatTheySay: description,
    alcoholFree: isAlcoholFree,
    minors: minors,
    takeout: takeout,
    image,
    restaurantUrl,
    url
  };

  cacheMap.set(url, parsed);
  return parsed;
}

async function main() {
  const OUT_FILE = path.join(__dirname, 'data', 'slushies2026.js');
  let existingListings = [];
  try {
    const raw = fs.readFileSync(OUT_FILE, 'utf8');
    const m = raw.match(/const newItems = (\[.*\]);\s*window\.RESTAURANTS\.push/s);
    if (m) {
      existingListings = JSON.parse(m[1]);
    }
  } catch(e) {}
  
  const existingMap = new Map();
  for (const l of existingListings) existingMap.set(l.id, l);

  const indexHtml = await httpGet('https://everout.com/portland/events/the-portland-mercurys-summer-of-slushies-2026/e222749/');
  const re = /\/portland\/events\/[a-z0-9-]+\/e\d+\//gi;
  let links = [...new Set([...indexHtml.matchAll(re)].map(m => 'https://everout.com' + m[0]))];
  links = links.filter(l => !l.includes('summer-of-slushies-2026'));

  console.log('Found', links.length, 'links.');

  const entries = [];
  const cacheMap = new Map();

  for (let i = 0; i < links.length; i++) {
    const url = links[i];
    try {
      const parsed = await scrapeDish(url, cacheMap, existingMap);
      if (parsed) {
        entries.push(parsed);
        console.log(`[${i+1}/${links.length}] ${parsed.dish} @ ${parsed.restaurant}`);
      } else {
        console.log(`[${i+1}/${links.length}] Skipped ${url}`);
      }
    } catch(err) {
      console.log(`[${i+1}/${links.length}] Error ${url}: ${err.message}`);
    }
  }

  const jsContent = `// Auto-generated by scrape_slushies.js
window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "slushie-2026",
  name: "Summer of Slushies 2026",
  organizer: "Portland Mercury",
  startDate: "2026-07-01",
  dates: "July 2026",
  pricePills: ["$10 Slushies"],
  color: "#E25A97",
  emoji: "🥤",
  totalLocations: ${entries.length},
  url: "https://everout.com/portland/events/the-portland-mercurys-summer-of-slushies-2026/e222749/",
});
window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  window.RESTAURANTS.push(...newItems);
})();
`;
  fs.writeFileSync(OUT_FILE, jsContent);
  console.log('Done!');
}
main();
