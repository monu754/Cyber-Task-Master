import * as SQLite from 'expo-sqlite';

// Opens or creates the local database file synchronously
export const db = SQLite.openDatabaseSync('cyber_task_master.db');

const ensureTaskColumns = () => {
  const columns = db.getAllSync('PRAGMA table_info(tasks)');
  const hasReminderMinutes = columns.some((column) => column.name === 'reminder_minutes');

  if (!hasReminderMinutes) {
    db.runSync('ALTER TABLE tasks ADD COLUMN reminder_minutes INTEGER DEFAULT 1440');
  }
};

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

  ensureTaskColumns();
  
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

export const getCategories = () => {
  return db.getAllSync('SELECT * FROM categories ORDER BY name');
};

export const getTasksWithCategories = () => {
  return db.getAllSync(`
    SELECT tasks.*, categories.name AS category_name, categories.color AS category_color
    FROM tasks
    LEFT JOIN categories ON tasks.category_id = categories.id
    ORDER BY tasks.completed ASC,
           CASE WHEN tasks.due_date IS NOT NULL THEN 1 ELSE 0 END DESC,
           tasks.due_date ASC,
           tasks.id DESC
  `);
};

export const createTask = ({
  title,
  description,
  priority = 'Medium',
  categoryId = 1,
  dueDate = null,
}) => {
  return db.runSync(
    'INSERT INTO tasks (title, description, priority, category_id, due_date, completed) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description, priority, categoryId, dueDate, 0]
  );
};

export const updateTask = ({
  id,
  title,
  description,
  priority = 'Medium',
  categoryId = 1,
  dueDate = null,
}) => {
  return db.runSync(
    'UPDATE tasks SET title = ?, description = ?, priority = ?, category_id = ?, due_date = ? WHERE id = ?',
    [title, description, priority, categoryId, dueDate, id]
  );
};

export const setTaskCompleted = (taskId, completed) => {
  db.runSync('UPDATE tasks SET completed = ? WHERE id = ?', [completed, taskId]);
};

export const removeTask = (taskId) => {
  db.runSync('DELETE FROM tasks WHERE id = ?', [taskId]);
};

export const setTaskReminderMinutes = (taskId, minutes) => {
  db.runSync('UPDATE tasks SET reminder_minutes = ? WHERE id = ?', [minutes, taskId]);
};
