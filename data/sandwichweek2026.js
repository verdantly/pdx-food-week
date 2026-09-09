// Portland Mercury's Sandwich Week 2026 — March 2 to 8, 2026
// Source: https://everout.com/portland/events/the-portland-mercurys-sandwich-week-2026/e222742/

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "sandwich-2026",
  name: "Sandwich Week 2026",
  organizer: "Portland Mercury",
  dates: "March 2–8, 2026",
  startDate: "2026-03-02",
  endDate: "2026-03-08",
  pricePills: ["$10 sandwiches"],
  color: "#00897B",
  colorDark: "#00564D",
  colorLight: "#B2DFDB",
  colorPale: "#E0F2F1",
  emoji: "🥪",
  totalLocations: 2,
  url: "https://everout.com/portland/events/the-portland-mercurys-sandwich-week-2026/e222742/",
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
      id: 22274201,
      weekId: "sandwich-2026",
      restaurant: "Lardo",
      dish: "Porchetta Melt",
      neighborhood: "Central Eastside - Southeast Portland",
      address: "1212 SE Hawthorne Blvd, Portland, OR 97214",
      lat: 45.5123,
      lng: -122.6534,
      type: "meat",
      vegOption: false,
      veganOption: false,
      glutenFree: false,
      minors: true,
      takeout: true,
      desc: "Crispy-skinned herb roasted porchetta, caper mayo, pickled red onions, melted provolone on crusty grilled sourdough.",
      emoji: "🥪",
      price: "$10",
      url: "https://everout.com/portland/events/the-portland-mercurys-sandwich-week-2026/e222742/"
    },
    {
      id: 22274202,
      weekId: "sandwich-2026",
      restaurant: "Bunk Sandwiches",
      dish: "Cubano Especial",
      neighborhood: "Buckman - Southeast Portland",
      address: "1028 SE Water Ave, Portland, OR 97214",
      lat: 45.5151,
      lng: -122.6653,
      type: "meat",
      vegOption: false,
      veganOption: false,
      glutenFree: false,
      minors: true,
      takeout: true,
      desc: "Slow-roasted pork shoulder, Carlton Farms ham, Swiss cheese, yellow mustard, and house-cured dill pickles pressed hot on traditional pan cubano.",
      emoji: "🥪",
      price: "$10",
      url: "https://everout.com/portland/events/the-portland-mercurys-sandwich-week-2026/e222742/"
    }
  ];

  newItems.forEach(item => {
    if (!window.RESTAURANTS.some(r => r.id === item.id && r.weekId === item.weekId)) {
      window.RESTAURANTS.push(item);
    }
  });
})();
