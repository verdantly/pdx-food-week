# Feature Roadmap & Competitive Parity: PDX Food Week vs. pdxfoodweeks.app

This document tracks feature comparisons, parity gaps, competitive differentiators, and planned enhancements between **PDX Food Week** and **pdxfoodweeks.app**.

---

## 1. Competitive Overview

| Feature Area | pdxfoodweeks.app | Our App Current State | Parity Status & Action |
| :--- | :--- | :--- | :--- |
| **Citywide Weighted Dish Chart** | Weighted Bayesian citywide chart aggregated from user ratings, updated daily during active weeks. | User star ratings & personal notes exist locally + cloud synced in Firebase, but no aggregated city leaderboard. | 🟡 **Planned Enhancement** (Aggregate ratings in Firestore into a public `/chart` view) |
| **Day-of-Week & Open Filter Chips** | Single-tap horizontal pills: *Open now*, *Any day*, *Mon*, *Tue*, *Wed*, *Thu*, *Fri*, *Sat*, *Sun*. | Hours filtering inside drawer / badges on card, but requires opening modal or filter controls. | 🟡 **Immediate Win** (Expose quick horizontal day-of-week chips directly on browse view) |
| **Food Week Countdown Badges** | Dynamic status tags: `IN 3 DAYS`, `ACTIVE`, `ENDS SUNDAY`, `LAST DAY`. | Shows calendar date range string (e.g. `Sep 14 - 20, 2026`). | 🟡 **Immediate Win** (Compute relative date badges for landing & switcher cards) |
| **Calendar Sync & Drop Reminders** | Reminders for menu drops, opening day, and closing day. | PWA installation prompt, but no calendar integration or drop alerts. | 🟡 **High Value** (Generate `.ics` file downloads + "Add to Google Calendar" links) |
| **Ranked Personal Tier List / Picks** | Dedicated "Picks" view where users rank dishes in priority order. | "Saved" tab supports custom drag-and-drop order, but lacks tier tags / ordinal rankings. | 🟡 **Quick Polish** (Add ranked numbers `#1`, `#2`, `#3` or tier badges in Saved) |
| **Dark Mode / Theme Preference** | Automatic dark mode support + manual toggle stored in `pdxfw-theme-pref`. | Light cream theme (`--paper`, `--ink`, `--pizza`). | 🟡 **Polish Win** (CSS variables for dark theme + theme switch in Account modal) |
| **Crawl Route Optimization** | Simple ordered route planner. | Full TSP route optimizer with walking, biking, and driving options, turn-by-turn steps, and map overlay. | 🟢 **We Win** (More advanced routing & travel times) |
| **Tinder-Style Swipe Discovery** | None (standard card and photo grid views only). | Swipe mode with swipe-right to save, swipe-left to pass. | 🟢 **We Win** (Engaging fast mobile discovery) |
| **Friend Collaboration** | None. | Friend compare mode, itinerary sharing, and overlap indicators. | 🟢 **We Win** (Social utility) |
| **Multi-Week Unified Archive** | Separate archive pages. | Cross-week global search, multi-week switcher, offline cached menus. | 🟢 **We Win** (Cross-week navigation) |

---

## 2. Priority Implementation Roadmap

### Phase 1: High-Impact UX & Conversion Wins (Next Worktree)
1. **Quick Day-of-Week Filter Pills (`Open Now`, `Mon`–`Sun`)**
   - Place directly above dish lists on the Browse view.
   - Filter specials by participating restaurant open days/hours without needing to open the full filter drawer.
2. **Relative Countdown Badges**
   - Compute relative urgency: `Happening Now · Ends Sunday`, `Starts in 3 days`, `Final 24 Hours`.
   - Display on both the landing screen carousel cards and the top app bar header.
3. **"Add to Calendar" (.ics & Google Calendar Link)**
   - For every food week, provide a 1-tap "Add to Calendar" button that creates calendar events with notification alerts for:
     - 1 week prior (menu release)
     - Day 1 (launch day)
     - Final day (last chance)

### Phase 2: Community & Engagement
4. **Citywide Chart / Community Leaderboard (`/chart`)**
   - Create an anonymous Firestore collection aggregating dish ratings.
   - Calculate Bayesian weighted score ($W = \frac{R \cdot v + C \cdot m}{v + m}$) to rank top specials fairly without skew from low sample sizes.
   - Display a live leaderboard tab for the currently active food week.
5. **Ranked "Picks" & Shareable Graphic Cards**
   - Let users export a visual top 5 / top 10 card ("My PDX Burger Week Top Picks") to share on Instagram Stories, Messages, or Reddit.

### Phase 3: Theming & Visual Polish
6. **Dark Mode / Night Crawl Theme**
   - Implement dark mode CSS custom properties (`--paper`, `--card-bg`, `--ink`, etc.) respecting `prefers-color-scheme: dark` with a manual toggle in settings/account.

