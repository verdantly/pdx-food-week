#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import https from 'https';

const CACHE_DIR = path.resolve('data/cache');
const CACHE_FILE = path.join(CACHE_DIR, 'places_cache.json');
const DATA_DIR = path.resolve('data');

const DAY_MAP = {
  sun: 0, sunday: 0, sundays: 0,
  mon: 1, monday: 1, mondays: 1,
  tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
  wed: 3, wednesday: 3, wednesdays: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
  fri: 5, friday: 5, fridays: 5,
  sat: 6, saturday: 6, saturdays: 6
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseClosedDays(text) {
  if (!text) return new Set();
  const normalized = String(text).toLowerCase().replace(/['’]/g, '');
  const closedDays = new Set();

  const closedMatches = normalized.matchAll(/closed\s+(?:on\s+)?([a-z\s,&/\-]+?)(?=[.)]|$)/gi);
  for (const match of closedMatches) {
    const phrase = match[1];
    
    // Check for day ranges like "mon-wed" or "monday through wednesday"
    const rangeMatch = phrase.match(/(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:-|through|to)\s*(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (rangeMatch) {
      const startDay = DAY_MAP[rangeMatch[1]];
      const endDay = DAY_MAP[rangeMatch[2]];
      if (startDay !== undefined && endDay !== undefined) {
        let curr = startDay;
        while (true) {
          closedDays.add(curr);
          if (curr === endDay) break;
          curr = (curr + 1) % 7;
        }
      }
    }

    const words = phrase.split(/[\s,&/]+/);
    for (const word of words) {
      if (DAY_MAP[word] !== undefined) {
        closedDays.add(DAY_MAP[word]);
      }
    }
  }

  return closedDays;
}

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {
      console.warn('Could not parse cache file, starting fresh:', e.message);
    }
  }
  return {};
}

function saveCache(cache) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function getCacheKey(r) {
  return `${r.restaurant || ''}_${r.address || ''}`.trim().toLowerCase();
}

async function fetchGooglePlacesHours(restaurant, address, apiKey) {
  const query = encodeURIComponent(`${restaurant} ${address || ''} Portland OR`);
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id&key=${apiKey}`;

  const placeId = await new Promise((resolve) => {
    https.get(findUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.candidates && json.candidates.length > 0) {
            resolve(json.candidates[0].place_id);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });

  if (!placeId) return null;

  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=opening_hours,utc_offset_minutes&key=${apiKey}`;
  return new Promise((resolve) => {
    https.get(detailsUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.result && json.result.opening_hours) {
            const oh = json.result.opening_hours;
            const periods = oh.periods || [];
            const openDays = [...new Set(periods.map(p => p.open && p.open.day).filter(d => typeof d === 'number'))].sort((a, b) => a - b);
            const weekdayDescriptions = oh.weekday_text || [];
            resolve({
              openDays: openDays.length > 0 ? openDays : [0, 1, 2, 3, 4, 5, 6],
              weekdayDescriptions: weekdayDescriptions.length > 0 ? weekdayDescriptions : undefined,
              periods: periods.length > 0 ? periods : undefined
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function enrichHours() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    console.log('Google Places API key detected. Will attempt to query Google Places API for un-cached items.');
  } else {
    console.log('No Google Places API key detected. Using heuristic hours enrichment from text / closures.');
  }

  const cache = loadCache();
  let cacheUpdated = false;

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('2026.js'));
  console.log(`Found ${files.length} data files to check/enrich.`);

  let totalRestaurants = 0;
  let totalEnriched = 0;
  let closuresFound = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const startMarker = 'const newItems = [';
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.lastIndexOf('];');

    if (startIndex === -1 || endIndex === -1) {
      console.warn(`Could not find newItems array in ${file}, skipping.`);
      continue;
    }

    const arrayCode = content.substring(startIndex + 'const newItems = '.length, endIndex + 1);
    let items;
    try {
      items = vm.runInNewContext('(' + arrayCode + ')');
    } catch (e) {
      console.error(`Failed to evaluate array in ${file}:`, e.message);
      continue;
    }

    let fileChanged = false;

    for (const r of items) {
      totalRestaurants++;
      const cacheKey = getCacheKey(r);

      // Check if item already has hours
      if (r.hours && (r.hours.weekdayDescriptions || r.hours.openDays)) {
        if (!cache[cacheKey]) {
          cache[cacheKey] = r.hours;
          cacheUpdated = true;
        }
        continue;
      }

      // Check cache
      if (cache[cacheKey]) {
        r.hours = cache[cacheKey];
        fileChanged = true;
        totalEnriched++;
        continue;
      }

      // Check Google Places API if key is set
      let googleHours = null;
      if (apiKey) {
        googleHours = await fetchGooglePlacesHours(r.restaurant, r.address, apiKey);
      }

      if (googleHours) {
        r.hours = googleHours;
        cache[cacheKey] = googleHours;
        cacheUpdated = true;
        fileChanged = true;
        totalEnriched++;
      } else {
        // Fallback: heuristic hours from descriptions/notes
        const textToCheck = `${r.desc || ''} ${r.whatsOnIt || ''} ${r.whatTheySay || ''} ${r.notes || ''} ${r.restaurant || ''}`;
        const closed = parseClosedDays(textToCheck);
        
        let openDays = [0, 1, 2, 3, 4, 5, 6];
        let weekdayDescriptions = [];

        if (closed.size > 0) {
          closuresFound++;
          openDays = openDays.filter(d => !closed.has(d));
          weekdayDescriptions = DAY_NAMES.map((name, idx) => {
            if (closed.has(idx)) {
              return `${name}: Closed`;
            }
            return `${name}: Open`;
          });
        } else {
          weekdayDescriptions = DAY_NAMES.map(name => `${name}: Open`);
        }

        const hoursData = {
          openDays,
          weekdayDescriptions
        };

        r.hours = hoursData;
        cache[cacheKey] = hoursData;
        cacheUpdated = true;
        fileChanged = true;
        totalEnriched++;
      }
    }

    if (fileChanged) {
      const formattedArray = 'const newItems = ' + JSON.stringify(items, null, 2) + ';\n';
      const newContent = content.substring(0, startIndex) + formattedArray + content.substring(endIndex + 2).replace(/^\r?\n/, '');
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`Updated ${file} (${items.length} items).`);
    }
  }

  if (cacheUpdated) {
    saveCache(cache);
    console.log(`Saved cache to ${CACHE_FILE} with ${Object.keys(cache).length} entries.`);
  }

  console.log(`\nEnrichment complete:`);
  console.log(`- Total restaurants scanned: ${totalRestaurants}`);
  console.log(`- Restaurants enriched with hours: ${totalEnriched}`);
  console.log(`- Specific day closures detected: ${closuresFound}`);
}

enrichHours().catch(err => {
  console.error('Error enriching hours:', err);
  process.exit(1);
});
