import * as cheerio from 'cheerio';

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
