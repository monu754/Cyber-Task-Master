# TaskManagerApp

TaskManagerApp is an offline-first task manager built with Expo, React Native, and SQLite. It is designed for mobile-first personal productivity, with local data storage, reminders, recurring tasks, multiple task views, time tracking, and dashboard insights.

## Overview

- Offline-first local task management
- SQLite-backed persistence
- Dashboard, task library, and task planner flows
- Reminders with Expo Notifications
- Recurring tasks, subtasks, dependencies, and tags
- Time tracking and weekly productivity insights
- In-app update checks with Expo Updates

## Features

### Task management

- Create, edit, complete, and delete tasks
- Set title, notes, due date, reminder, priority, and estimated time
- Track task status with `Todo`, `In Progress`, and `Done`
- Support recurring rules with `none`, `daily`, and `weekly`
- Break tasks into subtasks
- Link task dependencies

### Organization

- Categories
- Workspaces
- Projects
- Tags
- Saved filter presets

### Views

- Dashboard view
- Task list view
- Board view grouped by status
- Calendar-style grouped view by due date
- Timeline view for scheduled work

### Productivity

- Local notifications for reminders
- Active task timer
- Completion stats
- Weekly performance summary
- Burn-down trend data
- Dashboard customization toggles
- Theme switching

## Tech Stack

- React Native
- Expo
- Expo SQLite
- Expo Notifications
- Expo Updates
- Expo Blur
- Expo Linear Gradient
- React 19
- AsyncStorage

## Project Structure

```text
TaskManagerApp/
|-- App.js
|-- app.json
|-- database.js
|-- package.json
|-- screens/
|   |-- AddTaskScreen.js
|   |-- HomeScreen.js
|   |-- MainWorkspaceScreen.js
|   `-- TasksScreen.js
|-- utils/
|   |-- analytics.js
|   |-- preferences.js
|   `-- taskNotifications.js
|-- scripts/
|   |-- reset-project.js
|   `-- run-android.js
|-- navigation/
|   `-- StackNavigator.js
|-- components/
|-- hooks/
|-- constants/
`-- assets/
```

## Key Files

### `App.js`

- Initializes the database
- Loads the saved theme
- Mounts the main workspace shell

### `database.js`

Main local data layer for:

- tasks
- categories
- workspaces
- projects
- tags
- subtasks
- task dependencies
- preferences
- time entries

It also contains task CRUD, timer helpers, recurrence handling, and dashboard insight queries.

### `screens/MainWorkspaceScreen.js`

- Hosts the main app shell
- Manages dashboard, tasks, and planner tabs
- Handles app update checking and update actions

### `screens/HomeScreen.js`

- Dashboard UI
- Shows progress summaries and the next due task
- Contains dashboard customization controls
- Displays update availability state

### `screens/TasksScreen.js`

- Task library
- Search and filters
- Multiple task views
- Edit, timer, status, and delete actions

### `screens/AddTaskScreen.js`

- Task creation and editing form
- Supports reminders, recurrence, subtasks, dependencies, tags, notes, and project/workspace selection

## How Data Works

The app is fully local-first.

- Task data is stored in SQLite
- Theme preferences and saved filters are stored locally
- Notifications are scheduled on-device
- There is no backend API in this repository

## Updates

The app is configured to use Expo Updates.

- Automatic checking is handled inside the app when it opens
- A banner appears when an update is available
- Users can also manually check for updates from the dashboard

## Available Scripts

```bash
npm start
npm run android
npm run android:raw
npm run ios
npm run web
npm run lint
npm run reset-project
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start the Expo dev server

```bash
npm start
```

### 3. Run on Android

```bash
npm run android
```

### 4. Run lint

```bash
npm run lint
```

## Notes

- `npm run android` uses the custom launcher in `scripts/run-android.js`
- `npm run android:raw` runs plain `expo run:android`
- In-app updates are best tested in preview or production builds, not local dev mode
