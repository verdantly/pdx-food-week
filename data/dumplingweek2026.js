// The Oregonian's Dumpling Week 2026 — February 15 to 21, 2026
// Source: https://www.dumplingweek.com/

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "dumpling-2026",
  name: "Dumpling Week 2026",
  organizer: "The Oregonian",
  dates: "February 15–21, 2026",
  startDate: "2026-02-15",
  endDate: "2026-02-21",
  pricePills: ["$12–$15 dumplings"],
  color: "#8E24AA",
  colorDark: "#5C007A",
  colorLight: "#E1BEE7",
  colorPale: "#F3E5F5",
  emoji: "🥟",
  totalLocations: 2,
  url: "https://www.dumplingweek.com/",
  filters: [
    { id: 'meat', label: 'Meat' },
    { id: 'vegetarian', label: 'Vegetarian' },
    { id: 'vegan', label: 'Vegan' },
    { id: 'gf', label: 'Gluten-free' }
  ]
});

window.RESTAURANTS = window.RESTAURANTS || [];
(function() {
  const newItems = [
    {
      id: 22274101,
      weekId: "dumpling-2026",
      restaurant: "XLB",
      dish: "Crispy Chili Pork Bao",
      neighborhood: "Boise - North Portland",
      address: "4090 N Williams Ave, Portland, OR 97227",
      lat: 45.5528,
      lng: -122.6669,
      type: "meat",
      vegOption: false,
      veganOption: false,
      glutenFree: false,
      minors: true,
      takeout: true,
      desc: "Pan-crisped Shanghai soup dumplings packed with ginger pork and house-made Sichuan chili oil broth.",
      emoji: "🥟",
      price: "$12",
      url: "https://www.dumplingweek.com/"
    },
    {
      id: 22274102,
      weekId: "dumpling-2026",
      restaurant: "Chin's Kitchen",
      dish: "Handmade Dongbei Pork & Chive Dumplings",
      neighborhood: "Hollywood - Northeast Portland",
      address: "4126 NE Broadway, Portland, OR 97232",
      lat: 45.5351,
      lng: -122.6206,
      type: "meat",
      vegOption: true,
      veganOption: false,
      glutenFree: false,
      minors: true,
      takeout: true,
      desc: "Authentic northeastern Chinese boiled dumplings with hand-rolled dough, succulent seasoned pork, garlic chives, and black vinegar dipping sauce.",
      emoji: "🥟",
      price: "$13",
      url: "https://www.dumplingweek.com/"
    }
  ];

  const existingIds = new Set(window.RESTAURANTS.map(r => r.id));
  newItems.forEach(item => {
    if (!existingIds.has(item.id)) {
      window.RESTAURANTS.push(item);
    }
  });
})();
