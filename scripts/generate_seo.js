import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const dishOutputDir = path.join(projectRoot, 'd');
const weeksOutputDir = path.join(projectRoot, 'weeks');

// Ensure output directories exist
if (!fs.existsSync(dishOutputDir)) {
  fs.mkdirSync(dishOutputDir, { recursive: true });
}
if (!fs.existsSync(weeksOutputDir)) {
  fs.mkdirSync(weeksOutputDir, { recursive: true });
}

// Global context mock for dataset files
const context = {
  window: {
    FOOD_WEEKS: [],
    RESTAURANTS: []
  }
};
vm.createContext(context);

// 1. Load metadata first from js/meta.js
const metaPath = path.join(projectRoot, 'js', 'meta.js');
if (fs.existsSync(metaPath)) {
  const metaCode = fs.readFileSync(metaPath, 'utf8');
  try {
    vm.runInContext(metaCode, context);
  } catch (err) {
    console.error('Error loading js/meta.js in SEO generator:', err);
  }
}

// 2. Load all dataset scripts from data/
const dataFiles = fs.readdirSync(dataDir).filter(file => file.endsWith('.js') && file !== 'geocode_cache.json');

for (const file of dataFiles) {
  const filePath = path.join(dataDir, file);
  const code = fs.readFileSync(filePath, 'utf8');
  try {
    vm.runInContext(code, context);
  } catch (err) {
    console.error(`Error loading data file ${file}:`, err);
  }
}

const targetFilter = process.argv[2] ? process.argv[2].toLowerCase() : null;

const rawFoodWeeks = context.window.FOOD_WEEKS || [];
const weekMap = new Map();
for (const w of rawFoodWeeks) {
  if (w && w.id && !weekMap.has(w.id)) {
    weekMap.set(w.id, w);
  }
}
const foodWeeks = Array.from(weekMap.values());
let restaurants = context.window.RESTAURANTS || [];

if (targetFilter) {
  restaurants = restaurants.filter(d => 
    (d.weekId && d.weekId.toLowerCase().includes(targetFilter))
  );
  console.log(`Filtering dishes matching week: "${targetFilter}"...`);
}

console.log(`Loaded ${foodWeeks.length} food weeks and ${restaurants.length} dishes for SEO generation.`);

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatHoursSummary(hours) {
  if (!hours || !hours.weekdayDescriptions || !hours.weekdayDescriptions.length) {
    return '';
  }
  return hours.weekdayDescriptions.join(' • ');
}

// 3. Generate Week Landing Pages (weeks/<weekId>.html)
const generatedWeekPages = [];
for (const week of foodWeeks) {
  const weekDishes = restaurants.filter(r => r.weekId === week.id);
  const weekTitle = `Portland ${week.name}`;
  const metaDescription = `Explore ${weekDishes.length} participating restaurants, specialty dishes, and pricing for ${week.name} (${week.dates || '2026'}). Plan your crawl with the interactive PDX Food Week map!`;
  const canonicalUrl = `https://www.pdxfoodweek.com/weeks/${week.id}.html`;
  const appDeepLink = `../?week=${encodeURIComponent(week.id)}`;

  const foodEventSchema = {
    '@context': 'https://schema.org',
    '@type': 'FoodEvent',
    name: week.name,
    description: metaDescription,
    startDate: week.startDate || '2026-01-01',
    endDate: week.endDate || '2026-12-31',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: 'Portland, Oregon',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Portland',
        addressRegion: 'OR',
        addressCountry: 'US'
      }
    },
    organizer: {
      '@type': 'Organization',
      name: week.organizer || 'PDX Food Week'
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      description: (week.pricePills && week.pricePills.join(', ')) || 'Featured Week Specials'
    }
  };

  const dishesListHtml = weekDishes.map(d => {
    const dishUrl = `../d/${d.weekId}-${d.id}.html`;
    const dishDeepLink = `../?week=${encodeURIComponent(d.weekId)}&amp;dish=${encodeURIComponent(d.id)}`;
    const tagBadges = [];
    if (d.type) tagBadges.push(`<span class="badge badge-subtle">${escapeHtml(d.type)}</span>`);
    if (d.glutenFree) tagBadges.push('<span class="badge badge-gf">GF</span>');
    if (d.wholePie) tagBadges.push('<span class="badge badge-subtle">Whole Pie</span>');
    if (d.minors) tagBadges.push('<span class="badge badge-subtle">Family OK</span>');
    if (d.takeout) tagBadges.push('<span class="badge badge-subtle">Takeout</span>');

    return `
      <div class="dish-card">
        <div class="dish-card-header">
          <div>
            <div class="restaurant-name">${escapeHtml(d.restaurant)}</div>
            <h3 class="dish-title"><a href="${dishUrl}">${escapeHtml(d.dish || 'Special Dish')}</a></h3>
          </div>
          ${d.emoji ? `<span class="dish-emoji">${escapeHtml(d.emoji)}</span>` : ''}
        </div>
        ${d.desc ? `<p class="dish-desc">${escapeHtml(d.desc)}</p>` : ''}
        <div class="dish-meta">
          ${d.neighborhood ? `<span>📍 ${escapeHtml(d.neighborhood)}</span>` : ''}
          ${d.address ? `<span class="dish-address">${escapeHtml(d.address)}</span>` : ''}
        </div>
        <div class="dish-tags">${tagBadges.join(' ')}</div>
        <div class="dish-card-footer">
          <a href="${dishUrl}" class="link-detail">View Dish Details &rarr;</a>
          <a href="${dishDeepLink}" class="btn-app-sm">Open in App</a>
        </div>
      </div>
    `;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(weekTitle)} — Participating Restaurants, Menus &amp; Map</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- OpenGraph -->
  <meta property="og:site_name" content="PDX Food Week">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(weekTitle)} — Guide &amp; Participating Spots">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://www.pdxfoodweek.com/images/og-preview.png">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(weekTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="https://www.pdxfoodweek.com/images/og-preview.png">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(foodEventSchema, null, 2)}
  </script>

  <style>
    :root {
      --primary: ${week.color || '#B5472E'};
      --ink: #1A1208;
      --cream: #FBF6EF;
      --card-bg: #FFFFFF;
      --border: rgba(26, 18, 8, 0.12);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--cream);
      color: var(--ink);
      line-height: 1.5;
      padding: 24px 16px 64px;
    }
    .container { max-width: 1080px; margin: 0 auto; }
    header { margin-bottom: 32px; }
    .breadcrumbs { font-size: 13px; color: rgba(26, 18, 8, 0.6); margin-bottom: 12px; }
    .breadcrumbs a { color: inherit; text-decoration: none; }
    .breadcrumbs a:hover { text-decoration: underline; }
    .hero-title { font-size: clamp(28px, 5vw, 44px); font-weight: 800; line-height: 1.15; margin-bottom: 12px; }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .badge {
      display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px;
      font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .badge-primary { background: var(--primary); color: #fff; }
    .badge-dark { background: var(--ink); color: #fff; }
    .badge-subtle { background: rgba(26, 18, 8, 0.08); color: var(--ink); }
    .badge-gf { background: #E5EFEA; color: #286A5F; font-weight: 700; }
    .hero-desc { font-size: 17px; color: rgba(26, 18, 8, 0.8); max-width: 760px; margin-bottom: 24px; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    .btn-main {
      background: var(--primary); color: #fff; padding: 12px 24px; border-radius: 9999px;
      font-weight: 700; font-size: 15px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
    }
    .btn-main:hover { opacity: 0.92; }
    .btn-outline {
      background: #fff; color: var(--ink); border: 1.5px solid var(--border); padding: 11px 20px;
      border-radius: 9999px; font-weight: 600; font-size: 14px; text-decoration: none;
    }
    .btn-outline:hover { background: rgba(26, 18, 8, 0.04); }
    .section-title { font-size: 22px; font-weight: 700; margin: 36px 0 18px; }
    .dishes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .dish-card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .dish-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .restaurant-name { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 0.04em; }
    .dish-title { font-size: 17px; font-weight: 700; margin-top: 2px; }
    .dish-title a { color: inherit; text-decoration: none; }
    .dish-title a:hover { color: var(--primary); }
    .dish-emoji { font-size: 22px; }
    .dish-desc { font-size: 13.5px; color: rgba(26, 18, 8, 0.72); margin-bottom: 12px; line-height: 1.45; }
    .dish-meta { font-size: 12.5px; color: rgba(26, 18, 8, 0.6); margin-bottom: 10px; display: flex; flex-direction: column; gap: 2px; }
    .dish-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 14px; }
    .dish-card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(26, 18, 8, 0.06); padding-top: 10px; font-size: 13px; }
    .link-detail { color: var(--primary); font-weight: 600; text-decoration: none; }
    .link-detail:hover { text-decoration: underline; }
    .btn-app-sm { background: rgba(26, 18, 8, 0.08); color: var(--ink); padding: 5px 12px; border-radius: 6px; font-weight: 600; text-decoration: none; }
    .btn-app-sm:hover { background: var(--primary); color: #fff; }
    footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); font-size: 13px; color: rgba(26, 18, 8, 0.6); text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="breadcrumbs">
        <a href="../">PDX Food Week</a> &gt; <span>${escapeHtml(week.name)}</span>
      </div>
      <div class="hero-meta">
        <span class="badge badge-primary">${escapeHtml(week.emoji || '🍽️')} ${escapeHtml(week.organizer || 'PDX Food Week')}</span>
        ${week.dates ? `<span class="badge badge-dark">${escapeHtml(week.dates)}</span>` : ''}
        ${week.pricePills ? week.pricePills.map(p => `<span class="badge badge-subtle">${escapeHtml(p)}</span>`).join('') : ''}
        <span class="badge badge-subtle">${weekDishes.length} Spots</span>
      </div>
      <h1 class="hero-title">${escapeHtml(weekTitle)}</h1>
      <p class="hero-desc">
        Browse all ${weekDishes.length} special dish offerings, dietary options, and locations participating in ${escapeHtml(week.name)}. Use our interactive crawl planner and map to filter spots by neighborhood, distance, and dietary preferences!
      </p>
      <div class="cta-row">
        <a href="${appDeepLink}" class="btn-main">
          <span>🚀 Open in Interactive App &amp; Map</span>
        </a>
        <a href="../" class="btn-outline">Browse All Food Weeks</a>
      </div>
    </header>

    <main>
      <h2 class="section-title">Participating Restaurants &amp; Dishes (${weekDishes.length})</h2>
      <div class="dishes-grid">
        ${dishesListHtml}
      </div>
    </main>

    <footer>
      <p>PDX Food Week is an independent community project. Data referenced from organizer event listings. Not affiliated with Portland Mercury or The Oregonian.</p>
      <p style="margin-top: 8px;"><a href="../" style="color: inherit;">Back to Home</a> • <a href="../privacy.html" style="color: inherit;">Privacy Policy</a> • <a href="../terms.html" style="color: inherit;">Terms of Use</a></p>
    </footer>
  </div>
</body>
</html>`;

  const filename = `${week.id}.html`;
  fs.writeFileSync(path.join(weeksOutputDir, filename), html, 'utf8');
  generatedWeekPages.push({ id: week.id, title: weekTitle, url: canonicalUrl });
}

console.log(`Generated ${generatedWeekPages.length} food week landing pages in 'weeks/'.`);

// 4. Generate Enhanced Dish Pages (d/<weekId>-<dishId>.html)
let generatedDishCount = 0;
const generatedDishPages = [];

for (const dish of restaurants) {
  const week = weekMap.get(dish.weekId);
  const weekName = week ? week.name : 'PDX Food Week';
  const weekUrl = `../weeks/${dish.weekId}.html`;
  const dishTitle = `${dish.dish || 'Special Dish'} @ ${dish.restaurant || 'Restaurant'}`;
  const rawDesc = dish.desc || (dish.neighborhood ? `Featured for ${weekName} in ${dish.neighborhood}, Portland!` : `Featured for ${weekName} in Portland, OR!`);
  const metaDescription = rawDesc.length > 220 ? rawDesc.substring(0, 217) + '...' : rawDesc;
  const image = dish.image || 'https://www.pdxfoodweek.com/images/og-preview.png';
  const redirectUrl = `../?week=${encodeURIComponent(dish.weekId)}&dish=${encodeURIComponent(dish.id)}`;
  const canonicalUrl = `https://www.pdxfoodweek.com/d/${dish.weekId}-${dish.id}.html`;

  // Schema.org JSON-LD
  const restaurantSchema = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: dish.restaurant || 'Restaurant',
    address: {
      '@type': 'PostalAddress',
      streetAddress: dish.address || '',
      addressLocality: 'Portland',
      addressRegion: 'OR',
      addressCountry: 'US'
    },
    geo: (dish.lat && dish.lng) ? {
      '@type': 'GeoCoordinates',
      latitude: dish.lat,
      longitude: dish.lng
    } : undefined,
    hasMenuItem: {
      '@type': 'MenuItem',
      name: dish.dish || 'Special Dish',
      description: dish.desc || '',
      image: dish.image || undefined,
      suitableForDiet: [
        dish.type === 'vegan' || dish.veganOption ? 'https://schema.org/VeganDiet' : null,
        dish.type === 'vegetarian' || dish.vegOption ? 'https://schema.org/VegetarianDiet' : null,
        dish.glutenFree ? 'https://schema.org/GlutenFreeDiet' : null
      ].filter(Boolean)
    }
  };

  const hoursSummary = dish.hours ? formatHoursSummary(dish.hours) : '';

  const tagBadges = [];
  if (dish.type) tagBadges.push(`<span class="badge badge-primary">${escapeHtml(dish.type)}</span>`);
  if (dish.glutenFree) tagBadges.push('<span class="badge badge-gf">Gluten-Free</span>');
  if (dish.wholePie) tagBadges.push('<span class="badge badge-subtle">Whole Pie</span>');
  if (dish.minors) tagBadges.push('<span class="badge badge-subtle">Family Friendly</span>');
  if (dish.takeout) tagBadges.push('<span class="badge badge-subtle">Takeout Available</span>');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(dishTitle)} — ${escapeHtml(weekName)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- OpenGraph -->
  <meta property="og:site_name" content="PDX Food Week">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(dishTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${canonicalUrl}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(dishTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(restaurantSchema, null, 2)}
  </script>

  <style>
    :root {
      --primary: ${week ? (week.color || '#B5472E') : '#B5472E'};
      --ink: #1A1208;
      --cream: #FBF6EF;
      --card-bg: #FFFFFF;
      --border: rgba(26, 18, 8, 0.12);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--cream);
      color: var(--ink);
      line-height: 1.5;
      padding: 24px 16px 64px;
    }
    .card-container {
      max-width: 580px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(26, 18, 8, 0.08);
    }
    .dish-img {
      width: 100%;
      height: 280px;
      object-fit: cover;
      display: block;
      background: #eee;
    }
    .card-body { padding: 24px; }
    .breadcrumbs { font-size: 13px; color: rgba(26, 18, 8, 0.6); margin-bottom: 12px; }
    .breadcrumbs a { color: inherit; text-decoration: none; }
    .breadcrumbs a:hover { text-decoration: underline; }
    .restaurant-label { font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--primary); letter-spacing: 0.04em; }
    .dish-title { font-size: 26px; font-weight: 800; line-height: 1.2; margin: 4px 0 12px; }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .badge {
      display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 9999px;
      font-size: 12px; font-weight: 600;
    }
    .badge-primary { background: var(--primary); color: #fff; }
    .badge-subtle { background: rgba(26, 18, 8, 0.08); color: var(--ink); }
    .badge-gf { background: #E5EFEA; color: #286A5F; font-weight: 700; }
    .desc { font-size: 15px; color: rgba(26, 18, 8, 0.85); line-height: 1.55; margin-bottom: 20px; }
    .info-box {
      background: rgba(26, 18, 8, 0.03); border: 1px solid rgba(26, 18, 8, 0.08);
      border-radius: 10px; padding: 14px; font-size: 13px; margin-bottom: 24px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .info-row { display: flex; gap: 8px; align-items: flex-start; }
    .btn-main {
      display: flex; justify-content: center; align-items: center; width: 100%;
      background: var(--primary); color: #fff; padding: 14px 20px; border-radius: 12px;
      font-weight: 700; font-size: 15px; text-decoration: none; margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    .btn-main:hover { opacity: 0.92; }
    .nav-links { display: flex; justify-content: space-between; font-size: 13px; }
    .nav-links a { color: rgba(26, 18, 8, 0.6); text-decoration: underline; }
    .nav-links a:hover { color: var(--ink); }
  </style>
</head>
<body>
  <div class="card-container">
    ${dish.image ? `<img src="${escapeHtml(dish.image)}" alt="${escapeHtml(dishTitle)}" class="dish-img">` : ''}
    <div class="card-body">
      <div class="breadcrumbs">
        <a href="../">PDX Food Week</a> &gt; <a href="${weekUrl}">${escapeHtml(weekName)}</a>
      </div>
      <div class="restaurant-label">${escapeHtml(dish.restaurant || 'Restaurant')}</div>
      <h1 class="dish-title">${escapeHtml(dish.dish || 'Special Dish')}</h1>
      
      <div class="tags">
        ${tagBadges.join(' ')}
      </div>

      <p class="desc">${escapeHtml(dish.desc || rawDesc)}</p>

      <div class="info-box">
        ${dish.neighborhood ? `<div class="info-row"><span>📍</span><div><strong>Neighborhood:</strong> ${escapeHtml(dish.neighborhood)}</div></div>` : ''}
        ${dish.address ? `<div class="info-row"><span>🏠</span><div><strong>Address:</strong> ${escapeHtml(dish.address)}</div></div>` : ''}
        ${hoursSummary ? `<div class="info-row"><span>🕒</span><div><strong>Hours:</strong> ${escapeHtml(hoursSummary)}</div></div>` : ''}
      </div>

      <a href="${redirectUrl}" class="btn-main">
        🚀 Open in Interactive App &amp; Save Dish
      </a>

      <div class="nav-links">
        <a href="${weekUrl}">&larr; View all ${escapeHtml(weekName)} spots</a>
        <a href="../">All Food Weeks</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  const filename = `${dish.weekId}-${dish.id}.html`;
  fs.writeFileSync(path.join(dishOutputDir, filename), html, 'utf8');
  generatedDishCount++;
  generatedDishPages.push(canonicalUrl);
}

console.log(`Generated ${generatedDishCount} enhanced dish pages in 'd/'.`);

// 5. Generate sitemap.xml
const sitemapUrls = [
  { loc: 'https://www.pdxfoodweek.com/', priority: '1.0', changefreq: 'daily' },
  { loc: 'https://www.pdxfoodweek.com/privacy.html', priority: '0.3', changefreq: 'monthly' },
  { loc: 'https://www.pdxfoodweek.com/terms.html', priority: '0.3', changefreq: 'monthly' }
];

for (const wp of generatedWeekPages) {
  sitemapUrls.push({
    loc: wp.url,
    priority: '0.8',
    changefreq: 'weekly'
  });
}

for (const dpUrl of generatedDishPages) {
  sitemapUrls.push({
    loc: dpUrl,
    priority: '0.6',
    changefreq: 'weekly'
  });
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(path.join(projectRoot, 'sitemap.xml'), sitemapXml, 'utf8');
console.log(`Generated sitemap.xml with ${sitemapUrls.length} indexed URLs.`);

// 6. Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://www.pdxfoodweek.com/sitemap.xml
`;
fs.writeFileSync(path.join(projectRoot, 'robots.txt'), robotsTxt, 'utf8');
console.log('Generated robots.txt successfully.');

