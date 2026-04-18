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
└── data/
    └── pizzaweek2026.js     ← restaurant data (edit this each week!)
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

Edit `data/pizzaweek2026.js` (or add a new file like `data/burgerweek2026.js`) and commit:

```bash
git add data/
git commit -m "add burger week 2026 data"
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

1. Duplicate `data/pizzaweek2026.js` and rename (e.g. `data/burgerweek2026.js`)
2. Add your new week to `window.FOOD_WEEKS` array
3. Update `window.RESTAURANTS` with new entries, setting `weekId` to match
4. In `index.html`, add `<script src="data/burgerweek2026.js"></script>` before `app.js`
5. Change `currentWeekId` default in `app.js` or add a week switcher UI

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
  wholePie: false,              // true if $25 whole pie offered
  minors: true,                 // true if minors allowed
  takeout: true,                // true if takeout available
  desc: "Short description of the dish.",
  emoji: "🍕",                  // display emoji
  url: "https://everout.com/..." // link to EverOut listing
}
```

## Scraping Tips

To pull the full 70-location list from EverOut:
- Each pizza listing links to a sub-event page (e.g. `/portland/events/spuds-mackenzie/e234557/`)
- Visit each page to get the address, description, and dietary tags
- Geocode addresses using [geocode.maps.co](https://geocode.maps.co/) (free, no key needed for small volumes)
- Or use Google Maps "Copy coordinates" by right-clicking each address
