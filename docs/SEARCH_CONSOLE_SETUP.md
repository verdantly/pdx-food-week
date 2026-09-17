# Search Console & Discoverability Setup Guide

This guide walks through registering **Portland Food Week** (`https://www.pdxfoodweek.com`) with major search engines (Google & Bing) and using the built-in IndexNow tooling to ensure instant indexing of food weeks, restaurants, dietary categories, and neighborhood pages.

---

## 1. Google Search Console Setup

Google Search Console allows Google to discover, crawl, and rank all pages, and provides performance reports (impressions, clicks, queries).

### Step 1: Add Property
1. Go to [Google Search Console](https://search.google.com/search-console).
2. Click **Add Property**.
3. Choose either:
   - **URL prefix**: Enter `https://www.pdxfoodweek.com/` (Recommended if deploying static HTML to Cloudflare Pages, GitHub Pages, or Netlify).
   - **Domain**: Enter `pdxfoodweek.com` (Requires DNS TXT record access via your DNS provider).

### Step 2: Verification
- **HTML Tag Method (Easiest for Static Sites)**:
  1. Google will provide a meta tag, e.g.:
     ```html
     <meta name="google-site-verification" content="YOUR_TOKEN_HERE" />
     ```
  2. Add this tag to the `<head>` of `index.html`.
  3. Deploy to production and click **Verify** in Search Console.
- **HTML File Method**:
  1. Download Google's verification file (e.g. `google1234567890abcdef.html`).
  2. Place it in the repository root directory.
  3. Deploy and verify.

### Step 3: Submit Sitemap
1. In Google Search Console, navigate to **Indexing** > **Sitemaps** in the left sidebar.
2. Under "Add a new sitemap", enter:
   ```text
   sitemap.xml
   ```
3. Click **Submit**.
4. Status will change to **Success**, displaying indexed counts for all week pages, dishes, neighborhoods, and dietary pages (>770 URLs).

---

## 2. Bing Webmaster Tools & Yahoo / DuckDuckGo

Bing powers search results for Bing, Yahoo Search, DuckDuckGo, and several partner engines.

### Step 1: Import or Add Site
1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters).
2. Sign in with your Microsoft or Google account.
3. Option A (Instant): Choose **Import from Google Search Console**. This syncs verification and sitemaps automatically.
4. Option B: Manually add `https://www.pdxfoodweek.com`.

### Step 2: Submit Sitemap
1. In Bing Webmaster Tools, navigate to **Sitemaps**.
2. Click **Submit sitemap**.
3. Enter `https://www.pdxfoodweek.com/sitemap.xml` and click **Submit**.

---

## 3. IndexNow Protocol (Instant Indexing)

PDX Food Week has automated support for the **IndexNow protocol**. IndexNow notifies participating search engines (Bing, Yandex, Seznam, Naver) whenever URLs are created or updated, bypassing standard crawl delays.

### Running IndexNow Submission

To generate the verification key and submit all URLs in `sitemap.xml`:

```bash
# Dry run to preview payload without sending HTTP requests
npm run submit:indexnow -- --dry-run

# Live submission to IndexNow API
npm run submit:indexnow
```

### How It Works:
1. `scripts/ping_indexnow.js` verifies the presence of an IndexNow key file at the site root (e.g. `pdxfoodweek2026indexnowkey01.txt`).
2. It extracts all active URLs from `sitemap.xml`.
3. It sends an HTTP POST request to `https://api.indexnow.org/indexnow` containing your domain, key location, and list of URLs.
4. Search engine spiders prioritize crawling those URLs within minutes.
