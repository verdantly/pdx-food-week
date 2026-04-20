#!/usr/bin/env node
/**
 * PDX Food Week Scraper
 * Scrapes the Portland Mercury's Pizza Week listings from EverOut.
 *
 * Usage:
 *   npm install node-fetch cheerio
 *   node scrape.js
 *
 * Output: data/pizzaweek2026.js  (ready to drop into the app)
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://everout.com';
const WEEK_URL = 'https://everout.com/portland/events/the-portland-mercurys-pizza-week-2026/e222744/';
const DELAY_MS = 800; // be polite — don't hammer the server

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Free geocoding via nominatim (no API key needed) ──────────────────────────
async function geocode(address) {
  try {
    const q = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'pdx-food-week-app/1.0 (personal project)' }
    });
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.warn(`  ⚠ Geocode failed for: ${address}`);
  }
  return { lat: 45.5231, lng: -122.6765 }; // fallback: downtown Portland
}

// ── Scrape individual dish page ───────────────────────────────────────────────
async function scrapeDishPage(url, id) {
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; pdx-food-week-scraper/1.0)',
      'Accept': 'text/html'
    }
  });

  if (!res.ok) {
    console.warn(`  ⚠ HTTP ${res.status} for ${url}`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Dish name — usually in <h1> or the page title
  const dish = $('h1').first().text().trim()
    || $('title').text().split('|')[0].trim()
    || 'Unknown Dish';

  // Restaurant name — in breadcrumb or event subtitle
  const restaurant = $('.event-venue').first().text().trim()
    || $('[class*="venue"]').first().text().trim()
    || $('h2').first().text().trim()
    || 'Unknown Restaurant';

  // Neighborhood — often in breadcrumb or subtitle
  const neighborhood = $('[class*="neighborhood"]').first().text().trim()
    || $('[class*="location"]').first().text().trim()
    || '';

  // Description
  const desc = $('[class*="description"] p').first().text().trim()
    || $('meta[name="description"]').attr('content')?.trim()
    || '';

  // Address — look for structured address or map link
  let address = $('[class*="address"]').first().text().trim()
    || $('address').first().text().trim()
    || '';

  // Dietary tags — EverOut uses filter labels
  const pageText = $('body').text().toLowerCase();
  const type = pageText.includes('vegan') ? 'vegan'
    : pageText.includes('vegetarian') ? 'vegetarian'
    : 'meat';
  const glutenFree = pageText.includes('gluten free') || pageText.includes('gluten-free');
  const wholePie = pageText.includes('whole pie') || pageText.includes('$25');
  const minors = !pageText.includes('21+') && !pageText.includes('21 and over');
  const takeout = pageText.includes('takeout') || pageText.includes('take out') || pageText.includes('to-go');

  // Pick an emoji based on type/content
  const emoji = type === 'vegan' ? '🌱'
    : type === 'vegetarian' ? '🌿'
    : pageText.includes('bacon') ? '🥓'
    : pageText.includes('mushroom') ? '🍄'
    : pageText.includes('buffalo') || pageText.includes('chicken') ? '🌶️'
    : pageText.includes('egg') ? '🍳'
    : pageText.includes('seafood') || pageText.includes('shrimp') ? '🦐'
    : '🍕';

  // Geocode the address
  let coords = { lat: 45.5231, lng: -122.6765 };
  if (address) {
    await sleep(1100); // Nominatim rate limit: 1 req/sec
    coords = await geocode(address.includes('Portland') ? address : `${address}, Portland, OR`);
  }

  return {
    id,
    weekId: 'pizza-2026',
    dish,
    restaurant: restaurant.replace(/\s*\(.*?\)\s*/, '').trim(), // strip "(neighborhood)" from name if present
    neighborhood: neighborhood || extractNeighborhood(restaurant),
    address: address || '',
    lat: coords.lat,
    lng: coords.lng,
    type,
    glutenFree,
    wholePie,
    minors,
    takeout,
    desc: desc.slice(0, 200),
    emoji,
    url,
  };
}

// EverOut sometimes puts neighborhood in parens after restaurant name
function extractNeighborhood(restaurantText) {
  const match = restaurantText.match(/\(([^)]+)\)/);
  return match ? match[1] : '';
}

// ── Scrape main week page for dish links ──────────────────────────────────────
async function scrapeWeekPage() {
  console.log('Fetching Pizza Week index page…');
  const res = await fetch(WEEK_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; pdx-food-week-scraper/1.0)',
      'Accept': 'text/html'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Collect all dish sub-event links
  const links = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/portland/events/') && !href.includes('pizza-week-2026')) {
      const full = href.startsWith('http') ? href : BASE_URL + href;
      links.add(full);
    }
  });

  console.log(`Found ${links.size} dish links on the index page.`);
  return [...links];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dishLinks = await scrapeWeekPage();

  if (dishLinks.length === 0) {
    console.error('No dish links found. EverOut may have changed their HTML structure.');
    console.error('Try opening the page in a browser and inspecting the dish card links manually.');
    process.exit(1);
  }

  const restaurants = [];
  for (let i = 0; i < dishLinks.length; i++) {
    const url = dishLinks[i];
    console.log(`\n[${i + 1}/${dishLinks.length}] Scraping dish page…`);
    const dish = await scrapeDishPage(url, i + 1);
    if (dish) restaurants.push(dish);
    await sleep(DELAY_MS);
  }

  // ── Write output file ───────────────────────────────────────────────────────
  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'pizzaweek2026.js');

  const header = `// Portland Mercury's Pizza Week 2026 — scraped ${new Date().toISOString().slice(0, 10)}
// ${restaurants.length} locations scraped from EverOut
// Review and clean up addresses, descriptions, and coordinates before publishing.
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
    totalLocations: ${restaurants.length},
    url: "${WEEK_URL}",
  }
];\n`;

  const restaurantsBlock = `window.RESTAURANTS = ${JSON.stringify(restaurants, null, 2)};\n`;

  fs.writeFileSync(outPath, header + '\n' + weeksBlock + '\n' + restaurantsBlock);

  console.log(`\n✅ Done! Wrote ${restaurants.length} restaurants to ${outPath}`);
  console.log('   Drop this file into your pdx-food-week/data/ folder and reload the app.');
  console.log('\n   ⚠ Review the file — check for:');
  console.log('     - Missing or wrong addresses (fill in manually if needed)');
  console.log('     - Wrong dietary type detection (meat/vegetarian/vegan)');
  console.log('     - Geocoding misses (lat/lng defaulted to downtown Portland: 45.5231, -122.6765)');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
