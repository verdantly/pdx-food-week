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
const hoodsOutputDir = path.join(projectRoot, 'neighborhoods');
const dietsOutputDir = path.join(projectRoot, 'diets');

// Ensure output directories exist
if (!fs.existsSync(dishOutputDir)) {
  fs.mkdirSync(dishOutputDir, { recursive: true });
}
if (!fs.existsSync(weeksOutputDir)) {
  fs.mkdirSync(weeksOutputDir, { recursive: true });
}
if (!fs.existsSync(hoodsOutputDir)) {
  fs.mkdirSync(hoodsOutputDir, { recursive: true });
}
if (!fs.existsSync(dietsOutputDir)) {
  fs.mkdirSync(dietsOutputDir, { recursive: true });
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

// ── Shared Design System Tokens, Fonts & Styles for SEO Pages ──
const SHARED_FONTS_HTML = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap">
`;

function getSharedStyles(themeColor = '#B5472E') {
  return `
    :root {
      --pizza: ${themeColor};
      --primary: ${themeColor};
      --ink: #1A1208;
      --ink-70: rgba(26, 18, 8, 0.72);
      --ink-60: rgba(26, 18, 8, 0.60);
      --ink-30: rgba(26, 18, 8, 0.35);
      --cream: #FBF6EF;
      --card-bg: #FFFFFF;
      --border: rgba(26, 18, 8, 0.12);
      --header-bg: #1A1208;
      --header-ink: #FBF6EF;
      --font-brand: 'Syne', sans-serif;
      --font-display: 'Fraunces', Georgia, serif;
      --font-body: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      --radius: 12px;
      --radius-sm: 8px;
      --shadow: 0 2px 12px rgba(26, 18, 8, 0.08);
      --transition: 0.18s ease;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --ink: #F5F0EB;
        --ink-70: rgba(245, 240, 235, 0.75);
        --ink-60: rgba(245, 240, 235, 0.65);
        --ink-30: rgba(245, 240, 235, 0.35);
        --cream: #141414;
        --card-bg: #1E1E1E;
        --border: rgba(255, 255, 255, 0.12);
        --header-bg: #141414;
        --header-ink: #F5F0EB;
        --shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
      }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-body);
      background: var(--cream);
      color: var(--ink);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Navigation Header */
    .app-header-bar {
      background: var(--header-bg);
      color: var(--header-ink);
      padding: 12px 20px;
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .app-header-inner {
      max-width: 1080px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .app-wordmark {
      font-family: var(--font-brand);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      text-transform: lowercase;
      color: var(--header-ink);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: color var(--transition);
    }
    .app-wordmark:hover { color: var(--pizza); }
    .btn-header-cta {
      background: var(--pizza);
      color: #fff;
      font-family: var(--font-body);
      font-size: 12.5px;
      font-weight: 700;
      padding: 7px 16px;
      border-radius: 20px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity var(--transition), transform var(--transition);
    }
    .btn-header-cta:hover { opacity: 0.92; transform: translateY(-1px); }

    /* Page Container */
    .container { max-width: 1080px; margin: 0 auto; padding: 28px 16px 64px; }
    .breadcrumbs { font-size: 13px; color: var(--ink-70); margin-bottom: 14px; }
    .breadcrumbs a { color: inherit; text-decoration: none; }
    .breadcrumbs a:hover { text-decoration: underline; color: var(--pizza); }

    /* Hero Typography */
    .hero-title {
      font-family: var(--font-display);
      font-size: clamp(30px, 5.2vw, 46px);
      font-weight: 700;
      line-height: 1.15;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    .hero-title em {
      font-style: italic;
      color: var(--pizza);
    }
    .hero-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }

    /* Badges & Dietary Tags */
    .badge {
      display: inline-flex; align-items: center; padding: 4px 11px; border-radius: 9999px;
      font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .badge-primary { background: var(--pizza); color: #fff; }
    .badge-dark { background: var(--header-bg); color: #fff; border: 1px solid var(--border); }
    .badge-subtle { background: rgba(26, 18, 8, 0.08); color: var(--ink); }
    .badge-status { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }

    .tag {
      display: inline-flex; align-items: center; font-size: 11px; font-weight: 700;
      padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .tag-meat { background: rgba(181, 71, 46, 0.12); color: #B5472E; }
    .tag-veg { background: rgba(138, 92, 20, 0.14); color: #8A5C14; }
    .tag-vegan { background: rgba(46, 125, 50, 0.14); color: #2E7D32; }
    .tag-gf { background: rgba(40, 106, 95, 0.14); color: #286A5F; }
    .tag-subtle { background: rgba(26, 18, 8, 0.06); color: var(--ink-70); }

    [data-theme="dark"] .badge-subtle,
    @media (prefers-color-scheme: dark) {
      .badge-subtle { background: rgba(255, 255, 255, 0.1); color: var(--ink); }
      .tag-meat { background: rgba(220, 80, 50, 0.22); color: #FF8A70; }
      .tag-veg { background: rgba(220, 160, 40, 0.22); color: #F5C065; }
      .tag-vegan { background: rgba(60, 180, 80, 0.22); color: #72E088; }
      .tag-gf { background: rgba(70, 190, 170, 0.22); color: #6CE0D0; }
      .tag-subtle { background: rgba(255, 255, 255, 0.08); color: var(--ink-70); }
    }

    .hero-desc { font-size: 16.5px; color: var(--ink-70); max-width: 760px; margin-bottom: 24px; line-height: 1.6; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 36px; }
    .btn-main {
      background: var(--pizza); color: #fff; padding: 12px 24px; border-radius: 24px;
      font-weight: 700; font-size: 14.5px; text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
      transition: opacity var(--transition), transform var(--transition);
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    .btn-main:hover { opacity: 0.92; transform: translateY(-1px); }
    .btn-outline {
      background: var(--card-bg); color: var(--ink); border: 1.5px solid var(--border); padding: 11px 20px;
      border-radius: 24px; font-weight: 600; font-size: 14px; text-decoration: none;
      transition: background var(--transition);
    }
    .btn-outline:hover { background: rgba(26, 18, 8, 0.04); }

    /* Dish Cards Grid */
    .section-title {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 700;
      margin: 36px 0 20px;
      letter-spacing: -0.01em;
    }
    .dishes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

    /* Dish Card Component matching app design */
    .dish-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: border-color var(--transition), box-shadow var(--transition);
    }
    .dish-card:hover {
      border-color: rgba(26, 18, 8, 0.25);
      box-shadow: var(--shadow);
    }
    .dish-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }
    .card-restaurant {
      font-family: var(--font-body);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--pizza);
      margin-bottom: 3px;
    }
    .card-dish {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
      color: var(--ink);
    }
    .card-dish a {
      color: inherit;
      text-decoration: none;
      transition: color var(--transition);
    }
    .card-dish a:hover {
      color: var(--pizza);
    }
    .dish-emoji { font-size: 24px; line-height: 1; flex-shrink: 0; }
    .dish-desc {
      font-size: 13.5px;
      color: var(--ink-70);
      line-height: 1.45;
      margin-bottom: 12px;
    }
    .dish-meta {
      font-size: 12.5px;
      color: var(--ink-60);
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dish-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .dish-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border);
      padding-top: 12px;
      font-size: 13px;
    }
    .link-detail {
      color: var(--pizza);
      font-weight: 600;
      text-decoration: none;
    }
    .link-detail:hover { text-decoration: underline; }
    .btn-app-sm {
      background: rgba(26, 18, 8, 0.06);
      color: var(--ink);
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 12px;
      text-decoration: none;
      transition: background var(--transition), color var(--transition);
    }
    .btn-app-sm:hover { background: var(--pizza); color: #fff; }

    /* Footer */
    footer {
      margin-top: 56px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
      font-size: 13px;
      color: var(--ink-60);
      text-align: center;
      line-height: 1.6;
    }
    footer a { color: inherit; }
  `;
}

function getAppHeaderHtml(activeDeepLink = '../') {
  return `
  <header class="app-header-bar">
    <div class="app-header-inner">
      <a href="../" class="app-wordmark">
        <span>🍔</span>
        <span>pdx food week</span>
      </a>
      <a href="${activeDeepLink}" class="btn-header-cta">
        <span>Open App</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </a>
    </div>
  </header>
  `;
}

function renderDishTagBadges(dish) {
  const tagBadges = [];
  if (dish.type) {
    const t = String(dish.type).toLowerCase();
    const tagClass = t === 'vegan' ? 'tag-vegan' : (t === 'vegetarian' ? 'tag-veg' : 'tag-meat');
    tagBadges.push(`<span class="tag ${tagClass}">${escapeHtml(dish.type)}</span>`);
  }
  if (dish.glutenFree) tagBadges.push('<span class="tag tag-gf">GF</span>');
  if (dish.wholePie) tagBadges.push('<span class="tag tag-subtle">Whole Pie</span>');
  if (dish.minors) tagBadges.push('<span class="tag tag-subtle">Family OK</span>');
  if (dish.takeout) tagBadges.push('<span class="tag tag-subtle">Takeout</span>');
  return tagBadges.join(' ');
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
    const tagBadgesHtml = renderDishTagBadges(d);

    return `
      <div class="dish-card">
        <div>
          <div class="dish-card-header">
            <div>
              <div class="card-restaurant">${escapeHtml(d.restaurant)}</div>
              <h3 class="card-dish"><a href="${dishUrl}">${escapeHtml(d.dish || 'Special Dish')}</a></h3>
            </div>
            ${d.emoji ? `<span class="dish-emoji">${escapeHtml(d.emoji)}</span>` : ''}
          </div>
          ${d.desc ? `<p class="dish-desc">${escapeHtml(d.desc)}</p>` : ''}
          <div class="dish-meta">
            ${d.neighborhood ? `<span>📍 ${escapeHtml(d.neighborhood)}</span>` : ''}
            ${d.address ? `<span class="dish-address">${escapeHtml(d.address)}</span>` : ''}
          </div>
          ${tagBadgesHtml ? `<div class="dish-tags">${tagBadgesHtml}</div>` : ''}
        </div>
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
  ${SHARED_FONTS_HTML}

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
${getSharedStyles(week.color || '#B5472E')}
  </style>
</head>
<body>
  ${getAppHeaderHtml(appDeepLink)}
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

// 3b. Generate Upcoming Food Week Landing Pages (e.g., Mac & Cheese Week)
const upcomingFoodWeeks = context.window.UPCOMING_FOOD_WEEKS || [];
for (const week of upcomingFoodWeeks) {
  const weekTitle = `Portland ${week.name}`;
  const metaDescription = `${week.description || `Get ready for Portland ${week.name} (${week.dates || '2026'})!`} Check dates, pricing, event organizer details, and updates on participating Portland restaurants & food carts.`;
  const canonicalUrl = `https://www.pdxfoodweek.com/weeks/${week.id}.html`;

  const foodEventSchema = {
    '@context': 'https://schema.org',
    '@type': 'FoodEvent',
    name: week.name,
    description: metaDescription,
    startDate: week.startDate || '2026-11-01',
    endDate: week.endDate || '2026-11-30',
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
      name: week.organizer || 'The Actual Portland',
      url: week.url || 'https://www.theactualportland.com'
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      description: (week.pricePills && week.pricePills.join(', ')) || '$10 mac & cheese specials'
    }
  };

  const faqSchema = (week.faqs && week.faqs.length > 0) ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: week.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  } : null;

  const faqsHtml = (week.faqs && week.faqs.length > 0) ? `
    <section class="faq-section">
      <h2 class="section-title">Frequently Asked Questions</h2>
      <div class="faq-list">
        ${week.faqs.map(faq => `
          <div class="faq-card">
            <h3 class="faq-question">${escapeHtml(faq.question)}</h3>
            <p class="faq-answer">${escapeHtml(faq.answer)}</p>
          </div>
        `).join('\n')}
      </div>
    </section>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(weekTitle)} — Guide, Dates &amp; Participating Spots</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">
  ${SHARED_FONTS_HTML}

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
  ${faqSchema ? `
  <script type="application/ld+json">
${JSON.stringify(faqSchema, null, 2)}
  </script>` : ''}

  <style>
${getSharedStyles(week.color || '#E69500')}
    .info-card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 24px; margin-bottom: 24px; box-shadow: var(--shadow);
    }
    .info-card h3 {
      font-family: var(--font-display);
      font-size: 20px; font-weight: 700; margin-bottom: 12px; color: var(--pizza);
    }
    .info-card p { font-size: 15px; color: var(--ink-70); line-height: 1.6; margin-bottom: 12px; }
    .info-card p:last-child { margin-bottom: 0; }
    .faq-list { display: flex; flex-direction: column; gap: 14px; }
    .faq-card {
      background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 18px 20px;
    }
    .faq-question {
      font-family: var(--font-display);
      font-size: 17px; font-weight: 700; margin-bottom: 8px; color: var(--ink);
    }
    .faq-answer { font-size: 14.5px; color: var(--ink-70); line-height: 1.55; }
  </style>
</head>
<body>
  ${getAppHeaderHtml('../')}
  <div class="container">
    <header>
      <div class="breadcrumbs">
        <a href="../">PDX Food Week</a> &gt; <span>${escapeHtml(week.name)}</span>
      </div>
      <div class="hero-meta">
        <span class="badge badge-primary">${escapeHtml(week.emoji || '🧀')} ${escapeHtml(week.organizer || 'PDX Food Week')}</span>
        ${week.dates ? `<span class="badge badge-dark">${escapeHtml(week.dates)}</span>` : ''}
        <span class="badge badge-status">📅 Upcoming Event</span>
        ${week.pricePills ? week.pricePills.map(p => `<span class="badge badge-subtle">${escapeHtml(p)}</span>`).join('') : ''}
      </div>
      <h1 class="hero-title">${escapeHtml(weekTitle)}</h1>
      <p class="hero-desc">
        ${escapeHtml(week.description || `Portland ${week.name} is scheduled for ${week.dates || 'November 2026'}. Check back here for full menus, participating venues, interactive crawl maps, and dietary filter options!`)}
      </p>
      <div class="cta-row">
        <a href="../" class="btn-main">
          <span>🚀 Explore Active Food Weeks</span>
        </a>
        ${week.url ? `<a href="${escapeHtml(week.url)}" target="_blank" rel="noopener" class="btn-outline">Organizer Website &rarr;</a>` : ''}
      </div>
    </header>

    <main>
      <section class="info-card">
        <h3>${escapeHtml(week.aboutTitle || `🍽️ What is Portland ${week.name}?`)}</h3>
        <p>
          ${escapeHtml(week.aboutText || `Organized by ${week.organizer || 'local organizers'}, ${week.name} celebrates Portland's rich culinary scene with exclusive, limited-time food specials.`)}
        </p>
        <p>
          As the event approaches, this page and the PDX Food Week interactive web app will feature the complete directory of participating restaurants, dishes, addresses, hours, and customized filters.
        </p>
      </section>

      ${faqsHtml}
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

  const tagBadgesHtml = renderDishTagBadges(dish);
  const themeColor = week ? (week.color || '#B5472E') : '#B5472E';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(dishTitle)} — ${escapeHtml(weekName)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">
  ${SHARED_FONTS_HTML}

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
${getSharedStyles(themeColor)}
    .detail-wrapper {
      max-width: 640px;
      margin: 0 auto;
      padding: 24px 16px 64px;
    }
    .card-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow);
    }
    .dish-img {
      width: 100%;
      height: 320px;
      object-fit: cover;
      display: block;
      background: rgba(26, 18, 8, 0.05);
    }
    .card-body { padding: 24px; }
    .restaurant-label {
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--pizza);
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    .dish-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      margin: 4px 0 12px;
      color: var(--ink);
    }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .desc { font-size: 15px; color: var(--ink-70); line-height: 1.6; margin-bottom: 22px; }
    .info-box {
      background: rgba(26, 18, 8, 0.03); border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 14px 16px; font-size: 13px; margin-bottom: 24px;
      display: flex; flex-direction: column; gap: 10px;
    }
    @media (prefers-color-scheme: dark) {
      .info-box { background: rgba(255, 255, 255, 0.04); }
    }
    .info-row { display: flex; gap: 10px; align-items: flex-start; color: var(--ink-70); }
    .info-row strong { color: var(--ink); }
    .btn-main {
      display: flex; justify-content: center; align-items: center; width: 100%;
      background: var(--pizza); color: #fff; padding: 14px 20px; border-radius: 24px;
      font-weight: 700; font-size: 15px; text-decoration: none; margin-bottom: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      transition: opacity var(--transition), transform var(--transition);
    }
    .btn-main:hover { opacity: 0.92; transform: translateY(-1px); }
    .nav-links { display: flex; justify-content: space-between; font-size: 13px; margin-top: 10px; }
    .nav-links a { color: var(--ink-70); text-decoration: underline; }
    .nav-links a:hover { color: var(--pizza); }
  </style>
</head>
<body>
  ${getAppHeaderHtml(redirectUrl)}
  <div class="detail-wrapper">
    <div class="breadcrumbs">
      <a href="../">PDX Food Week</a> &gt; <a href="${weekUrl}">${escapeHtml(weekName)}</a> &gt; <span>${escapeHtml(dish.dish || 'Special')}</span>
    </div>

    <div class="card-container">
      ${dish.image ? `<img src="${escapeHtml(dish.image)}" alt="${escapeHtml(dishTitle)}" class="dish-img">` : ''}
      <div class="card-body">
        <div class="restaurant-label">${escapeHtml(dish.restaurant || 'Restaurant')}</div>
        <h1 class="dish-title">${escapeHtml(dish.dish || 'Special Dish')}</h1>
        
        ${tagBadgesHtml ? `<div class="tags">${tagBadgesHtml}</div>` : ''}

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

    <footer>
      <p>PDX Food Week is an independent community project. Data referenced from organizer event listings. Not affiliated with Portland Mercury or The Oregonian.</p>
      <p style="margin-top: 8px;"><a href="../">Back to Home</a> • <a href="../privacy.html">Privacy Policy</a> • <a href="../terms.html">Terms of Use</a></p>
    </footer>
  </div>
</body>
</html>`;

  const filename = `${dish.weekId}-${dish.id}.html`;
  fs.writeFileSync(path.join(dishOutputDir, filename), html, 'utf8');
  generatedDishCount++;
  generatedDishPages.push(canonicalUrl);
}

console.log(`Generated ${generatedDishCount} enhanced dish pages in 'd/'.`);

// 5. Generate Neighborhood Landing Pages (neighborhoods/<slug>.html)
const neighborhoodMap = new Map();
for (const dish of restaurants) {
  if (!dish.neighborhood) continue;
  const rawHood = dish.neighborhood.trim();
  const slug = rawHood.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!neighborhoodMap.has(slug)) {
    neighborhoodMap.set(slug, {
      slug,
      name: rawHood,
      dishes: []
    });
  }
  neighborhoodMap.get(slug).dishes.push(dish);
}

const generatedHoodPages = [];
for (const [slug, hoodData] of neighborhoodMap.entries()) {
  const hoodDishes = hoodData.dishes;
  const hoodTitle = `${hoodData.name} — Portland Food Week Spots & Menus`;
  const metaDescription = `Explore ${hoodDishes.length} special dishes and participating restaurants in ${hoodData.name} across Portland food weeks. Plan your crawl route on the map!`;
  const canonicalUrl = `https://www.pdxfoodweek.com/neighborhoods/${slug}.html`;

  const dishesListHtml = hoodDishes.map(d => {
    const dishUrl = `../d/${d.weekId}-${d.id}.html`;
    const dishDeepLink = `../?week=${encodeURIComponent(d.weekId)}&amp;dish=${encodeURIComponent(d.id)}`;
    const week = weekMap.get(d.weekId);
    const weekName = week ? week.name : d.weekId;
    const tagBadgesHtml = renderDishTagBadges(d);

    return `
      <div class="dish-card">
        <div>
          <div class="dish-card-header">
            <div>
              <div class="badge badge-primary" style="font-size: 10.5px; padding: 2px 7px; margin-bottom: 6px;">${escapeHtml(weekName)}</div>
              <div class="card-restaurant">${escapeHtml(d.restaurant)}</div>
              <h3 class="card-dish"><a href="${dishUrl}">${escapeHtml(d.dish || 'Special Dish')}</a></h3>
            </div>
            ${d.emoji ? `<span class="dish-emoji">${escapeHtml(d.emoji)}</span>` : ''}
          </div>
          ${d.desc ? `<p class="dish-desc">${escapeHtml(d.desc)}</p>` : ''}
          <div class="dish-meta">
            ${d.address ? `<span class="dish-address">🏠 ${escapeHtml(d.address)}</span>` : ''}
          </div>
          ${tagBadgesHtml ? `<div class="dish-tags">${tagBadgesHtml}</div>` : ''}
        </div>
        <div class="dish-card-footer">
          <a href="${dishUrl}" class="link-detail">View Dish Details &rarr;</a>
          <a href="${dishDeepLink}" class="btn-app-sm">Open in App</a>
        </div>
      </div>
    `;
  }).join('\n');

  const hoodSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hoodTitle,
    description: metaDescription,
    url: canonicalUrl,
    about: {
      '@type': 'Place',
      name: hoodData.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Portland',
        addressRegion: 'OR',
        addressCountry: 'US'
      }
    }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(hoodTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">
  ${SHARED_FONTS_HTML}

  <!-- OpenGraph -->
  <meta property="og:site_name" content="PDX Food Week">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(hoodTitle)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://www.pdxfoodweek.com/images/og-preview.png">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(hoodTitle)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="https://www.pdxfoodweek.com/images/og-preview.png">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(hoodSchema, null, 2)}
  </script>

  <style>
${getSharedStyles('#B5472E')}
  </style>
</head>
<body>
  ${getAppHeaderHtml('../')}
  <div class="container">
    <header>
      <div class="breadcrumbs">
        <a href="../">PDX Food Week</a> &gt; <span>${escapeHtml(hoodData.name)}</span>
      </div>
      <div class="hero-meta">
        <span class="badge badge-primary">📍 Neighborhood</span>
        <span class="badge badge-subtle">${hoodDishes.length} Spots</span>
      </div>
      <h1 class="hero-title">${escapeHtml(hoodData.name)} Food Week Guide</h1>
      <p class="hero-desc">
        Browse ${hoodDishes.length} special dishes and participating restaurants located in ${escapeHtml(hoodData.name)} across Portland's themed food weeks. Plan your crawl route and filter by dietary options!
      </p>
      <div class="cta-row">
        <a href="../" class="btn-main">
          <span>🚀 Explore All in App &amp; Map</span>
        </a>
        <a href="../" class="btn-outline">All Food Weeks</a>
      </div>
    </header>

    <main>
      <h2 class="section-title">Featured Dishes in ${escapeHtml(hoodData.name)} (${hoodDishes.length})</h2>
      <div class="dishes-grid">
        ${dishesListHtml}
      </div>
    </main>

    <footer>
      <p>PDX Food Week is an independent community project. Data referenced from organizer event listings. Not affiliated with Portland Mercury or The Oregonian.</p>
      <p style="margin-top: 8px;"><a href="../">Back to Home</a> • <a href="../privacy.html">Privacy Policy</a> • <a href="../terms.html">Terms of Use</a></p>
    </footer>
  </div>
</body>
</html>`;

  const filename = `${slug}.html`;
  fs.writeFileSync(path.join(hoodsOutputDir, filename), html, 'utf8');
  generatedHoodPages.push({ slug, name: hoodData.name, url: canonicalUrl });
}

console.log(`Generated ${generatedHoodPages.length} neighborhood landing pages in 'neighborhoods/'.`);

// 6. Generate Dietary Category Pages (diets/<diet-slug>.html)
const dietCategories = [
  {
    slug: 'vegan',
    title: 'Vegan Portland Food Week Dishes & Restaurants',
    filterLabel: 'Vegan',
    description: 'Find 100% plant-based and vegan specialty dishes participating across all 2026 Portland Food Weeks.',
    predicate: d => d.type === 'vegan' || d.veganOption === true,
    color: '#2E7D32'
  },
  {
    slug: 'vegetarian',
    title: 'Vegetarian Portland Food Week Dishes & Restaurants',
    filterLabel: 'Vegetarian',
    description: 'Explore delicious vegetarian-friendly pizzas, burgers, tacos, dumplings, and more for Portland Food Weeks.',
    predicate: d => d.type === 'vegetarian' || d.vegOption === true || d.type === 'vegan' || d.veganOption === true,
    color: '#8A5C14'
  },
  {
    slug: 'gluten-free',
    title: 'Gluten-Free Portland Food Week Dishes & Restaurants',
    filterLabel: 'Gluten-Free',
    description: 'Browse all restaurants offering gluten-free dishes or GF-friendly bun/crust options during Portland Food Weeks.',
    predicate: d => d.glutenFree === true,
    color: '#286A5F'
  }
];

const generatedDietPages = [];
for (const cat of dietCategories) {
  const matchingDishes = restaurants.filter(cat.predicate);
  const canonicalUrl = `https://www.pdxfoodweek.com/diets/${cat.slug}.html`;
  const metaDescription = `${cat.description} Browse ${matchingDishes.length} dishes with dietary flags, ingredients, and map locations!`;

  const dishesListHtml = matchingDishes.map(d => {
    const dishUrl = `../d/${d.weekId}-${d.id}.html`;
    const dishDeepLink = `../?week=${encodeURIComponent(d.weekId)}&amp;dish=${encodeURIComponent(d.id)}`;
    const week = weekMap.get(d.weekId);
    const weekName = week ? week.name : d.weekId;
    const tagBadgesHtml = renderDishTagBadges(d);

    return `
      <div class="dish-card">
        <div>
          <div class="dish-card-header">
            <div>
              <div class="badge badge-primary" style="font-size: 10.5px; padding: 2px 7px; margin-bottom: 6px;">${escapeHtml(weekName)}</div>
              <div class="card-restaurant">${escapeHtml(d.restaurant)}</div>
              <h3 class="card-dish"><a href="${dishUrl}">${escapeHtml(d.dish || 'Special Dish')}</a></h3>
            </div>
            ${d.emoji ? `<span class="dish-emoji">${escapeHtml(d.emoji)}</span>` : ''}
          </div>
          ${d.desc ? `<p class="dish-desc">${escapeHtml(d.desc)}</p>` : ''}
          <div class="dish-meta">
            ${d.neighborhood ? `<span>📍 ${escapeHtml(d.neighborhood)}</span>` : ''}
            ${d.address ? `<span class="dish-address">🏠 ${escapeHtml(d.address)}</span>` : ''}
          </div>
          ${tagBadgesHtml ? `<div class="dish-tags">${tagBadgesHtml}</div>` : ''}
        </div>
        <div class="dish-card-footer">
          <a href="${dishUrl}" class="link-detail">View Dish Details &rarr;</a>
          <a href="${dishDeepLink}" class="btn-app-sm">Open in App</a>
        </div>
      </div>
    `;
  }).join('\n');

  const dietSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cat.title,
    description: metaDescription,
    url: canonicalUrl
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(cat.title)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <link rel="canonical" href="${canonicalUrl}">
  ${SHARED_FONTS_HTML}

  <!-- OpenGraph -->
  <meta property="og:site_name" content="PDX Food Week">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(cat.title)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://www.pdxfoodweek.com/images/og-preview.png">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(cat.title)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
  <meta name="twitter:image" content="https://www.pdxfoodweek.com/images/og-preview.png">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(dietSchema, null, 2)}
  </script>

  <style>
${getSharedStyles(cat.color)}
  </style>
</head>
<body>
  ${getAppHeaderHtml('../')}
  <div class="container">
    <header>
      <div class="breadcrumbs">
        <a href="../">PDX Food Week</a> &gt; <span>${escapeHtml(cat.filterLabel)} Dishes</span>
      </div>
      <div class="hero-meta">
        <span class="badge badge-primary">🥗 ${escapeHtml(cat.filterLabel)} Category</span>
        <span class="badge badge-subtle">${matchingDishes.length} Dishes</span>
      </div>
      <h1 class="hero-title">${escapeHtml(cat.title)}</h1>
      <p class="hero-desc">
        Browse all ${matchingDishes.length} ${escapeHtml(cat.filterLabel).toLowerCase()} dishes featured across Portland's themed food weeks. Filter, plan crawl routes, and view locations!
      </p>
      <div class="cta-row">
        <a href="../" class="btn-main">
          <span>🚀 Explore in Interactive App</span>
        </a>
        <a href="../" class="btn-outline">All Food Weeks</a>
      </div>
    </header>

    <main>
      <h2 class="section-title">${escapeHtml(cat.filterLabel)} Offerings Across Portland (${matchingDishes.length})</h2>
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

  const filename = `${cat.slug}.html`;
  fs.writeFileSync(path.join(dietsOutputDir, filename), html, 'utf8');
  generatedDietPages.push({ slug: cat.slug, url: canonicalUrl });
}

console.log(`Generated ${generatedDietPages.length} dietary category landing pages in 'diets/'.`);

// 7. Generate sitemap.xml
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

for (const dp of generatedDietPages) {
  sitemapUrls.push({
    loc: dp.url,
    priority: '0.8',
    changefreq: 'weekly'
  });
}

for (const hp of generatedHoodPages) {
  sitemapUrls.push({
    loc: hp.url,
    priority: '0.7',
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

// 8. Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://www.pdxfoodweek.com/sitemap.xml
`;
fs.writeFileSync(path.join(projectRoot, 'robots.txt'), robotsTxt, 'utf8');
console.log('Generated robots.txt successfully.');

