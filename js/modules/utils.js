/* ── Shared Utilities ── */

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, delay) {
  let timeoutId = null;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function highlightMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return esc(text);

  const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${q})`, 'gi');
  const parts = String(text).split(regex);
  if (parts.length <= 1) return esc(text);

  return parts.map(part => {
    if (regex.test(part)) {
      return `<mark class="search-highlight">${esc(part)}</mark>`;
    }
    return esc(part);
  }).join('');
}

export function safeUrl(u) {
  const v = String(u || '').trim();
  return /^https?:\/\//i.test(v) ? v : '#';
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let toastTimer = null;
export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Schedule & Day-of-Week Helpers ──
const DAY_MAP = {
  sun: 0, sunday: 0, sundays: 0,
  mon: 1, monday: 1, mondays: 1,
  tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
  wed: 3, wednesday: 3, wednesdays: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
  fri: 5, friday: 5, fridays: 5,
  sat: 6, saturday: 6, saturdays: 6
};

export function parseClosedDays(text) {
  if (!text) return new Set();
  const normalized = String(text).toLowerCase().replace(/['’]/g, '');
  const closedDays = new Set();

  // Pattern: "closed [days...]"
  const closedMatches = normalized.matchAll(/closed\s+(?:on\s+)?([a-z\s,&/\-]+?)(?=[.)]|$)/gi);
  for (const match of closedMatches) {
    const phrase = match[1];
    
    // Check for day ranges like "mon-wed" or "monday through wednesday"
    const rangeMatch = phrase.match(/(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:-|through|to)\s*(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (rangeMatch) {
      const startDay = DAY_MAP[rangeMatch[1]];
      const endDay = DAY_MAP[rangeMatch[2]];
      if (startDay !== undefined && endDay !== undefined) {
        let curr = startDay;
        while (true) {
          closedDays.add(curr);
          if (curr === endDay) break;
          curr = (curr + 1) % 7;
        }
      }
    }

    // Individual days mentioned in the closed phrase
    const words = phrase.split(/[\s,&/]+/);
    for (const word of words) {
      if (DAY_MAP[word] !== undefined) {
        closedDays.add(DAY_MAP[word]);
      }
    }
  }

  return closedDays;
}

export function isRestaurantOpenOnDay(r, dayIndex) {
  if (!r) return true;
  const targetDay = Number(dayIndex);
  if (isNaN(targetDay) || targetDay < 0 || targetDay > 6) return true;

  // 1. Structured hours if provided
  if (r.hours && Array.isArray(r.hours.openDays)) {
    return r.hours.openDays.includes(targetDay);
  }
  if (r.hours && Array.isArray(r.hours.periods)) {
    return r.hours.periods.some(p => p.open && p.open.day === targetDay);
  }

  // 2. Heuristic parsing from description and notes
  const textToCheck = `${r.desc || ''} ${r.whatsOnIt || ''} ${r.notes || ''} ${r.restaurant || ''}`;
  const closedDays = parseClosedDays(textToCheck);
  if (closedDays.has(targetDay)) {
    return false;
  }

  // Default permissive: if no closure is stated, assume open
  return true;
}

export function isRestaurantOpenNow(r, now = new Date()) {
  if (!r) return true;
  const currentDay = now.getDay();
  if (!isRestaurantOpenOnDay(r, currentDay)) return false;

  // If structured hours are available:
  if (r.hours && Array.isArray(r.hours.periods)) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const todayPeriods = r.hours.periods.filter(p => p.open && p.open.day === currentDay);
    if (todayPeriods.length > 0) {
      return todayPeriods.some(p => {
        const openMin = p.open.hour * 60 + (p.open.minute || 0);
        let closeMin = p.close ? (p.close.hour * 60 + (p.close.minute || 0)) : 1440;
        if (p.close && p.close.day !== currentDay) {
          closeMin += 1440;
        }
        return currentMinutes >= openMin && currentMinutes < closeMin;
      });
    }
  }

  return true;
}

// ── Relative Food Week Timing Badges (Clean & Solid, No Pulsing Dots) ──
export function getWeekTiming(w, now = new Date()) {
  if (!w || !w.startDate) return { badgeHTML: '', status: 'unknown', start: null, end: null, label: '' };
  const [sy, sm, sd] = w.startDate.split('-');
  const start = new Date(sy, sm - 1, sd, 0, 0, 0);
  let end = new Date(sy, sm - 1, sd, 23, 59, 59);

  if (w.endDate) {
    const [ey, em, ed] = w.endDate.split('-');
    end = new Date(ey, em - 1, ed, 23, 59, 59);
  } else if (w.dates) {
    const weekMatch = w.dates.match(/([a-zA-Z]+)\s+\d+\s*[-–]\s*(\d+),\s+(\d{4})/);
    const monthMatch = w.dates.match(/([a-zA-Z]+)\s+(\d{4})/);
    if (weekMatch) {
      end = new Date(`${weekMatch[1]} ${weekMatch[2]}, ${weekMatch[3]} 23:59:59`);
    } else if (monthMatch) {
      end = new Date(`${monthMatch[1]} 1, ${monthMatch[2]} 23:59:59`);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
    } else {
      end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    }
  } else {
    end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  }

  if (now >= start && now <= end) {
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 1) {
      return {
        badgeHTML: '<div class="landing-status-badge active urgent">Ends Today!</div>',
        status: 'active',
        label: 'Ends Today!',
        start, end
      };
    }
    if (daysLeft <= 3) {
      return {
        badgeHTML: `<div class="landing-status-badge active">Ends in ${daysLeft}d</div>`,
        status: 'active',
        label: `Ends in ${daysLeft}d`,
        start, end
      };
    }
    return {
      badgeHTML: '<div class="landing-status-badge active">Active Now</div>',
      status: 'active',
      label: 'Active Now',
      start, end
    };
  }

  if (now < start) {
    const daysUntil = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    if (daysUntil === 1) {
      return {
        badgeHTML: '<div class="landing-status-badge next">Starts Tomorrow</div>',
        status: 'upcoming',
        label: 'Starts Tomorrow',
        start, end, daysUntil
      };
    }
    if (daysUntil <= 14) {
      return {
        badgeHTML: `<div class="landing-status-badge next">Starts in ${daysUntil}d</div>`,
        status: 'upcoming',
        label: `Starts in ${daysUntil}d`,
        start, end, daysUntil
      };
    }
    return {
      badgeHTML: '<div class="landing-status-badge upcoming">Upcoming</div>',
      status: 'upcoming',
      label: 'Upcoming',
      start, end, daysUntil
    };
  }

  return {
    badgeHTML: '<div class="landing-status-badge past">Past Event</div>',
    status: 'past',
    label: 'Past Event',
    start, end
  };
}

