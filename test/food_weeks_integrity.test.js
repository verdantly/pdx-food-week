import { expect, test, describe } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { WEEK_FILE_MAP, WEEK_FILTERS } from "../js/modules/state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

describe("Food Weeks Registry & Data Integrity", () => {
  // 1. Evaluate js/meta.js in an isolated sandbox to inspect window.FOOD_WEEKS
  const metaCode = fs.readFileSync(path.join(projectRoot, "js/meta.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(metaCode, sandbox);
  const foodWeeks = sandbox.window.FOOD_WEEKS;

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

  test("index.html week-switcher dropdowns include all registered food weeks", () => {
    const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    for (const week of foodWeeks) {
      const expectedOption = `value="${week.id}"`;
      expect(
        html.includes(expectedOption),
        `index.html does not contain dropdown option for week "${week.id}"`
      ).toBe(true);
    }
  });
});
