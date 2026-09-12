import { expect, test, describe } from "vitest";
import { isRestaurantOpenOnDay, isRestaurantOpenNow, parseClosedDays, getRestaurantScheduleText, getWeekTiming } from "../js/modules/utils.js";
import { cardHTML } from "../js/modules/cards.js";
import { State } from "../js/modules/state.js";

describe("Roadmap Features: Schedules & Day Filters", () => {
  test("parseClosedDays correctly parses single and multi-day closure strings", () => {
    expect([...parseClosedDays("CRISPY THAI WINGS. (Closed Tuesday’s)")].sort()).toEqual([2]);
    expect([...parseClosedDays("Burger special (closed monday's & tuesday's)")].sort()).toEqual([1, 2]);
    expect([...parseClosedDays("Delicious dish. Closed Mon-Wed.")].sort()).toEqual([1, 2, 3]);
    expect([...parseClosedDays("No closures noted here")]).toEqual([]);
  });

  test("getRestaurantScheduleText formats weekday descriptions, openDays, and closure text", () => {
    const rWithDescriptions = {
      hours: {
        weekdayDescriptions: [
          "Monday: 11:30 AM – 9:00 PM",
          "Tuesday: 11:30 AM – 9:00 PM",
          "Wednesday: Closed"
        ]
      }
    };
    const descSchedule = getRestaurantScheduleText(rWithDescriptions);
    expect(descSchedule).not.toBeNull();
    expect(descSchedule.summary).toMatch(/(Monday|Tuesday|Wednesday):/);

    const rWithOpenDays = {
      hours: {
        openDays: [1, 2, 3, 4, 5]
      }
    };
    const openSchedule = getRestaurantScheduleText(rWithOpenDays);
    expect(openSchedule.summary).toBe("Open: Mon, Tue, Wed, Thu, Fri");

    const rWithClosure = {
      desc: "Awesome taco (closed tuesday's)"
    };
    const closureSchedule = getRestaurantScheduleText(rWithClosure);
    expect(closureSchedule.summary).toBe("Closed Tuesday");

    const rUnstated = {
      desc: "Delicious food with no special hours"
    };
    expect(getRestaurantScheduleText(rUnstated)).toBeNull();
  });

  test("isRestaurantOpenOnDay checks closures from description heuristics", () => {
    const eSanThai = {
      restaurant: "E-San Thai Woodstock",
      dish: "Crispy Thai Wings",
      desc: "CRISPY THAI WINGS. (Closed Tuesday’s)"
    };
    // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
    expect(isRestaurantOpenOnDay(eSanThai, 2)).toBe(false); // Closed Tuesday
    expect(isRestaurantOpenOnDay(eSanThai, 1)).toBe(true);  // Open Monday
    expect(isRestaurantOpenOnDay(eSanThai, 5)).toBe(true);  // Open Friday
  });

  test("isRestaurantOpenOnDay respects structured hours if provided", () => {
    const rWithHours = {
      restaurant: "Fancy Spot",
      hours: {
        openDays: [3, 4, 5, 6] // Wed-Sat
      }
    };
    expect(isRestaurantOpenOnDay(rWithHours, 1)).toBe(false); // Monday closed
    expect(isRestaurantOpenOnDay(rWithHours, 4)).toBe(true);  // Thursday open
  });

  test("isRestaurantOpenOnDay defaults to permissive (true) when unstated", () => {
    const unstated = { restaurant: "Open Spot", desc: "Just regular food" };
    for (let day = 0; day <= 6; day++) {
      expect(isRestaurantOpenOnDay(unstated, day)).toBe(true);
    }
  });

  test("isRestaurantOpenNow returns false if closed on current day", () => {
    const eSanThai = { desc: "Crispy wings (closed tuesday's)" };
    const tuesday = new Date("2026-09-08T14:00:00"); // 2026-09-08 is a Tuesday
    expect(isRestaurantOpenNow(eSanThai, tuesday)).toBe(false);
  });
});

describe("Roadmap Features: Relative Timing Badges (Clean, No Pulsing Dots)", () => {
  test("getWeekTiming produces clean badges without any badge-dot-live or pulse animations", () => {
    const activeWeek = {
      id: "active-test",
      name: "Test Active Week",
      startDate: "2026-09-10",
      endDate: "2026-09-20"
    };
    const now = new Date("2026-09-11T12:00:00");
    const timing = getWeekTiming(activeWeek, now);

    expect(timing.status).toBe("active");
    expect(timing.badgeHTML).not.toContain("badge-dot-live");
    expect(timing.badgeHTML).not.toContain("pulse");
    expect(timing.badgeHTML).toContain("landing-status-badge");
  });

  test("getWeekTiming handles upcoming and past events cleanly", () => {
    const upcomingWeek = {
      startDate: "2026-10-01",
      endDate: "2026-10-07"
    };
    const pastWeek = {
      startDate: "2026-08-01",
      endDate: "2026-08-07"
    };
    const now = new Date("2026-09-11T12:00:00");

    const upTiming = getWeekTiming(upcomingWeek, now);
    expect(upTiming.status).toBe("upcoming");
    expect(upTiming.badgeHTML).not.toContain("badge-dot-live");

    const pastTiming = getWeekTiming(pastWeek, now);
    expect(pastTiming.status).toBe("past");
    expect(pastTiming.label).toBe("Past Event");
    expect(pastTiming.badgeHTML).not.toContain("badge-dot-live");
  });
});

describe("Roadmap Features: Saved Custom Order Rank Badges", () => {
  test("cardHTML renders #1 rank badge with rank-gold in saved tab custom sort", () => {
    State.activeSavedSort = "custom";
    State.crawlModeActive = false;

    const sampleDish = {
      id: 101,
      restaurant: "Top Burger Joint",
      dish: "The Champion Burger",
      type: "meat",
      weekId: "burger-2026"
    };

    const html1 = cardHTML(sampleDish, false, true, 0, 5);
    expect(html1).toContain("saved-rank-badge");
    expect(html1).toContain("rank-gold");
    expect(html1).toContain("#1");

    const html2 = cardHTML(sampleDish, false, true, 1, 5);
    expect(html2).toContain("rank-silver");
    expect(html2).toContain("#2");

    const html3 = cardHTML(sampleDish, false, true, 2, 5);
    expect(html3).toContain("rank-bronze");
    expect(html3).toContain("#3");

    const html4 = cardHTML(sampleDish, false, true, 3, 5);
    expect(html4).toContain("#4");
    expect(html4).not.toContain("rank-gold");
    expect(html4).not.toContain("rank-silver");
    expect(html4).not.toContain("rank-bronze");
  });
});
