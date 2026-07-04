# Implementation Plan: revou-dummy-clock-app

## Overview

Implement the revou-dummy-clock-app as a zero-dependency, browser-based SPA using plain HTML, CSS, and vanilla JavaScript. All logic lives in three files (`index.html`, `css/style.css`, `js/app.js`). Each module follows the `init() / render() / persist()` pattern. A Node-based test harness using Jest + fast-check covers property-based tests; the production code itself has no dependencies.

---

## Tasks

- [x] 1. Set up project structure, HTML scaffold, and test harness
  - Create `index.html` with semantic sections for clock, greeting, timer, todo, quick-links, and theme toggle
  - Create `css/style.css` with light/dark theme variables and base layout
  - Create `js/app.js` skeleton with module stubs (`StorageService`, `ClockModule`, `GreetingModule`, `TimerModule`, `TodoModule`, `QuickLinksModule`, `ThemeModule`, `App`)
  - Initialise `package.json` with `jest` and `fast-check` as dev dependencies
  - Create `tests/` directory with a Jest config pointing at `js/app.js` pure-function exports
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 8.1, 9.1_

- [x] 2. Implement `StorageService`
  - [x] 2.1 Implement `StorageService.get`, `StorageService.set`, `StorageService.remove`
    - Wrap every `localStorage` call in `try/catch`; flip `available` flag to `false` on first error
    - `get` wraps `JSON.parse` in `try/catch` and returns `defaultValue` on failure
    - Define and export `KEYS` constants (`rda_userName`, `rda_tasks`, `rda_links`, `rda_theme`)
    - _Requirements: 7.3, 7.4, 10.1, 10.2_

  - [ ]* 2.2 Write property test for StorageService graceful fallback under unavailability (Property 17)
    - **Property 17: StorageService graceful fallback under unavailability**
    - Mock `localStorage` to always throw; assert `get` returns `defaultValue`, `set` does not throw, `available === false`
    - **Validates: Requirements 10.2**

  - [ ]* 2.3 Write property test for StorageService corrupt-data fallback (Property 18)
    - **Property 18: StorageService corrupt-data fallback**
    - Generate arbitrary non-JSON strings; assert `get` returns `defaultValue` without propagating `SyntaxError`
    - **Validates: Requirements 10.1**

- [x] 3. Implement `ThemeModule`
  - [x] 3.1 Implement `ThemeModule.init`, `ThemeModule.toggle`, and `ThemeModule.render`
    - Apply theme by adding/removing `theme-dark` class on `<html>`; update `aria-pressed` on toggle button
    - Load saved theme from `StorageService` on `init()`; apply before any other module to prevent flash-of-default-theme
    - Default to `'light'` when no theme is saved
    - Persist selected theme via `StorageService.set(KEYS.THEME, theme)`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 3.2 Write property test for theme toggle involution (Property 16)
    - **Property 16: Theme toggle is its own inverse**
    - Generate initial theme from `fc.constantFrom('light', 'dark')`; assert toggling twice restores original class, `aria-pressed`, and stored value
    - **Validates: Requirements 9.2, 9.3**

- [x] 4. Implement `ClockModule`
  - [x] 4.1 Implement `ClockModule.init` and `ClockModule._tick`
    - Export `formatTime(date)` — returns zero-padded `HH:MM:SS` string
    - Export `formatDate(date)` — returns full day name, zero-padded date, full month name, 4-digit year using `toLocaleDateString('en-GB', ...)`
    - Start `setInterval` at 1000 ms; attach `visibilitychange` listener to resync on tab focus
    - Update `#clock-time` and `#clock-date` DOM elements on each tick
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 4.2 Write property test for clock time format invariant (Property 1)
    - **Property 1: Clock time format invariant**
    - Generate arbitrary `Date` objects via `fc.date()`; assert `formatTime(date)` matches `/^\d{2}:\d{2}:\d{2}$/`
    - **Validates: Requirements 1.1**

  - [ ]* 4.3 Write property test for clock date format invariant (Property 2)
    - **Property 2: Clock date format invariant**
    - Generate arbitrary `Date` objects via `fc.date()`; assert `formatDate(date)` contains full weekday, two-digit day, full month name, and four-digit year
    - **Validates: Requirements 1.2**

- [x] 5. Implement `GreetingModule`
  - [x] 5.1 Export `getTimeOfDayPhrase(hour)` pure function
    - Map hour 5–11 → "Good Morning", 12–17 → "Good Afternoon", 18–20 → "Good Evening", 21–23 and 0–4 → "Good Night"
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.2 Write property test for greeting phrase coverage (Property 3)
    - **Property 3: Greeting phrase coverage — all hours handled**
    - Generate `fc.integer({min:0, max:23})`; assert result is one of the four exact phrases, never `null`/`undefined`/empty, never throws
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 5.3 Export `buildGreeting(hour, userName)` and implement `GreetingModule.init` / `render`
    - With name: return `"<phrase>, <name>!"`; without name: return `"<phrase>!"`
    - On `init()`: load saved name from `StorageService`; attach submit handler on `#name-form`
    - Trim input; if non-empty and ≤ 50 chars → `StorageService.set(KEYS.USER_NAME, trimmed)`; else → `StorageService.remove(KEYS.USER_NAME)`
    - Re-render greeting on each `ClockModule` tick to update phrase when hour boundary crosses
    - _Requirements: 2.5, 2.6, 2.7, 2.8_

  - [ ]* 5.4 Write property test for greeting format with name (Property 4)
    - **Property 4: Greeting format with name**
    - Generate `fc.integer(0,23)` × `fc.string({minLength:1, maxLength:50})`; assert result equals `"<phrase>, <name>!"` with exactly one comma and one trailing `!`
    - **Validates: Requirements 2.5**

  - [ ]* 5.5 Write property test for greeting format without name (Property 5)
    - **Property 5: Greeting format without name**
    - Generate `fc.integer(0,23)`; assert result equals `"<phrase>!"` with no comma
    - **Validates: Requirements 2.6**

  - [ ]* 5.6 Write property test for user name round-trip persistence (Property 6)
    - **Property 6: User name round-trip persistence**
    - Generate `fc.string({minLength:1, maxLength:50})`; save via `StorageService.set(KEYS.USER_NAME, name)` and read back; assert strict equality
    - **Validates: Requirements 2.7, 10.1**

  - [ ]* 5.7 Write property test for whitespace/empty input clears name (Property 7)
    - **Property 7: Whitespace-only or empty input clears the saved name**
    - Generate `fc.string().filter(s => s.trim() === '')`; assert key absent and greeting reverts to default format
    - **Validates: Requirements 2.8**

- [x] 6. Checkpoint — Ensure all tests pass
  - Run the Jest test suite; ensure all property-based and unit tests pass before continuing. Ask the user if questions arise.

- [x] 7. Implement `TimerModule`
  - [x] 7.1 Implement `TimerModule.init`, `start`, `stop`, `reset`, and tick logic
    - Initial state: `{ remaining: 1500, running: false, intervalId: null }`
    - `start()`: no-op when `running === true`; disable `#timer-start`; start 1-second interval
    - `stop()`: clear interval, `running = false`, re-enable `#timer-start`, re-render
    - `reset()`: call `stop()`, set `remaining = 1500`, re-render
    - On tick: decrement `remaining`; when `remaining <= 0` call `stop()` and show `#timer-alert` (`<div role="alert">`)
    - Alert dismissal: close button sets `alert.hidden = true`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 8. Implement `TodoModule` — core CRUD and validation
  - [x] 8.1 Export `validateTaskName(name, existingTasks, excludeId)` and implement `addTask` / `editTask`
    - Trim input; reject empty/whitespace (Req 4.3); reject > 100 chars (Req 4.4); reject case-insensitive duplicate among other tasks (Req 4.2, 5.3)
    - `addTask`: push `{ id, name, completed: false, createdAt }` to array; clear `#todo-input`; `persist()`; `render()`
    - `editTask`: validate; update matching task in array; `persist()`; `render()`; show inline error on failure
    - `editTask` same-name-single-task no-op: treat as success, exit edit state without modifying storage (Req 5.6)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.2 Write property test for task addition grows the list (Property 8)
    - **Property 8: Task addition grows the list**
    - Generate `fc.array(taskModel)` × unique valid name; assert length increases by exactly 1 and new task is present
    - **Validates: Requirements 4.1**

  - [ ]* 8.3 Write property test for duplicate task rejection (Property 9)
    - **Property 9: Duplicate task names are rejected — add and edit paths**
    - Generate list ≥1 task and a duplicate name; assert list length unchanged and error produced; also test edit path with list ≥2 tasks
    - **Validates: Requirements 4.2, 5.3**

  - [ ]* 8.4 Write property test for whitespace task names rejected (Property 10)
    - **Property 10: Whitespace-only or empty task names are rejected**
    - Generate `fc.string().filter(s => s.trim() === '')`; assert list unchanged and error shown
    - **Validates: Requirements 4.3**

  - [x] 8.5 Implement `toggleTask` and `deleteTask`
    - `toggleTask(id)`: flip `completed` on matching task; `persist()`; `render()`
    - `deleteTask(id)`: splice task from array; `persist()`; `render()`
    - Render completed tasks with strikethrough and reduced-emphasis CSS class
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.6 Write property test for complete toggle involution (Property 12)
    - **Property 12: Complete toggle is its own inverse**
    - Generate `fc.boolean()` as initial `completed`; toggle twice; assert back to original and other fields unchanged
    - **Validates: Requirements 6.1**

  - [ ]* 8.7 Write property test for delete removes exactly the targeted task (Property 13)
    - **Property 13: Delete removes exactly the targeted task**
    - Generate `fc.array(taskModel, {minLength:1})`; delete a random task; assert length −1, no task with that `id`, all others intact
    - **Validates: Requirements 6.4**

  - [x] 8.8 Implement `TodoModule` persistence (`persist`) and `init` with storage load
    - `persist()`: `StorageService.set(KEYS.TASKS, tasks)`
    - `init()`: load tasks from `StorageService.get(KEYS.TASKS, [])`; `render()`
    - Handle absent key (empty list) and corrupt data (fallback to `[]`) transparently via `StorageService`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.9 Write property test for task list round-trip persistence (Property 11)
    - **Property 11: Task list round-trip persistence**
    - Generate `fc.array(taskModel)`; serialise and deserialise via `StorageService`; assert deep equality of all fields, order, and length
    - **Validates: Requirements 7.1, 7.3**

- [x] 9. Checkpoint — Ensure all tests pass
  - Run the Jest test suite; ensure all property-based and unit tests pass before continuing. Ask the user if questions arise.

- [x] 10. Implement `QuickLinksModule`
  - [x] 10.1 Export `isValidUrl(str)` and implement `addLink` / `deleteLink`
    - `isValidUrl`: construct `new URL(str)` in `try/catch`; check `protocol` is `http:` or `https:` and `hostname` non-empty
    - `addLink(label, url)`: validate label non-empty (show `#link-label-error`); validate URL (show `#link-url-error`); push `{ id, label, url }`; `persist()`; `render()`
    - `deleteLink(id)`: splice from array; `persist()`; `render()`
    - Link button `onclick`: `window.open(url, '_blank')`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.2 Write property test for URL validation (Property 14)
    - **Property 14: URL validation correctly classifies all inputs**
    - Generate valid `http(s)://` strings and arbitrary non-URL strings; assert `isValidUrl` returns correct boolean for each
    - **Validates: Requirements 8.1, 8.3**

  - [x] 10.3 Implement `QuickLinksModule.init`, `persist`, and storage load
    - `init()`: `StorageService.get(KEYS.LINKS, [])`; `render()`
    - `persist()`: `StorageService.set(KEYS.LINKS, links)`
    - Handle absent key (empty panel) and corrupt data (fallback to `[]`) via `StorageService`
    - _Requirements: 8.6, 8.7_

  - [ ]* 10.4 Write property test for quick links round-trip persistence (Property 15)
    - **Property 15: Quick Links round-trip persistence**
    - Generate `fc.array(linkModel)`; serialise and deserialise; assert deep equality of all fields, order, and length
    - **Validates: Requirements 8.6**

- [x] 11. Implement `App` bootstrap and LocalStorage unavailability notice
  - [x] 11.1 Wire all modules in `DOMContentLoaded` and show session notice when storage unavailable
    - Init order: `ThemeModule` → `StorageService.init()` → `ClockModule` → `GreetingModule` → `TimerModule` → `TodoModule` → `QuickLinksModule`
    - After all inits: if `!StorageService.available`, insert `<aside role="status">` non-blocking banner with dismiss button
    - _Requirements: 7.4, 10.2_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run the full Jest test suite; verify all property-based and unit tests pass. Open `index.html` in a browser and smoke-test clock ticking, theme toggle without flash, task CRUD, quick-links, and timer. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical seams
- Property tests validate universal correctness properties across arbitrary inputs (minimum 100 iterations each via fast-check)
- Unit tests validate specific examples and edge cases
- The production build remains zero-dependency; Jest + fast-check are dev-only

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "5.5", "5.6", "5.7", "7.1"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 8, "tasks": ["8.6", "8.7", "8.8"] },
    { "id": 9, "tasks": ["8.9", "10.1"] },
    { "id": 10, "tasks": ["10.2", "10.3"] },
    { "id": 11, "tasks": ["10.4", "11.1"] }
  ]
}
```
