import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { decodeHTML, isAllCaps, toTitleCase, toSentenceCase, updateMetaTotalLocations, loadExistingData } from './scraper_utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.resolve(__dirname, '../data/geocode_cache.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/macandcheeseweek2026.js');
const KML_URL = 'https://www.google.com/maps/d/kml?mid=1NEzohls7shUUctvrNP17KyBczQuwJPs&forcekml=1';
const LOCATIONS_URL = 'https://www.theactualportland.com/macandcheeselocations';

const GEO_UA = 'pdx-food-week-app/1.0 (https://github.com/verdantly/pdx-food-week)';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

let geocodeCache = {};
if (fs.existsSync(CACHE_PATH)) {
  try {
    const raw = fs.readFileSync(CACHE_PATH, 'utf8').replace(/^\uFEFF/, '');
    geocodeCache = JSON.parse(raw);
    console.log(`Loaded ${Object.keys(geocodeCache).length} cached coordinates.`);
  } catch (e) {
    console.warn('Failed to load geocode cache, starting fresh:', e.message);
  }
}

function saveGeocodeCache() {
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(geocodeCache, null, 2), 'utf8');
}

const NAME_MAP = {
  '10barrelbrewingportland': '10barrelbrewing',
  'graysrestaurantbar': 'graysrestaurantandbar',
  'migrationbrewingwilliamsx5star': 'migrationbrewingwilliams',
  'migrationbrewingglisan': 'migrationbrewingglisan',
  'haymakerbar': 'haymaker'
};

const ADDRESS_OVERRIDES = {
  'Adelleda/Vtopian Cheeses': {
    address: '103 NE Grand Ave, Portland, OR 97232',
    streetAddress: '103 NE Grand Ave',
    neighborhood: 'Kerns',
    lat: 45.523778,
    lng: -122.660909
  },
  "Wonderboy's Smokestack": {
    address: '1027 NE Alberta St, Portland, OR 97211',
    streetAddress: '1027 NE Alberta St',
    neighborhood: 'King',
    lat: 45.5592348,
    lng: -122.6548145
  },
  'Jade Cow Creamery': {
    address: '917 SW Alder St, Portland, OR 97205',
    streetAddress: '917 SW Alder St',
    neighborhood: 'Downtown',
    lat: 45.5205994,
    lng: -122.6809717
  },
  'Grays Restaurant & Bar': {
    address: '301 W 6th St, Vancouver, WA 98660',
    streetAddress: '301 W 6th St',
    neighborhood: 'Vancouver',
    lat: 45.625508,
    lng: -122.6747148
  },
  'Pope House Bourbon Lounge': {
    address: '2075 NW Glisan St, Portland, OR 97209',
    streetAddress: '2075 NW Glisan St',
    neighborhood: 'Nob Hill',
    lat: 45.5264614,
    lng: -122.6940135
  },
  'Idella Shepard': {
    address: '58 NE Burnside Rd, Gresham, OR 97030',
    streetAddress: '58 NE Burnside Rd',
    neighborhood: 'Gresham',
    lat: 45.5082705,
    lng: -122.4301784
  },
  'Speakeasy Saloon': {
    address: '2135 N Willis Blvd, Portland, OR 97217',
    streetAddress: '2135 N Willis Blvd',
    neighborhood: 'Kenton',
    lat: 45.5839202,
    lng: -122.6889298
  },
  'Exotic Eggrollz': {
    address: '9100 SW Burnham St, Tigard, OR 97223',
    streetAddress: '9100 SW Burnham St',
    neighborhood: 'Downtown Tigard',
    lat: 45.428497,
    lng: -122.7711428
  },
  'Mama Chow\'s Kitchen': {
    address: '3757 SE Hawthorne Blvd, Portland, OR 97214',
    streetAddress: '3757 SE Hawthorne Blvd',
    neighborhood: 'Hawthorne',
    lat: 45.5122362,
    lng: -122.6247001
  }
};

const DISH_OVERRIDES = {
  'Adelleda/Vtopian Cheeses': {
    dish: 'Crafted Vegan Mac & Cheese',
    type: 'vegan',
    veganOption: true,
    vegOption: true,
    glutenFree: false,
    emoji: '🧀'
  },
  '10 Barrel Brewing Portland': {
    dish: 'Four Cheese Fettuccini Mac',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    emoji: '🧀'
  },
  "Wonderboy's Smokestack": {
    dish: 'Creamy Pork Belly Mac & Cheese',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    emoji: '🥓'
  },
  'DesiPDX': {
    dish: 'Saag Paneer Mac n Cheese',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: true,
    emoji: '🧀'
  },
  'Jade Cow Creamery': {
    dish: 'Kraft Mac & Cheese Ice Cream',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    emoji: '🍨'
  },
  'Exotic Eggrollz': {
    dish: 'Signature Mac & Cheese Eggroll',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    emoji: '🥢'
  },
  'Grays Restaurant & Bar': {
    dish: 'Grays Buffalo Crusted 5-Cheese Mac',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🧀'
  },
  'Migration Brewing Williams x 5 Star': {
    dish: 'Deep-Fried Pesto Bacon Mac & Cheese Bites',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    emoji: '🧀'
  },
  'Migration Brewing - Glisan': {
    dish: 'Pepperoni Pizza Mac and Cheese',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    emoji: '🍕'
  },
  'The Rambler': {
    dish: 'Southwest Chile Verde Mac',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🧀'
  },
  'Haymaker Bar': {
    dish: 'Mac and Cheese Eggrolls with Spicy Ranch',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🥢'
  },
  'Victoria Bar': {
    dish: 'Roasted Corn & Hatch Chili Mac',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🧀'
  },
  'Gin Thai Brasserie': {
    dish: 'Fusilli Pad Ka Prao (Thai Basil)',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🍲'
  },
  'Mama Chow\'s Kitchen': {
    dish: 'Chinatown Style Macaroni Soup',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    emoji: '🍲'
  },
  'Pope House Bourbon Lounge': {
    dish: 'Gochujang Burnt Ends Macaroni',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🥓'
  },
  "Uncle Earl's BBQ Bistro": {
    dish: 'Pulled Pork / Cheeseburger Dirty Mac',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    emoji: '🧀'
  },
  'Idella Shepard': {
    dish: 'Jalapeño Popper Mac & Cheese',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    spicy: true,
    emoji: '🧀'
  },
  'Speakeasy Saloon': {
    dish: 'Three-Cheese Béchamel Cavatappi',
    type: 'vegetarian',
    vegOption: true,
    veganOption: false,
    glutenFree: false,
    emoji: '🧀'
  },
  'Hunny Beez': {
    dish: 'Longanisa Mac & Cheese',
    type: 'meat',
    vegOption: false,
    veganOption: false,
    glutenFree: false,
    emoji: '🧀'
  }
};

async function scrape() {
  console.log('Fetching live Squarespace locations page & Google Maps KML for Mac & Cheese Week...');
  const [resLoc, resKml] = await Promise.all([
    fetch(LOCATIONS_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }),
    fetch(KML_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  ]);

  if (!resLoc.ok) throw new Error(`Failed to fetch locations page: HTTP ${resLoc.status}`);
  if (!resKml.ok) throw new Error(`Failed to fetch KML map: HTTP ${resKml.status}`);

  const htmlText = await resLoc.text();
  const kmlText = await resKml.text();

  const $html = cheerio.load(htmlText);
  const squarespaceMap = {};

  $html('li.list-item, .user-items-list-item-container').each((i, el) => {
    const rawTitle = $html(el).find('h2').text().trim();
    if (!rawTitle || rawTitle.includes('Coming Soon') || rawTitle.includes('Locations.')) return;

    const desc = $html(el).find('.list-item-content__description').text().trim();
    let img = $html(el).find('img').attr('data-src') || $html(el).find('img').attr('src') || '';
    if (img.startsWith('//')) img = 'https:' + img;
    const key = normalizeName(rawTitle);

    if (key) {
      squarespaceMap[key] = {
        title: rawTitle,
        description: desc,
        image: img
      };
    }
  });

  console.log(`Parsed ${Object.keys(squarespaceMap).length} items from Squarespace page.`);

  const $kml = cheerio.load(kmlText, { xmlMode: true });
  const existingMap = loadExistingData(OUTPUT_PATH);
  const existingRestaurants = new Set();
  for (const item of existingMap.values()) {
    if (item && item.restaurant) {
      existingRestaurants.add(item.restaurant.toLowerCase().trim());
    }
  }

  const entries = [];
  const processedKeys = new Set();
  let counter = 1;

  const placemarks = $kml('Placemark').toArray();
  console.log(`Found ${placemarks.length} Placemarks in KML map.`);

  for (const pm of placemarks) {
    const name = decodeHTML($kml(pm).find('name').text().trim());
    if (!name || name.includes('Coming Soon')) continue;

    const descHtml = $kml(pm).find('description').text().trim();
    const coordsText = $kml(pm).find('coordinates').text().trim();
    if (!coordsText) continue;

    let rawText = descHtml
      .replace(/<img[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!rawText || rawText.length < 5) {
      console.log(`Skipping duplicate or empty placemark: "${name}"`);
      continue;
    }

    const [lngStr, latStr] = coordsText.split(',');
    let lng = parseFloat(lngStr);
    let lat = parseFloat(latStr);
    if (isNaN(lat) || isNaN(lng)) continue;

    const cleanKey = normalizeName(name);
    const sqKey = squarespaceMap[cleanKey] ? cleanKey : (NAME_MAP[cleanKey] && squarespaceMap[NAME_MAP[cleanKey]] ? NAME_MAP[cleanKey] : null);
    let sqItem = sqKey ? squarespaceMap[sqKey] : null;

    if (sqKey) {
      processedKeys.add(sqKey);
      processedKeys.add(cleanKey);
    }

    let image = (sqItem && sqItem.image) || '';
    if (!image) {
      const imgMatch = descHtml.match(/src="([^"]+)"/);
      if (imgMatch) image = imgMatch[1];
    }
    if (image.startsWith('//')) image = 'https:' + image;

    rawText = decodeHTML(rawText);

    let dish = 'Mac & Cheese Special';
    let desc = rawText;

    if (DISH_OVERRIDES[name] && DISH_OVERRIDES[name].dish) {
      dish = DISH_OVERRIDES[name].dish;
    } else {
      const splitMatch = rawText.match(/^([^—\-–:]{3,60})\s*[—\-–:]\s*(.+)$/i);
      if (splitMatch) {
        dish = splitMatch[1].trim();
        desc = splitMatch[2].trim();
      } else if (rawText.length > 0 && rawText.length < 50) {
        dish = rawText;
        desc = rawText;
      }
    }

    dish = toTitleCase(dish);
    desc = toSentenceCase(desc);

    let address = '';
    let streetAddress = '';
    let neighborhood = '';

    if (ADDRESS_OVERRIDES[name]) {
      address = ADDRESS_OVERRIDES[name].address;
      streetAddress = ADDRESS_OVERRIDES[name].streetAddress;
      neighborhood = ADDRESS_OVERRIDES[name].neighborhood;
      lat = ADDRESS_OVERRIDES[name].lat;
      lng = ADDRESS_OVERRIDES[name].lng;
    } else {
      const cacheKey = `${lat},${lng}`;
      if (geocodeCache[cacheKey]) {
        const cached = geocodeCache[cacheKey];
        address = cached.address;
        streetAddress = cached.streetAddress;
        neighborhood = cached.neighborhood;
      } else {
        console.log(`[${counter}] Reverse geocoding ${name} (${cacheKey})...`);
        const geoUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;

        try {
          const res = await fetch(geoUrl, { headers: { 'User-Agent': GEO_UA } });
          await sleep(1200);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          const addr = data.address || {};

          const houseNum = addr.house_number || '';
          const road = addr.road || '';
          neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.village || addr.town || '';
          let city = addr.city || addr.town || addr.village || 'Portland';
          const postcode = addr.postcode || '';

          if (houseNum && road) {
            streetAddress = `${houseNum} ${road}`;
          } else if (road) {
            streetAddress = road;
          } else {
            streetAddress = data.display_name.split(',')[0].trim();
          }

          streetAddress = streetAddress
            .replace(/\bStreet\b/g, 'St')
            .replace(/\bAvenue\b/g, 'Ave')
            .replace(/\bBoulevard\b/g, 'Blvd')
            .replace(/\bRoad\b/g, 'Rd');

          address = `${streetAddress}, ${city}, OR`;
          if (postcode) address += ` ${postcode}`;

          geocodeCache[cacheKey] = { address, streetAddress, neighborhood };
          saveGeocodeCache();
        } catch (e) {
          console.warn(`  ⚠ Geocoding failed for ${name}:`, e.message);
          address = 'Portland, OR';
          streetAddress = '';
          neighborhood = '';
        }
      }
    }

    const combined = `${name} ${dish} ${desc} ${rawText}`.toLowerCase();
    let isVegan = combined.includes('vegan') && !combined.includes('non-vegan');
    let isVegetarian = isVegan || combined.includes('saag paneer') || combined.includes('paneer') || combined.includes('vegetarian') || (!combined.includes('bacon') && !combined.includes('pork') && !combined.includes('beef') && !combined.includes('sausage') && !combined.includes('chicken'));
    let isGlutenFree = combined.includes('gluten-free') || combined.includes('gluten free');
    let isSpicy = /spicy|hot|jalapeño|jalapeno|gochujang|buffalo|chile|chili|togarashi|kimchi/i.test(combined);

    let type = 'meat';
    if (isVegan) type = 'vegan';
    else if (isVegetarian) type = 'vegetarian';

    if (DISH_OVERRIDES[name]) {
      if (DISH_OVERRIDES[name].type) type = DISH_OVERRIDES[name].type;
      if (DISH_OVERRIDES[name].veganOption !== undefined) isVegan = DISH_OVERRIDES[name].veganOption;
      if (DISH_OVERRIDES[name].vegOption !== undefined) isVegetarian = DISH_OVERRIDES[name].vegOption;
      if (DISH_OVERRIDES[name].glutenFree !== undefined) isGlutenFree = DISH_OVERRIDES[name].glutenFree;
      if (DISH_OVERRIDES[name].spicy !== undefined) isSpicy = DISH_OVERRIDES[name].spicy;
    }

    let emoji = '🧀';
    if (DISH_OVERRIDES[name] && DISH_OVERRIDES[name].emoji) {
      emoji = DISH_OVERRIDES[name].emoji;
    } else if (type === 'vegan') emoji = '🌱';
    else if (type === 'vegetarian') emoji = '🌿';

    const isNew = existingRestaurants.size > 0 && !existingRestaurants.has(name.toLowerCase().trim());

    entries.push({
      id: counter,
      weekId: 'mac-and-cheese-2026',
      dish,
      restaurant: name,
      neighborhood: neighborhood || 'Portland',
      address,
      lat,
      lng,
      type,
      vegOption: isVegetarian,
      veganOption: isVegan,
      glutenFree: isGlutenFree,
      spicy: isSpicy,
      minors: true,
      takeout: true,
      desc,
      emoji,
      image,
      url: LOCATIONS_URL,
      ...(isNew ? { isNew: true } : {})
    });

    counter++;
  }

  for (const [sqKey, sqItem] of Object.entries(squarespaceMap)) {
    if (!processedKeys.has(sqKey)) {
      console.log(`Adding Squarespace-only listing: "${sqItem.title}"`);
      const override = ADDRESS_OVERRIDES[sqItem.title] || {};
      let address = override.address || 'Portland, OR';
      let streetAddress = override.streetAddress || (override.address ? override.address.split(',')[0].trim() : '');
      let neighborhood = override.neighborhood || 'Portland';
      let lat = override.lat || 45.5231;
      let lng = override.lng || -122.6765;

      let dish = 'Mac & Cheese Special';
      let desc = sqItem.description ? toSentenceCase(sqItem.description) : 'Special mac & cheese';
      if (DISH_OVERRIDES[sqItem.title] && DISH_OVERRIDES[sqItem.title].dish) {
        dish = DISH_OVERRIDES[sqItem.title].dish;
      }

      const isNew = existingRestaurants.size > 0 && !existingRestaurants.has(sqItem.title.toLowerCase().trim());

      entries.push({
        id: counter,
        weekId: 'mac-and-cheese-2026',
        dish,
        restaurant: sqItem.title,
        neighborhood,
        address,
        lat,
        lng,
        type: 'vegetarian',
        vegOption: true,
        veganOption: false,
        glutenFree: false,
        spicy: false,
        minors: true,
        takeout: true,
        desc,
        emoji: '🧀',
        image: sqItem.image,
        url: LOCATIONS_URL,
        ...(isNew ? { isNew: true } : {})
      });
      counter++;
    }
  }

  const fileContent = `// The Actual Portland's Mac & Cheese Week 2026
// ${entries.length} locations
// Source: ${LOCATIONS_URL}

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push(
  {
    id: "mac-and-cheese-2026",
    name: "Mac & Cheese Week 2026",
    organizer: "The Actual Portland",
    dates: "November 2–8, 2026",
    startDate: "2026-11-02",
    endDate: "2026-11-08",
    pricePills: ["$10 special"],
    color: "#E69500",
    colorDark: "#A66300",
    colorLight: "#FDE68A",
    colorPale: "#FFFBEB",
    emoji: "🧀",
    totalLocations: ${entries.length},
    url: "${LOCATIONS_URL}",
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
  console.log(`Successfully generated ${OUTPUT_PATH} with ${entries.length} locations.`);
  updateMetaTotalLocations('mac-and-cheese-2026', entries.length, path.resolve(__dirname, '../js/meta.js'));
}

scrape().catch(err => {
  console.error('Scraping error:', err);
  process.exit(1);
});
