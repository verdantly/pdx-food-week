import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Ensure minimal globals exist before importing browser modules
const store = new Map();
global.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, val) => store.set(key, String(val)),
  removeItem: key => store.delete(key),
  clear: () => store.clear()
};

if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = () => 0;
}
if (typeof global.window === 'undefined') {
  global.window = {};
}
global.window.FOOD_WEEKS = [
  { id: 'burger-2026', name: 'Burger Week 2026', badge: '🍔', restaurants: [] },
  { id: 'pizza-2026', name: 'Pizza Week 2026', badge: '🍕', restaurants: [] }
];
const SAMPLE_RESTAURANTS = [
  { id: 101, weekId: 'burger-2026', dish: 'Smash Royale', restaurant: 'Burger Barn', neighborhood: 'SE Hawthorne', desc: 'Crispy edges', tags: ['beef'] },
  { id: 102, weekId: 'burger-2026', dish: 'Truffle Melt', restaurant: 'Griddle Club', neighborhood: 'NW 23rd', desc: 'Swiss melt', tags: ['beef'] },
  { id: 103, weekId: 'burger-2026', dish: 'Veggie Deluxe', restaurant: 'Green Grill', neighborhood: 'Alberta', desc: 'Plant patty', tags: ['vegan'] },
  { id: 104, weekId: 'burger-2026', dish: 'Spicy Hatch', restaurant: 'Heat Shack', neighborhood: 'Mississippi', desc: 'Green chile', tags: ['beef'] },
  { id: 101, weekId: 'pizza-2026', dish: 'Hot Honey Roni', restaurant: 'Pie Co', neighborhood: 'Division', desc: 'Cup roni', tags: [] }
];
global.window.RESTAURANTS = SAMPLE_RESTAURANTS;

const classListStub = () => {
  const set = new Set();
  return {
    add: cls => set.add(cls),
    remove: cls => set.delete(cls),
    contains: cls => set.has(cls),
    toggle: (cls, force) => (force === undefined ? (set.has(cls) ? (set.delete(cls), false) : (set.add(cls), true)) : (force ? (set.add(cls), true) : (set.delete(cls), false)))
  };
};

const mockElements = new Map();
function ensureElement(id) {
  if (!mockElements.has(id)) {
    mockElements.set(id, {
      id,
      innerHTML: '',
      outerHTML: '',
      textContent: '',
      style: {},
      classList: classListStub(),
      setAttribute: vi.fn(),
      querySelector: () => null,
      querySelectorAll: () => []
    });
  }
  return mockElements.get(id);
}

global.document = {
  getElementById: id => ensureElement(id),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  body: { classList: classListStub(), style: {} },
  activeElement: null
};

const {
  State,
  loadState,
  saveState,
  clearUserDataState,
  computeTierScore,
  getWeekRatingsMap,
  getUserDishRating,
  isDishTried,
  getCommunityDishRating
} = await import('../js/modules/state.js');

const {
  getBeliBadgeClass,
  getTierLabel,
  renderBeliBadgeHTML,
  getRatingSession,
  openRatingModal,
  closeRatingModal,
  selectRatingTier,
  handleComparisonChoice,
  handleComparisonTie,
  finalizeDishPlacement,
  removeDishRating
} = await import('../js/modules/ratings.js');

const {
  subscribeToWeekRatings,
  syncPublicWeekRatings,
  recomputeCommunityRatingsForWeek,
  deleteCloudUserData,
  resetWeekRatingsCache
} = await import('../js/modules/sync.js');

const { getFiltered, getSaved } = await import('../js/modules/data.js');
const { cardHTML } = await import('../js/modules/cards.js');
const { buildDetailRatingSummaryHTML } = await import('../js/modules/ui.js');

beforeEach(() => {
  store.clear();
  mockElements.clear();
  resetWeekRatingsCache();
  State.saved = new Set();
  State.passed = new Set();
  State.notes = {};
  State.ratings = {};
  State.communityRatings = {};
  State.customSavedOrder = [];
  State.crawlSelection = [];
  State.activeFilters = new Set();
  State.activeSavedFilters = new Set();
  State.activeDayFilter = null;
  State.activeDayFilters = new Set();
  State.searchQuery = '';
  State.savedSearchQuery = '';
  State.activeSort = 'restaurant';
  State.activeSavedSort = 'restaurant';
  State.rankingModeActive = false;
  State.currentWeekId = 'burger-2026';
  State.user = null;
  State.selectedDish = null;
  window.RESTAURANTS = SAMPLE_RESTAURANTS;
  window.db = null;
  closeRatingModal();
});

describe('Beli-Style Dish Rating Core Math & Per-Week Scoping', () => {
  it('computes midpoint 0.1-rounded Beli scores across all three tiers', () => {
    expect(computeTierScore('liked', 0, 1)).toBe(8.5);
    expect(computeTierScore('fine', 0, 1)).toBe(5.5);
    expect(computeTierScore('disliked', 0, 1)).toBe(2.5);

    // 2 items in liked band [7.0, 10.0]: indices 0 and 1
    expect(computeTierScore('liked', 0, 2)).toBe(9.3);
    expect(computeTierScore('liked', 1, 2)).toBe(7.8);

    // Invalid inputs return null
    expect(computeTierScore('unknown', 0, 1)).toBeNull();
    expect(computeTierScore('liked', -1, 2)).toBeNull();
    expect(computeTierScore('liked', 2, 2)).toBeNull();
  });

  it('scopes dish ratings independently per food week', () => {
    State.user = { uid: 'user-1' };
    finalizeDishPlacement('liked', 0, 101, 'burger-2026');
    finalizeDishPlacement('disliked', 0, 101, 'pizza-2026');

    const burgerRating = getUserDishRating(101, 'burger-2026');
    const pizzaRating = getUserDishRating(101, 'pizza-2026');

    expect(burgerRating.score).toBe(8.5);
    expect(burgerRating.tier).toBe('liked');
    expect(pizzaRating.score).toBe(2.5);
    expect(pizzaRating.tier).toBe('disliked');
    expect(isDishTried(101, 'burger-2026')).toBe(true);
    expect(getWeekRatingsMap('burger-2026').size).toBe(1);
  });

  it('persists ratings in localStorage and clears them on clearUserDataState', () => {
    State.user = { uid: 'user-1' };
    finalizeDishPlacement('liked', 0, 102, 'burger-2026');
    saveState();

    State.ratings = {};
    loadState();
    expect(getUserDishRating(102, 'burger-2026')?.score).toBe(8.5);

    clearUserDataState();
    expect(getUserDishRating(102, 'burger-2026')).toBeNull();
  });
});

describe('Signed-In Auth Guard & Head-to-Head Comparison Flow', () => {
  it('blocks guest users from rating and opens account sign-in modal', () => {
    State.user = null;
    const opened = openRatingModal(101, 'burger-2026');
    expect(opened).toBe(false);
    expect(getRatingSession()).toBeNull();
    expect(document.getElementById('account-modal-overlay').classList.contains('open')).toBe(true);
    expect(document.getElementById('beli-rating-modal').classList.contains('open')).toBe(false);
  });

  it('places the first dish in an empty tier immediately and auto-saves it', () => {
    State.user = { uid: 'user-1' };
    State.passed.add('burger-2026_101');

    expect(openRatingModal(101, 'burger-2026')).toBe(true);
    const result = selectRatingTier('liked');

    expect(result.score).toBe(8.5);
    expect(State.saved.has('burger-2026_101')).toBe(true);
    expect(State.passed.has('burger-2026_101')).toBe(false);
    expect(getRatingSession().step).toBe('result');
  });

  it('ranks a new dish via binary search head-to-head comparisons', () => {
    State.user = { uid: 'user-1' };
    State.ratings['burger-2026'] = { liked: [101, 102, 103], fine: [], disliked: [] };

    openRatingModal(104, 'burger-2026');
    const session = selectRatingTier('liked');
    expect(session.step).toBe('compare');
    // existingList = [101, 102, 103], mid = 1 -> 102
    expect(session.existingList[session.mid]).toBe(102);

    // Prefer new dish (104) over 102 -> narrows to index [0..1), mid = 0 -> 101
    const afterFirst = handleComparisonChoice('new');
    expect(afterFirst.step).toBe('compare');
    expect(afterFirst.existingList[afterFirst.mid]).toBe(101);

    // Prefer existing 101 over new dish (104) -> converges to index 1
    const finalResult = handleComparisonChoice('existing');
    expect(finalResult.rankIndex).toBe(1);
    expect(State.ratings['burger-2026'].liked).toEqual([101, 104, 102, 103]);
    expect(State.saved.has('burger-2026_104')).toBe(true);
  });

  it('handles "Too tough to call" tie immediately at current midpoint', () => {
    State.user = { uid: 'user-1' };
    State.ratings['burger-2026'] = { liked: [101, 102, 103], fine: [], disliked: [] };

    openRatingModal(104, 'burger-2026');
    selectRatingTier('liked'); // mid = 1 (dish 102)
    const tiedResult = handleComparisonTie();

    expect(tiedResult.rankIndex).toBe(1);
    expect(State.ratings['burger-2026'].liked).toEqual([101, 104, 102, 103]);
  });

  it('moves dish cleanly when re-rated into another tier and deletes rating on remove', () => {
    State.user = { uid: 'user-1' };
    finalizeDishPlacement('liked', 0, 101, 'burger-2026');
    finalizeDishPlacement('disliked', 0, 101, 'burger-2026');

    expect(State.ratings['burger-2026'].liked).toEqual([]);
    expect(State.ratings['burger-2026'].disliked).toEqual([101]);

    const removed = removeDishRating(101, 'burger-2026');
    expect(removed).toBe(true);
    expect(getUserDishRating(101, 'burger-2026')).toBeNull();
    // Keeps dish in Saved even if rating is removed
    expect(State.saved.has('burger-2026_101')).toBe(true);
  });
});

describe('Community Score Aggregation, Sync & Deletion Cleanup', () => {
  it('aggregates remote community docs with optimistic local user overlay', () => {
    State.user = { uid: 'u1' };
    finalizeDishPlacement('liked', 0, 101, 'burger-2026'); // u1 score = 8.5

    const remoteDocs = [
      { id: 'burger-2026_u2', data: () => ({ uid: 'u2', weekId: 'burger-2026', scores: { '101': 8.0, '102': 7.0 } }) },
      { id: 'burger-2026_u3', data: () => ({ uid: 'u3', weekId: 'burger-2026', scores: { '101': 6.0 } }) }
    ];

    window.db = {
      collection: () => ({
        where: () => ({
          onSnapshot: cb => {
            cb({ forEach: fn => remoteDocs.forEach(fn) });
            return () => {};
          }
        })
      })
    };

    subscribeToWeekRatings('burger-2026');
    const dish101Comm = getCommunityDishRating(101, 'burger-2026');
    const dish102Comm = getCommunityDishRating(102, 'burger-2026');

    // (8.5 + 8.0 + 6.0) / 3 = 7.5
    expect(dish101Comm).toEqual({ sum: 22.5, count: 3, avg: 7.5 });
    expect(dish102Comm).toEqual({ sum: 7.0, count: 1, avg: 7.0 });
  });

  it('writes public week_user_ratings doc when syncing non-empty scores and deletes empty ones', async () => {
    State.user = { uid: 'u1' };
    const setMock = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn().mockResolvedValue(undefined);

    window.db = {
      collection: name => ({
        doc: docId => ({ set: setMock, delete: deleteMock, name, docId })
      })
    };

    State.ratings['burger-2026'] = { liked: [101], fine: [], disliked: [] };
    await syncPublicWeekRatings('burger-2026', 'u1');
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock.mock.calls[0][0]).toMatchObject({
      uid: 'u1',
      weekId: 'burger-2026',
      scores: { '101': 8.5 }
    });

    State.ratings['burger-2026'] = { liked: [], fine: [], disliked: [] };
    await syncPublicWeekRatings('burger-2026', 'u1');
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('deletes user week_user_ratings documents alongside /users/{uid} during account deletion', async () => {
    State.user = { uid: 'u1' };
    const userDeleteMock = vi.fn().mockResolvedValue(undefined);
    const publicDocDeleteMock = vi.fn().mockResolvedValue(undefined);

    window.db = {
      collection: name => {
        if (name === 'users') {
          return { doc: () => ({ delete: userDeleteMock }) };
        }
        if (name === 'week_user_ratings') {
          return {
            where: () => ({
              get: async () => ({
                empty: false,
                forEach: fn => fn({ ref: { delete: publicDocDeleteMock } })
              })
            })
          };
        }
        return {};
      }
    };

    await deleteCloudUserData('u1');
    expect(publicDocDeleteMock).toHaveBeenCalledTimes(1);
    expect(userDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe('Sorting, Card Badges & Detail Summary Rendering', () => {
  it('sorts Browse by Highest Rated community average descending', () => {
    State.communityRatings['burger-2026'] = {
      '101': { sum: 14.0, count: 2, avg: 7.0 },
      '103': { sum: 18.6, count: 2, avg: 9.3 }
    };
    State.activeSort = 'rating';

    const ids = getFiltered().map(d => d.id);
    expect(ids.slice(0, 2)).toEqual([103, 101]);
  });

  it('sorts Saved by personal Beli rating first, then community rating, then unrated', () => {
    State.user = { uid: 'u1' };
    State.saved = new Set(['burger-2026_101', 'burger-2026_102', 'burger-2026_103', 'burger-2026_104']);
    State.ratings['burger-2026'] = { liked: [104, 101], fine: [], disliked: [] }; // 104=9.3, 101=7.8
    recomputeCommunityRatingsForWeek('burger-2026');
    State.communityRatings['burger-2026']['102'] = { sum: 8.5, count: 1, avg: 8.5 };
    State.activeSavedSort = 'rating';

    const ids = getSaved().map(d => d.id);
    expect(ids).toEqual([104, 102, 101, 103]);
  });

  it('renders color-coded Beli badges on dish cards and detail summary without exposing user emails', () => {
    expect(getBeliBadgeClass(8.5)).toBe('beli-good');
    expect(getBeliBadgeClass(5.5)).toBe('beli-fine');
    expect(getBeliBadgeClass(2.5)).toBe('beli-bad');
    expect(getTierLabel('liked')).toBe('Liked it!');

    const dish = window.RESTAURANTS[0];
    const unratedHTML = cardHTML(dish, null, false, 0, 1);
    expect(unratedHTML).not.toContain('card-rating-row');

    State.user = { uid: 'u1', email: 'secret@example.com' };
    State.ratings['burger-2026'] = { liked: [101], fine: [], disliked: [] };
    State.communityRatings['burger-2026'] = { '101': { sum: 17.0, count: 2, avg: 8.5 } };

    const ratedHTML = cardHTML(dish, null, false, 0, 1);
    expect(ratedHTML).toContain('card-rating-row');
    expect(ratedHTML).toContain('You');
    expect(ratedHTML).toContain('Avg');
    expect(ratedHTML).toContain('8.5');
    expect(ratedHTML).not.toContain('secret@example.com');

    const summaryHTML = buildDetailRatingSummaryHTML(dish);
    expect(summaryHTML).toContain('Community Score');
    expect(summaryHTML).toContain('2 ratings');
    expect(summaryHTML).toContain('Your Beli Rank');

    const badge = renderBeliBadgeHTML(8.5);
    expect(badge).toContain('beli-good');
  });
});

describe('Privacy Policy & Terms of Use Disclosures', () => {
  it('documents dish ratings, anonymous community aggregation, fair use, and deletion in legal pages', () => {
    const rootDir = path.resolve(process.cwd());
    const privacy = fs.readFileSync(path.join(rootDir, 'privacy.html'), 'utf8');
    const terms = fs.readFileSync(path.join(rootDir, 'terms.html'), 'utf8');
    const deployment = fs.readFileSync(path.join(rootDir, 'docs', 'DEPLOYMENT.md'), 'utf8');

    expect(privacy).toContain('November 14, 2026');
    expect(privacy).toContain('Community Scores');
    expect(privacy).toContain('never');
    expect(privacy).toContain('community score records');

    expect(terms).toContain('November 14, 2026');
    expect(terms).toContain('Community Scores');
    expect(terms).toContain('dish ratings');
    expect(terms).toContain('manipulate');

    expect(deployment).toContain('week_user_ratings');
  });
});
