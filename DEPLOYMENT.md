# Deployment Guide

This guide details how to deploy the PDX Food Week application. Since it is a static vanilla-JS single-page app, it can be hosted on any static web hosting service or local web server.

---

## Deployment: GitHub Pages

### 1. Create a GitHub Repository

```bash
git init
git add .
git commit -m "initial commit"
gh repo create pdx-food-week --public --push --source=.
```

Or create the repository manually at github.com, then run:

```bash
git remote add origin https://github.com/YOUR_USERNAME/pdx-food-week.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repository on GitHub → **Settings** → **Pages**.
2. Under "Source", select **Deploy from a branch**.
3. Choose the **main** branch and select the **/** (root) folder.
4. Click **Save**.

Your app will be live at:
`https://YOUR_USERNAME.github.io/pdx-food-week/`

### 3. Updating Data Each Food Week

When you edit your data files or run a scraper to update food listings, simply commit the changes and push to GitHub:

```bash
git add data/
git commit -m "update food week data"
git push
```

GitHub Pages auto-deploys the update within a minute.

---

## Deployment: Raspberry Pi (Local Network)

### Requirements
- Raspberry Pi (any model with Wi-Fi)
- Raspberry Pi OS (Lite or Desktop)
- Node.js OR nginx OR Python (any one is enough)

### Option A — Python (simplest, already installed)

1. Copy files to your Pi (from your computer):
   ```bash
   scp -r pdx-food-week/ pi@raspberrypi.local:/home/pi/
   ```
2. SSH into the Pi:
   ```bash
   ssh pi@raspberrypi.local
   ```
3. Serve on port 8080:
   ```bash
   cd /home/pi/pdx-food-week
   python3 -m http.server 8080
   ```

The app is now accessible at `http://raspberrypi.local:8080` on your local network.

To auto-start the server on boot, add a cron job:
1. Open the cron editor:
   ```bash
   crontab -e
   ```
2. Add this line at the bottom:
   ```bash
   @reboot cd /home/pi/pdx-food-week && python3 -m http.server 8080 &
   ```

### Option B — nginx (production-grade, recommended)

1. Install nginx:
   ```bash
   sudo apt update && sudo apt install nginx -y
   ```
2. Copy your app files:
   ```bash
   sudo cp -r pdx-food-week/* /var/www/html/
   ```
3. Enable and start nginx:
   ```bash
   sudo systemctl enable nginx
   sudo systemctl start nginx
   ```

The app is now accessible at `http://raspberrypi.local` (port 80). No extra configuration is needed.

### Option C — Node.js with http-server

1. Install the global `http-server` package:
   ```bash
   npm install -g http-server
   ```
2. Run the server:
   ```bash
   cd /home/pi/pdx-food-week
   http-server -p 8080
   ```
3. (Optional) Auto-start on boot using `pm2`:
   ```bash
   npm install -g pm2
   pm2 start "http-server /home/pi/pdx-food-week -p 8080" --name pdx-food-week
   pm2 startup && pm2 save
   ```

### Finding your Pi's IP (for non-.local access)

If `.local` addresses are not resolved by your router, find the Pi's internal IP address:
```bash
hostname -I
```
Share `http://192.168.x.x:8080` with friends connected to the same Wi-Fi network.
