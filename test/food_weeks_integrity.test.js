import { expect, test, describe } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { State, WEEK_FILE_MAP, WEEK_FILTERS, isDishSaved, toggleDishSaved, migrateWeekSavedState } from "../js/modules/state.js";
import { highlightMatch } from "../js/modules/utils.js";
import { PORTLAND_ZIP_CACHE } from "../js/modules/filters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Ensure global.window has meta.js loaded for node test environment
if (typeof global.window === "undefined") {
  global.window = {};
}
const metaCode = fs.readFileSync(path.join(projectRoot, "js/meta.js"), "utf8");
vm.runInThisContext(metaCode);
const foodWeeks = global.window.FOOD_WEEKS;

describe("Food Weeks Registry & Data Integrity", () => {

  test("FOOD_WEEKS is defined and has items", () => {
    expect(Array.isArray(foodWeeks)).toBe(true);
    expect(foodWeeks.length).toBeGreaterThan(0);
  });

  test("Every food week in meta.js has a corresponding entry in WEEK_FILE_MAP", () => {
    for (const week of foodWeeks) {
      expect(
        WEEK_FILE_MAP[week.id],
        `Week "${week.id}" (${week.name}) is missing from WEEK_FILE_MAP in js/modules/state.js`
      ).toBeDefined();
    }
  });

  test("Every entry in WEEK_FILE_MAP has a corresponding week in meta.js", () => {
    const weekIds = new Set(foodWeeks.map(w => w.id));
    for (const id of Object.keys(WEEK_FILE_MAP)) {
      expect(
        weekIds.has(id),
        `WEEK_FILE_MAP contains "${id}", which is not defined in window.FOOD_WEEKS in js/meta.js`
      ).toBe(true);
    }
  });

  test("Every file referenced in WEEK_FILE_MAP exists on disk in data/", () => {
    for (const [id, filename] of Object.entries(WEEK_FILE_MAP)) {
      const dataPath = path.join(projectRoot, "data", filename);
      expect(
        fs.existsSync(dataPath),
        `Data file for "${id}" does not exist at ${dataPath}`
      ).toBe(true);
    }
  });

  test("Every data file evaluates cleanly and populates RESTAURANTS for its weekId", () => {
    for (const [id, filename] of Object.entries(WEEK_FILE_MAP)) {
      const dataPath = path.join(projectRoot, "data", filename);
      const code = fs.readFileSync(dataPath, "utf8");
      const testEnv = { window: { FOOD_WEEKS: [], RESTAURANTS: [] } };
      vm.createContext(testEnv);
      expect(() => {
        vm.runInContext(code, testEnv);
      }).not.toThrow();

      const items = (testEnv.window.RESTAURANTS || []).filter(r => r.weekId === id);
      expect(
        items.length,
        `Data file ${filename} did not populate any restaurants with weekId: "${id}"`
      ).toBeGreaterThan(0);

      for (const item of items) {
        expect(item.dish, `Restaurant in ${filename} missing dish name`).toBeTruthy();
        expect(item.restaurant, `Restaurant in ${filename} missing restaurant name`).toBeTruthy();
        expect(typeof item.lat).toBe("number");
        expect(typeof item.lng).toBe("number");
        expect(item.lat).toBeGreaterThan(40);
        expect(item.lng).toBeLessThan(-120);
      }
    }
  });

  test("Every food week has an entry in WEEK_FILTERS in js/modules/state.js", () => {
    for (const week of foodWeeks) {
      expect(
        WEEK_FILTERS[week.id],
        `Week "${week.id}" is missing from WEEK_FILTERS in js/modules/state.js`
      ).toBeDefined();
      expect(Array.isArray(WEEK_FILTERS[week.id])).toBe(true);
    }
  });

  test("Every food week in meta.js defines dataFile and filters directly", () => {
    for (const week of foodWeeks) {
      expect(week.dataFile, `Week "${week.id}" must define dataFile in js/meta.js`).toBeTruthy();
      expect(Array.isArray(week.filters), `Week "${week.id}" must define filters array in js/meta.js`).toBe(true);
    }
  });

  test("index.html contains the week-switcher select elements ready for dynamic hydration", () => {
    const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    expect(html.includes('id="week-switcher"')).toBe(true);
    expect(html.includes('id="compact-week-switcher"')).toBe(true);
  });

  test("Loading all week datasets sequentially into a shared window preserves items without ID collision drops", () => {
    const sharedEnv = { window: { FOOD_WEEKS: [], RESTAURANTS: [] } };
    vm.createContext(sharedEnv);

    for (const week of foodWeeks) {
      const dataPath = path.join(projectRoot, "data", week.dataFile);
      const code = fs.readFileSync(dataPath, "utf8");
      vm.runInContext(code, sharedEnv);
    }

    for (const week of foodWeeks) {
      const count = sharedEnv.window.RESTAURANTS.filter(r => r.weekId === week.id).length;
      expect(
        count,
        `Week "${week.id}" lost items when loaded alongside other datasets into shared window.RESTAURANTS`
      ).toBe(week.totalLocations);
    }
  });

  test("A new synthetic food week added dynamically resolves seamlessly across getters and proxies", () => {
    const syntheticWeek = {
      id: "dumpling-week-2027",
      name: "Dumpling Week 2027",
      dataFile: "dumplingweek2027.js",
      emoji: "🥟",
      filters: [
        { id: "pork", label: "Pork" },
        { id: "vegan", label: "Vegan" }
      ]
    };

    // Dynamically push to window.FOOD_WEEKS
    global.window.FOOD_WEEKS.push(syntheticWeek);

    try {
      // 1. Check helper functions
      expect(global.window.getWeekMeta("dumpling-week-2027")).toEqual(syntheticWeek);
      expect(global.window.getWeekFile("dumpling-week-2027")).toBe("dumplingweek2027.js");
      expect(global.window.getWeekFilters("dumpling-week-2027")).toEqual(syntheticWeek.filters);

      // 2. Check dynamic state Proxies
      expect(WEEK_FILE_MAP["dumpling-week-2027"]).toBe("dumplingweek2027.js");
      expect(WEEK_FILTERS["dumpling-week-2027"]).toEqual(syntheticWeek.filters);
    } finally {
      // Clean up synthetic week
      const idx = global.window.FOOD_WEEKS.findIndex(w => w.id === "dumpling-week-2027");
      if (idx !== -1) global.window.FOOD_WEEKS.splice(idx, 1);
    }
  });

  test("Cross-week saved state isolation prevents ID collisions between Taco and Fried Chicken weeks", () => {
    State.saved.clear();
    State.customSavedOrder = [];

    // Save dish 1 on Taco Week
    toggleDishSaved(1, "taco-2026");

    // Taco dish 1 is saved
    expect(isDishSaved(1, "taco-2026")).toBe(true);

    // Fried Chicken dish 1 must NOT be saved
    expect(isDishSaved(1, "fried-chicken-2026")).toBe(false);

    // Legacy migration migrates raw 1 on Taco Week without polluting Fried Chicken Week
    State.saved.clear();
    State.saved.add(1); // simulate legacy stored ID
    global.window.RESTAURANTS = [
      { id: 1, weekId: "taco-2026", dish: "Taco Dish" },
      { id: 1, weekId: "fried-chicken-2026", dish: "Chicken Dish" }
    ];

    migrateWeekSavedState("taco-2026");
    expect(isDishSaved(1, "taco-2026")).toBe(true);
    expect(isDishSaved(1, "fried-chicken-2026")).toBe(false);
  });

  test("highlightMatch escapes HTML safely without corrupting entities like &amp; or &#39;", () => {
    // 1. Searching for "amp" when text has "&" must NOT match inside "&amp;"
    const textWithAmp = "Rock & Roll";
    const resultAmp = highlightMatch(textWithAmp, "amp");
    expect(resultAmp).toBe("Rock &amp; Roll");
    expect(resultAmp).not.toContain("&<mark");

    // 2. Searching for "39" when text has apostrophe must NOT match inside "&#39;"
    const textWithApos = "Tom's Diner";
    const resultApos = highlightMatch(textWithApos, "39");
    expect(resultApos).toBe("Tom&#39;s Diner");
    expect(resultApos).not.toContain("&#<mark");

    // 3. Searching for "&" must properly highlight with safe entity escaping
    const resultQueryAmp = highlightMatch("Salt & Straw", "&");
    expect(resultQueryAmp).toBe('Salt <mark class="search-highlight">&amp;</mark> Straw');
  });

  test("PORTLAND_ZIP_CACHE includes Vancouver / Clark County zip codes", () => {
    expect(PORTLAND_ZIP_CACHE["98660"]).toBeDefined();
    expect(PORTLAND_ZIP_CACHE["98661"]).toBeDefined();
    expect(PORTLAND_ZIP_CACHE["98684"]).toBeDefined();
    expect(PORTLAND_ZIP_CACHE["97045"]).toBeDefined();
  });
});
