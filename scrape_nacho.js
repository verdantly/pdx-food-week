/**
 * Dependency-free EverOut Scraper
 * Does not rely on Cheerio. Uses native regex and string matching to parse HTML.
 * Can be adapted to scrape other EverOut food weeks by changing the URLs and regexes.
 */
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://everout.com';
const WEEK_URL = 'https://everout.com/portland/events/the-portland-mercurys-nacho-week-2026/e222747/';
const PARENT_EID = 'e222747';
const PAGE_DELAY = 600;
const GEO_DELAY = 1100;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const GEO_UA = 'pdx-food-week-app/1.0';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function httpGet(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

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
    const hit = data && data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    geoCache.set(address, hit);
    return hit;
  } catch (e) {
    lastGeoAt = Date.now();
    geoCache.set(address, null);
    return null;
  }
}

function parseDishPage(html, url) {
  const qa = {};
  const regex = /<div class="question-text[^>]*>([\s\S]*?)<\/div>\s*<div class="answer-text[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const q = match[1].trim().replace(/<[^>]+>/g, '');
    const a = match[2].trim().replace(/<[^>]+>/g, '');
    qa[q] = a;
  }

  const dishMatch = html.match(/<h1 class="mb-0">([\s\S]*?)<\/h1>/i);
  const dish = dishMatch ? dishMatch[1].trim() : null;

  const venueMatch = html.match(/<a href="[^"]*\/locations\/[a-z0-9-]+\/l\d+\/">([\s\S]*?)<\/a>/i);
  const restaurant = venueMatch ? venueMatch[1].trim() : null;

  const neighborhoodMatch = html.match(/<span class="text-muted">([\s\S]*?)<\/span>/i);
  const neighborhood = neighborhoodMatch ? neighborhoodMatch[1].trim().replace(/^\(|\)$/g, '') : '';

  let address = '';
  const iframeMatch = html.match(/src="https:\/\/www.google.com\/maps\/embed\/v1\/place\?key=[^&]*&amp;q=([^"]*)"/i);
  if (iframeMatch) {
    address = decodeURIComponent(iframeMatch[1].replace(/\+/g, ' '));
  } else {
    // try to get from address block
    const addrBlockMatch = html.match(/<div class="mb-2">[\s\S]*?<a href="[^"]*\/locations\/[a-z0-9-]+\/l\d+\/">[\s\S]*?<\/a>([\s\S]*?)<a/i);
    if (addrBlockMatch) {
      address = addrBlockMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const image = imgMatch ? imgMatch[1] : '';

  let desc = qa["What's On It..."] || qa['What’s On It...'] || qa['What They Say...'] || '';
  if (!desc) {
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    desc = descMatch ? descMatch[1] : '';
  }

  const typeRaw = (qa['Meat or Vegetarian?'] || '').toLowerCase();
  const hasVegan = /\bvegan\b/.test(typeRaw);
  const hasVeg = /\bvegetarian\b/.test(typeRaw);
  const type = hasVegan ? 'vegan' : hasVeg ? 'vegetarian' : 'meat';
  
  const glutenFree = /^yes\b/i.test((qa['Gluten Free?'] || '').trim());
  const takeout = /^yes\b/i.test((qa['Takeout?'] || '').trim());
  const minors = /^yes\b/i.test((qa['Minors Allowed?'] || qa['Family Friendly?'] || '').trim());

  if (!dish || !restaurant) return null;

  const both = (dish + ' ' + desc).toLowerCase();
  const emoji = type === 'vegan' ? '🌱'
    : type === 'vegetarian' ? '🌿'
    : /cheese|queso/.test(both) ? '🧀'
    : /chicken/.test(both) ? '🍗'
    : /pork|carnitas/.test(both) ? '🐖'
    : /beef|steak/.test(both) ? '🥩'
    : /shrimp|seafood/.test(both) ? '🦐'
    : '🌮';

  return { dish, restaurant, neighborhood, address, type, glutenFree, takeout, minors, desc: desc.replace(/\s+/g, ' ').slice(0, 200), emoji, image, url };
}

async function main() {
  console.log('Fetching index…');
  const html = await httpGet(WEEK_URL);
  const re = /\/portland\/events\/[a-z0-9-]+\/e\d+\//gi;
  const links = [...new Set([...html.matchAll(re)].map(m => BASE_URL + m[0]).filter(url => !url.includes(PARENT_EID)))];
  console.log(`Found ${links.length} links.`);

  if (links.length === 0) process.exit(1);

  const entries = [];
  for (let i = 0; i < links.length; i++) {
    const url = links[i];
    console.log(`[${i + 1}/${links.length}] ${url}`);
    try {
      const pageHtml = await httpGet(url);
      const parsed = parseDishPage(pageHtml, url);
      if (parsed) {
        console.log(` -> ${parsed.dish} @ ${parsed.restaurant}`);
        const coords = await geocode(parsed.address);
        const idMatch = url.match(/\/e(\d+)\//);
        entries.push({
          id: idMatch ? parseInt(idMatch[1], 10) : i + 1,
          weekId: 'nacho-2026',
          ...parsed,
          lat: coords ? coords.lat : 45.5231,
          lng: coords ? coords.lng : -122.6765,
        });
      }
    } catch (e) {
      console.warn('Failed:', e.message);
    }
    await sleep(PAGE_DELAY);
  }

  const outPath = path.join(process.cwd(), 'data', 'nachoweek2026.js');
  const header = `// Portland Mercury's Nacho Week 2026\n`;
  const weeksBlock = `window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "nacho-2026",
  name: "Nacho Week 2026",
  organizer: "Portland Mercury",
    dates: "June 22–28, 2026",
    pricePills: ["$10 dish"],
    color: "#D97B29",
    emoji: "🧀",
    totalLocations: ${entries.length},
    url: "${WEEK_URL}",
});\n`;
  const restBlock = `window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  newItems.forEach(item => {
    if (!window.RESTAURANTS.some(r => r.id === item.id)) {
      window.RESTAURANTS.push(item);
    }
  });
})();\n`;

  fs.writeFileSync(outPath, header + weeksBlock + restBlock);
  console.log('Done!');
}
main();
