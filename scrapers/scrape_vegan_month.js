import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { decodeHTML, toTitleCase, toSentenceCase, updateMetaTotalLocations, loadExistingData, loadPlacesCache, lookupOperatingHours } from './scraper_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.resolve(__dirname, '../data/geocode_cache.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/veganmonth2026.js');
const KML_URL = 'https://www.google.com/maps/d/kml?mid=1G0LHFLWs9F7nt2avFSxDTCWYdM5lTtI&forcekml=1';
const LOCATIONS_URL = 'https://veganizerpdx.com/world-vegan-month/';

let geocodeCache = {};
if (fs.existsSync(CACHE_PATH)) {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf8').replace(/^\uFEFF/, '');
    geocodeCache = JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load geocode cache:', e.message);
  }
}

function saveGeocodeCache() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(geocodeCache, null, 2), 'utf8');
}

// Map each unique location key to physical details
export const VENUE_LOCATIONS = {
  'adelleda': {
    restaurant: 'Adelleda',
    address: '103 NE Grand Ave, Portland, OR 97232',
    streetAddress: '103 NE Grand Ave',
    neighborhood: 'Kerns',
    lat: 45.523778,
    lng: -122.660909
  },
  'blackwater': {
    restaurant: 'Black Water',
    address: '5115 NE Sandy Blvd, Portland, OR 97213',
    streetAddress: '5115 NE Sandy Blvd',
    neighborhood: 'Hollywood',
    lat: 45.5401251,
    lng: -122.6105869
  },
  'boxcarpizza': {
    restaurant: 'Boxcar Pizza',
    address: '2701 NE Sandy Blvd, Portland, OR 97232',
    streetAddress: '2701 NE Sandy Blvd',
    neighborhood: 'Kerns',
    lat: 45.5289578,
    lng: -122.6381947
  },
  'buddys': {
    restaurant: "Buddy's",
    address: '304 SE 2nd Ave, Portland, OR 97214',
    streetAddress: '304 SE 2nd Ave',
    neighborhood: 'Central Eastside',
    lat: 45.5205175,
    lng: -122.6635578,
    note: "Also available at Black Water, Boxcar Pizza, Theoberto's, and The Wagon"
  },
  'carinasbakery': {
    restaurant: "Carina's Bakery",
    address: '4725 SW Lombard Ave #108, Beaverton, OR 97005',
    streetAddress: '4725 SW Lombard Ave #108',
    neighborhood: 'Beaverton',
    lat: 45.4857434,
    lng: -122.8008819
  },
  'catscratchcoopbakery': {
    restaurant: 'Catscratch Co-op Bakery',
    address: '2816 NE Halsey St, Portland, OR 97232',
    streetAddress: '2816 NE Halsey St',
    neighborhood: 'Sullivan\'s Gulch',
    lat: 45.5335973,
    lng: -122.6365731
  },
  'cooperscoopcafe': {
    restaurant: "Cooper's Co-op Cafe",
    address: '2420 SE Belmont St, Portland, OR 97214',
    streetAddress: '2420 SE Belmont St',
    neighborhood: 'Buckman',
    lat: 45.5161949,
    lng: -122.6410021
  },
  'culturedkindness': {
    restaurant: 'Cultured Kindness',
    address: '1217 SE Stark St, Portland, OR 97214',
    streetAddress: '1217 SE Stark St',
    neighborhood: 'Buckman',
    lat: 45.519498,
    lng: -122.6532693
  },
  'dingersdeli': {
    restaurant: "Dinger's Deli at Wayfinder Beer",
    address: '304 SE 2nd Ave, Portland, OR 97214',
    streetAddress: '304 SE 2nd Ave',
    neighborhood: 'Central Eastside',
    lat: 45.5205175,
    lng: -122.6635578
  },
  'doedonuts': {
    restaurant: 'Doe Donuts + Ice Cream',
    address: '4110 NE Sandy Blvd, Portland, OR 97212',
    streetAddress: '4110 NE Sandy Blvd',
    neighborhood: 'Hollywood',
    lat: 45.5352857,
    lng: -122.6211591
  },
  'epif': {
    restaurant: 'Epif',
    address: '404 NE 28th Ave, Portland, OR 97232',
    streetAddress: '404 NE 28th Ave',
    neighborhood: 'Kerns',
    lat: 45.5259152,
    lng: -122.6369865
  },
  'exquisitecreatures': {
    restaurant: 'Exquisite Creatures',
    address: '537 SE Ash St #108, Portland, OR 97214',
    streetAddress: '537 SE Ash St #108',
    neighborhood: 'Central Eastside',
    lat: 45.5215978,
    lng: -122.6601769
  },
  'feral': {
    restaurant: 'Feral',
    address: '1640 NE Killingsworth St, Portland, OR 97211',
    streetAddress: '1640 NE Killingsworth St',
    neighborhood: 'Vernon',
    lat: 45.5626288,
    lng: -122.6481932
  },
  'fortune': {
    restaurant: 'Fortune',
    address: '614 SW 11th Ave, Portland, OR 97205',
    streetAddress: '614 SW 11th Ave',
    neighborhood: 'Downtown',
    lat: 45.5205139,
    lng: -122.6828188
  },
  'harlowdivision': {
    restaurant: 'Harlow (Division)',
    address: '3715 SE Division St, Portland, OR 97202',
    streetAddress: '3715 SE Division St',
    neighborhood: 'Richmond',
    lat: 45.5049376,
    lng: -122.6252431
  },
  'harlownw23rd': {
    restaurant: 'Harlow (NW 23rd)',
    address: '505 NW 23rd Ave, Portland, OR 97210',
    streetAddress: '505 NW 23rd Ave',
    neighborhood: 'Nob Hill',
    lat: 45.5263452,
    lng: -122.6986439
  },
  'icequeen': {
    restaurant: 'Ice Queen',
    address: '2012 SE 11th Ave, Portland, OR 97214',
    streetAddress: '2012 SE 11th Ave',
    neighborhood: 'Hosford-Abernethy',
    lat: 45.508409,
    lng: -122.6544966
  },
  'jaderabbit': {
    restaurant: 'Jade Rabbit',
    address: '3632 SE Hawthorne Blvd, Portland, OR 97214',
    streetAddress: '3632 SE Hawthorne Blvd',
    neighborhood: 'Hawthorne',
    lat: 45.5119043,
    lng: -122.6261043
  },
  'june': {
    restaurant: 'JUNE',
    address: '4589 SW Watson Ave #110, Beaverton, OR 97005',
    streetAddress: '4589 SW Watson Ave #110',
    neighborhood: 'Beaverton',
    lat: 45.4865734,
    lng: -122.8062973
  },
  'katesicecreammississippi': {
    restaurant: "Kate's Ice Cream (Mississippi)",
    address: '3713 N Mississippi Ave, Portland, OR 97227',
    streetAddress: '3713 N Mississippi Ave',
    neighborhood: 'Boise',
    lat: 45.5498037,
    lng: -122.6757773
  },
  'katesicecreamnw23rd': {
    restaurant: "Kate's Ice Cream (NW 23rd)",
    address: '1430 NW 23rd Ave, Portland, OR 97210',
    streetAddress: '1430 NW 23rd Ave',
    neighborhood: 'Nob Hill',
    lat: 45.5331279,
    lng: -122.6985958
  },
  'lacasademama': {
    restaurant: 'La Casa de Mamá',
    address: '1670 NE Killingsworth St, Portland, OR 97211',
    streetAddress: '1670 NE Killingsworth St',
    neighborhood: 'Vernon',
    lat: 45.5626212,
    lng: -122.6480057,
    note: 'Available at Mis Tacones (daily) and Kalesa Coffee (Tue–Sat)'
  },
  'maruti': {
    restaurant: 'Maruti Indian Restaurant',
    address: '1925 SE Hawthorne Blvd, Portland, OR 97214',
    streetAddress: '1925 SE Hawthorne Blvd',
    neighborhood: 'Buckman',
    lat: 45.5123975,
    lng: -122.6458794
  },
  'mirisata': {
    restaurant: 'Mirisata',
    address: '2420 SE Belmont St, Portland, OR 97214',
    streetAddress: '2420 SE Belmont St',
    neighborhood: 'Buckman',
    lat: 45.5163116,
    lng: -122.6409989
  },
  'mistacones': {
    restaurant: 'Mis Tacones',
    address: '1670 NE Killingsworth St, Portland, OR 97211',
    streetAddress: '1670 NE Killingsworth St',
    neighborhood: 'Vernon',
    lat: 45.5626212,
    lng: -122.6480057
  },
  'natesoatmealcookies': {
    restaurant: "Nate's Oatmeal Cookies",
    address: '3308 SE Belmont St, Portland, OR 97214',
    streetAddress: '3308 SE Belmont St',
    neighborhood: 'Sunnyside',
    lat: 45.5163247,
    lng: -122.6306885
  },
  'norahbelmont': {
    restaurant: 'Norah (Belmont)',
    address: '3801 SE Belmont St, Portland, OR 97214',
    streetAddress: '3801 SE Belmont St',
    neighborhood: 'Sunnyside',
    lat: 45.51659,
    lng: -122.6242609
  },
  'norahalberta': {
    restaurant: 'Norah (Alberta)',
    address: '1451 NE Alberta St, Portland, OR 97211',
    streetAddress: '1451 NE Alberta St',
    neighborhood: 'Alberta Arts',
    lat: 45.5592375,
    lng: -122.6505348
  },
  'obonshokudo': {
    restaurant: 'Obon Shokudo',
    address: '720 SE Grand Ave, Portland, OR 97214',
    streetAddress: '720 SE Grand Ave',
    neighborhood: 'Central Eastside',
    lat: 45.5175646,
    lng: -122.6605606
  },
  'officelunch': {
    restaurant: 'Office Lunch at Olympic Mills',
    address: '107 SE Washington St, Portland, OR 97214',
    streetAddress: '107 SE Washington St',
    neighborhood: 'Central Eastside',
    lat: 45.51874,
    lng: -122.664236
  },
  'orangeandblossom': {
    restaurant: 'Orange & Blossom',
    address: '1612 NE Killingsworth St, Portland, OR 97211',
    streetAddress: '1612 NE Killingsworth St',
    neighborhood: 'Vernon',
    lat: 45.5626205,
    lng: -122.6485646
  },
  'painaunikkiexquisite': {
    restaurant: 'Pain Au Nikki at Exquisite Creatures',
    address: '537 SE Ash St #108, Portland, OR 97214',
    streetAddress: '537 SE Ash St #108',
    neighborhood: 'Central Eastside',
    lat: 45.5215978,
    lng: -122.6601769
  },
  'painaunikkilalucha': {
    restaurant: 'Pain Au Nikki at La Lucha Coffee',
    address: '1416 SE Stark St, Portland, OR 97214',
    streetAddress: '1416 SE Stark St',
    neighborhood: 'Buckman',
    lat: 45.5191336,
    lng: -122.6511654
  },
  'radmagicsubs': {
    restaurant: 'Rad Magic Subs',
    address: '2824 SE Gladstone St, Portland, OR 97202',
    streetAddress: '2824 SE Gladstone St',
    neighborhood: 'Creston-Kenilworth',
    lat: 45.4931853,
    lng: -122.6369069
  },
  'secretpizzasociety': {
    restaurant: 'Secret Pizza Society',
    address: '7201 NE Glisan St, Portland, OR 97213',
    streetAddress: '7201 NE Glisan St',
    neighborhood: 'Montavilla',
    lat: 45.5265779,
    lng: -122.5885575
  },
  'thewagon': {
    restaurant: 'The Wagon',
    address: '3518 SW Multnomah Blvd, Portland, OR 97219',
    streetAddress: '3518 SW Multnomah Blvd',
    neighborhood: 'Multnomah Village',
    lat: 45.4670695,
    lng: -122.7131288
  },
  'theobertos': {
    restaurant: "Theoberto's at Swan Dive",
    address: '727 SE Grand Ave, Portland, OR 97214',
    streetAddress: '727 SE Grand Ave',
    neighborhood: 'Central Eastside',
    lat: 45.5174948,
    lng: -122.6609933
  },
  'verduremalpractice': {
    restaurant: 'Verdure at Malpractice',
    address: '77 SE Yamhill St, Portland, OR 97214',
    streetAddress: '77 SE Yamhill St',
    neighborhood: 'Central Eastside',
    lat: 45.5160112,
    lng: -122.6652432,
    note: 'Sundays only'
  },
  'verdureexquisite': {
    restaurant: 'Verdure at Exquisite Creatures',
    address: '537 SE Ash St #108, Portland, OR 97214',
    streetAddress: '537 SE Ash St #108',
    neighborhood: 'Central Eastside',
    lat: 45.5215978,
    lng: -122.6601769
  },
  'vtopian': {
    restaurant: 'Vtopian Artisan Cheeses',
    address: '103 NE Grand Ave, Portland, OR 97232',
    streetAddress: '103 NE Grand Ave',
    neighborhood: 'Kerns',
    lat: 45.523778,
    lng: -122.660909,
    note: 'Also available on weekends at PSU, King, and Montavilla Farmers Markets'
  }
};

// Add venue coordinates to cache if not present
for (const loc of Object.values(VENUE_LOCATIONS)) {
  const key = `${loc.lat},${loc.lng}`;
  if (!geocodeCache[key]) {
    geocodeCache[key] = {
      address: loc.address,
      streetAddress: loc.streetAddress,
      neighborhood: loc.neighborhood
    };
  }
}
saveGeocodeCache();

export async function scrape() {
  console.log('Fetching live Veganizer World Vegan Month page & KML map...');
  const [resHtml, resKml] = await Promise.all([
    fetch(LOCATIONS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }),
    fetch(KML_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  ]);

  if (!resHtml.ok) throw new Error(`HTTP ${resHtml.status} for ${LOCATIONS_URL}`);
  if (!resKml.ok) throw new Error(`HTTP ${resKml.status} for ${KML_URL}`);

  const htmlText = await resHtml.text();
  const kmlText = await resKml.text();

  const $ = cheerio.load(htmlText);
  const $kml = cheerio.load(kmlText, { xmlMode: true });

  // Map KML image assets by placemark name
  const kmlImages = new Map();
  $kml('Placemark').each((i, el) => {
    const pName = $kml(el).find('name').text().trim().toLowerCase();
    const desc = $kml(el).find('description').text().trim();
    const imgMatch = desc.match(/src="([^"]+)"/);
    if (imgMatch) {
      kmlImages.set(pName, imgMatch[1]);
    }
  });

  // Parse HTML business sections
  const htmlBusinesses = new Map();
  $('h3').each((i, el) => {
    const rawName = $(el).text().trim();
    const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Image preceding h3
    let img = '';
    let prev = $(el).prev();
    while (prev.length && prev[0].tagName !== 'h3' && prev[0].tagName !== 'h2') {
      if (prev[0].tagName === 'img') {
        img = prev.attr('src') || '';
        break;
      }
      const innerImg = prev.find('img');
      if (innerImg.length) {
        img = innerImg.attr('src') || '';
        break;
      }
      prev = prev.prev();
    }
    if (img && !img.startsWith('http')) {
      img = new URL(img, LOCATIONS_URL).href;
    }

    const specials = [];
    let cause = '';
    let causeUrl = '';
    let causeDesc = '';
    let locationText = '';
    let bonusText = '';

    let curr = $(el).next();
    while (curr.length && curr[0].tagName !== 'h3' && curr[0].tagName !== 'h2') {
      if (curr[0].tagName === 'p') {
        const pText = curr.text().trim();
        const strong = curr.find('strong').first().text().trim();
        if (strong.startsWith('Special')) {
          specials.push(pText.replace(/^Special:\s*/i, '').trim());
        } else if (strong.startsWith('Cause')) {
          const a = curr.find('a').first();
          if (a.length) {
            cause = a.text().trim();
            causeUrl = a.attr('href') || '';
          }
          const lines = pText.replace(/^Cause:\s*/i, '').split('\n').map(s => s.trim()).filter(Boolean);
          if (!cause && lines.length > 0) cause = lines[0];
          if (lines.length > 1) causeDesc = lines.slice(1).join(' ');
          else if (lines.length === 1 && !causeUrl) causeDesc = lines[0];
        } else if (strong.startsWith('Location')) {
          locationText = pText.replace(/^Locations?:\s*/i, '').trim();
        } else if (strong.startsWith('Bonus')) {
          bonusText = pText.replace(/^Bonus:\s*/i, '').trim();
        }
      }
      curr = curr.next();
    }

    htmlBusinesses.set(key, {
      rawName,
      image: img,
      specials,
      cause,
      causeUrl,
      causeDesc,
      locationText,
      bonusText
    });
  });

  console.log(`Parsed ${htmlBusinesses.size} businesses from Veganizer HTML.`);

  // Define each dish entry linked to its distinct physical venue location
  const entriesDef = [
    // 1. Adelleda
    { venueKey: 'adelleda', bizKey: 'adelleda', specialIdx: 0, emoji: '🍝' },

    // 2. Black Water
    { venueKey: 'blackwater', bizKey: 'blackwater', specialIdx: 0, emoji: '🍔' },

    // 3. Boxcar Pizza
    { venueKey: 'boxcarpizza', bizKey: 'boxcarpizza', specialIdx: 0, emoji: '🍕' },

    // 4. Buddy's
    { venueKey: 'buddys', bizKey: 'buddys', specialIdx: 0, emoji: '🧆' },

    // 5 & 6. Carina's Bakery (2 specials)
    { venueKey: 'carinasbakery', bizKey: 'carinasbakery', specialIdx: 0, emoji: '🍮' },
    { venueKey: 'carinasbakery', bizKey: 'carinasbakery', specialIdx: 1, emoji: '🍰' },

    // 7 & 8. Catscratch Co-op Bakery (2 specials)
    { venueKey: 'catscratchcoopbakery', bizKey: 'catscratchcoopbakery', specialIdx: 0, emoji: '🍞' },
    { venueKey: 'catscratchcoopbakery', bizKey: 'catscratchcoopbakery', specialIdx: 1, emoji: '☕' },

    // 9. Cooper's Co-op Cafe
    { venueKey: 'cooperscoopcafe', bizKey: 'cooperscoopcafe', specialIdx: 0, emoji: '🥞' },

    // 10 & 11. Cultured Kindness (2 specials)
    { venueKey: 'culturedkindness', bizKey: 'culturedkindness', specialIdx: 0, emoji: '🍰' },
    { venueKey: 'culturedkindness', bizKey: 'culturedkindness', specialIdx: 1, emoji: '🧀' },

    // 12. Dinger's Deli at Wayfinder Beer
    { venueKey: 'dingersdeli', bizKey: 'dingersdeliatwayfinderbeer', specialIdx: 0, emoji: '🥪' },

    // 13 & 14. Doe Donuts (2 specials)
    { venueKey: 'doedonuts', bizKey: 'doedonuts', specialIdx: 0, emoji: '🍩' },
    { venueKey: 'doedonuts', bizKey: 'doedonuts', specialIdx: 1, emoji: '☕' },

    // 15. Epif
    { venueKey: 'epif', bizKey: 'epif', specialIdx: 0, emoji: '🥑' },

    // 16. Exquisite Creatures
    { venueKey: 'exquisitecreatures', bizKey: 'exquisitecreatures', specialIdx: 0, emoji: '☕' },

    // 17 & 18. Feral (2 specials)
    { venueKey: 'feral', bizKey: 'feral', specialIdx: 0, emoji: '🥪' },
    { venueKey: 'feral', bizKey: 'feral', specialIdx: 1, emoji: '🍸' },

    // 19 & 20. Fortune (2 specials)
    { venueKey: 'fortune', bizKey: 'fortune', specialIdx: 0, emoji: '🍔' },
    { venueKey: 'fortune', bizKey: 'fortune', specialIdx: 1, emoji: '🍹' },

    // 21 & 22. Harlow (2 locations)
    { venueKey: 'harlowdivision', bizKey: 'harlowcafejuicebar', specialIdx: 0, emoji: '🍝' },
    { venueKey: 'harlownw23rd', bizKey: 'harlowcafejuicebar', specialIdx: 0, emoji: '🍝' },

    // 23. Ice Queen
    { venueKey: 'icequeen', bizKey: 'icequeen', specialIdx: 0, emoji: '🍨' },

    // 24. Jade Rabbit
    { venueKey: 'jaderabbit', bizKey: 'jaderabbit', specialIdx: 0, emoji: '🥟' },

    // 25 & 26. JUNE (2 specials)
    { venueKey: 'june', bizKey: 'june', specialIdx: 0, emoji: '🍔' },
    { venueKey: 'june', bizKey: 'june', specialIdx: 1, emoji: '🍸' },

    // 27 & 28. Kate's Ice Cream (2 locations)
    { venueKey: 'katesicecreammississippi', bizKey: 'katesicecream', specialIdx: 0, emoji: '🍨' },
    { venueKey: 'katesicecreamnw23rd', bizKey: 'katesicecream', specialIdx: 0, emoji: '🍨' },

    // 29. La Casa de Mamá
    { venueKey: 'lacasademama', bizKey: 'lacasademam', specialIdx: 0, emoji: '🍰' },

    // 30. Maruti Indian Restaurant
    { venueKey: 'maruti', bizKey: 'marutiindianrestaurant', specialIdx: 0, emoji: '🍛' },

    // 31 & 32. Mirisata (2 specials)
    { venueKey: 'mirisata', bizKey: 'mirisata', specialIdx: 0, emoji: '🍲' },
    { venueKey: 'mirisata', bizKey: 'mirisata', specialIdx: 1, emoji: '🍹' },

    // 33. Mis Tacones
    { venueKey: 'mistacones', bizKey: 'mistacones', specialIdx: 0, emoji: '🍲' },

    // 34. Nate's Oatmeal Cookies
    { venueKey: 'natesoatmealcookies', bizKey: 'natesoatmealcookies', specialIdx: 0, emoji: '🍪' },

    // 35, 36, 37, 38. Norah (2 specials across 2 locations = 4 entries)
    { venueKey: 'norahbelmont', bizKey: 'norah', specialIdx: 0, emoji: '🍚' },
    { venueKey: 'norahbelmont', bizKey: 'norah', specialIdx: 1, emoji: '🍮' },
    { venueKey: 'norahalberta', bizKey: 'norah', specialIdx: 0, emoji: '🍚' },
    { venueKey: 'norahalberta', bizKey: 'norah', specialIdx: 1, emoji: '🍮' },

    // 39. Obon Shokudo
    { venueKey: 'obonshokudo', bizKey: 'obonshokudo', specialIdx: 0, emoji: '🥟' },

    // 40. Office Lunch at Olympic Mills
    { venueKey: 'officelunch', bizKey: 'officelunchatolympicmills', specialIdx: 0, emoji: '🥪' },

    // 41. Orange & Blossom
    { venueKey: 'orangeandblossom', bizKey: 'orangeblossom', specialIdx: 0, emoji: '🥐' },

    // 42 & 43. Pain Au Nikki (2 popup host locations)
    { venueKey: 'painaunikkiexquisite', bizKey: 'painaunikki', specialIdx: 0, emoji: '🍪' },
    { venueKey: 'painaunikkilalucha', bizKey: 'painaunikki', specialIdx: 1, emoji: '🍪' },

    // 44. Rad Magic Subs
    { venueKey: 'radmagicsubs', bizKey: 'radmagicsubs', specialIdx: 0, emoji: '🌭' },

    // 45. Secret Pizza Society
    { venueKey: 'secretpizzasociety', bizKey: 'secretpizzasociety', specialIdx: 0, emoji: '🥪' },

    // 46. The Wagon
    { venueKey: 'thewagon', bizKey: 'thewagon', specialIdx: 0, emoji: '🥪' },

    // 47 & 48. Theoberto's at Swan Dive (2 specials)
    { venueKey: 'theobertos', bizKey: 'theobertosatswandive', specialIdx: 0, emoji: '🌮' },
    { venueKey: 'theobertos', bizKey: 'theobertosatswandive', specialIdx: 1, emoji: '🍹' },

    // 49 & 50. Verdure (2 distinct specials at 2 host locations)
    { venueKey: 'verduremalpractice', bizKey: 'verdure', specialIdx: 0, emoji: '🥧' },
    { venueKey: 'verdureexquisite', bizKey: 'verdure', specialIdx: 1, emoji: '🥖' },

    // 51 & 52. Vtopian Artisan Cheeses (2 specials)
    { venueKey: 'vtopian', bizKey: 'vtopianartisancheeses', specialIdx: 0, emoji: '🧀' },
    { venueKey: 'vtopian', bizKey: 'vtopianartisancheeses', specialIdx: 1, emoji: '🧁' }
  ];

  const entries = [];
  const placesCache = loadPlacesCache();
  const existingDataMap = loadExistingData(OUTPUT_PATH);
  let counter = 1;

  for (const def of entriesDef) {
    const venue = VENUE_LOCATIONS[def.venueKey];
    if (!venue) {
      console.warn(`Venue key not found: ${def.venueKey}`);
      continue;
    }

    const biz = htmlBusinesses.get(def.bizKey);
    const rawSpecialText = (biz && biz.specials[def.specialIdx]) || 'World Vegan Month Special';

    // Parse Dish Name and Description
    const lines = rawSpecialText.split('\n').map(s => s.trim()).filter(Boolean);
    let rawDish = lines[0] || 'Special';
    let rawDesc = lines.slice(1).join(' ');

    // Clean leading Special: / Special 1:
    rawDish = rawDish.replace(/^Special\s*\d*:\s*/i, '').trim();

    // Clean trailing location markers in special title (e.g. "... at Exquisite Creatures")
    let dish = rawDish;
    if (def.bizKey === 'painaunikki') {
      dish = 'Macaron Box';
    } else if (def.bizKey === 'verdure') {
      dish = rawDish.replace(/\s+at\s+(Malpractice|Exquisite Creatures).*$/i, '').trim();
    } else if (def.bizKey === 'vtopian' && def.specialIdx === 0) {
      dish = 'Seasonal Cheese: Cranberry Brie';
    } else if (def.bizKey === 'epif' && def.specialIdx === 0) {
      dish = 'Autumn Benedict';
    }

    let image = (biz && biz.image) || '';
    if (!image) {
      // Check KML image cache
      const kmlImg = kmlImages.get(venue.restaurant.toLowerCase()) ||
                     kmlImages.get(def.venueKey.toLowerCase()) ||
                     kmlImages.get(def.bizKey.toLowerCase());
      if (kmlImg) image = kmlImg;
    }
    if (!image && def.bizKey === 'feral') {
      image = 'https://veganizerpdx.com/world-vegan-month/images/feral-2025.jpg';
    }

    const combinedText = `${rawDish} ${rawDesc} ${rawSpecialText}`.toLowerCase();
    const isGlutenFree = combinedText.includes('gluten free') ||
                         combinedText.includes('gluten-free') ||
                         combinedText.includes('gf');
    const isSpicy = combinedText.includes('spicy') ||
                    combinedText.includes('jalapeño') ||
                    combinedText.includes('jalapeno') ||
                    combinedText.includes('habanero') ||
                    combinedText.includes('chili') ||
                    combinedText.includes('chile');

    const desc = rawDesc ? toSentenceCase(rawDesc) : rawDish;

    // What they say / charity cause description
    let whatTheySay = '';
    if (biz && biz.cause) {
      whatTheySay = `Supporting ${biz.cause}${biz.causeDesc ? ': ' + biz.causeDesc : '.'}`;
      if (venue.note) {
        whatTheySay += ` (${venue.note})`;
      }
    } else if (venue.note) {
      whatTheySay = venue.note;
    }

    const hours = lookupOperatingHours(venue.restaurant, venue.address, placesCache, existingDataMap);

    entries.push({
      id: counter,
      weekId: 'world-vegan-month-2026',
      dish: toTitleCase(dish),
      restaurant: venue.restaurant,
      neighborhood: venue.neighborhood,
      address: venue.address,
      lat: venue.lat,
      lng: venue.lng,
      type: 'vegan',
      vegOption: true,
      veganOption: true,
      glutenFree: isGlutenFree,
      spicy: isSpicy,
      minors: true,
      takeout: true,
      desc,
      emoji: def.emoji || '🌱',
      image,
      url: LOCATIONS_URL,
      whatsOnIt: rawDesc ? toSentenceCase(rawDesc) : undefined,
      whatTheySay: whatTheySay || undefined,
      restaurantUrl: biz && biz.causeUrl ? biz.causeUrl : undefined,
      ...(hours ? { hours } : {})
    });

    counter++;
  }

  const fileContent = `// Veganizer PDX's World Vegan Month 2026
// ${entries.length} specials across Portland locations
// Source: ${LOCATIONS_URL}

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push(
  {
    id: "world-vegan-month-2026",
    name: "World Vegan Month 2026",
    organizer: "Veganizer PDX",
    dates: "November 1–30, 2026",
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    pricePills: ["Vegan specials for a cause"],
    color: "#2E7D32",
    colorDark: "#1B5E20",
    colorLight: "#C8E6C9",
    colorPale: "#E8F5E9",
    emoji: "🌱",
    totalLocations: ${entries.length},
    url: "${LOCATIONS_URL}",
    filters: [
      { id: "gf", label: "Gluten-free" },
      { id: "spicy", label: "Spicy" }
    ]
  }
);

window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = ${JSON.stringify(entries, null, 2)};
  const seen = new Set(window.RESTAURANTS.map(r => \`\${r.weekId}_\${r.id}\`));
  for (const item of newItems) {
    if (!seen.has(\`\${item.weekId}_\${item.id}\`)) {
      window.RESTAURANTS.push(item);
      seen.add(\`\${item.weekId}_\${item.id}\`);
    }
  }
})();
`;

  fs.writeFileSync(OUTPUT_PATH, fileContent, 'utf8');
  console.log(`Successfully generated ${OUTPUT_PATH} with ${entries.length} items.`);
  updateMetaTotalLocations('world-vegan-month-2026', entries.length, path.resolve(__dirname, '../js/meta.js'));
}

if (process.argv[1] && process.argv[1].endsWith('scrape_vegan_month.js')) {
  scrape().catch(err => {
    console.error('Scraping error:', err);
    process.exit(1);
  });
}
