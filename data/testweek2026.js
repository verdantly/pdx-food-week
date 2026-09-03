// Test Week 2026
// Sample test dataset
window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "test-week-2026",
  name: "Test Week 2026",
  organizer: "PDX Food Week Team",
  dates: "October 1–7, 2026",
  startDate: "2026-10-01",
  endDate: "2026-10-07",
  pricePills: ["$8 special"],
  color: "#8B5CF6",
  colorDark: "#6D28D9",
  colorLight: "#EDE9FE",
  colorPale: "#F5F3FF",
  emoji: "🧪",
  totalLocations: 2,
  url: "https://www.pdxfoodweek.com/"
});

window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = [
    {
      "id": 1,
      "weekId": "test-week-2026",
      "dish": "Quantum Crunch Slider",
      "restaurant": "The Laboratory Cafe",
      "neighborhood": "Central Eastside",
      "address": "100 SE Water Ave, Portland, OR 97214",
      "lat": 45.5188,
      "lng": -122.6658,
      "type": "meat",
      "vegOption": false,
      "veganOption": false,
      "glutenFree": true,
      "spicy": false,
      "minors": true,
      "takeout": true,
      "desc": "Crispy seasoned slider infused with test lab secret seasoning and pickled shallots.",
      "emoji": "🍔",
      "image": "https://www.pdxfoodweek.com/og_preview_card.jpg",
      "url": "https://www.pdxfoodweek.com/"
    },
    {
      "id": 2,
      "weekId": "test-week-2026",
      "dish": "Galactic Green Salad Bowl",
      "restaurant": "Nebula Bowls",
      "neighborhood": "Pearl District",
      "address": "1100 NW Glisan St, Portland, OR 97209",
      "lat": 45.5265,
      "lng": -122.6828,
      "type": "vegan",
      "vegOption": true,
      "veganOption": true,
      "glutenFree": true,
      "spicy": true,
      "minors": true,
      "takeout": true,
      "desc": "Fresh cosmic greens, roasted chickpeas, spicy tahini drizzle, and toasted sesame seeds.",
      "emoji": "🥗",
      "image": "https://www.pdxfoodweek.com/og_preview_card.jpg",
      "url": "https://www.pdxfoodweek.com/"
    }
  ];

  const seen = new Set(window.RESTAURANTS.map(r => `${r.weekId}_${r.id}`));
  for (const item of newItems) {
    if (!seen.has(`${item.weekId}_${item.id}`)) {
      window.RESTAURANTS.push(item);
      seen.add(`${item.weekId}_${item.id}`);
    }
  }
})();
