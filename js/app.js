/* =========================================================
   RevoU Dummy Clock App — app.js
   Zero-dependency SPA. All logic is in this single file.

   Module structure:
     StorageService      — localStorage wrapper
     ClockModule         — live time/date display
     GreetingModule      — time-of-day greeting + name persistence
     TimerModule         — 25-minute Pomodoro countdown
     TodoModule          — task CRUD, validation, persistence
     QuickLinksModule    — URL shortcut CRUD, persistence
     ThemeModule         — light/dark toggle, FODT prevention
     App                 — bootstrap / DOMContentLoaded wiring
   ========================================================= */

'use strict';

/* =========================================================
   LocalStorage key constants
   ========================================================= */
const KEYS = {
  USER_NAME: 'rda_userName',
  TASKS:     'rda_tasks',
  LINKS:     'rda_links',
  THEME:     'rda_theme',
};

/* =========================================================
   StorageService
   Thin wrapper around localStorage. All calls are wrapped
   in try/catch. On first error, available is set to false
   and subsequent calls become no-ops / return defaults.
   ========================================================= */
const StorageService = {
  available: true,

  /** Probe localStorage availability. Called once by App. */
  init() {
    try {
      const probe = '__rda_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      this.available = true;
    } catch (_e) {
      this.available = false;
    }
  },

  /**
   * Read and JSON-parse a value from localStorage.
   * Returns defaultValue on any error (missing key, parse failure, unavailable).
   * If localStorage.getItem itself throws, flips available to false.
   * @param {string} key
   * @param {*} defaultValue
   * @returns {*}
   */
  get(key, defaultValue = null) {
    if (!this.available) return defaultValue;
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (_e) {
      this.available = false;
      return defaultValue;
    }
    if (raw === null) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (_e) {
      // Corrupt data — return default but do NOT mark storage unavailable (Req 10.1)
      return defaultValue;
    }
  },

  /**
   * JSON-serialise a value and write it to localStorage.
   * Silently no-ops when unavailable or on quota error.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    if (!this.available) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_e) {
      this.available = false;
    }
  },

  /**
   * Remove a key from localStorage.
   * @param {string} key
   */
  remove(key) {
    if (!this.available) return;
    try {
      localStorage.removeItem(key);
    } catch (_e) {
      this.available = false;
    }
  },
};

/* =========================================================
   ClockModule
   Displays live HH:MM:SS time and full date.
   Pure helper functions are exported for testing.
   ========================================================= */
const ClockModule = {
  _intervalId: null,

  init() {
    this._tick();
    this._intervalId = setInterval(() => this._tick(), 1000);

    // Resync immediately when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this._tick();
    });
  },

  _tick() {
    const now = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if (timeEl) timeEl.textContent = formatTime(now);
    if (dateEl) dateEl.textContent = formatDate(now);
    // Notify GreetingModule so the phrase updates at hour boundaries
    if (typeof GreetingModule !== 'undefined') GreetingModule.render();
  },
};

/**
 * Format a Date as zero-padded HH:MM:SS (24-hour).
 * @param {Date} date
 * @returns {string}
 */
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Format a Date as "Weekday, DD Month YYYY" (e.g., "Saturday, 04 July 2026").
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     '2-digit',
    month:   'long',
    year:    'numeric',
  });
}

/* =========================================================
   GreetingModule
   Personalised time-of-day greeting with name persistence.
   Pure functions exported for testing.
   ========================================================= */
const GreetingModule = {
  _userName: null,

  init() {
    this._userName = StorageService.get(KEYS.USER_NAME, null);

    const form = document.getElementById('name-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('name-input');
        const trimmed = (input ? input.value : '').trim();
        if (trimmed.length >= 1 && trimmed.length <= 50) {
          this._userName = trimmed;
          StorageService.set(KEYS.USER_NAME, trimmed);
        } else {
          this._userName = null;
          StorageService.remove(KEYS.USER_NAME);
        }
        this.render();
      });
    }

    this.render();
  },

  render() {
    const el = document.getElementById('greeting-text');
    if (!el) return;
    const hour = new Date().getHours();
    el.textContent = buildGreeting(hour, this._userName);
  },
};

/**
 * Return the time-of-day phrase for a given hour (0–23).
 * @param {number} hour  Integer in [0, 23]
 * @returns {string}
 */
function getTimeOfDayPhrase(hour) {
  if (hour >= 5 && hour <= 11) return 'Good Morning';
  if (hour >= 12 && hour <= 17) return 'Good Afternoon';
  if (hour >= 18 && hour <= 20) return 'Good Evening';
  return 'Good Night'; // 21–23 and 0–4
}

/**
 * Build the full greeting string.
 * @param {number}      hour      Integer in [0, 23]
 * @param {string|null} userName  Trimmed name, or null/empty for no-name
 * @returns {string}
 */
function buildGreeting(hour, userName) {
  const phrase = getTimeOfDayPhrase(hour);
  if (userName && userName.trim().length > 0) {
    return `${phrase}, ${userName}!`;
  }
  return `${phrase}!`;
}

/* =========================================================
   TimerModule
   25-minute Pomodoro countdown with start / stop / reset.
   ========================================================= */
const TimerModule = {
  _state: {
    remaining:  1500, // 25 * 60 seconds
    running:    false,
    intervalId: null,
  },

  init() {
    const startBtn  = document.getElementById('timer-start');
    const stopBtn   = document.getElementById('timer-stop');
    const resetBtn  = document.getElementById('timer-reset');
    const alertClose = document.getElementById('timer-alert-close');

    if (startBtn)   startBtn.addEventListener('click', () => this.start());
    if (stopBtn)    stopBtn.addEventListener('click',  () => this.stop());
    if (resetBtn)   resetBtn.addEventListener('click', () => this.reset());
    if (alertClose) alertClose.addEventListener('click', () => {
      const alert = document.getElementById('timer-alert');
      if (alert) alert.hidden = true;
    });

    this.render();
  },

  start() {
    if (this._state.running) return; // guard double-start
    this._state.running = true;
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = true;
    this._state.intervalId = setInterval(() => this._tick(), 1000);
  },

  stop() {
    clearInterval(this._state.intervalId);
    this._state.intervalId = null;
    this._state.running = false;
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.disabled = false;
    this.render();
  },

  reset() {
    this.stop();
    this._state.remaining = 1500;
    this.render();
  },

  _tick() {
    this._state.remaining -= 1;
    if (this._state.remaining <= 0) {
      this._state.remaining = 0;
      this.stop();
      const alert = document.getElementById('timer-alert');
      if (alert) alert.hidden = false;
    }
    this.render();
  },

  render() {
    const el = document.getElementById('timer-display');
    if (!el) return;
    const mins = String(Math.floor(this._state.remaining / 60)).padStart(2, '0');
    const secs = String(this._state.remaining % 60).padStart(2, '0');
    el.textContent = `${mins}:${secs}`;
  },
};

/* =========================================================
   TodoModule
   Task CRUD with validation and localStorage persistence.
   Pure helpers exported for testing.
   ========================================================= */
const TodoModule = {
  _tasks: [],

  init() {
    this._tasks = StorageService.get(KEYS.TASKS, []);

    const form  = document.getElementById('todo-form');
    const input = document.getElementById('todo-input');
    const error = document.getElementById('todo-error');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = input ? input.value : '';
        this.addTask(name);
      });
    }

    if (input && error) {
      input.addEventListener('input', () => {
        error.hidden = true;
        error.textContent = '';
      });
    }

    this.render();
  },

  addTask(name) {
    const errorEl = document.getElementById('todo-error');
    const result  = validateTaskName(name, this._tasks, null);
    if (result.error) {
      if (errorEl) {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
      }
      return;
    }
    const task = {
      id:        (typeof crypto !== 'undefined' && crypto.randomUUID)
                   ? crypto.randomUUID()
                   : Date.now().toString(),
      name:      result.trimmed,
      completed: false,
      createdAt: Date.now(),
    };
    this._tasks.push(task);
    const input = document.getElementById('todo-input');
    if (input) input.value = '';
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    this.persist();
    this.render();
  },

  editTask(id, newName) {
    const taskIndex = this._tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;
    const task = this._tasks[taskIndex];

    // Same-name single-task no-op (Req 5.6)
    const trimmed = newName.trim();
    if (trimmed === task.name && this._tasks.length === 1) {
      return; // no-op — exit edit state without modifying storage
    }

    const result = validateTaskName(newName, this._tasks, id);
    if (result.error) {
      return result; // caller handles inline error display
    }
    this._tasks[taskIndex] = { ...task, name: result.trimmed };
    this.persist();
    this.render();
    return result;
  },

  toggleTask(id) {
    const task = this._tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    this.persist();
    this.render();
  },

  deleteTask(id) {
    const idx = this._tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    this._tasks.splice(idx, 1);
    this.persist();
    this.render();
  },

  persist() {
    StorageService.set(KEYS.TASKS, this._tasks);
  },

  render() {
    const list = document.getElementById('todo-list');
    if (!list) return;
    list.innerHTML = '';
    this._tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (task.completed ? ' completed' : '');
      li.dataset.id = task.id;
      li.innerHTML = `
        <span class="todo-name">${_escHtml(task.name)}</span>
        <div class="todo-item-actions">
          <button type="button" class="todo-complete-btn"
                  aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${_escHtml(task.name)}">
            ${task.completed ? 'Undo' : 'Done'}
          </button>
          <button type="button" class="todo-edit-btn"
                  aria-label="Edit task: ${_escHtml(task.name)}">Edit</button>
          <button type="button" class="todo-delete-btn"
                  aria-label="Delete task: ${_escHtml(task.name)}">Delete</button>
        </div>`;

      li.querySelector('.todo-complete-btn').addEventListener('click', () => {
        this.toggleTask(task.id);
      });
      li.querySelector('.todo-delete-btn').addEventListener('click', () => {
        this.deleteTask(task.id);
      });
      li.querySelector('.todo-edit-btn').addEventListener('click', () => {
        this._startEdit(li, task);
      });

      list.appendChild(li);
    });
  },

  _startEdit(li, task) {
    const nameSpan   = li.querySelector('.todo-name');
    const actionsDiv = li.querySelector('.todo-item-actions');

    // Replace name span with input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'todo-edit-input';
    editInput.value = task.name;
    editInput.maxLength = 100;
    editInput.setAttribute('aria-label', 'Edit task name');

    const editError = document.createElement('span');
    editError.className = 'todo-edit-error';
    editError.setAttribute('role', 'alert');
    editError.hidden = true;

    editInput.addEventListener('input', () => {
      editError.hidden = true;
      editError.textContent = '';
    });

    nameSpan.replaceWith(editInput);
    actionsDiv.innerHTML = `
      <button type="button" class="todo-save-btn"  aria-label="Save edit">Save</button>
      <button type="button" class="todo-cancel-btn" aria-label="Cancel edit">Cancel</button>`;
    li.insertBefore(editError, actionsDiv);
    editInput.focus();

    actionsDiv.querySelector('.todo-save-btn').addEventListener('click', () => {
      const result = this.editTask(task.id, editInput.value);
      if (result && result.error) {
        editError.textContent = result.error;
        editError.hidden = false;
      }
      // render() is called inside editTask on success
    });

    actionsDiv.querySelector('.todo-cancel-btn').addEventListener('click', () => {
      this.render(); // discard changes
    });
  },
};

/**
 * Validate a task name.
 * @param {string}      name          Raw input from user
 * @param {Object[]}    existingTasks Current task array
 * @param {string|null} excludeId     Task id to exclude from uniqueness check (edit path)
 * @returns {{ trimmed: string, error: string|null }}
 */
function validateTaskName(name, existingTasks, excludeId) {
  const trimmed = (name || '').trim();
  if (trimmed.length === 0) {
    return { trimmed, error: 'Task name cannot be empty.' };
  }
  if (trimmed.length > 100) {
    return { trimmed, error: 'Task name must be 100 characters or fewer.' };
  }
  const lower = trimmed.toLowerCase();
  const duplicate = existingTasks.some(
    t => t.id !== excludeId && t.name.toLowerCase() === lower
  );
  if (duplicate) {
    return { trimmed, error: 'A task with that name already exists.' };
  }
  return { trimmed, error: null };
}

/* =========================================================
   QuickLinksModule
   URL shortcut CRUD with localStorage persistence.
   Pure helper exported for testing.
   ========================================================= */
const QuickLinksModule = {
  _links: [],

  init() {
    this._links = StorageService.get(KEYS.LINKS, []);

    const form       = document.getElementById('links-form');
    const labelInput = document.getElementById('link-label-input');
    const urlInput   = document.getElementById('link-url-input');
    const labelError = document.getElementById('link-label-error');
    const urlError   = document.getElementById('link-url-error');

    if (labelInput && labelError) {
      labelInput.addEventListener('input', () => {
        labelError.hidden = true; labelError.textContent = '';
      });
    }
    if (urlInput && urlError) {
      urlInput.addEventListener('input', () => {
        urlError.hidden = true; urlError.textContent = '';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const label = labelInput ? labelInput.value : '';
        const url   = urlInput   ? urlInput.value   : '';
        this.addLink(label, url);
      });
    }

    this.render();
  },

  addLink(label, url) {
    const labelError = document.getElementById('link-label-error');
    const urlError   = document.getElementById('link-url-error');
    let valid = true;

    if (!label || label.trim().length === 0) {
      if (labelError) {
        labelError.textContent = 'Label cannot be empty.';
        labelError.hidden = false;
      }
      valid = false;
    }
    if (!isValidUrl(url)) {
      if (urlError) {
        urlError.textContent = 'Please enter a valid http:// or https:// URL.';
        urlError.hidden = false;
      }
      valid = false;
    }
    if (!valid) return;

    const link = {
      id:    (typeof crypto !== 'undefined' && crypto.randomUUID)
               ? crypto.randomUUID()
               : Date.now().toString(),
      label: label.trim(),
      url:   url.trim(),
    };
    this._links.push(link);

    const labelInput = document.getElementById('link-label-input');
    const urlInput   = document.getElementById('link-url-input');
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';

    this.persist();
    this.render();
  },

  deleteLink(id) {
    const idx = this._links.findIndex(l => l.id === id);
    if (idx === -1) return;
    this._links.splice(idx, 1);
    this.persist();
    this.render();
  },

  persist() {
    StorageService.set(KEYS.LINKS, this._links);
  },

  render() {
    const panel = document.getElementById('links-panel');
    if (!panel) return;
    panel.innerHTML = '';
    this._links.forEach(link => {
      const item = document.createElement('div');
      item.className = 'link-item';
      item.innerHTML = `
        <button type="button" class="link-btn"
                aria-label="Open ${_escHtml(link.label)}">${_escHtml(link.label)}</button>
        <button type="button" class="link-delete-btn"
                aria-label="Delete link: ${_escHtml(link.label)}">✕</button>`;
      item.querySelector('.link-btn').addEventListener('click', () => {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      });
      item.querySelector('.link-delete-btn').addEventListener('click', () => {
        this.deleteLink(link.id);
      });
      panel.appendChild(item);
    });
  },
};

/**
 * Validate that str is an http:// or https:// URL with a non-empty hostname.
 * @param {string} str
 * @returns {boolean}
 */
function isValidUrl(str) {
  if (!str) return false;
  try {
    const url = new URL(str);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
           url.hostname.length > 0;
  } catch (_e) {
    return false;
  }
}

/* =========================================================
   ThemeModule
   Light/dark toggle. Applied before other modules to
   prevent flash-of-default-theme (FODT).
   ========================================================= */
const ThemeModule = {
  _theme: 'light',

  init() {
    // Load saved theme (inline script in <head> already applied the class,
    // but we sync internal state here for toggle logic).
    const saved = StorageService.get(KEYS.THEME, 'light');
    this._theme = (saved === 'dark') ? 'dark' : 'light';
    this._applyTheme();

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => this.toggle());
    }
  },

  toggle() {
    this._theme = (this._theme === 'light') ? 'dark' : 'light';
    StorageService.set(KEYS.THEME, this._theme);
    this._applyTheme();
  },

  _applyTheme() {
    if (this._theme === 'dark') {
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.classList.remove('theme-dark');
    }
    this.render();
  },

  render() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = this._theme === 'dark';
    btn.setAttribute('aria-pressed', String(isDark));
    btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  },
};

/* =========================================================
   Utility helpers
   ========================================================= */

/**
 * Escape HTML special characters to prevent XSS in innerHTML.
 * @param {string} str
 * @returns {string}
 */
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =========================================================
   App — Bootstrap
   Init order: ThemeModule first (FODT prevention), then
   StorageService probe, then all feature modules.
   ========================================================= */
const App = {
  init() {
    ThemeModule.init();
    StorageService.init();
    ClockModule.init();
    GreetingModule.init();
    TimerModule.init();
    TodoModule.init();
    QuickLinksModule.init();

    if (!StorageService.available) {
      this._showStorageNotice();
    }
  },

  _showStorageNotice() {
    const aside = document.createElement('aside');
    aside.setAttribute('role', 'status');
    aside.className = 'storage-notice';
    aside.innerHTML = `
      <span>⚠️ Local storage is unavailable. Your data will not be saved between sessions.</span>
      <button type="button" aria-label="Dismiss storage notice">Dismiss</button>`;
    aside.querySelector('button').addEventListener('click', () => aside.remove());

    const header = document.querySelector('.app-header');
    if (header) {
      header.insertAdjacentElement('afterend', aside);
    } else {
      document.body.prepend(aside);
    }
  },
};

/* =========================================================
   Node.js / test environment exports
   When running under Jest (no `window`), export pure
   functions and services so tests can import them.
   ========================================================= */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
  };
}

/* =========================================================
   Entry point
   ========================================================= */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => App.init());
}
