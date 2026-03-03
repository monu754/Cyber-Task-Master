import * as SQLite from 'expo-sqlite';

// Opens or creates the local database file synchronously
const db = SQLite.openDatabaseSync('cyber_task_master.db');

export const initDatabase = () => {
  // Enforce foreign key constraints (links subtasks to tasks, tasks to categories)
  db.execSync('PRAGMA foreign_keys = ON;');

  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'Medium',
      category_id INTEGER,
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      title TEXT,
      completed INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    );
  `);
  
  // Seed the default categories so the user has them immediately
  db.runSync('INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)', ['Work', '#6366F1']);
  db.runSync('INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)', ['Personal', '#10B981']);
  db.runSync('INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)', ['College', '#F59E0B']);
};

// --- Helper Functions for Phase 1 ---

export const getTasks = () => {
  // Fetches all tasks, showing incomplete ones first, then sorting by newest
  return db.getAllSync('SELECT * FROM tasks ORDER BY completed ASC, id DESC');
};

export const insertTask = (title, description, priority = 'Medium', categoryId = 1) => {
  return db.runSync(
    'INSERT INTO tasks (title, description, priority, category_id) VALUES (?, ?, ?, ?)',
    [title, description, priority, categoryId]
  );
};