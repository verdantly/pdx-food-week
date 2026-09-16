import { expect, test, describe } from "vitest";
import { isRestaurantOpenOnDay, isRestaurantOpenNow, parseClosedDays, getRestaurantScheduleText, getWeekTiming } from "../js/modules/utils.js";
import { cardHTML } from "../js/modules/cards.js";
import { State } from "../js/modules/state.js";

describe("App Features: Schedules & Day Filters", () => {
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

describe("App Features: Relative Timing Badges (Clean, No Pulsing Dots)", () => {
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

describe("App Features: Saved Custom Order Rank Badges", () => {
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

  test("cardHTML renders rank badges when State.rankingModeActive is true", () => {
    State.activeSavedSort = "restaurant";
    State.rankingModeActive = true;
    State.crawlModeActive = false;

    const sampleDish = {
      id: 102,
      restaurant: "Great Spot",
      dish: "Tasty Burger",
      type: "meat",
      weekId: "burger-2026"
    };

    const html1 = cardHTML(sampleDish, false, true, 0, 5);
    expect(html1).toContain("saved-rank-badge");
    expect(html1).toContain("rank-gold");
    expect(html1).toContain("#1");

    State.rankingModeActive = false;
  });

  test("cardHTML renders bulk-selectable and bulk-selected indicators in bulk edit mode", () => {
    State.bulkEditActive = true;
    State.bulkEditSelection = new Set([201]);
    State.crawlModeActive = false;

    const sampleDish1 = {
      id: 201,
      restaurant: "Selected Burger Place",
      dish: "Bacon Burger",
      type: "meat",
      weekId: "burger-2026"
    };

    const sampleDish2 = {
      id: 202,
      restaurant: "Unselected Burger Place",
      dish: "Cheeseburger",
      type: "meat",
      weekId: "burger-2026"
    };

    const htmlSelected = cardHTML(sampleDish1, false, true, 0, 2);
    expect(htmlSelected).toContain("bulk-selectable");
    expect(htmlSelected).toContain("bulk-selected");
    expect(htmlSelected).toContain("bulk-select-indicator selected");

    const htmlUnselected = cardHTML(sampleDish2, false, true, 1, 2);
    expect(htmlUnselected).toContain("bulk-selectable");
    expect(htmlUnselected).not.toContain("bulk-selected");
    expect(htmlUnselected).toContain("bulk-select-indicator ");

    State.bulkEditActive = false;
    State.bulkEditSelection.clear();
  });

  test("Share tab friend list overlap correctly resolves between compound-saved keys and friend numeric IDs", async () => {
    if (typeof global.window === "undefined") {
      global.window = {};
    }
    const { toggleDishSaved } = await import("../js/modules/state.js");
    const { renderFriends } = await import("../js/modules/friends.js");
    const { getCurrentContextList } = await import("../js/modules/ui.js");

    State.currentWeekId = "burger-2026";
    State.saved.clear();
    State.customSavedOrder = [];
    State.friends = [];

    const mockDishes = [
      { id: 101, weekId: "burger-2026", restaurant: "Burger Bar", dish: "Double Cheeseburger", type: "meat" },
      { id: 102, weekId: "burger-2026", restaurant: "Shake Shack", dish: "SmokeShack", type: "meat" },
      { id: 103, weekId: "burger-2026", restaurant: "Hopdoddy", dish: "Magic Shroom", type: "meat" }
    ];
    global.window.RESTAURANTS = mockDishes;

    // Save dishes 101 and 102 using toggleDishSaved (creates 'burger-2026_101', etc.)
    toggleDishSaved(101, "burger-2026");
    toggleDishSaved(102, "burger-2026");

    // Add friends: Friend 1 saved 101 & 102, Friend 2 saved 101 & 103
    State.friends = [
      { name: "Alex", ids: [101, 102], code: "test1" },
      { name: "Jordan", ids: [101, 103], code: "test2" }
    ];

    // Mock DOM elements needed by renderFriends
    const mockElements = {
      "copy-btn": { disabled: false },
      "share-results": { style: { display: "none" } },
      "friends-list": { innerHTML: "" },
      "overlap-section": { style: { display: "none" } },
      "overlap-container": { className: "", innerHTML: "" }
    };
    global.document = {
      getElementById: (id) => mockElements[id] || null,
      querySelectorAll: (sel) => {
        if (sel.includes("#overlap-container") && mockElements["overlap-container"].innerHTML) {
          const matches = [...mockElements["overlap-container"].innerHTML.matchAll(/data-id="(\d+)"/g)];
          return matches.map(m => ({ getAttribute: () => m[1] }));
        }
        return [];
      }
    };

    renderFriends();

    // Overlap should be shown and contain only dish 101 (saved by user, Alex, and Jordan)
    const overlapSection = document.getElementById("overlap-section");
    expect(overlapSection.style.display).toBe("block");

    const overlapCards = document.querySelectorAll("#overlap-container .dish-card");
    expect(overlapCards.length).toBe(1);
    expect(overlapCards[0].getAttribute("data-id")).toBe("101");

    // Test getCurrentContextList in share tab
    State.activeTab = "share";
    const contextList = getCurrentContextList();
    expect(contextList.length).toBe(1);
    expect(contextList[0].id).toBe(101);

    // Clean up
    State.saved.clear();
    State.customSavedOrder = [];
    State.friends = [];
    State.activeTab = "browse";
    delete global.document;
  });
});


