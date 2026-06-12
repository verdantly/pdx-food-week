# PDX Food Week - UX Enhancement Suggestions

This document compiles modern user experience (UX) and user interface (UI) recommendations to transition **PDX Food Week** into a premium, responsive, and highly interactive application.

---

## 1. Viewport-Specific Layout Upgrades

### A. Mobile Viewpoint (< 768px): One-Handed Bottom Navigation
* **Friction Points:** Taller screen aspect ratios make top navigation tabs (`Browse`, `Swipe`, `Saved`, `Share`, `Map`) difficult to reach. Full-screen detail modals block the scrolling feed.
* **Ergonomic Solutions:**
  * **Bottom Navigation Tab Bar:** Position tabs at the bottom with a minimum touch target size of $44 \times 44\text{px}$ for easy thumb reach.
  * **Glassmorphic Underlay:** Apply `backdrop-filter: blur(20px)` and a slightly translucent background (`rgba(26, 18, 8, 0.88)`) to let food cards scroll behind the tab bar.
  * **Slide-Up Bottom Sheet:** Display dish details in a bottom drawer (60% to 80% screen height) that users can swipe/drag down or tap outside to dismiss.

### B. Tablet Viewpoint (768px – 1099px): Split-Pane Browse Header
* **Friction Points:** Stacked search bars, header descriptions, and sort chips consume too much vertical space, pushing food cards off-screen.
* **Ergonomic Solutions:**
  * **Split Header Layout:** Move brand details and event info to the left pane, and place the search input and scrolling filter chips side-by-side in the right pane.
  * **2-Column Scannable Grid:** Arrange cards in a balanced 2-column grid. Move bookmark/favorite stars to float over the top-right of card photos to keep labels clean.

### C. Desktop Viewpoint (≥ 1100px): Master-Detail Side-by-Side Panel
* **Friction Points:** Overlaying detail modals on large monitors is a jarring context switch. Closing/opening modals disrupts smooth exploration.
* **Ergonomic Solutions:**
  * **Three-Pane Split Layout:**
    * **Left Sidebar (240px):** Navigation menu and event/week switchers.
    * **Middle Feed (Flexible):** Scrollable grid of dishes with header search/filters.
    * **Right Sidebar (380px - 450px):** Persistent detail pane showing description, tags, mini-map, and notes.
  * **Instant selection:** Clicking a card in the middle feed instantly loads its details in the right pane using a smooth cross-fade animation.

---

## 2. Interactive Journeys & Ergonomic Details

### A. Detail Sheet Navigation
* **Friction Point:** Users are locked into a single dish's modal sheet and must close it or click small icons to navigate to neighboring dishes.
* **Ergonomic Solutions:**
  * **Keyboard Shortcuts:** Bind the `Escape` key to close detail panels immediately. Bind `ArrowLeft` and `ArrowRight` to step through dishes in the active list.
  * **Gestural Swiping:** Enable smooth touch swipe-to-dismiss actions for bottom sheets on mobile.

### B. Swipe View Keyboard Cues
* **Friction Point:** The Tinder-style card deck is engaging, but desktop users are often unaware they can use keyboard commands.
* **Ergonomic Solutions:**
  * **Visual Keys:** Overlay subtle, fading indicators next to cards showing keyboard shortcuts (e.g., `[← Pass]` and `[Like →]`) that disappear after the first action.

### C. Clearable Search Fields
* **Friction Point:** Clearing a search term requires backspacing or highlighting text.
* **Ergonomic Solutions:**
  * **Inline Clear Button:** Add a clear (`✕`) button inside the search inputs that becomes visible only when text is entered. Clicking it resets search results instantly.

### D. Auto-Save Feedback Indicators
* **Friction Point:** Users can type custom notes and rate dishes, but they lack feedback on whether their data was successfully saved to `localStorage`.
* **Ergonomic Solutions:**
  * **Save Indicator:** Display a micro-animated status text (e.g., `Auto-saved ✓` or a checkmark) next to the notes field that fades in upon typing and disappears shortly after.

---

## 3. Delighters & Micro-animations

* **Card Spring Hover:** Apply physics-based hover transitions to cards instead of static sizing.
  ```css
  .food-card {
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .food-card:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 16px 36px rgba(26, 18, 8, 0.12);
  }
  ```
* **Swipe Punch Effect:** Add a quick "punch" animation scaling the card in the direction of the swipe before it flies off-screen.
* **Completion Confetti:** Fire a light CSS particle confetti shower when the user finishes swiping all cards in the deck to celebrate completion.
* **Skeleton Shimmer Loading:** Replace loading spinners with pulsing placeholder block cards to prepare the user's mind for the upcoming layout.
