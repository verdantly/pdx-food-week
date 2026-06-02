# PDX Food Week App

A mobile-first web app to browse, bookmark, and share your favorite dishes from Portland's themed food weeks (Pizza Week, Burger Week, etc.).

## Features

- 🍕 **Browse** — filter by meat/veg/vegan, gluten-free, whole pie, family-friendly
- ★ **Bookmark** — save dishes you want to try; persists in browser storage
- 👥 **Friends** — share a short code, paste friends' codes, see overlap
- 🗺️ **Map** — tap pins to see details; saved spots highlighted

---

## Project Structure

```
pdx-food-week/
├── index.html               ← main app shell
├── css/
# PDX Food Week App

A mobile-first web app to browse, bookmark, and share your favorite dishes from Portland's themed food weeks (Pizza Week, Burger Week, etc.).

## Features

- 🍕 **Browse** — filter by meat/veg/vegan, gluten-free, whole pie, family-friendly
- ★ **Bookmark** — save dishes you want to try; persists in browser storage
- 👥 **Friends** — share a short code, paste friends' codes, see overlap
- 🗺️ **Map** — tap pins to see details; saved spots highlighted

---

## Project Structure

```
pdx-food-week/
├── index.html               ← main app shell
├── css/
│   └── style.css            ← all styles
├── js/
│   └── app.js               ← app logic
├── data/
│   ├── pizzaweek2026.js     ← pizza week restaurant data (generated)
│   └── highballweek2026.js  ← highball week restaurant data (generated)
├── scrape_everout.js        ← Node.js automated scraper & geocoder for EverOut
├── scrape_tacos.js          ← Node.js scraper & geocoder for Taco Week 2026
└── scrape-console.js        ← Browser console utility scraper fallback for EverOut
```

---

## Deployment: GitHub Pages

### 1. Create a GitHub repo

```bash
git init
git add .
git commit -m "initial commit"
gh repo create pdx-food-week --public --push --source=.
```

Or create manually at github.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/pdx-food-week.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under "Source" select **Deploy from a branch**
3. Choose **main** branch, **/ (root)** folder
4. Click **Save**

Your app will be live at:
`https://YOUR_USERNAME.github.io/pdx-food-week/`

### 3. Update data each food week

Edit your data files or run the scraper, then commit:

```bash
git add data/
git commit -m "update food week data"
git push
```

GitHub Pages auto-deploys within a minute.

---

## Deployment: Raspberry Pi (Local Network)

### Requirements
- Raspberry Pi (any model with Wi-Fi)
- Raspberry Pi OS (Lite or Desktop)
- Node.js OR nginx OR Python (any one is enough)

### Option A — Python (simplest, already installed)

```bash
# Copy files to your Pi (from your computer):
scp -r pdx-food-week/ pi@raspberrypi.local:/home/pi/

# SSH into the Pi:
ssh pi@raspberrypi.local

# Serve on port 8080:
cd /home/pi/pdx-food-week
python3 -m http.server 8080
```

App is now at `http://raspberrypi.local:8080` on your local network.

To auto-start on boot, add a cron job:

```bash
crontab -e
# Add this line:
@reboot cd /home/pi/pdx-food-week && python3 -m http.server 8080 &
```

### Option B — nginx (production-grade, recommended)

```bash
# Install nginx:
sudo apt update && sudo apt install nginx -y

# Copy your app files:
sudo cp -r pdx-food-week/* /var/www/html/

# Enable and start nginx:
sudo systemctl enable nginx
sudo systemctl start nginx
```

App is at `http://raspberrypi.local` (port 80). No extra configuration needed.

### Option C — Node.js with http-server

```bash
# Install once:
npm install -g http-server

# Run:
cd /home/pi/pdx-food-week
http-server -p 8080

# Auto-start with pm2:
npm install -g pm2
pm2 start "http-server /home/pi/pdx-food-week -p 8080" --name pdx-food-week
pm2 startup && pm2 save
```

### Finding your Pi's IP (for non-.local access)

```bash
hostname -I
```

Share `http://192.168.x.x:8080` with friends on the same Wi-Fi.

---

## Adding Data for New Food Weeks

1. Create a data file under `data/` (e.g. `data/burgerweek2026.js`) containing the week's details.
2. In the new data file, define your week in the `window.FOOD_WEEKS` array:
   ```js
   window.FOOD_WEEKS.push({
     id: "burger-2026",
     name: "Burger Week 2026",
     dates: "August 10–16",
     pricePills: ["$8 burger"],
     totalLocations: 50,
     emoji: "🍔",
     color: "#D49E2A"
   });
   ```
3. Populate `window.RESTAURANTS` with the dish entries, ensuring `weekId` matches (e.g. `"burger-2026"`).
4. In `index.html`, load the new script tag **before** `js/app.js`:
   ```html
   <script src="data/burgerweek2026.js"></script>
   ```
5. Add the new option to the `<select id="week-switcher">` dropdown in `index.html`:
   ```html
   <option value="burger-2026">🍔 Burger Week</option>
   ```
6. Set the default active week `currentWeekId` in `js/app.js` if you want it to load by default.

## Restaurant Data Fields

```js
{
  id: 1,                        // unique integer
  weekId: "pizza-2026",         // matches FOOD_WEEKS id
  dish: "Dish Name",            // the special item name
  restaurant: "Restaurant Name",
  neighborhood: "Pearl District",
  address: "123 NW Example St, Portland, OR 97209",
  lat: 45.5272,                 // for map (decimal degrees)
  lng: -122.6843,
  type: "meat",                 // "meat" | "vegetarian" | "vegan"
  glutenFree: false,            // true if GF option available
  wholePie: false,              // true if $25 whole pie offered (Pizza Week specific)
  minors: true,                 // true if minors allowed / Family OK
  takeout: true,                // true if takeout available
  desc: "Short description of the dish.",
  emoji: "🍕",                  // display emoji
  url: "https://everout.com/..." // link to EverOut listing
}
```

---

## Scraping and Data Generation

Instead of compiling restaurant data manually, you can use the automated scrapers included in this repository to fetch food week events:

### 1. EverOut Food Weeks (e.g. Pizza Week) — `scrape_everout.js`
Requires Node.js environment. It automatically fetches listings from EverOut, parses details/dietary flags, geocodes addresses using Nominatim, and outputs the completed JS file.
```bash
# Install dependencies
npm install

# Run the EverOut scraper
npm run scrape:everout
```

### 2. Taco Week (hosted on The Actual Portland) — `scrape_tacos.js`
Uses Node.js to parse the Taco Week KML coordinates and Squarespace JSON context, matches items, applies geocoding with local caching (`data/geocode_cache.json`), and outputs the completed JS file.
```bash
# Run the Taco Week scraper
npm run scrape:tacos
```

### 3. Browser Console Scraper (`scrape-console.js`)
If you are running in a restricted sandbox or get rate-limited during geocoding on EverOut, open the EverOut food week index page in your browser DevTools, paste the contents of `scrape-console.js` into the console, and hit enter. It extracts coordinates directly from Google Maps links inside the page and prompts a file download.
