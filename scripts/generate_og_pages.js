import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const outputDir = path.join(projectRoot, 'd');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Global context mock for dataset files
const context = {
  window: {
    FOOD_WEEKS: [],
    RESTAURANTS: []
  }
};
vm.createContext(context);

// Load all dataset scripts from data/
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

const foodWeeks = context.window.FOOD_WEEKS || [];
let restaurants = context.window.RESTAURANTS || [];

if (targetFilter) {
  restaurants = restaurants.filter(d => 
    (d.weekId && d.weekId.toLowerCase().includes(targetFilter))
  );
  console.log(`Filtering dishes matching week: "${targetFilter}"...`);
}

console.log(`Loaded ${foodWeeks.length} food weeks and ${restaurants.length} dishes to generate.`);

const weekMap = new Map(foodWeeks.map(w => [w.id, w]));

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let generatedCount = 0;

for (const dish of restaurants) {
  const week = weekMap.get(dish.weekId);
  const weekName = week ? week.name : 'PDX Food Week';
  const dishTitle = `${dish.dish || 'Special Dish'} @ ${dish.restaurant || 'Restaurant'}`;
  const rawDesc = dish.desc || (dish.neighborhood ? `Featured for ${weekName} in ${dish.neighborhood}, Portland!` : `Featured for ${weekName} in Portland, OR!`);
  const description = rawDesc.length > 200 ? rawDesc.substring(0, 197) + '...' : rawDesc;
  const image = dish.image || 'https://www.pdxfoodweek.com/og_preview_card.jpg';
  const redirectUrl = `/?week=${encodeURIComponent(dish.weekId)}&dish=${encodeURIComponent(dish.id)}`;
  const canonicalUrl = `https://www.pdxfoodweek.com/d/${dish.weekId}-${dish.id}.html`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(dishTitle)} — ${escapeHtml(weekName)}</title>
  
  <!-- OpenGraph Social Metadata -->
  <meta property="og:site_name" content="PDX Food Week">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(dishTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  
  <!-- Twitter Card Metadata -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(dishTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">

  <!-- Instant Client Redirect -->
  <script>
    window.location.replace(${JSON.stringify(redirectUrl)});
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">
  </noscript>
</head>
<body style="font-family: system-ui, sans-serif; padding: 40px; text-align: center; background: #FBF6EF; color: #1A1208;">
  <h1>${escapeHtml(dishTitle)}</h1>
  <p>${escapeHtml(description)}</p>
  <p>Redirecting to <a href="${escapeHtml(redirectUrl)}">PDX Food Week App</a>...</p>
</body>
</html>`;

  const filename = `${dish.weekId}-${dish.id}.html`;
  fs.writeFileSync(path.join(outputDir, filename), html, 'utf8');
  generatedCount++;
}

console.log(`Successfully generated ${generatedCount} static OpenGraph share pages in 'd/'.`);
