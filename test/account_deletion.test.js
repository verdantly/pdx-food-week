import { describe, it, expect, beforeEach } from 'vitest';
import { State, clearUserDataState, purgeAllUserData } from '../js/modules/state.js';

// Mock localStorage for Node environment
const storage = {};
globalThis.localStorage = {
  getItem: (key) => (key in storage ? storage[key] : null),
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

describe('Account Deletion & Data Purge Unit Tests', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    State.saved = new Set(['dish_1', 'dish_2']);
    State.passed = new Set(['dish_3']);
    State.notes = { dish_1: 'Delicious!' };
    State.crawlSelection = ['dish_1'];
    State.customSavedOrder = ['dish_1', 'dish_2'];

    localStorage.setItem('pdxfw_saved_v1', JSON.stringify(['dish_1', 'dish_2']));
    localStorage.setItem('pdxfw_passed_v1', JSON.stringify(['dish_3']));
    localStorage.setItem('pdxfw_notes_v1', JSON.stringify({ dish_1: 'Delicious!' }));
    localStorage.setItem('pdxfw_custom_order_v1', JSON.stringify(['dish_1', 'dish_2']));
    localStorage.setItem('pdxfw_guest_backup_v1', JSON.stringify({ saved: ['dish_1'] }));
    localStorage.setItem('pdxfw_logged_in_uid', 'user_123');
  });

  it('clearUserDataState clears saved, passed, notes, and order', () => {
    clearUserDataState();

    expect(State.saved.size).toBe(0);
    expect(State.passed.size).toBe(0);
    expect(Object.keys(State.notes).length).toBe(0);
    expect(State.crawlSelection.length).toBe(0);
    expect(State.customSavedOrder.length).toBe(0);

    expect(localStorage.getItem('pdxfw_saved_v1')).toBeNull();
    expect(localStorage.getItem('pdxfw_passed_v1')).toBeNull();
    expect(localStorage.getItem('pdxfw_notes_v1')).toBeNull();
    expect(localStorage.getItem('pdxfw_custom_order_v1')).toBeNull();
  });

  it('purgeAllUserData clears state, guest backup, and logged-in user tokens', () => {
    purgeAllUserData();

    expect(State.saved.size).toBe(0);
    expect(localStorage.getItem('pdxfw_guest_backup_v1')).toBeNull();
    expect(localStorage.getItem('pdxfw_logged_in_uid')).toBeNull();
  });
});
