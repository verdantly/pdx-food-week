import { expect, test, describe } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { WEEK_FILE_MAP, WEEK_FILTERS } from "../js/modules/state.js";

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
});
