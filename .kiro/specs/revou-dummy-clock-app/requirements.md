# Requirements Document

## Introduction

The **revou-dummy-clock-app** is a browser-based productivity application built with plain HTML, CSS, and vanilla JavaScript. It requires no backend server and stores all persistent data in the browser's Local Storage. The app presents a greeting with the current time and date, a 25-minute focus timer, a to-do list, and a quick-links panel. Additional features include light/dark mode, a customisable user name in the greeting, and duplicate-task prevention. The application must work as a standalone web page or browser extension across modern browsers (Chrome, Firefox, Edge, Safari).

---

## Glossary

- **App**: The revou-dummy-clock-app single-page web application.
- **Clock**: The display component that shows the current time and date.
- **Greeting**: The personalised welcome message shown to the user based on the time of day and their saved name.
- **Focus_Timer**: The countdown timer component set to 25 minutes.
- **Todo_List**: The task management component that allows adding, editing, completing, and deleting tasks.
- **Task**: A single to-do item managed by the Todo_List.
- **Quick_Links**: The panel of user-defined shortcut buttons that open URLs in a new browser tab.
- **Link**: A single quick-link entry consisting of a label and a URL.
- **Local_Storage**: The browser's Web Storage API used to persist all user data client-side.
- **Theme**: The visual colour scheme of the App — either light or dark.
- **User_Name**: The custom display name entered by the user for personalised greeting.

---

## Folder Structure

```
revou-dummy-clock-app/
├── index.html
├── css/
│   └── style.css        (only one CSS file)
├── js/
│   └── app.js           (only one JavaScript file)
└── README.md
```

---

## Requirements

---

### Requirement 1: Display Current Time and Date

**User Story:** As a user, I want to see the current time and date on the app's main screen, so that I can stay aware of the time without switching applications.

#### Acceptance Criteria

1. WHEN the app page is loaded, THE Clock SHALL display the current local device time in HH:MM:SS format (zero-padded, 24-hour) and update the display every second with a tolerance of ±1 second.
2. THE Clock SHALL display the current date showing the full day name, zero-padded calendar date, full month name, and 4-digit year (e.g., "Saturday, 04 July 2026").
3. WHEN the app page is loaded, THE Clock SHALL source the time from the local device clock and show the initial time within 1 second of page load completion.
4. WHEN the browser tab regains visibility after being hidden, THE Clock SHALL immediately resync the displayed time with the current local device time.

---

### Requirement 2: Personalised Greeting

**User Story:** As a user, I want to see a greeting that addresses me by name and reflects the time of day, so that the app feels personal and contextually relevant.

#### Acceptance Criteria

1. WHEN the current time is between 05:00 and 11:59, THE Greeting SHALL display a "Good Morning" message.
2. WHEN the current time is between 12:00 and 17:59, THE Greeting SHALL display a "Good Afternoon" message.
3. WHEN the current time is between 18:00 and 20:59, THE Greeting SHALL display a "Good Evening" message.
4. WHEN the current time is between 21:00 and 04:59, THE Greeting SHALL display a "Good Night" message.
5. WHEN a User_Name has been saved, THE Greeting SHALL display the message in the format "[Time_Greeting], [User_Name]!" (e.g., "Good Morning, Alex!").
6. WHEN no User_Name has been saved, THE Greeting SHALL display a default greeting without a personalised name (e.g., "Good Morning!").
7. WHEN the user submits a non-empty User_Name of 1 to 50 characters (after trimming leading and trailing whitespace) via the name input field, THE App SHALL save the trimmed User_Name to Local_Storage and update the Greeting immediately.
8. WHEN the user submits an empty or whitespace-only value via the name input field, THE App SHALL remove the saved User_Name from Local_Storage and revert the Greeting to the default (no name) format.

---

### Requirement 3: Focus Timer

**User Story:** As a user, I want a 25-minute countdown timer with start, stop, and reset controls, so that I can use the Pomodoro technique to manage my focus sessions.

#### Acceptance Criteria

1. WHEN the Focus_Timer component is loaded, THE Focus_Timer SHALL display an initial duration of 25 minutes as "25:00" in MM:SS format.
2. WHEN the user activates the Start control, THE Focus_Timer SHALL begin counting down one second at a time.
3. WHILE the Focus_Timer is counting down, THE Focus_Timer SHALL update the displayed time every second.
4. WHEN the user activates the Stop control, THE Focus_Timer SHALL pause the countdown and retain the remaining time.
5. WHEN the user activates the Reset control, THE Focus_Timer SHALL stop any active countdown and reset the displayed time to 25:00.
6. WHEN the countdown reaches 00:00, THE Focus_Timer SHALL stop automatically, display a dismissible on-screen alert that persists until the user dismisses it, and re-enable the Start control.
7. WHILE the Focus_Timer is counting down, THE Focus_Timer SHALL disable the Start control to prevent duplicate timer instances.
8. WHEN the user activates the Stop control, THE Focus_Timer SHALL re-enable the Start control.
9. WHEN the user activates the Reset control, THE Focus_Timer SHALL re-enable the Start control.

---

### Requirement 4: To-Do List — Add Tasks

**User Story:** As a user, I want to add tasks to a list, so that I can track the work I need to complete.

#### Acceptance Criteria

1. WHEN the user submits a non-empty task name of 1 to 100 characters (excluding leading and trailing whitespace) via the task input field, THE Todo_List SHALL add a new Task to the list, clear the task input field, and save the updated list to Local_Storage.
2. IF the user submits a task name that already exists in the list (case-insensitive comparison), THEN THE Todo_List SHALL reject the duplicate entry and display an inline error message indicating the task already exists, and THE Todo_List SHALL dismiss the inline error message when the user modifies the content of the task input field.
3. IF the user submits an empty or whitespace-only task name, THEN THE Todo_List SHALL reject the submission and display an inline validation error, and THE Todo_List SHALL dismiss the inline validation error when the user modifies the content of the task input field.
4. IF the user submits a task name exceeding 100 characters, THEN THE Todo_List SHALL reject the submission and display an inline validation error indicating the maximum length has been exceeded.

---

### Requirement 5: To-Do List — Edit Tasks

**User Story:** As a user, I want to edit the name of an existing task, so that I can correct or update my task descriptions.

#### Acceptance Criteria

1. WHEN the user activates the Edit control for a Task, THE Todo_List SHALL present an in-place editable input field pre-filled with the current task name and focused for immediate input.
2. WHEN the user confirms the edit with a trimmed task name of 1 to 100 characters that does not match any other Task (case-insensitive), THE Todo_List SHALL update the Task name, save the updated list to Local_Storage, and exit the edit state.
3. IF the user confirms an edit with a task name that matches an existing different Task (case-insensitive), THEN THE Todo_List SHALL reject the change and display an inline error message indicating a duplicate task name.
4. WHEN the user modifies the content of the edit input field, THE Todo_List SHALL dismiss any inline error message currently displayed for that field.
5. WHEN the user cancels the edit, THE Todo_List SHALL restore the original task name and exit the edit state without modifying Local_Storage.
6. WHEN only one Task exists in the Todo_List and the user confirms the edit with the same name (after trimming), THE Todo_List SHALL treat the submission as a no-op and exit the edit state without modifying Local_Storage.

---

### Requirement 6: To-Do List — Complete and Delete Tasks

**User Story:** As a user, I want to mark tasks as done and delete tasks I no longer need, so that I can maintain an accurate and clean task list.

#### Acceptance Criteria

1. WHEN the user activates the Complete control for a Task, THE Todo_List SHALL toggle the Task's completion state and save the updated list to Local_Storage.
2. WHILE a Task is in the completed state, THE Todo_List SHALL render the task with strikethrough text and reduced emphasis styling.
3. WHILE a Task is NOT in the completed state, THE Todo_List SHALL render the task without strikethrough and at full emphasis styling.
4. WHEN the user activates the Delete control for a Task, THE Todo_List SHALL remove the Task from the list and save the updated list to Local_Storage.

---

### Requirement 7: To-Do List — Persistence

**User Story:** As a user, I want my tasks to be saved between sessions, so that I do not lose my task list when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN the app page is loaded and Local_Storage contains a saved Task list, THE Todo_List SHALL retrieve the saved Tasks and render them.
2. WHEN the app page is loaded and Local_Storage contains no saved Task list, THE Todo_List SHALL render an empty list without displaying an error.
3. WHEN a Task is added, edited, completed, or deleted, THE App SHALL save the complete current Task list to Local_Storage, overwriting the previously stored value.
4. WHEN the app attempts to save tasks and Local_Storage is unavailable, THE App SHALL retain tasks in-memory and display a non-blocking notice that data will not be persisted, consistent with Requirement 10.

---

### Requirement 8: Quick Links

**User Story:** As a user, I want to save and access my favourite website shortcuts from the app, so that I can open them quickly without typing the URL each time.

#### Acceptance Criteria

1. WHEN the user submits a non-empty label and a valid URL (beginning with http:// or https:// and containing a hostname) via the link input form, THE Quick_Links SHALL add a new Link, save the updated link collection to Local_Storage, and render a new shortcut button.
2. IF the user submits an empty label, THEN THE Quick_Links SHALL reject the submission and display an inline validation error on the label field.
3. IF the user submits an empty or invalid URL (not beginning with http:// or https://, or missing a hostname), THEN THE Quick_Links SHALL reject the submission and display an inline validation error on the URL field.
4. WHEN the user activates a Link button, THE App SHALL open the associated URL in a new browser tab.
5. WHEN the user activates the Delete control for a Link, THE Quick_Links SHALL remove the Link from the collection and save the updated collection to Local_Storage.
6. WHEN the app page is loaded and Local_Storage contains saved Links, THE Quick_Links SHALL retrieve and render the corresponding shortcut buttons.
7. WHEN the app page is loaded and Local_Storage contains no saved Links, THE Quick_Links SHALL render an empty panel without displaying an error.

---

### Requirement 9: Light / Dark Mode

**User Story:** As a user, I want to toggle between a light and dark colour scheme, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL provide a toggle control that switches the Theme between light and dark and visually indicates the currently active Theme.
2. WHEN the user activates the Theme toggle, THE App SHALL apply the selected Theme to all visible components immediately without a page reload.
3. WHEN the user activates the Theme toggle, THE App SHALL save the selected Theme to Local_Storage.
4. WHEN the app page is loaded, THE App SHALL retrieve the saved Theme from Local_Storage and apply it by setting a Theme class on the root element before rendering content, to avoid a flash of the default theme.
5. WHEN no Theme has been saved, THE App SHALL apply the light Theme as the default.
6. WHEN the user activates the Theme toggle from any section of the app, THE App SHALL update the toggle's visual indicator to reflect the newly active Theme.

---

### Requirement 10: Local Storage Integrity

**User Story:** As a user, I want the app to handle missing or corrupted stored data gracefully, so that a storage error does not prevent me from using the app.

#### Acceptance Criteria

1. WHEN the app reads from Local_Storage and the stored value is absent or cannot be parsed, THE App SHALL fall back to a safe default value for the affected data (empty Task list, empty Link collection, light Theme, no User_Name).
2. IF Local_Storage is unavailable (e.g., private browsing mode or quota exceeded), THEN THE App SHALL continue operating in-memory with full functionality, and display a non-blocking notice that persists for the session duration and does not prevent interaction with any part of the app.
