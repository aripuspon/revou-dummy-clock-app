/**
 * Test harness smoke tests for revou-dummy-clock-app
 *
 * These tests verify that:
 *  1. All expected exports are present from js/app.js
 *  2. Core module shapes are correct (module stubs are wired up)
 *  3. Pure functions return expected types/values on basic inputs
 *
 * Property-based tests (fast-check) are added in later tasks.
 * This file focuses on ensuring the scaffold is importable and
 * correctly structured before any logic is filled in.
 */

'use strict';

// js/app.js exports pure functions + module objects when run in Node
const {
  KEYS,
  StorageService,
  formatTime,
  formatDate,
  getTimeOfDayPhrase,
  buildGreeting,
  validateTaskName,
  isValidUrl,
  ClockModule,
  GreetingModule,
  TimerModule,
  TodoModule,
  QuickLinksModule,
  ThemeModule,
  App,
} = require('../js/app.js');

// ---------------------------------------------------------------------------
// 1. Exports smoke test
// ---------------------------------------------------------------------------
describe('app.js exports', () => {
  test('KEYS has all four expected constants', () => {
    expect(KEYS).toMatchObject({
      USER_NAME: 'rda_userName',
      TASKS:     'rda_tasks',
      LINKS:     'rda_links',
      THEME:     'rda_theme',
    });
  });

  test('StorageService exposes get, set, remove, init', () => {
    expect(typeof StorageService.get).toBe('function');
    expect(typeof StorageService.set).toBe('function');
    expect(typeof StorageService.remove).toBe('function');
    expect(typeof StorageService.init).toBe('function');
  });

  test('formatTime is exported as a function', () => {
    expect(typeof formatTime).toBe('function');
  });

  test('formatDate is exported as a function', () => {
    expect(typeof formatDate).toBe('function');
  });

  test('getTimeOfDayPhrase is exported as a function', () => {
    expect(typeof getTimeOfDayPhrase).toBe('function');
  });

  test('buildGreeting is exported as a function', () => {
    expect(typeof buildGreeting).toBe('function');
  });

  test('validateTaskName is exported as a function', () => {
    expect(typeof validateTaskName).toBe('function');
  });

  test('isValidUrl is exported as a function', () => {
    expect(typeof isValidUrl).toBe('function');
  });

  test('all module objects are exported', () => {
    expect(ClockModule).toBeDefined();
    expect(GreetingModule).toBeDefined();
    expect(TimerModule).toBeDefined();
    expect(TodoModule).toBeDefined();
    expect(QuickLinksModule).toBeDefined();
    expect(ThemeModule).toBeDefined();
    expect(App).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. StorageService (node env — localStorage unavailable)
// ---------------------------------------------------------------------------
describe('StorageService in Node environment', () => {
  beforeEach(() => {
    // Reset to a known state
    StorageService.available = true;
  });

  test('get returns defaultValue when available=false', () => {
    StorageService.available = false;
    expect(StorageService.get('any_key', 'default')).toBe('default');
  });

  test('set is a no-op when available=false (does not throw)', () => {
    StorageService.available = false;
    expect(() => StorageService.set('any_key', { x: 1 })).not.toThrow();
  });

  test('remove is a no-op when available=false (does not throw)', () => {
    StorageService.available = false;
    expect(() => StorageService.remove('any_key')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2b. StorageService with mocked localStorage (Req 7.3, 7.4, 10.1, 10.2)
// ---------------------------------------------------------------------------
describe('StorageService with mocked localStorage', () => {
  let mockStorage;

  beforeEach(() => {
    // Reset available flag
    StorageService.available = true;

    // Build a simple in-memory localStorage mock
    mockStorage = (() => {
      const store = {};
      return {
        getItem:    (k)    => (k in store ? store[k] : null),
        setItem:    (k, v) => { store[k] = String(v); },
        removeItem: (k)    => { delete store[k]; },
      };
    })();

    global.localStorage = mockStorage;
  });

  afterEach(() => {
    delete global.localStorage;
  });

  // Req 10.1 — absent key returns defaultValue
  test('get returns defaultValue when key is absent', () => {
    expect(StorageService.get('missing_key', 'fallback')).toBe('fallback');
  });

  // Req 10.1 — corrupt / non-JSON value returns defaultValue without throwing
  test('get returns defaultValue on JSON parse failure (corrupt data)', () => {
    mockStorage.setItem('corrupt_key', '{ not valid json !!!');
    expect(() => {
      const result = StorageService.get('corrupt_key', 'safe');
      expect(result).toBe('safe');
    }).not.toThrow();
  });

  // Req 7.3 / 10.1 — round-trip: set then get returns deeply equal value
  test('set then get round-trips a JSON-serialisable value', () => {
    const tasks = [{ id: '1', name: 'Buy milk', completed: false, createdAt: 1000 }];
    StorageService.set(KEYS.TASKS, tasks);
    const loaded = StorageService.get(KEYS.TASKS, []);
    expect(loaded).toEqual(tasks);
  });

  // Req 7.4 / 10.2 — set flips available=false on error and never throws
  test('set flips available=false on error and does not throw', () => {
    mockStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    expect(() => StorageService.set(KEYS.TASKS, [1, 2, 3])).not.toThrow();
    expect(StorageService.available).toBe(false);
  });

  // Req 10.2 — remove flips available=false on error and never throws
  test('remove flips available=false on error and does not throw', () => {
    mockStorage.removeItem = () => { throw new Error('Storage error'); };
    expect(() => StorageService.remove(KEYS.USER_NAME)).not.toThrow();
    expect(StorageService.available).toBe(false);
  });

  // Req 10.2 — get flips available=false when localStorage.getItem throws
  test('get flips available=false when localStorage.getItem throws', () => {
    mockStorage.getItem = () => { throw new Error('Storage access denied'); };
    expect(() => {
      const result = StorageService.get('some_key', 'default');
      expect(result).toBe('default');
    }).not.toThrow();
    expect(StorageService.available).toBe(false);
  });

  // Req 10.1 — corrupt JSON does NOT flip available (only unavailability does)
  test('corrupt JSON data does not flip available to false', () => {
    mockStorage.setItem('bad_key', 'THIS IS NOT JSON');
    StorageService.get('bad_key', null);
    expect(StorageService.available).toBe(true);
  });

  // Req 7.4 — remove is a no-op (does not throw) when available=false
  test('remove is a no-op when available=false after an earlier error', () => {
    mockStorage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    StorageService.set(KEYS.TASKS, []); // triggers available = false
    expect(() => StorageService.remove(KEYS.USER_NAME)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. formatTime
// ---------------------------------------------------------------------------
describe('formatTime', () => {
  test('formats midnight as 00:00:00', () => {
    const d = new Date(2026, 0, 1, 0, 0, 0); // Jan 1 2026 00:00:00
    expect(formatTime(d)).toBe('00:00:00');
  });

  test('formats noon as 12:00:00', () => {
    const d = new Date(2026, 0, 1, 12, 0, 0);
    expect(formatTime(d)).toBe('12:00:00');
  });

  test('zero-pads single-digit values', () => {
    const d = new Date(2026, 0, 1, 9, 5, 7);
    expect(formatTime(d)).toBe('09:05:07');
  });

  test('formats 23:59:59 correctly', () => {
    const d = new Date(2026, 0, 1, 23, 59, 59);
    expect(formatTime(d)).toBe('23:59:59');
  });

  test('output always matches HH:MM:SS pattern', () => {
    const d = new Date(2026, 6, 4, 14, 30, 5);
    expect(formatTime(d)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// 4. formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  test('contains a full weekday name', () => {
    // July 4 2026 is a Saturday
    const d = new Date(2026, 6, 4, 12, 0, 0);
    expect(formatDate(d)).toMatch(/Saturday/);
  });

  test('contains a two-digit day number', () => {
    const d = new Date(2026, 6, 4, 12, 0, 0);
    expect(formatDate(d)).toMatch(/04/);
  });

  test('contains a full month name', () => {
    const d = new Date(2026, 6, 4, 12, 0, 0);
    expect(formatDate(d)).toMatch(/July/);
  });

  test('contains a four-digit year', () => {
    const d = new Date(2026, 6, 4, 12, 0, 0);
    expect(formatDate(d)).toMatch(/2026/);
  });

  // Req 1.2 — full format: "Weekday, DD Month YYYY" ordering
  test('full format is "Saturday, 04 July 2026" (Req 1.2)', () => {
    // July 4 2026 is a Saturday; toLocaleDateString en-GB with these options
    // produces "Saturday, 04 July 2026"
    const d = new Date(2026, 6, 4, 12, 0, 0);
    expect(formatDate(d)).toBe('Saturday, 04 July 2026');
  });

  // Req 1.2 — single-digit day must be zero-padded (day:'2-digit')
  test('zero-pads a single-digit day (e.g. the 4th → "04")', () => {
    const d = new Date(2026, 6, 4, 12, 0, 0); // July 4
    expect(formatDate(d)).toMatch(/\b04\b/);
  });

  // Verify another month/weekday to confirm locale is consistent
  test('contains correct weekday and month for January 1 2026 (Thursday)', () => {
    const d = new Date(2026, 0, 1, 12, 0, 0); // Jan 1 2026 is a Thursday
    const result = formatDate(d);
    expect(result).toMatch(/Thursday/);
    expect(result).toMatch(/January/);
    expect(result).toMatch(/2026/);
  });
});

// ---------------------------------------------------------------------------
// 5. getTimeOfDayPhrase
// ---------------------------------------------------------------------------
describe('getTimeOfDayPhrase', () => {
  const VALID_PHRASES = ['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night'];

  test('returns a known phrase for every hour 0–23', () => {
    for (let h = 0; h <= 23; h++) {
      expect(VALID_PHRASES).toContain(getTimeOfDayPhrase(h));
    }
  });

  test('returns Good Morning for hour 5', ()  => expect(getTimeOfDayPhrase(5)).toBe('Good Morning'));
  test('returns Good Morning for hour 11', () => expect(getTimeOfDayPhrase(11)).toBe('Good Morning'));
  test('returns Good Afternoon for hour 12', () => expect(getTimeOfDayPhrase(12)).toBe('Good Afternoon'));
  test('returns Good Afternoon for hour 17', () => expect(getTimeOfDayPhrase(17)).toBe('Good Afternoon'));
  test('returns Good Evening for hour 18', () => expect(getTimeOfDayPhrase(18)).toBe('Good Evening'));
  test('returns Good Evening for hour 20', () => expect(getTimeOfDayPhrase(20)).toBe('Good Evening'));
  test('returns Good Night for hour 21', () => expect(getTimeOfDayPhrase(21)).toBe('Good Night'));
  test('returns Good Night for hour 0',  () => expect(getTimeOfDayPhrase(0)).toBe('Good Night'));
  test('returns Good Night for hour 4',  () => expect(getTimeOfDayPhrase(4)).toBe('Good Night'));
  test('returns Good Night for hour 23', () => expect(getTimeOfDayPhrase(23)).toBe('Good Night'));
});

// ---------------------------------------------------------------------------
// 6. buildGreeting
// ---------------------------------------------------------------------------
describe('buildGreeting', () => {
  test('with a name: format is "<phrase>, <name>!"', () => {
    expect(buildGreeting(9, 'Alex')).toBe('Good Morning, Alex!');
  });

  test('without a name: format is "<phrase>!" with no comma', () => {
    expect(buildGreeting(9, null)).toBe('Good Morning!');
  });

  test('empty string name treated as no-name', () => {
    expect(buildGreeting(14, '')).toBe('Good Afternoon!');
  });

  test('whitespace-only name treated as no-name', () => {
    expect(buildGreeting(19, '   ')).toBe('Good Evening!');
  });

  test('name appears verbatim after comma-space', () => {
    const result = buildGreeting(22, 'Jordan');
    expect(result).toBe('Good Night, Jordan!');
  });
});

// ---------------------------------------------------------------------------
// 7. validateTaskName
// ---------------------------------------------------------------------------
describe('validateTaskName', () => {
  const tasks = [
    { id: '1', name: 'Buy milk', completed: false, createdAt: 1000 },
    { id: '2', name: 'Read book', completed: false, createdAt: 2000 },
  ];

  test('accepts a valid unique name', () => {
    const r = validateTaskName('Write tests', tasks, null);
    expect(r.error).toBeNull();
    expect(r.trimmed).toBe('Write tests');
  });

  test('trims the name before returning', () => {
    const r = validateTaskName('  Write tests  ', tasks, null);
    expect(r.trimmed).toBe('Write tests');
  });

  test('rejects empty string', () => {
    const r = validateTaskName('', tasks, null);
    expect(r.error).not.toBeNull();
  });

  test('rejects whitespace-only string', () => {
    const r = validateTaskName('   ', tasks, null);
    expect(r.error).not.toBeNull();
  });

  test('rejects name exceeding 100 characters', () => {
    const long = 'a'.repeat(101);
    const r = validateTaskName(long, tasks, null);
    expect(r.error).not.toBeNull();
  });

  test('accepts exactly 100 characters', () => {
    const exactly100 = 'a'.repeat(100);
    const r = validateTaskName(exactly100, tasks, null);
    expect(r.error).toBeNull();
  });

  test('rejects case-insensitive duplicate on add path', () => {
    const r = validateTaskName('BUY MILK', tasks, null);
    expect(r.error).not.toBeNull();
  });

  test('allows edit of a task to keep its own name (excludeId)', () => {
    const r = validateTaskName('Buy milk', tasks, '1');
    expect(r.error).toBeNull();
  });

  test('rejects edit that duplicates another task name (excludeId)', () => {
    const r = validateTaskName('Read book', tasks, '1');
    expect(r.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. isValidUrl
// ---------------------------------------------------------------------------
describe('isValidUrl', () => {
  test('accepts http:// URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  test('accepts https:// URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  test('accepts https:// URL with path and query', () => {
    expect(isValidUrl('https://www.example.com/path?q=1')).toBe(true);
  });

  test('rejects ftp:// URL', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  test('rejects URL with no protocol', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  test('rejects null/undefined gracefully', () => {
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
  });

  test('rejects arbitrary non-URL string', () => {
    expect(isValidUrl('not a url at all')).toBe(false);
  });

  test('rejects data: URI', () => {
    expect(isValidUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. ThemeModule
// Tests: default state, toggle light→dark, involution, _applyTheme state
// Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
// ---------------------------------------------------------------------------
describe('ThemeModule', () => {
  beforeEach(() => {
    // Reset ThemeModule to a clean state before each test
    ThemeModule._theme = 'light';

    // Provide a minimal document.documentElement mock so _applyTheme doesn't throw
    if (typeof document === 'undefined') {
      global.document = {
        documentElement: {
          _classes: new Set(),
          classList: {
            add(cls)    { global.document.documentElement._classes.add(cls); },
            remove(cls) { global.document.documentElement._classes.delete(cls); },
            contains(cls) { return global.document.documentElement._classes.has(cls); },
          },
        },
        getElementById: () => null, // no DOM elements in Node
      };
    } else {
      // If document exists (e.g. jsdom), reset the class
      document.documentElement.classList.remove('theme-dark');
    }
  });

  afterEach(() => {
    // Clean up the global mock if we added it
    if (global.document && global.document.documentElement && global.document.documentElement._classes) {
      delete global.document;
    }
  });

  // Req 9.5 — default theme is 'light' (no saved theme)
  test('_theme starts at "light" by default', () => {
    expect(ThemeModule._theme).toBe('light');
  });

  // Req 9.1, 9.2 — toggling from light switches to dark
  test('toggle from light switches _theme to "dark"', () => {
    ThemeModule._theme = 'light';
    ThemeModule.toggle();
    expect(ThemeModule._theme).toBe('dark');
  });

  // Req 9.2 — toggle is its own inverse (involution): light → dark → light
  test('toggling twice returns to the original theme (involution)', () => {
    ThemeModule._theme = 'light';
    ThemeModule.toggle();
    ThemeModule.toggle();
    expect(ThemeModule._theme).toBe('light');
  });

  // Req 9.2 — involution starting from dark
  test('toggling twice from dark also returns to dark', () => {
    ThemeModule._theme = 'dark';
    ThemeModule.toggle();
    ThemeModule.toggle();
    expect(ThemeModule._theme).toBe('dark');
  });

  // Req 9.2 — _applyTheme adds theme-dark class on <html> when theme is dark
  test('_applyTheme adds "theme-dark" class when theme is "dark"', () => {
    ThemeModule._theme = 'dark';
    ThemeModule._applyTheme();
    const hasDark = document.documentElement.classList.contains('theme-dark');
    expect(hasDark).toBe(true);
  });

  // Req 9.2 — _applyTheme removes theme-dark class on <html> when theme is light
  test('_applyTheme removes "theme-dark" class when theme is "light"', () => {
    // First add the class, then apply light theme and verify it's removed
    document.documentElement.classList.add('theme-dark');
    ThemeModule._theme = 'light';
    ThemeModule._applyTheme();
    const hasDark = document.documentElement.classList.contains('theme-dark');
    expect(hasDark).toBe(false);
  });
});
