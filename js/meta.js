// Centralized metadata for all PDX Food Weeks
// This allows the landing page to render instantly without loading all restaurant data.

window.FOOD_WEEKS = [
  {
    id: "wiener-2026",
    name: "Wiener Week 2026",
    organizer: "Portland Mercury",
    dataFile: "wienerweek2026.js",
    dates: "January 26 – February 1, 2026",
    startDate: "2026-01-26",
    endDate: "2026-02-01",
    pricePills: ["$8 wieners"],
    color: "#D32F2F",
    colorDark: "#9A0007",
    colorLight: "#FFCDD2",
    colorPale: "#FFEBEE",
    emoji: "🌭",
    totalLocations: 47,
    url: "https://everout.com/portland/events/the-portland-mercurys-wiener-week-2026/e222740/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  },
  {
    id: "dumpling-2026",
    name: "Dumpling Week 2026",
    organizer: "The Oregonian",
    dataFile: "dumplingweek2026.js",
    dates: "February 15–21, 2026",
    startDate: "2026-02-15",
    endDate: "2026-02-21",
    pricePills: ["$12–$15 dumplings"],
    color: "#8E24AA",
    colorDark: "#5C007A",
    colorLight: "#E1BEE7",
    colorPale: "#F3E5F5",
    emoji: "🥟",
    totalLocations: 57,
    url: "https://www.dumplingweek.com/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  },
  {
    id: "sandwich-2026",
    name: "Sandwich Week 2026",
    organizer: "Portland Mercury",
    dataFile: "sandwichweek2026.js",
    dates: "March 2–8, 2026",
    startDate: "2026-03-02",
    endDate: "2026-03-08",
    pricePills: ["$10 sandwiches"],
    color: "#00897B",
    colorDark: "#00564D",
    colorLight: "#B2DFDB",
    colorPale: "#E0F2F1",
    emoji: "🥪",
    totalLocations: 90,
    url: "https://everout.com/portland/events/the-portland-mercurys-sandwich-week-2026/e222742/",
    filters: [
      { id: 'meat', label: 'Meat' },
      { id: 'vegetarian', label: 'Vegetarian' },
      { id: 'vegan', label: 'Vegan' },
      { id: 'gf', label: 'Gluten-free' }
    ]
  },
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
    totalLocations: 45,
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
    totalLocations: 100,
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

window.UPCOMING_FOOD_WEEKS = [
  {
    id: "mac-and-cheese-2026",
    name: "Mac & Cheese Week 2026",
    organizer: "The Actual Portland",
    dates: "November 2–8, 2026",
    startDate: "2026-11-02",
    endDate: "2026-11-08",
    pricePills: ["$10 specials"],
    color: "#E69500",
    colorDark: "#A66300",
    colorLight: "#FDE68A",
    colorPale: "#FFFBEB",
    emoji: "🧀",
    url: "https://www.theactualportland.com",
    aboutTitle: "What is Portland Mac & Cheese Week?",
    aboutText: "Organized by The Actual Portland, Mac & Cheese Week celebrates Portland's best comfort food. Area restaurants, carts, and brewpubs present specialty creations—ranging from classic gourmet cheddar blends and smoked gouda skillets to buffalo chicken macs, crab and lobster bakes, and innovative plant-based vegan/gluten-free variations.",
    description: "Portland Mac & Cheese Week celebrates cheesy, comforting culinary mastery across local Portland restaurants and food carts. Participating eateries offer limited-edition craft mac & cheese creations and special pairings from November 2–8, 2026.",
    faqs: [
      {
        question: "When is Portland Mac & Cheese Week 2026?",
        answer: "Portland Mac & Cheese Week takes place November 2–8, 2026 across restaurants, pubs, and food carts throughout Portland, Oregon."
      },
      {
        question: "Who organizes Portland Mac & Cheese Week?",
        answer: "Portland Mac & Cheese Week is presented by The Actual Portland (theactualportland.com), celebrating local culinary culture across the Rose City."
      },
      {
        question: "How does Portland Mac & Cheese Week work?",
        answer: "Participating restaurants and food carts feature signature mac & cheese specials for $10—often highlighting artisan cheeses, house-made pastas, dietary accommodations (gluten-free, vegetarian, vegan options), and decadent toppings. Diners visit participating venues, order the event special, and explore Portland's vibrant food scene."
      },
      {
        question: "How do I get updates when participating restaurants are announced?",
        answer: "Bookmark PDX Food Week or install the app to get direct access to interactive crawl maps, dietary filters, and live updates as participating spots and dishes are officially revealed."
      }
    ]
  },
  {
    id: "wiener-2027",
    name: "Wiener Week 2027",
    organizer: "Portland Mercury",
    dates: "Late January 2027",
    startDate: "2027-01-25",
    endDate: "2027-01-31",
    pricePills: ["$8 wieners"],
    color: "#D32F2F",
    colorDark: "#9A0007",
    colorLight: "#FFCDD2",
    colorPale: "#FFEBEE",
    emoji: "🌭",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Wiener Week 2027?",
    aboutText: "Portland Wiener Week is the Portland Mercury's annual celebration of gourmet hot dogs, sausages, corn dogs, and vegan franks. Dozens of bars, pubs, and restaurants across Portland offer exclusive, one-of-a-kind wieners at an affordable fixed price.",
    description: "Get ready for Portland Wiener Week 2027! Explore upcoming dates, $8 frank specials, participating Portland bars & restaurants, dietary options, and interactive crawl planning.",
    faqs: [
      {
        question: "When is Portland Wiener Week 2027?",
        answer: "Portland Wiener Week 2027 is projected to return in late January 2027 (typically late January through early February) across dozens of Portland restaurants and bars."
      },
      {
        question: "Who organizes Portland Wiener Week?",
        answer: "Wiener Week is organized and presented by the Portland Mercury and EverOut Portland."
      },
      {
        question: "Are there vegetarian and vegan options during Wiener Week?",
        answer: "Yes! Most participating locations provide vegetarian, vegan, or gluten-free bun alternatives alongside traditional meat franks."
      },
      {
        question: "How much are hot dogs during Wiener Week 2027?",
        answer: "Wiener Week features budget-friendly specials, historically priced at $8 per featured wiener creation."
      }
    ]
  },
  {
    id: "dumpling-2027",
    name: "Dumpling Week 2027",
    organizer: "The Oregonian",
    dates: "Mid February 2027",
    startDate: "2027-02-14",
    endDate: "2027-02-20",
    pricePills: ["$12–$15 dumplings"],
    color: "#8E24AA",
    colorDark: "#5C007A",
    colorLight: "#E1BEE7",
    colorPale: "#F3E5F5",
    emoji: "🥟",
    url: "https://www.dumplingweek.com/",
    aboutTitle: "What is Portland Dumpling Week 2027?",
    aboutText: "Dumpling Week is The Oregonian / OregonLive's beloved culinary showcase honoring handcrafted dumplings, momos, potstickers, gyoza, pierogi, and empanadas created by over 50 of Portland's finest restaurants.",
    description: "Portland Dumpling Week 2027 guide: Dates, participating restaurants, special dumpling creations, and interactive crawl map for the annual celebration presented by The Oregonian.",
    faqs: [
      {
        question: "When is Portland Dumpling Week 2027?",
        answer: "Portland Dumpling Week 2027 is anticipated for mid-February 2027, highlighting diverse cultural dumpling traditions all across the Portland metropolitan area."
      },
      {
        question: "Who organizes Portland Dumpling Week?",
        answer: "Dumpling Week is organized by The Oregonian / OregonLive (dumplingweek.com)."
      },
      {
        question: "What kinds of dumplings are featured?",
        answer: "You'll discover soup dumplings (xiao long bao), pan-fried potstickers, Tibetan momos, Polish pierogi, Georgian khinkali, Russian pelmeni, empanadas, and inventive dessert dumplings."
      },
      {
        question: "Where can I find the 2027 Dumpling Week map and menus?",
        answer: "PDX Food Week will publish the full list of participating spots, photos, prices, dietary tags, and interactive crawl route maps as soon as The Oregonian releases the official lineup."
      }
    ]
  },
  {
    id: "sandwich-2027",
    name: "Sandwich Week 2027",
    organizer: "Portland Mercury",
    dates: "Early March 2027",
    startDate: "2027-03-01",
    endDate: "2027-03-07",
    pricePills: ["$10 sandwiches"],
    color: "#00897B",
    colorDark: "#00564D",
    colorLight: "#B2DFDB",
    colorPale: "#E0F2F1",
    emoji: "🥪",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Sandwich Week 2027?",
    aboutText: "Portland Sandwich Week, produced by the Portland Mercury, unites nearly 100 delis, restaurants, carts, and bakeries crafting mouthwatering specialty sandwiches priced at just $10 each.",
    description: "Everything you need to know about Portland Sandwich Week 2027: $10 sandwich specials, dates, participating delis and bakeries, and dietary options.",
    faqs: [
      {
        question: "When is Portland Sandwich Week 2027?",
        answer: "Portland Sandwich Week 2027 takes place in early March 2027 across close to 100 Portland-area food carts, delis, and diners."
      },
      {
        question: "Who presents Portland Sandwich Week?",
        answer: "The Portland Mercury produces Sandwich Week each spring."
      },
      {
        question: "What is the price for Sandwich Week specials?",
        answer: "Featured Sandwich Week items are traditionally priced at $10 each."
      }
    ]
  },
  {
    id: "pizza-2027",
    name: "Pizza Week 2027",
    organizer: "Portland Mercury",
    dates: "Mid April 2027",
    startDate: "2027-04-19",
    endDate: "2027-04-25",
    pricePills: ["$4 slices", "$25 whole pies"],
    color: "#C94B2C",
    colorDark: "#9E3318",
    colorLight: "#F5E6DF",
    colorPale: "#FDF7F4",
    emoji: "🍕",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Pizza Week 2027?",
    aboutText: "Portland Pizza Week is one of the Rose City's most anticipated food events. Presented by the Portland Mercury, dozens of pizzerias serve creative, one-off slices for just $4 (and whole pie specials for $25).",
    description: "Portland Pizza Week 2027 dates, $4 slice specials, participating slice shops, vegan and gluten-free crust options, and interactive crawl map.",
    faqs: [
      {
        question: "When is Portland Pizza Week 2027?",
        answer: "Portland Pizza Week 2027 is scheduled for mid-to-late April 2027 at top pizzerias across Portland."
      },
      {
        question: "How much are pizza slices during Portland Pizza Week?",
        answer: "Specialty slices are typically $4 each, with select locations offering full whole pies for $25."
      },
      {
        question: "Can I find vegan or gluten-free pizza during Pizza Week?",
        answer: "Yes, many participating pizzerias prepare dedicated vegan cheeses and gluten-free crust variations."
      }
    ]
  },
  {
    id: "highball-2027",
    name: "Highball Week 2027",
    organizer: "Portland Mercury",
    dates: "Late May 2027",
    startDate: "2027-05-24",
    endDate: "2027-05-30",
    pricePills: ["$10 craft cocktails"],
    color: "#2C69C9",
    colorDark: "#1B478C",
    colorLight: "#DFEAF9",
    colorPale: "#F4F7FD",
    emoji: "🥃",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Highball Week 2027?",
    aboutText: "Portland Highball Week features premier mixologists, craft cocktail bars, and neighborhood lounges serving inventive highballs and spirit-forward drinks for an exclusive discounted price ($10).",
    description: "Portland Highball Week 2027: Dates, participating cocktail bars, $10 drink recipes, and crawl guides across Portland neighborhoods.",
    faqs: [
      {
        question: "When is Portland Highball Week 2027?",
        answer: "Portland Highball Week 2027 is expected in late May 2027, heading into Memorial Day weekend."
      },
      {
        question: "What is a highball cocktail?",
        answer: "A highball is a cocktail consisting of an alcoholic base spirit and a larger proportion of a carbonated mixer served over ice in a tall glass."
      }
    ]
  },
  {
    id: "taco-2027",
    name: "Taco Week 2027",
    organizer: "The Actual Portland",
    dates: "Early June 2027",
    startDate: "2027-06-07",
    endDate: "2027-06-13",
    pricePills: ["$5 craft tacos"],
    color: "#D48C2C",
    colorDark: "#945B13",
    colorLight: "#FCEFD8",
    colorPale: "#FEF9F0",
    emoji: "🌮",
    url: "https://www.theactualportland.com",
    aboutTitle: "What is Portland Taco Week 2027?",
    aboutText: "Portland Taco Week celebrates the vibrant taquerias, carts, and Mexican restaurants of Portland with $5 specialty tacos, handmade salsas, and regional heritage recipes.",
    description: "Portland Taco Week 2027 guide: $5 taco specials, participating taquerias, vegan/vegetarian tacos, spicy ratings, and crawl maps.",
    faqs: [
      {
        question: "When is Portland Taco Week 2027?",
        answer: "Portland Taco Week 2027 returns in early June 2027 across Portland taquerias, carts, and cantinas."
      },
      {
        question: "Who organizes Portland Taco Week?",
        answer: "Portland Taco Week is presented by The Actual Portland (theactualportland.com)."
      },
      {
        question: "How much are tacos during Portland Taco Week?",
        answer: "Specialty tacos are priced at $5 each."
      }
    ]
  },
  {
    id: "nacho-2027",
    name: "Nacho Week 2027",
    organizer: "Portland Mercury",
    dates: "Late June 2027",
    startDate: "2027-06-21",
    endDate: "2027-06-27",
    pricePills: ["$10 nacho platters"],
    color: "#D97B29",
    colorDark: "#92400E",
    colorLight: "#FED7AA",
    colorPale: "#FFFBEB",
    emoji: "🧀",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Nacho Week 2027?",
    aboutText: "Portland Nacho Week presents mountainous platters of tortilla chips, queso, slow-braised meats, and vegan toppings for only $10 at participating bars, carts, and restaurants.",
    description: "Portland Nacho Week 2027: $10 specialty nacho platters, participating locations, gluten-free and vegan options, and maps.",
    faqs: [
      {
        question: "When is Portland Nacho Week 2027?",
        answer: "Portland Nacho Week 2027 is slated for late June 2027 across dozens of Portland restaurants and bars."
      },
      {
        question: "How much are nachos during Nacho Week?",
        answer: "Participating venues offer signature nacho plates for $10 each."
      }
    ]
  },
  {
    id: "slushie-2027",
    name: "Summer of Slushies 2027",
    organizer: "Portland Mercury",
    dates: "July 2027",
    startDate: "2027-07-01",
    endDate: "2027-07-31",
    pricePills: ["$10 boozy slushies"],
    color: "#E25A97",
    colorDark: "#B83271",
    colorLight: "#FCE7F1",
    colorPale: "#FDF2F7",
    emoji: "🥤",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Summer of Slushies 2027?",
    aboutText: "Summer of Slushies is the Portland Mercury's month-long July celebration of frozen, boozy drinks served by beloved patio bars, distilleries, and lounges all over town.",
    description: "Portland Summer of Slushies 2027 guide: Dates, $10 boozy frozen cocktails, participating patio bars, and neighborhood maps.",
    faqs: [
      {
        question: "When is Portland Summer of Slushies 2027?",
        answer: "Summer of Slushies runs throughout the entire month of July 2027."
      },
      {
        question: "Are non-alcoholic slushies available?",
        answer: "Many venues offer virgin/mocktail slushie alternatives so everyone can enjoy a refreshing frozen treat on hot summer days."
      }
    ]
  },
  {
    id: "salad-2027",
    name: "Salad Week 2027",
    organizer: "Bridgetown Bites",
    dates: "Late July 2027",
    startDate: "2027-07-19",
    endDate: "2027-07-30",
    pricePills: ["$10–$29 salads"],
    color: "#4CAF50",
    colorDark: "#2E7D32",
    colorLight: "#E8F5E9",
    colorPale: "#F1F8E9",
    emoji: "🥗",
    url: "https://bridgetownbites.com",
    aboutTitle: "What is Portland Salad Week 2027?",
    aboutText: "Portland Salad Week, organized by Bridgetown Bites, celebrates the bounty of the Pacific Northwest summer with farm-fresh produce, grain bowls, and crisp artisan salads.",
    description: "Portland Salad Week 2027: Dates, participating farm-to-table eateries, fresh summer salads, vegan/GF options, and maps.",
    faqs: [
      {
        question: "When is Portland Salad Week 2027?",
        answer: "Portland Salad Week 2027 is anticipated for late July 2027 across Portland farm-to-table spots and cafes."
      },
      {
        question: "Who presents Portland Salad Week?",
        answer: "Salad Week is founded and organized by Bridgetown Bites (bridgetownbites.com)."
      }
    ]
  },
  {
    id: "burger-2027",
    name: "Burger Week 2027",
    organizer: "Portland Mercury",
    dates: "Mid August 2027",
    startDate: "2027-08-09",
    endDate: "2027-08-15",
    pricePills: ["$10 gourmet burgers"],
    color: "#E65100",
    colorDark: "#9A3412",
    colorLight: "#FED7AA",
    colorPale: "#FFFBEB",
    emoji: "🍔",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Burger Week 2027?",
    aboutText: "Portland Burger Week is Portland's biggest food celebration! Organized by the Portland Mercury, over 120 restaurants serve custom, one-week-only burger masterpieces for just $10.",
    description: "Portland Burger Week 2027: Dates, participating spots, $10 specialty burgers, vegetarian/vegan patties, gluten-free buns, and map.",
    faqs: [
      {
        question: "When is Portland Burger Week 2027?",
        answer: "Portland Burger Week 2027 is slated for mid-August 2027 (typically the second week of August)."
      },
      {
        question: "How much are burgers during Burger Week?",
        answer: "Participating restaurants feature special burger creations for just $10 each."
      },
      {
        question: "Are vegan and vegetarian burgers included?",
        answer: "Yes, dozens of participating venues provide plant-based veggie patties, vegan cheese/bacon, or gluten-free buns."
      }
    ]
  },
  {
    id: "fried-chicken-2027",
    name: "Fried Chicken Week 2027",
    organizer: "The Actual Portland",
    dates: "Mid September 2027",
    startDate: "2027-09-13",
    endDate: "2027-09-19",
    pricePills: ["$10 chicken specials"],
    color: "#D97706",
    colorDark: "#92400E",
    colorLight: "#FEF3C7",
    colorPale: "#FFFBEB",
    emoji: "🐔",
    url: "https://www.theactualportland.com",
    aboutTitle: "What is Portland Fried Chicken Week 2027?",
    aboutText: "Portland Fried Chicken Week, organized by The Actual Portland, highlights Southern, Korean, Nashville hot, and gluten-free crispy fried chicken specialties across the city for $10.",
    description: "Portland Fried Chicken Week 2027: $10 crispy chicken specials, participating restaurants and carts, and interactive crawl map.",
    faqs: [
      {
        question: "When is Portland Fried Chicken Week 2027?",
        answer: "Portland Fried Chicken Week 2027 is expected in mid-September 2027 across Portland restaurants, food carts, and bars."
      },
      {
        question: "Who presents Portland Fried Chicken Week?",
        answer: "Fried Chicken Week is organized by The Actual Portland (theactualportland.com)."
      }
    ]
  },
  {
    id: "wing-2027",
    name: "Wing Week 2027",
    organizer: "Portland Mercury",
    dates: "Late September 2027",
    startDate: "2027-09-20",
    endDate: "2027-09-26",
    pricePills: ["$10 for 6 wings"],
    color: "#E04F2E",
    colorDark: "#B8361B",
    colorLight: "#FDEAE6",
    colorPale: "#FFF5F2",
    emoji: "🍗",
    url: "https://everout.com/portland/",
    aboutTitle: "What is Portland Wing Week 2027?",
    aboutText: "Portland Wing Week, produced by the Portland Mercury, brings together 100 sports bars, pubs, and restaurants serving 6 special wings tossed in custom glazes and dry rubs for just $10.",
    description: "Portland Wing Week 2027: Dates, participating sports bars and restaurants, $10 wing specials, vegetarian seitan/cauliflower wings, and crawl map.",
    faqs: [
      {
        question: "When is Portland Wing Week 2027?",
        answer: "Portland Wing Week 2027 takes place in late September 2027 at approximately 100 Portland pubs and eateries."
      },
      {
        question: "How many wings do you get during Wing Week?",
        answer: "Participating restaurants serve an order of six wings with signature sauces for $10."
      },
      {
        question: "Are vegetarian or vegan wings available?",
        answer: "Yes, numerous locations provide vegetarian options such as crispy cauliflower wings, tofu, or seitan wings."
      }
    ]
  }
];

window.getWeekMeta = function (weekId) {
  return (window.FOOD_WEEKS || []).find(w => w.id === weekId) ||
         (window.UPCOMING_FOOD_WEEKS || []).find(w => w.id === weekId);
};

window.getUpcomingWeekMeta = function (weekId) {
  return (window.UPCOMING_FOOD_WEEKS || []).find(w => w.id === weekId);
};

window.getWeekFile = function (weekId) {
  const meta = window.getWeekMeta(weekId);
  return meta ? meta.dataFile : undefined;
};

window.getWeekFilters = function (weekId) {
  const meta = window.getWeekMeta(weekId);
  return meta && meta.filters ? meta.filters : [];
};

window.RESTAURANTS = window.RESTAURANTS || [];
