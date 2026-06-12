# Public Launch Checklist

This document compiles the recommended security, compliance, performance, and user experience updates to implement before opening the **PDX Food Week Companion** application to the general public.

---

## 🔒 1. Cost & Security Protection (High Priority)

Under general public traffic, open-ended client configurations can be abused. Ensure your cloud resources are secured:

*   [ ] **Lock down Firebase Firestore Rules**: Modify your rules in the Firebase console so that the public can only *add* lists (up to a small, reasonable size) and *read* lists, but cannot edit, overwrite, or delete documents:
    ```javascript
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        match /shared_lists/{document} {
          allow create: if request.resource.data.keys().hasAll(['ids', 'name'])
                        && request.resource.data.ids.size() < 150;
          allow read: if true;
          allow update, delete: if false;
        }
      }
    }
    ```
*   [ ] **Restrict GCP/Firebase API Keys**: Go to the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**. Edit your API key and set **Application Restrictions** to `HTTP referrers (web sites)`. Add your production domains (e.g. `https://yourdomain.com/*` or `https://username.github.io/*`).

---

## ⚖️ 2. Legal, Branding & Attribution

Avoid copyright or trademark disputes with official event organizers:

*   [ ] **Attribution / Disclaimer**: Ensure a prominent disclaimer exists on the landing page and view footers indicating independent companionship:
    > **Disclaimer**: This is an unofficial, independent companion website built by fans for the Portland community. This website is not affiliated with, authorized, maintained, sponsored, or endorsed by the *Portland Mercury* or any participating restaurant.
*   [ ] **Image Hotlinking Resolution**: Scrapers pull dish images pointing to source server URLs. Under high public traffic, these sites may block hotlinking or trigger excessive usage.
    *   *Option A*: Download dish images during scraping and store them in the repository under a static directory (e.g., `images/`).
    *   *Option B*: Upload scraped images to your own CDN / object bucket (e.g. Cloudflare R2 or Firebase Storage) and serve them from there.

---

## 📈 3. Hosting & Infrastructure Scaling

Ensure the site remains fast and accessible under traffic spikes:

*   [ ] **Select Scalable Static Hosting**: GitHub Pages has a soft limit of 100GB/month. Consider deploying to services with robust free-tier bandwidth caps and edge-network caching:
    *   **Cloudflare Pages**: Generous free tier, automatic global edge delivery, and fast deployments.
    *   **Vercel / Netlify**: Simple GitHub integrations, analytics support, and edge redirects.
*   [ ] **Automate Scrapers (CI/CD)**: Set up a GitHub Action to run the scraper script (`node scrape_everout.js`) automatically on a cron schedule (e.g., once every 12 hours) during active food weeks, automatically committing new changes to keep listings up-to-date.

---

## 📱 4. UX & Retention Features

Upgrade the user interface for social sharing and offline convenience:

*   [ ] **Rich OpenGraph Meta Cards**: Add sharing metadata tags to `index.html`'s `<head>` to display rich link previews in messaging apps (iMessage, Slack) and social platforms:
    ```html
    <meta property="og:title" content="PDX Food Week Companion" />
    <meta property="og:description" content="Browse, bookmark, and share your favorite dishes from Portland's food weeks!" />
    <meta property="og:image" content="https://yourdomain.com/apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    ```
*   [ ] **Offline PWA Support**: Users checking menus in downtown Portland or inside basement bars may experience poor cellular signals. Initialize a lightweight Service Worker to cache static assets (`index.html`, `css/style.css`, `js/app.js`, and `data/*.js` files) to allow the app to work 100% offline.
*   [ ] **Privacy-Focused Analytics**: Integrate lightweight analytics (e.g. Plausible, Umami, or Cloudflare Web Analytics) to monitor traffic and track popular dishes without violating user privacy.
