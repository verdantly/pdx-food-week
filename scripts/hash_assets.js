import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

/**
 * Computes an 8-character SHA-256 content hash across all core frontend assets.
 */
export function computeCombinedHash() {
  const hash = crypto.createHash('sha256');

  const filesToHash = [
    path.join(rootDir, 'css', 'style.css'),
    path.join(rootDir, 'js', 'app.js'),
    path.join(rootDir, 'js', 'meta.js'),
  ];

  // Include all ES modules
  const modulesDir = path.join(rootDir, 'js', 'modules');
  if (fs.existsSync(modulesDir)) {
    const modules = fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')).sort();
    for (const m of modules) {
      filesToHash.push(path.join(modulesDir, m));
    }
  }

  // Include all datasets
  const dataDir = path.join(rootDir, 'data');
  if (fs.existsSync(dataDir)) {
    const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.js') && f !== 'geocode_cache.json').sort();
    for (const d of dataFiles) {
      filesToHash.push(path.join(dataDir, d));
    }
  }

  for (const filePath of filesToHash) {
    if (fs.existsSync(filePath)) {
      hash.update(fs.readFileSync(filePath));
    }
  }

  return hash.digest('hex').slice(0, 8);
}

/**
 * Updates index.html and sw.js with the computed content hash.
 */
export function updateAssetVersions(version) {
  const v = version || computeCombinedHash();
  let updatedFiles = 0;

  // 1. Update index.html
  const indexPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf8');
    const original = indexHtml;

    indexHtml = indexHtml.replace(/href="css\/style\.css(\?v=[^"]*)?"/g, `href="css/style.css?v=${v}"`);
    indexHtml = indexHtml.replace(/src="js\/meta\.js(\?v=[^"]*)?"/g, `src="js/meta.js?v=${v}"`);
    indexHtml = indexHtml.replace(/src="js\/app\.js(\?v=[^"]*)?"/g, `src="js/app.js?v=${v}"`);

    if (indexHtml !== original) {
      fs.writeFileSync(indexPath, indexHtml, 'utf8');
      updatedFiles++;
    }
  }

  // 2. Update sw.js
  const swPath = path.join(rootDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    let swJs = fs.readFileSync(swPath, 'utf8');
    const original = swJs;

    swJs = swJs.replace(/const CACHE_NAME = 'pdxfw-cache-[^']*';/g, `const CACHE_NAME = 'pdxfw-cache-${v}';`);
    swJs = swJs.replace(/'css\/style\.css(\?v=[^']*)?'/g, `'css/style.css?v=${v}'`);
    swJs = swJs.replace(/'js\/app\.js(\?v=[^']*)?'/g, `'js/app.js?v=${v}'`);
    swJs = swJs.replace(/'js\/meta\.js(\?v=[^']*)?'/g, `'js/meta.js?v=${v}'`);

    if (swJs !== original) {
      fs.writeFileSync(swPath, swJs, 'utf8');
      updatedFiles++;
    }
  }

  return { version: v, updatedFiles };
}

// Execute if run directly
if (process.argv[1] === __filename) {
  const res = updateAssetVersions();
  console.log(`[hash_assets] Assets hashed successfully. Version: ${res.version} (Updated ${res.updatedFiles} files)`);
}
