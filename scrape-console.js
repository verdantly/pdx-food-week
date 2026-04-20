// PDX Pizza Week 2026 — Browser Console Scraper
// 1. Go to: https://everout.com/portland/events/the-portland-mercurys-pizza-week-2026/e222744/
// 2. Open DevTools: F12 (Windows/Linux) or Cmd+Option+I (Mac)
// 3. Click the "Console" tab
// 4. Paste this entire script and press Enter
// 5. Wait ~30 seconds while it fetches each dish page
// 6. It will auto-download a ready-to-use pizzaweek2026.js file

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const BASE = 'https://everout.com';
  const results = [];

  // ── Step 1: collect all dish links from the current page ──
  const allLinks = [...document.querySelectorAll('a[href]')]
    .map(a => a.href)
    .filter(h => h.includes('/portland/events/') && !h.includes('pizza-week-2026') && !h.includes('/food-weeks/'))
    .filter((h, i, arr) => arr.indexOf(h) === i); // dedupe

  console.log(`Found ${allLinks.length} dish links. Fetching each page…`);

  // ── Step 2: fetch and parse each dish page ──
  for (let i = 0; i < allLinks.length; i++) {
    const url = allLinks[i];
    console.log(`[${i+1}/${allLinks.length}] ${url}`);

    try {
      const res = await fetch(url, { credentials: 'omit' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const text = doc.body?.innerText?.toLowerCase() || '';

      // Dish name
      const dish = doc.querySelector('h1')?.textContent?.trim() || 'Unknown';

      // Restaurant + neighborhood — EverOut puts "Restaurant (Neighborhood)" in a header/subtitle
      const subtitleEl = doc.querySelector('h2, h3, [class*="venue"], [class*="location"], [class*="subtitle"]');
      const subtitleRaw = subtitleEl?.textContent?.trim() || '';
      const neighMatch = subtitleRaw.match(/\(([^)]+)\)/);
      const neighborhood = neighMatch ? neighMatch[1] : '';
      const restaurant = subtitleRaw.replace(/\s*\([^)]*\)/, '').trim() || subtitleRaw;

      // Address
      const addrEl = doc.querySelector('[class*="address"], address, [itemprop="address"]');
      const address = addrEl?.textContent?.replace(/\s+/g, ' ').trim() || '';

      // Description — first paragraph in the event body
      const descEl = doc.querySelector('[class*="description"] p, [class*="body"] p, article p');
      const desc = descEl?.textContent?.trim().slice(0, 220) || doc.querySelector('meta[name="description"]')?.content || '';

      // Dietary detection
      const type = text.includes('vegan') ? 'vegan'
        : (text.includes('vegetarian') || text.includes('veggie')) ? 'vegetarian'
        : 'meat';

      const glutenFree = text.includes('gluten-free') || text.includes('gluten free');
      const wholePie   = text.includes('whole pie') || text.includes('$25');
      const minors     = !text.includes('21+') && !text.includes('21 and over') && !text.includes('must be 21');
      const takeout    = text.includes('takeout') || text.includes('take-out') || text.includes('to-go') || text.includes('to go');

      // Emoji based on keywords
      const emoji = type === 'vegan' ? '🌱'
        : type === 'vegetarian' ? '🌿'
        : text.includes('bacon') ? '🥓'
        : text.includes('mushroom') ? '🍄'
        : text.includes('buffalo') || (text.includes('chicken') && text.includes('hot')) ? '🌶️'
        : text.includes('egg') && text.includes('breakfast') ? '🍳'
        : text.includes('shrimp') || text.includes('seafood') || text.includes('clam') ? '🦐'
        : text.includes('truffle') ? '🫐'
        : text.includes('pork') || text.includes('sausage') ? '🥩'
        : '🍕';

      // Map link — EverOut often embeds a Google Maps link
      const mapLink = [...doc.querySelectorAll('a[href]')]
        .find(a => a.href.includes('maps.google') || a.href.includes('goo.gl/maps'));
      let lat = 45.5231, lng = -122.6765; // fallback: downtown PDX

      if (mapLink) {
        const coordMatch = mapLink.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) { lat = parseFloat(coordMatch[1]); lng = parseFloat(coordMatch[2]); }
        const qMatch = mapLink.href.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (qMatch) { lat = parseFloat(qMatch[1]); lng = parseFloat(qMatch[2]); }
      }

      results.push({
        id: i + 1,
        weekId: 'pizza-2026',
        dish, restaurant, neighborhood, address,
        lat, lng, type, glutenFree, wholePie, minors, takeout,
        desc, emoji, url
      });

    } catch (e) {
      console.warn(`  ⚠ Failed: ${url}`, e.message);
    }

    await sleep(300); // polite delay
  }

  // ── Step 3: build the JS file content ──
  const weekBlock = `window.FOOD_WEEKS = [
  {
    id: "pizza-2026",
    name: "Pizza Week 2026",
    organizer: "Portland Mercury",
    dates: "April 20\u201326, 2026",
    priceSlice: "$4",
    pricePie: "$25",
    color: "#C94B2C",
    emoji: "🍕",
    totalLocations: ${results.length},
    url: "https://everout.com/portland/events/the-portland-mercurys-pizza-week-2026/e222744/",
  }
];\n`;

  const restaurantBlock = `window.RESTAURANTS = ${JSON.stringify(results, null, 2)};\n`;

  const header = `// Portland Mercury's Pizza Week 2026\n// Scraped ${new Date().toISOString().slice(0,10)} via browser console — ${results.length} locations\n// Review lat/lng: entries showing 45.5231,-122.6765 need manual coordinates\n\n`;

  const fileContent = header + weekBlock + '\n' + restaurantBlock;

  // ── Step 4: trigger download ──
  const blob = new Blob([fileContent], { type: 'application/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pizzaweek2026.js';
  a.click();

  console.log(`\n✅ Done! Downloaded pizzaweek2026.js with ${results.length} restaurants.`);
  console.log('   Drop it into your pdx-food-week/data/ folder and reload the app.');
  console.log('   Check any entries with lat=45.5231 — those need manual coordinates.');
})();
