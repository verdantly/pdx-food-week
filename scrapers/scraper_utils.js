import * as cheerio from 'cheerio';
import fs from 'fs';

/**
 * Robustly decodes HTML entities (e.g. &amp;, &#39;, &rsquo;)
 * using cheerio's built-in parser.
 */
export function decodeHTML(str) {
  if (!str) return '';
  // Load the string into a div so cheerio parses entities, then extract text
  return cheerio.load(`<div>${str}</div>`)('div').text();
}

export function isAllCaps(str) {
  const letters = str.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return (upper / letters.length) > 0.75;
}

export function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bBbq\b/g, 'BBQ')
    .replace(/\bGf\b/g, 'GF');
}

export function toSentenceCase(str) {
  if (!str) return '';
  if (!isAllCaps(str)) return str;
  return str.toLowerCase().split('. ').map(s => {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }).join('. ');
}

export function cleanName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses coordinates from a string like "-122.658,45.523,0"
 * Returns { lat, lng } or null
 */
export function parseCoordinates(coordsText) {
  if (!coordsText) return null;
  const parts = coordsText.split(',');
  if (parts.length < 2) return null;
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0'
];

export async function fetchHtml(url) {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
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

/**
 * Loads existing items from a generated food week JS file (e.g. data/burgerweek2026.js).
 * Returns a Map keyed by item URL and string ID.
 */
export function loadExistingData(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const jsonMatch = content.match(/const newItems = (\[[\s\S]*?\]);/);
    if (jsonMatch) {
      const items = JSON.parse(jsonMatch[1]);
      const map = new Map();
      items.forEach(item => {
        if (item.url) map.set(item.url.trim(), item);
        if (item.id !== undefined && item.id !== null) map.set(String(item.id), item);
      });
      return map;
    }
  } catch (e) {
    console.warn(`  ⚠ Could not parse existing data from ${filePath}: ${e.message}`);
  }
  return new Map();
}
