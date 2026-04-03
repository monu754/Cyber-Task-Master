# TaskManagerApp

TaskManagerApp is an offline-first task management app built with Expo, React Native, and SQLite. It is designed as a mobile-first productivity app with local persistence, multiple task views, reminders, recurring tasks, time tracking, and dashboard insights.

## What the app currently does

### Core task management

- Create, edit, update status, and delete tasks
- Title, notes/description, due date, reminder, and estimated time
- Priority support: `Low`, `Medium`, `High`
- Status support: `Todo`, `In Progress`, `Done`
- Recurring task rules: `none`, `daily`, `weekly`
- Attachment metadata entries stored locally as `name | path-or-url | type`

### Organization

- Categories
- Workspaces
- Projects
- Tags
- Subtasks
- Task dependencies

### Views

- List view
- Board view grouped by status
- Calendar-style grouped view by due date
- Timeline view sorted by upcoming schedule

### Productivity features

- Reminder scheduling through Expo Notifications
- Time tracking with active timer state
- Completion stats
- Weekly performance summary
- Burn-down style trend data
- Saved filters
- Dashboard customization toggles
- Theme switching

## Current architecture

The app is fully local-first.

- App shell and screen state are handled in React Native
- Data is stored in a local SQLite database
- Some UI preferences and saved filters are stored with AsyncStorage
- Notifications are scheduled locally on-device
- There is no backend API in this repository
- Redis is not part of the current architecture

## Project structure

```text
TaskManagerApp/
├── App.js
├── app.json
├── database.js
├── package.json
├── screens/
│   ├── AddTaskScreen.js
│   ├── HomeScreen.js
│   ├── MainWorkspaceScreen.js
│   └── TasksScreen.js
├── utils/
│   ├── analytics.js
│   ├── preferences.js
│   └── taskNotifications.js
├── scripts/
│   ├── reset-project.js
│   └── run-android.js
├── navigation/
│   └── StackNavigator.js
├── components/
├── hooks/
├── constants/
└── assets/
```

## Important files

### `App.js`

- Initializes the local database
- Loads the current theme preference
- Mounts the main workspace shell

### `database.js`

This is the main local data layer.

It defines and manages:

- `categories`
- `workspaces`
- `projects`
- `tags`
- `preferences`
- `tasks`
- `subtasks`
- `task_tags`
- `task_dependencies`
- `task_attachments`
- `time_entries`

It also exposes helpers for:

- task CRUD
- recurrence handling
- timer start/stop
- dashboard insights
- theme preference storage
- category / workspace / project creation

### `screens/MainWorkspaceScreen.js`

- Hosts the three main app areas:
  - Dashboard
  - Tasks
  - Planner
- Contains the custom bottom navigation
- Handles in-app update checking

### `screens/HomeScreen.js`

- Dashboard screen
- Shows next due task
- Shows completion metrics, weekly summaries, burndown trend, and time tracking summaries
- Supports theme switching and dashboard customization

### `screens/TasksScreen.js`

- Main task library
- Search
- Saved filters
- View tabs for list / board / calendar / timeline
- Filter popup
- Task actions for edit, status changes, timer start/stop, and delete

### `screens/AddTaskScreen.js`

- Create and edit task form
- Designed for clearer, beginner-friendly input
- Supports categories, workspaces, projects, priorities, reminders, recurring tasks, tags, subtasks, dependencies, attachments, and notes

### `utils/taskNotifications.js`

- Requests notification permissions
- Normalizes reminder values
- Schedules, cancels, and syncs task reminders

### `utils/preferences.js`

- Theme definitions
- Dashboard widget preferences
- Saved filter persistence

### `utils/analytics.js`

- Formats tracked time
- Builds chart-ready data for weekly stats and burndown trends

### `scripts/run-android.js`

Custom Android runner that:

- starts an emulator if needed
- waits for boot completion
- prepares the device for APK installation
- runs Expo Android builds with a smoother fallback flow

## Tech stack

- React Native
- Expo
- Expo SQLite
- Expo Notifications
- Expo Blur
- Expo Linear Gradient
- React 19
- React Native Safe Area Context
- AsyncStorage

## Available scripts

```bash
npm start
npm run android
npm run android:raw
npm run ios
npm run web
npm run lint
```

### Notes

- `npm run android` uses the custom launcher in `scripts/run-android.js`
- `npm run android:raw` runs plain `expo run:android`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start Expo

```bash
npm start
```

### 3. Run on Android

```bash
npm run android
```
