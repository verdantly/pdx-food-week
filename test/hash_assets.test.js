import { expect, test, describe } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeCombinedHash, updateAssetVersions } from '../scripts/hash_assets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Asset Hashing & Service Worker Versioning', () => {
  test('computeCombinedHash returns an 8-character hexadecimal string', () => {
    const hash = computeCombinedHash();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(8);
    expect(/^[0-9a-f]{8}$/.test(hash)).toBe(true);
  });

  test('updateAssetVersions synchronizes index.html and sw.js with computed hash', () => {
    const { version } = updateAssetVersions();
    expect(version).toBe(computeCombinedHash());

    const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    const swJs = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');

    // Verify index.html contains the hash query string
    expect(indexHtml).toContain(`href="css/style.css?v=${version}"`);
    expect(indexHtml).toContain(`src="js/meta.js?v=${version}"`);
    expect(indexHtml).toContain(`src="js/app.js?v=${version}"`);

    // Verify sw.js contains the cache name and assets with the same hash
    expect(swJs).toContain(`const CACHE_NAME = 'pdxfw-cache-${version}';`);
    expect(swJs).toContain(`'css/style.css?v=${version}'`);
    expect(swJs).toContain(`'js/app.js?v=${version}'`);
    expect(swJs).toContain(`'js/meta.js?v=${version}'`);
  });

  test('sw.js navigation fetch uses cache: "no-cache" for fresh HTML loading', () => {
    const swJs = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');
    expect(swJs).toContain("cache: 'no-cache'");
    expect(swJs).toContain("isNavigation");
  });

  test('sw.js awaits skipWaiting() and clients.claim() inside waitUntil and never serves stale versioned assets when online', () => {
    const swJs = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');

    // skipWaiting and clients.claim must be chained inside event.waitUntil
    expect(swJs).toContain('.then(() => self.skipWaiting())');
    expect(swJs).toContain('.then(() => self.clients.claim())');

    // Unversioned JS/data fetches must bypass HTTP disk cache via cache: 'no-cache'
    expect(swJs).toContain('const revalidateReq = new Request(event.request.url');

    // Versioned asset handler must NOT call ignoreSearch: true before attempting network fetch
    const section4Idx = swJs.indexOf('// 4. Versioned static assets');
    expect(section4Idx).toBeGreaterThan(0);
    const section4Code = swJs.slice(section4Idx);
    const fetchIdx = section4Code.indexOf('fetch(fetchTarget)');
    const ignoreSearchTrueIdx = section4Code.lastIndexOf('ignoreSearch: true');
    expect(fetchIdx).toBeGreaterThan(0);
    expect(ignoreSearchTrueIdx).toBeGreaterThan(fetchIdx);
  });

  test('index.html registers sw.js with updateViaCache: "none" and includes apple-mobile-web-app-capable', () => {
    const indexHtml = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    expect(indexHtml).toContain("navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })");
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
  });

  test('site.webmanifest declares separate "any" and "maskable" icons for cross-platform PWA install', () => {
    const manifestRaw = fs.readFileSync(path.join(projectRoot, 'site.webmanifest'), 'utf8');
    const manifest = JSON.parse(manifestRaw);
    expect(Array.isArray(manifest.icons)).toBe(true);
    const purposes = manifest.icons.map(i => i.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
  });
});
