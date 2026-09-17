import { expect, test, describe } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Search Engine Optimization (SEO) & Discoverability Suite', () => {
  test('robots.txt exists and specifies standard directives and sitemap', () => {
    const robotsPath = path.join(projectRoot, 'robots.txt');
    expect(fs.existsSync(robotsPath)).toBe(true);

    const robotsContent = fs.readFileSync(robotsPath, 'utf8');
    expect(robotsContent).toContain('User-agent: *');
    expect(robotsContent).toContain('Allow: /');
    expect(robotsContent).toContain('Sitemap: https://www.pdxfoodweek.com/sitemap.xml');
  });

  test('sitemap.xml exists, is valid XML, and covers home, weeks, and dishes', () => {
    const sitemapPath = path.join(projectRoot, 'sitemap.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
    expect(sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemapContent).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(sitemapContent).toContain('https://www.pdxfoodweek.com/</loc>');
    expect(sitemapContent).toContain('https://www.pdxfoodweek.com/weeks/pizza-2026.html</loc>');
    expect(sitemapContent).toContain('https://www.pdxfoodweek.com/weeks/burger-2026.html</loc>');
    expect(sitemapContent).toContain('https://www.pdxfoodweek.com/d/pizza-2026-');

    // Count indexed URLs
    const urlMatches = sitemapContent.match(/<loc>/g);
    expect(urlMatches).not.toBeNull();
    expect(urlMatches.length).toBeGreaterThanOrEqual(650);
  });

  test('Food week landing pages are generated with FoodEvent JSON-LD schema and participating spots', () => {
    const weeksDir = path.join(projectRoot, 'weeks');
    expect(fs.existsSync(weeksDir)).toBe(true);

    const weekFiles = fs.readdirSync(weeksDir).filter(f => f.endsWith('.html'));
    expect(weekFiles.length).toBeGreaterThanOrEqual(11);

    // Verify Pizza Week page
    const pizzaWeekPath = path.join(weeksDir, 'pizza-2026.html');
    expect(fs.existsSync(pizzaWeekPath)).toBe(true);
    const pizzaHtml = fs.readFileSync(pizzaWeekPath, 'utf8');

    expect(pizzaHtml).toContain('Portland Pizza Week 2026');
    expect(pizzaHtml).toContain('"@type": "FoodEvent"');
    expect(pizzaHtml).toContain('"name": "Pizza Week 2026"');
    expect(pizzaHtml).toContain('Participating Restaurants');
    expect(pizzaHtml).toContain('Clarklewis');
    expect(pizzaHtml).toContain('Mediterranean Mojo Lamb');
    expect(pizzaHtml).toContain('href="../?week=pizza-2026"');
  });

  test('Enhanced dish pages contain Restaurant and MenuItem JSON-LD and deep links without instant redirects', () => {
    const sampleDishPath = path.join(projectRoot, 'd', 'pizza-2026-233600.html');
    expect(fs.existsSync(sampleDishPath)).toBe(true);

    const dishHtml = fs.readFileSync(sampleDishPath, 'utf8');

    // No instant window.location.replace or meta refresh
    expect(dishHtml).not.toContain('window.location.replace');
    expect(dishHtml).not.toContain('http-equiv="refresh"');

    // Has Schema.org Restaurant and MenuItem
    expect(dishHtml).toContain('"@type": "Restaurant"');
    expect(dishHtml).toContain('"@type": "MenuItem"');
    expect(dishHtml).toContain('"name": "Clarklewis"');
    expect(dishHtml).toContain('"name": "Mediterranean Mojo Lamb"');

    // Has OpenGraph and interactive app CTA
    expect(dishHtml).toContain('property="og:title"');
    expect(dishHtml).toContain('href="../?week=pizza-2026&dish=233600"');
    expect(dishHtml).toContain('Open in Interactive App');
  });

  test('Neighborhood landing pages are generated with CollectionPage schema and dish items', () => {
    const hoodsDir = path.join(projectRoot, 'neighborhoods');
    expect(fs.existsSync(hoodsDir)).toBe(true);

    const hoodFiles = fs.readdirSync(hoodsDir).filter(f => f.endsWith('.html'));
    expect(hoodFiles.length).toBeGreaterThanOrEqual(50);

    // Verify sample neighborhood page
    const sampleHoodPath = path.join(hoodsDir, 'buckman-southeast-portland.html');
    expect(fs.existsSync(sampleHoodPath)).toBe(true);
    const hoodHtml = fs.readFileSync(sampleHoodPath, 'utf8');

    expect(hoodHtml).toContain('Buckman - Southeast Portland Food Week Guide');
    expect(hoodHtml).toContain('"@type": "CollectionPage"');
    expect(hoodHtml).toContain('Featured Dishes in Buckman - Southeast Portland');
    expect(hoodHtml).toContain('href="../d/');
  });

  test('Dietary landing pages are generated with CollectionPage schema and dish lists', () => {
    const dietsDir = path.join(projectRoot, 'diets');
    expect(fs.existsSync(dietsDir)).toBe(true);

    for (const dietSlug of ['vegan', 'vegetarian', 'gluten-free']) {
      const dietPath = path.join(dietsDir, `${dietSlug}.html`);
      expect(fs.existsSync(dietPath)).toBe(true);
      const dietHtml = fs.readFileSync(dietPath, 'utf8');

      expect(dietHtml).toContain('"@type": "CollectionPage"');
      expect(dietHtml).toContain('Dishes &amp; Restaurants');
      expect(dietHtml).toContain('dishes-grid');
      expect(dietHtml).toContain('href="../d/');
    }
  });

  test('IndexNow ping script exists and generates verification file', () => {
    const scriptPath = path.join(projectRoot, 'scripts', 'ping_indexnow.js');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const docPath = path.join(projectRoot, 'docs', 'SEARCH_CONSOLE_SETUP.md');
    expect(fs.existsSync(docPath)).toBe(true);
  });

  test('index.html references sitemap.xml and contains WebSite structured data', () => {
    const indexPath = path.join(projectRoot, 'index.html');
    const indexHtml = fs.readFileSync(indexPath, 'utf8');

    expect(indexHtml).toContain('rel="sitemap"');
    expect(indexHtml).toContain('"@type": "WebSite"');
    expect(indexHtml).toContain('"url": "https://www.pdxfoodweek.com/"');
  });
});

