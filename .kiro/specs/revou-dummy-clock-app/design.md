# Design Document

## Overview

The **revou-dummy-clock-app** is a zero-dependency, browser-based productivity SPA delivered as three plain files: `index.html`, `css/style.css`, and `js/app.js`. There is no build step, no package manager, and no server — the page opens directly in a browser or runs as a browser extension.

The application presents six self-contained UI panels on a single screen:

| Panel | Purpose |
|---|---|
| Clock | Live HH:MM:SS time + full date |
| Greeting | Time-of-day salutation personalised with the saved user name |
| Focus Timer | 25-minute Pomodoro countdown with Start / Stop / Reset |
| To-Do List | CRUD task manager with duplicate prevention |
| Quick Links | User-defined URL shortcuts that open in a new tab |
| Theme Toggle | Global light ↔ dark colour-scheme switch |

All mutable state is persisted to `localStorage` immediately on change. When `localStorage` is unavailable the app falls back to in-memory state and surfaces a non-blocking session-duration notice.

---

## Architecture

### High-Level Structure

The entire client-side logic lives in a single JavaScript file (`js/app.js`) and is organised as a collection of feature modules that each follow the same pattern:

```
init()        — query DOM refs, attach event listeners, load persisted state, render
render()      — read in-memory state, update the DOM
persist()     — serialise in-memory state to localStorage (no-op when unavailable)
```

There is no virtual DOM, no reactive framework, and no module bundler. ES6+ syntax (arrow functions, `const`/`let`, template literals, `class`) is used throughout because all target browsers support it natively.

### Module Boundaries

```
app.js
├── StorageService      — thin wrapper around localStorage; exposes get/set/remove
├── ClockModule         — setInterval-based time display; visibility re-sync
├── GreetingModule      — time-of-day logic; name save/load
├── TimerModule         — countdown state machine; alert on completion
├── TodoModule          — task CRUD, validation, duplicate check, persistence
├── QuickLinksModule    — link CRUD, URL validation, persistence
├── ThemeModule         — class toggling on <html>; persistence; FODT prevention
└── App (bootstrap)     — calls each module's init() in document-ready order
```

### Execution Flow

```
DOMContentLoaded
  │
  ├─ ThemeModule.init()        ← applied FIRST to suppress flash-of-default-theme
  ├─ StorageService.init()     ← probe localStorage availability
  ├─ ClockModule.init()        ← start 1-second interval
  ├─ GreetingModule.init()     ← load name, render greeting
  ├─ TimerModule.init()        ← render 25:00, attach controls
  ├─ TodoModule.init()         ← load tasks, render list
  ├─ QuickLinksModule.init()   ← load links, render buttons
  └─ (if storage unavailable) show session notice
```

### Persistence Strategy

`StorageService` wraps every `localStorage` call in a `try/catch`. On the first failed write or read it flips an `available` flag to `false`, returns a safe default, and signals the bootstrap layer to show the non-blocking notice. All subsequent calls are no-ops (reads return defaults, writes are silently skipped). In-memory state is always the source of truth; `localStorage` is purely a persistence side-effect.

---

## Components and Interfaces

### StorageService

```js
StorageService = {
  available: true,          // flipped false on first error
  get(key, defaultValue),   // returns parsed JSON or defaultValue
  set(key, value),          // serialises to JSON; catches QuotaExceededError
  remove(key),              // wraps localStorage.removeItem
}
```

Keys used:

| Constant | Key string | Value type |
|---|---|---|
| `KEYS.USER_NAME` | `'rda_userName'` | `string \| null` |
| `KEYS.TASKS` | `'rda_tasks'` | `Task[]` |
| `KEYS.LINKS` | `'rda_links'` | `Link[]` |
| `KEYS.THEME` | `'rda_theme'` | `'light' \| 'dark'` |

### ClockModule

**State**: none (reads `Date` on every tick)

**DOM refs**: `#clock-time`, `#clock-date`

**Behaviour**:
- Starts a `setInterval` with a 1000 ms period on `init()`.
- Listens on `document.visibilitychange`; when `document.visibilityState === 'visible'` it immediately fires one tick to resync before the next interval fires.
- Formats time with zero-padding via a `pad2(n)` helper.
- Formats date using `Date` locale methods: `toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })`.

### GreetingModule

**State**: `{ userName: string | null }`

**DOM refs**: `#greeting-text`, `#name-input`, `#name-form`

**Behaviour**:
- `getTimeOfDayPhrase(hour)` — pure function mapping `hour` (0–23) → greeting string (see Data Models).
- On `submit` of `#name-form`: trim value; if non-empty and ≤ 50 chars → save; else → remove.
- Re-renders greeting every time `ClockModule` fires a tick (so the salutation updates if midnight/5 am/noon etc. passes).

### TimerModule

**State**: `{ remaining: number, running: boolean, intervalId: number | null }`

**DOM refs**: `#timer-display`, `#timer-start`, `#timer-stop`, `#timer-reset`, `#timer-alert`

**Behaviour**:
- `start()` — guards against double-start via `running` flag; sets interval.
- `stop()` — clears interval, sets `running = false`, re-enables Start.
- `reset()` — calls `stop()`, sets `remaining = 1500` (25 × 60), re-renders.
- On each tick: decrement `remaining`; if `remaining <= 0` call `stop()` and show alert.
- Alert is a `<div role="alert">` dismissible via a close button; dismissal calls `alert.hidden = true`.

### TodoModule

**State**: `Task[]` (ordered array, insertion order preserved)

**DOM refs**: `#todo-form`, `#todo-input`, `#todo-error`, `#todo-list`

**Operations**:

| Operation | Validation | Side-effects |
|---|---|---|
| `addTask(name)` | trim; 1–100 chars; case-insensitive uniqueness | push to array, clear input, `persist()`, `render()` |
| `editTask(id, newName)` | trim; 1–100 chars; unique among *other* tasks | update in array, `persist()`, `render()` |
| `toggleTask(id)` | — | flip `completed`, `persist()`, `render()` |
| `deleteTask(id)` | — | splice from array, `persist()`, `render()` |

Inline error messages are cleared whenever the user modifies the content of the related input (`input` event listener).

### QuickLinksModule

**State**: `Link[]`

**DOM refs**: `#links-form`, `#link-label-input`, `#link-url-input`, `#link-label-error`, `#link-url-error`, `#links-panel`

**URL validation**: `isValidUrl(str)` — constructs `new URL(str)`, checks `protocol` is `http:` or `https:`, and that `hostname` is non-empty.

**Operations**:

| Operation | Validation |
|---|---|
| `addLink(label, url)` | label non-empty; URL valid per `isValidUrl` |
| `deleteLink(id)` | — |

### ThemeModule

**State**: `{ theme: 'light' | 'dark' }`

**DOM refs**: `#theme-toggle`, `document.documentElement`

**Behaviour**:
- Applied *before* any content renders to prevent flash. The `<script>` that calls `ThemeModule.init()` is the very first thing inside `<body>` (or in a `<script>` in `<head>` before stylesheets that depend on the class).
- Applies theme by adding/removing class `theme-dark` on `<html>`.
- Toggle button's `aria-pressed` attribute reflects current state.

---

## Data Models

### Task

```js
{
  id:        string,   // crypto.randomUUID() or Date.now().toString() fallback
  name:      string,   // trimmed, 1–100 chars
  completed: boolean,
  createdAt: number,   // Date.now() timestamp
}
```

### Link

```js
{
  id:    string,   // crypto.randomUUID() or Date.now().toString() fallback
  label: string,   // non-empty display label
  url:   string,   // validated http(s) URL
}
```

### Greeting Time-of-Day Map

| Hour range (inclusive) | Phrase |
|---|---|
| 05:00 – 11:59 | "Good Morning" |
| 12:00 – 17:59 | "Good Afternoon" |
| 18:00 – 20:59 | "Good Evening" |
| 21:00 – 04:59 | "Good Night" |

### LocalStorage Schema

```
rda_userName  →  "Alex"          (plain string or absent)
rda_theme     →  "dark"          (plain string: "light" | "dark")
rda_tasks     →  JSON array of Task objects
rda_links     →  JSON array of Link objects
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Clock time format invariant

*For any* `Date` object (representing any moment in time), the formatted time string produced by the clock renderer SHALL match the regular expression `/^\d{2}:\d{2}:\d{2}$/` — always exactly two digits for hours, minutes, and seconds, separated by colons, with no additional characters.

**Validates: Requirements 1.1**

---

### Property 2: Clock date format invariant

*For any* `Date` object, the formatted date string produced by the clock renderer SHALL contain a full day name (e.g., "Monday"), a zero-padded two-digit day number, a full month name (e.g., "July"), and a four-digit year.

**Validates: Requirements 1.2**

---

### Property 3: Greeting phrase coverage — all hours handled

*For any* integer hour in the range [0, 23], `getTimeOfDayPhrase(hour)` SHALL return exactly one of the strings "Good Morning", "Good Afternoon", "Good Evening", or "Good Night", and SHALL never return `null`, `undefined`, an empty string, or throw an error.

This single property consolidates Requirements 2.1–2.4, which together define the complete mapping for the 24-hour range. The four clauses partition [0, 23] without gaps or overlaps, so a property over the full range validates all four simultaneously.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 4: Greeting format with name

*For any* non-empty, trimmed User_Name of 1–50 characters and any hour in [0, 23], the rendered greeting string SHALL equal `"<phrase>, <name>!"` where `<phrase>` is the result of `getTimeOfDayPhrase(hour)` and `<name>` is the User_Name. It SHALL contain exactly one comma, exactly one exclamation mark at the end, and the name SHALL appear verbatim after the comma.

**Validates: Requirements 2.5**

---

### Property 5: Greeting format without name

*For any* hour in [0, 23] when no User_Name is present, the rendered greeting string SHALL equal `"<phrase>!"` — it SHALL end with `"!"`, SHALL NOT contain a comma, and SHALL NOT contain any text after the phrase.

**Validates: Requirements 2.6**

---

### Property 6: User name round-trip persistence

*For any* valid trimmed User_Name string of 1–50 characters, saving it via `StorageService.set(KEYS.USER_NAME, name)` and immediately reading it back via `StorageService.get(KEYS.USER_NAME, null)` SHALL return a value strictly equal to the original name string.

**Validates: Requirements 2.7, 10.1**

---

### Property 7: Whitespace-only or empty input clears the saved name

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines) — including the empty string — submitting it as the User_Name SHALL result in the `KEYS.USER_NAME` key being absent from `localStorage` (or returning `null` via `StorageService.get`) and the rendered greeting reverting to the default no-name format matching `"<phrase>!"`.

**Validates: Requirements 2.8**

---

### Property 8: Task addition grows the list

*For any* array of Task objects (any size, including empty) and any valid task name (1–100 trimmed characters, case-insensitively unique in the current list), calling `addTask(name)` SHALL increase the list length by exactly one, and the resulting list SHALL contain a Task whose `name` (after trimming) equals the submitted name.

**Validates: Requirements 4.1**

---

### Property 9: Duplicate task names are rejected — add and edit paths

*For any* task name that already exists in the Todo_List (case-insensitive match), attempting to **add** a task with that name SHALL leave the list length and all task names unchanged and SHALL produce an inline error. Similarly, *for any* task in the list, attempting to **edit** its name to case-insensitively match any *other* task's name SHALL leave that task's name unchanged and SHALL produce an inline error.

These two criteria test the same uniqueness invariant exercised through two different code paths (add vs. edit), so they are verified by a single combined property that generates both scenarios.

**Validates: Requirements 4.2, 5.3**

---

### Property 10: Whitespace-only or empty task names are rejected

*For any* string composed entirely of whitespace (including the empty string), submitting it as a new task name SHALL be rejected, the list SHALL remain unchanged, and an inline validation error SHALL be displayed.

**Validates: Requirements 4.3**

---

### Property 11: Task list round-trip persistence

*For any* array of Task objects (with arbitrary `id`, `name`, `completed`, and `createdAt` values), serialising the array via `StorageService.set(KEYS.TASKS, tasks)` then deserialising it via `StorageService.get(KEYS.TASKS, [])` SHALL produce an array that is deeply equal to the original — preserving all field values, ordering, and length.

**Validates: Requirements 7.1, 7.3**

---

### Property 12: Complete toggle is its own inverse

*For any* Task with any initial `completed` value (true or false), toggling the task's `completed` state twice SHALL return `completed` to its original value. This verifies that `toggleTask` is a pure involution with no side-effects on other task fields.

**Validates: Requirements 6.1**

---

### Property 13: Delete removes exactly the targeted task

*For any* Todo_List containing at least one Task, deleting a Task by its `id` SHALL decrease the list length by exactly one, no Task with that `id` SHALL remain anywhere in the list, and all other tasks SHALL be preserved with their fields unchanged.

**Validates: Requirements 6.4**

---

### Property 14: URL validation correctly classifies all inputs

*For any* string that does NOT begin with `http://` or `https://`, or that has an empty hostname (including the empty string, arbitrary non-URL strings, and `ftp://` URLs), `isValidUrl(str)` SHALL return `false`. *For any* string that begins with `http://` or `https://` and has a non-empty hostname, `isValidUrl(str)` SHALL return `true`.

This property covers both the rejection path (Requirement 8.3) and the acceptance path (Requirement 8.1) in one rule, since they are complementary halves of the same classification function.

**Validates: Requirements 8.1, 8.3**

---

### Property 15: Quick Links round-trip persistence

*For any* array of Link objects (with arbitrary `id`, `label`, and `url` values), serialising the array via `StorageService.set(KEYS.LINKS, links)` then deserialising it via `StorageService.get(KEYS.LINKS, [])` SHALL produce an array that is deeply equal to the original — preserving all field values, ordering, and length.

**Validates: Requirements 8.6**

---

### Property 16: Theme toggle is its own inverse

*For any* initial Theme value (`'light'` or `'dark'`), activating the Theme toggle twice SHALL return the application to the original Theme: the `<html>` element SHALL have the same `theme-dark` class presence as before the two toggles, the `aria-pressed` attribute SHALL reflect the original value, and `StorageService.get(KEYS.THEME)` SHALL return the original theme string.

**Validates: Requirements 9.2, 9.3**

---

### Property 17: StorageService graceful fallback under unavailability

*For any* storage key and any value, when `localStorage` is unavailable (simulated by mocking `localStorage` to throw on all operations), `StorageService.get(key, defaultValue)` SHALL return `defaultValue` without throwing, and `StorageService.set(key, value)` SHALL complete without throwing. After these calls, `StorageService.available` SHALL be `false`.

**Validates: Requirements 10.2**

---

### Property 18: StorageService corrupt-data fallback

*For any* key, when the value stored in `localStorage` for that key is an arbitrary non-JSON or structurally invalid string, `StorageService.get(key, defaultValue)` SHALL return `defaultValue` without throwing — never propagating a `SyntaxError` to the caller.

**Validates: Requirements 10.1**

---

## Error Handling

### LocalStorage Unavailability

- All `localStorage` calls are wrapped in `try/catch` inside `StorageService`.
- On the first caught error, `StorageService.available` is set to `false`.
- `App` bootstrap checks `StorageService.available` after all `init()` calls and, if `false`, inserts a non-blocking `<aside role="status">` banner at the top of the page.
- The banner includes a dismiss button but defaults to visible for the entire session.

### Corrupted / Unparseable Data

- `StorageService.get(key, defaultValue)` wraps `JSON.parse` in a `try/catch`; on parse failure it returns `defaultValue` (empty array, `null`, `'light'`, etc.).
- Individual modules never access `localStorage` directly, so corrupt data is always handled at the `StorageService` boundary.

### Timer Double-Start Prevention

- `TimerModule.start()` is a no-op when `running === true`.
- The Start button is disabled (`disabled` attribute) while the timer is running.

### Input Validation Errors

- Inline error `<span>` elements are pre-rendered in the HTML with `hidden` attribute; modules show/hide them by toggling `hidden`.
- All error spans have `role="alert"` so screen readers announce them automatically.
- Errors are dismissed on `input` events (i.e., as soon as the user changes the field content).

### URL Validation

- `isValidUrl` uses the `URL` constructor inside a `try/catch`: if the constructor throws, the string is invalid.
- Protocol check: `url.protocol !== 'http:' && url.protocol !== 'https:'` → invalid.
- Hostname check: `url.hostname === ''` → invalid.

### Clock Re-sync on Tab Visibility

- `document.visibilitychange` listener forces an immediate `ClockModule._tick()` call when the tab becomes visible, compensating for throttled intervals in background tabs.

---

## Testing Strategy

### Overview

Testing follows a **dual approach**: example-based unit tests for specific scenarios and edge cases, plus property-based tests (PBT) for universal invariants. Because the application is entirely pure-function logic (formatting, validation, state transitions) with no build tooling, tests are written with [**Jasmine**](https://jasmine.github.io/) (runs in browser without a build step) or [**fast-check**](https://fast-check.io/) for property generation in a Node test harness via a simple `package.json` dev dependency — the production code remains zero-dependency.

Alternatively the test suite can be written with **Jest + fast-check** (Node-based) by importing the pure-function modules directly, isolating them from the DOM.

### Unit Tests (Example-Based)

Cover specific scenarios that are most naturally expressed as concrete examples:

- Clock format output for midnight, noon, 9:05:07, 23:59:59
- Greeting phrase for each of the four time windows and their boundary hours (5, 12, 18, 21, 0)
- Timer state transitions: start → stop → remaining preserved; start → countdown to 0 → alert shown
- Task CRUD: add, edit, delete, toggle — with specific names
- Task validation: empty string, pure whitespace, 101-character string, exact duplicate
- Quick Links: valid `http://`, valid `https://`, no protocol, `ftp://`, missing hostname
- Theme: initial application from localStorage; default to light when absent
- StorageService: parse failure returns default; unavailability returns default and sets flag

### Property-Based Tests (fast-check)

Each property-based test runs a minimum of **100 iterations** with random inputs.

| Property | Generator inputs | Assertion |
|---|---|---|
| P1 – Clock time format | `fc.date()` (any `Date`) | output matches `/^\d{2}:\d{2}:\d{2}$/` |
| P2 – Clock date format | `fc.date()` | output contains full weekday, 2-digit day, full month, 4-digit year |
| P3 – Greeting phrase coverage | `fc.integer({min:0, max:23})` | one of the four exact phrases; never throws or returns empty |
| P4 – Greeting with name | `fc.integer(0,23)` × `fc.string({minLength:1, maxLength:50})` | equals `"<phrase>, <name>!"` exactly |
| P5 – Greeting without name | `fc.integer(0,23)` | equals `"<phrase>!"`; contains no comma |
| P6 – Name round-trip | `fc.string({minLength:1, maxLength:50})` | `get(KEYS.USER_NAME)` === saved name |
| P7 – Whitespace/empty name clears | `fc.string().filter(s => s.trim() === '')` | name key absent; greeting is default |
| P8 – Task addition grows list | `fc.array(taskModel)` × unique valid name | length + 1; task present |
| P9 – Duplicate rejection (add + edit) | list with ≥1 task; duplicate name (add path) / list ≥2 tasks; name of other task (edit path) | list unchanged; error shown |
| P10 – Whitespace task rejected | `fc.string().filter(s => s.trim() === '')` | list unchanged; error shown |
| P11 – Task list round-trip | `fc.array(taskModel)` | `deserialise(serialise(tasks))` deep-equals original |
| P12 – Complete toggle is involution | `fc.boolean()` | `toggle(toggle(b)) === b` |
| P13 – Delete removes target | `fc.array(taskModel, {minLength:1})` | length −1; no task with target `id`; others intact |
| P14 – URL validation | `fc.string()` (both valid and invalid) | `isValidUrl` returns correct boolean |
| P15 – Links round-trip | `fc.array(linkModel)` | `deserialise(serialise(links))` deep-equals original |
| P16 – Theme toggle is involution | `fc.constantFrom('light','dark')` | `toggle(toggle(theme)) === theme`; `html` class correct |
| P17 – StorageService unavailable fallback | mocked `localStorage` that always throws | `get` returns default; `set` no-throws; `available === false` |
| P18 – StorageService corrupt-data fallback | `fc.string()` filtered to non-JSON | `get` returns default; no `SyntaxError` propagated |

Each test file includes a comment header in the format:
```
// Feature: revou-dummy-clock-app, Property N: <property text>
```

### Tag Format

```
Feature: revou-dummy-clock-app, Property {N}: {property_text}
```

### Integration / Smoke Tests

- Open `index.html` in each target browser; verify clock ticks, theme loads without flash, localStorage round-trips survive page reload.
- Simulate `localStorage` quota exceeded by mocking `localStorage.setItem` to throw `DOMException`; verify the non-blocking banner appears.

### Accessibility

- All interactive elements have accessible labels (`aria-label`, `aria-pressed`, `role="alert"`).
- Manual testing with keyboard navigation and a screen reader is recommended.
