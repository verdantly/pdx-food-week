// Centralized metadata for all PDX Food Weeks
// This allows the landing page to render instantly without loading all restaurant data.

window.FOOD_WEEKS = [
  {
    id: "burger-2026",
    name: "Burger Week 2026",
    organizer: "Portland Mercury",
    dataFile: "burgerweek2026.js",
    dates: "August 10-16, 2026",
    startDate: "2026-08-10",
    endDate: "2026-08-16",
    pricePills: ["$10 burgers"],
    color: "#E65100",
    emoji: "🍔",
    totalLocations: 124,
    url: "https://everout.com/portland/events/the-portland-mercurys-burger-week-2026/e222750/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  },
  {
    id: "highball-2026",
    name: "Highball Week 2026",
    organizer: "Portland Mercury",
    dataFile: "highballweek2026.js",
    dates: "May 25-31, 2026",
    startDate: "2026-05-25",
    endDate: "2026-05-31",
    pricePills: ["$10 drinks"],
    color: "#2C69C9",
    colorDark: "#1B478C",
    colorLight: "#DFEAF9",
    colorPale: "#F4F7FD",
    emoji: "🥃",
    totalLocations: 27,
    url: "https://everout.com/portland/events/the-portland-mercurys-highball-week-2026/e222745/",
    hideTags: true,
    filters: []
  },
  {
    id: "nacho-2026",
    name: "Nacho Week 2026",
    organizer: "Portland Mercury",
    dataFile: "nachoweek2026.js",
    startDate: "2026-06-22",
    dates: "June 22-28, 2026",
    pricePills: ["$10 nachos"],
    color: "#D97B29",
    emoji: "🧀",
    totalLocations: 59,
    url: "https://everout.com/portland/events/the-portland-mercurys-nacho-week-2026/e222747/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  },
  {
    id: "pizza-2026",
    name: "Pizza Week 2026",
    organizer: "Portland Mercury",
    dataFile: "pizzaweek2026.js",
    dates: "April 20-26, 2026",
    startDate: "2026-04-20",
    endDate: "2026-04-26",
    pricePills: ["$4 slices"],
    priceSlice: "$4",
    pricePie: "$25",
    color: "#C94B2C",
    colorDark: "#9E3318",
    colorLight: "#F5E6DF",
    colorPale: "#FDF7F4",
    emoji: "🍕",
    totalLocations: 29,
    url: "https://everout.com/portland/events/the-portland-mercurys-pizza-week-2026/e222744/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' },
      { id: 'pie', label: 'Whole Pie' }
    ]
  },
  {
    id: "salad-2026",
    name: "Salad Week 2026",
    organizer: "Bridgetown Bites",
    dataFile: "salads2026.js",
    startDate: "2026-07-20",
    dates: "July 20 - 31, 2026",
    pricePills: ["$10–$29 salads"],
    color: "#4CAF50",
    colorDark: "#2E7D32",
    colorLight: "#E8F5E9",
    colorPale: "#F1F8E9",
    emoji: "🥗",
    totalLocations: 15,
    url: "https://bridgetownbites.com/2026/07/20/2026-portland-salad-week-restaurant-specials-oregon/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  },
  {
    id: "slushie-2026",
    name: "Summer of Slushies 2026",
    organizer: "Portland Mercury",
    dataFile: "slushies2026.js",
    startDate: "2026-07-01",
    dates: "July 2026",
    pricePills: ["$10 slushies"],
    color: "#E25A97",
    colorDark: "#B83271",
    colorLight: "#FCE7F1",
    colorPale: "#FDF2F7",
    emoji: "🥤",
    totalLocations: 24,
    url: "https://everout.com/portland/events/the-portland-mercurys-summer-of-slushies-2026/e222749/",
    hideTags: true,
    hideHoodStats: true,
    preferStreetAddress: true,
    ingredientLabel: "What's in it...",
    filters: []
  },
  {
    id: "taco-2026",
    name: "Taco Week 2026",
    organizer: "The Actual Portland",
    dataFile: "tacoweek2026.js",
    dates: "June 1-7, 2026",
    startDate: "2026-06-01",
    endDate: "2026-06-07",
    pricePills: ["$5 tacos"],
    color: "#D48C2C",
    colorDark: "#945B13",
    colorLight: "#FCEFD8",
    colorPale: "#FEF9F0",
    emoji: "🌮",
    totalLocations: 42,
    url: "https://www.theactualportland.com/locations",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' },
      { id: 'spicy', label: 'Spicy' }
    ]
  },
  {
    id: "fried-chicken-2026",
    name: "Fried Chicken Week 2026",
    organizer: "The Actual Portland",
    dataFile: "friedchickenweek2026.js",
    dates: "September 14-20, 2026",
    startDate: "2026-09-14",
    endDate: "2026-09-20",
    pricePills: ["$10 special"],
    color: "#D97706",
    colorDark: "#92400E",
    colorLight: "#FEF3C7",
    colorPale: "#FFFBEB",
    emoji: "🐔",
    totalLocations: 30,
    url: "https://www.theactualportland.com/friedchickenlocations",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' },
      { id: 'spicy', label: 'Spicy' }
    ]
  },
  {
    id: "wing-2026",
    name: "Wing Week 2026",
    organizer: "Portland Mercury",
    dataFile: "wingweek2026.js",
    dates: "September 21-27, 2026",
    startDate: "2026-09-21",
    endDate: "2026-09-27",
    pricePills: ["$10 for 6 wings"],
    color: "#E04F2E",
    colorDark: "#B8361B",
    colorLight: "#FDEAE6",
    colorPale: "#FFF5F2",
    emoji: "🍗",
    totalLocations: 30,
    url: "https://everout.com/portland/events/the-portland-mercurys-wing-week-2026/e222751/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' },
      { id: 'spicy', label: 'Spicy' }
    ]
  }
];

window.getWeekMeta = function(weekId) {
  return (window.FOOD_WEEKS || []).find(w => w.id === weekId);
};

window.getWeekFile = function(weekId) {
  const meta = window.getWeekMeta(weekId);
  return meta ? meta.dataFile : undefined;
};

window.getWeekFilters = function(weekId) {
  const meta = window.getWeekMeta(weekId);
  return meta && meta.filters ? meta.filters : [];
};

window.RESTAURANTS = window.RESTAURANTS || [];
