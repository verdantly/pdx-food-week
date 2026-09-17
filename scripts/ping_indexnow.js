#!/usr/bin/env node
/**
 * IndexNow Ping Tool for PDX Food Week
 *
 * IndexNow is an open protocol supported by Bing, Yandex, Seznam, and Naver
 * to instantly notify search engines of newly created or updated URLs.
 *
 * Usage:
 *   node scripts/ping_indexnow.js [--dry-run] [--key=<custom-key>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const HOST = 'www.pdxfoodweek.com';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITEMAP_PATH = path.join(projectRoot, 'sitemap.xml');

// Default API key for IndexNow (can be overridden with --key=...)
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const keyArg = args.find(a => a.startsWith('--key='));
const API_KEY = keyArg ? keyArg.split('=')[1] : 'pdxfoodweek2026indexnowkey01';

async function main() {
  console.log('=== PDX Food Week IndexNow Submission Tool ===');

  // 1. Ensure verification file exists at root
  const keyFileName = `${API_KEY}.txt`;
  const keyFilePath = path.join(projectRoot, keyFileName);
  fs.writeFileSync(keyFilePath, API_KEY, 'utf8');
  console.log(`Verified IndexNow key file: ${keyFileName}`);

  // 2. Parse URLs from sitemap.xml
  if (!fs.existsSync(SITEMAP_PATH)) {
    console.error('Error: sitemap.xml not found! Run npm run build:seo first.');
    process.exit(1);
  }

  const sitemapContent = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const matches = [...sitemapContent.matchAll(/<loc>(https:\/\/[^<]+)<\/loc>/g)];
  const urls = matches.map(m => m[1]);

  console.log(`Extracted ${urls.length} URLs from sitemap.xml.`);

  if (urls.length === 0) {
    console.error('No URLs found in sitemap.xml.');
    process.exit(1);
  }

  // IndexNow allows up to 10,000 URLs per batch
  const payload = {
    host: HOST,
    key: API_KEY,
    keyLocation: `https://${HOST}/${keyFileName}`,
    urlList: urls
  };

  console.log(`Target endpoint: ${INDEXNOW_ENDPOINT}`);
  console.log(`Host: ${HOST}`);
  console.log(`Key location: ${payload.keyLocation}`);
  console.log(`Submitting ${urls.length} URLs...`);

  if (isDryRun) {
    console.log('[DRY-RUN] Skipping actual network request.');
    console.log('Sample payload:', JSON.stringify({ ...payload, urlList: urls.slice(0, 5) }, null, 2));
    return;
  }

  try {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 200 || response.status === 202) {
      console.log(`✓ Success! IndexNow returned status ${response.status}.`);
      console.log('Search engines (Bing, Yandex, etc.) have queued your URLs for fast indexing.');
    } else {
      const respText = await response.text();
      console.warn(`IndexNow response: ${response.status} ${response.statusText}`);
      if (respText) {
        console.warn(`Details: ${respText}`);
      }
    }
  } catch (err) {
    console.error(`Failed to ping IndexNow: ${err.message}`);
    // Non-fatal exit for CI/offline environments
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
