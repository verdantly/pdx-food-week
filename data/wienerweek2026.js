// Portland Mercury's Wiener Week 2026 — January 26 to February 1, 2026
// Source: https://everout.com/portland/events/the-portland-mercurys-wiener-week-2026/e222740/

window.FOOD_WEEKS = window.FOOD_WEEKS || [];
window.FOOD_WEEKS.push({
  id: "wiener-2026",
  name: "Wiener Week 2026",
  organizer: "Portland Mercury",
  dates: "January 26 – February 1, 2026",
  startDate: "2026-01-26",
  endDate: "2026-02-01",
  pricePills: ["$8 wieners"],
  color: "#D32F2F",
  colorDark: "#9A0007",
  colorLight: "#FFCDD2",
  colorPale: "#FFEBEE",
  emoji: "🌭",
  totalLocations: 2,
  url: "https://everout.com/portland/events/the-portland-mercurys-wiener-week-2026/e222740/",
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
      id: 22274001,
      weekId: "wiener-2026",
      restaurant: "Zach's Shack",
      dish: "The Portlander Dog",
      neighborhood: "Hawthorne - Southeast Portland",
      address: "4611 SE Hawthorne Blvd, Portland, OR 97215",
      lat: 45.5121,
      lng: -122.6148,
      type: "meat",
      vegOption: true,
      veganOption: true,
      glutenFree: false,
      minors: true,
      takeout: true,
      desc: "All-beef frank grilled to perfection and topped with cream cheese, grilled onions, spicy brown mustard, and pickled jalapeños on a toasted bun.",
      emoji: "🌭",
      price: "$8",
      url: "https://everout.com/portland/events/the-portland-mercurys-wiener-week-2026/e222740/"
    },
    {
      id: 22274002,
      weekId: "wiener-2026",
      restaurant: "Otto's Sausage Kitchen",
      dish: "Old World Smoked Brat",
      neighborhood: "Woodstock - Southeast Portland",
      address: "4138 SE Woodstock Blvd, Portland, OR 97202",
      lat: 45.4793,
      lng: -122.6201,
      type: "meat",
      vegOption: false,
      veganOption: false,
      glutenFree: false,
      minors: true,
      takeout: true,
      desc: "House-smoked bratwurst grilled over applewood, served with homemade Bavarian sauerkraut and German sweet-hot mustard.",
      emoji: "🌭",
      price: "$8",
      url: "https://everout.com/portland/events/the-portland-mercurys-wiener-week-2026/e222740/"
    }
  ];

  const existingIds = new Set(window.RESTAURANTS.map(r => r.id));
  newItems.forEach(item => {
    if (!existingIds.has(item.id)) {
      window.RESTAURANTS.push(item);
    }
  });
})();
