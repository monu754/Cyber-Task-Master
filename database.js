import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("cyber_task_master.db");

const DEFAULT_WORKSPACE_NAME = "Personal HQ";
const DEFAULT_PROJECT_NAME = "General";
const DEFAULT_THEME = "midnight";

const ensureColumn = (tableName, columnName, definition) => {
  const columns = db.getAllSync(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.runSync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
};

const ensureTaskColumns = () => {
  ensureColumn("tasks", "status", "TEXT DEFAULT 'Todo'");
  ensureColumn("tasks", "workspace_id", "INTEGER");
  ensureColumn("tasks", "project_id", "INTEGER");
  ensureColumn("tasks", "due_date", "TEXT");
  ensureColumn("tasks", "completed", "INTEGER DEFAULT 0");
  ensureColumn("tasks", "reminder_minutes", "INTEGER DEFAULT 1440");
  ensureColumn("tasks", "recurrence", "TEXT DEFAULT 'none'");
  ensureColumn("tasks", "item_type", "TEXT DEFAULT 'task'");
  ensureColumn("tasks", "estimated_minutes", "INTEGER DEFAULT 0");
  ensureColumn("tasks", "created_at", "TEXT");
  ensureColumn("tasks", "updated_at", "TEXT");
  ensureColumn("tasks", "habit_group_id", "INTEGER");
};

const normalizeTaskStatus = () => {
  db.runSync(
    "UPDATE tasks SET status = CASE WHEN completed = 1 THEN 'Done' WHEN status IS NULL OR TRIM(status) = '' THEN 'Todo' ELSE status END",
  );
  db.runSync(
    "UPDATE tasks SET workspace_id = COALESCE(workspace_id, 1), project_id = COALESCE(project_id, 1)",
  );
  db.runSync(
    "UPDATE tasks SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP), updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)",
  );
  db.runSync(
    "UPDATE tasks SET item_type = CASE WHEN recurrence IS NOT NULL AND recurrence != 'none' THEN 'habit' ELSE COALESCE(item_type, 'task') END WHERE item_type IS NULL OR TRIM(item_type) = ''",
  );
  db.runSync(
    "UPDATE tasks SET habit_group_id = id WHERE item_type = 'habit' AND (habit_group_id IS NULL OR habit_group_id = 0)",
  );
};

const ensureSeedData = () => {
  db.runSync(
    "INSERT OR IGNORE INTO workspaces (id, name, color) VALUES (1, ?, ?)",
    [DEFAULT_WORKSPACE_NAME, "#38BDF8"],
  );
  db.runSync(
    "INSERT OR IGNORE INTO projects (id, workspace_id, name, color) VALUES (1, 1, ?, ?)",
    [DEFAULT_PROJECT_NAME, "#2563EB"],
  );

  const defaultTags = [
    ["deep-work", "#A78BFA"],
    ["meeting", "#34D399"],
    ["urgent", "#FB7185"],
    ["design", "#F59E0B"],
  ];

  defaultTags.forEach(([name, color]) => {
    db.runSync("INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)", [name, color]);
  });

  db.runSync(
    "INSERT OR IGNORE INTO preferences (key, value) VALUES (?, ?)",
    ["theme", DEFAULT_THEME],
  );
};

const createIndexes = () => {
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks (status, due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks (workspace_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_item_type ON tasks (item_type, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_habit_group_id ON tasks (habit_group_id, status);
    CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries (task_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags (task_id);
    CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies (task_id);
  `);
};

const toDayKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const diffInDays = (leftDate, rightDate) => {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((rightDate.getTime() - leftDate.getTime()) / millisecondsPerDay);
};

const isHabitStreakBroken = (habit) => {
  if (!habit?.due_date) {
    return false;
  }

  const dueDate = new Date(habit.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return dueDate.getTime() < Date.now();
};

const isOverdueDate = (value) => {
  if (!value) {
    return false;
  }

  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  return dueDate.getTime() < Date.now();
};

const computeHabitStats = (habit, completionRows) => {
  const intervalDays = habit?.recurrence === "weekly" ? 7 : 1;
  const completionDates = [...new Set(
    completionRows
      .map((row) => row.due_date || row.updated_at)
      .map((value) => toDayKey(value))
      .filter(Boolean),
  )]
    .map((dayKey) => new Date(`${dayKey}T00:00:00`))
    .sort((leftDate, rightDate) => leftDate - rightDate);

  let longestStreak = 0;
  let runningStreak = 0;

  completionDates.forEach((date, index) => {
    if (index === 0) {
      runningStreak = 1;
    } else {
      const previousDate = completionDates[index - 1];
      runningStreak = diffInDays(previousDate, date) === intervalDays ? runningStreak + 1 : 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
  });

  let currentStreak = completionDates.length ? runningStreak : 0;
  if (currentStreak > 0 && isHabitStreakBroken(habit)) {
    currentStreak = 0;
  }

  const lastCompletedAt =
    completionRows[completionRows.length - 1]?.updated_at ||
    completionRows[completionRows.length - 1]?.due_date ||
    null;

  return {
    total_completions: completionRows.length,
    total_completion_days: completionDates.length,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_completed_at: lastCompletedAt,
  };
};

const attachHabitStats = (habits) => {
  if (habits.length === 0) {
    return [];
  }

  const groupIds = [...new Set(habits.map((habit) => habit.habit_group_id || habit.id))];
  const placeholders = groupIds.map(() => "?").join(", ");
  const completionRows = db.getAllSync(
    `
      SELECT id, habit_group_id, due_date, updated_at
      FROM tasks
      WHERE item_type = 'habit'
        AND status = 'Done'
        AND habit_group_id IN (${placeholders})
      ORDER BY COALESCE(due_date, updated_at) ASC, updated_at ASC, id ASC
    `,
    groupIds,
  );
  const completionRowsByGroup = createLookupMap(completionRows, "habit_group_id");

  return habits.map((habit) => ({
    ...habit,
    ...computeHabitStats(habit, completionRowsByGroup[habit.habit_group_id || habit.id] || []),
  }));
};

const sanitizeList = (items) =>
  (items || [])
    .map((item) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed ? { name: trimmed } : null;
      }

      if (!item) {
        return null;
      }

      const trimmedName = (item.name || item.title || "").trim();
      return trimmedName ? { ...item, name: trimmedName } : null;
    })
    .filter(Boolean);

const nextOccurrenceForRule = (dueDate, recurrence) => {
  if (!dueDate || !recurrence || recurrence === "none") {
    return null;
  }

  const nextDate = new Date(dueDate);

  if (Number.isNaN(nextDate.getTime())) {
    return null;
  }

  if (recurrence === "daily") {
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString();
  }

  if (recurrence === "weekly") {
    nextDate.setDate(nextDate.getDate() + 7);
    return nextDate.toISOString();
  }

  return null;
};

const createLookupMap = (rows, keyName) =>
  rows.reduce((accumulator, row) => {
    const key = row[keyName];
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(row);
    return accumulator;
  }, {});

const attachTaskRelations = (tasks) => {
  if (tasks.length === 0) {
    return [];
  }

  const taskIds = tasks.map((task) => task.id);
  const placeholders = taskIds.map(() => "?").join(", ");
  const tagRows = db.getAllSync(
    `
      SELECT task_tags.task_id, tags.id, tags.name, tags.color
      FROM task_tags
      JOIN tags ON tags.id = task_tags.tag_id
      WHERE task_tags.task_id IN (${placeholders})
      ORDER BY tags.name ASC
    `,
    taskIds,
  );
  const dependencyRows = db.getAllSync(
    `
      SELECT task_dependencies.task_id, task_dependencies.depends_on_task_id,
             tasks.title AS depends_on_title, tasks.status AS depends_on_status
      FROM task_dependencies
      JOIN tasks ON tasks.id = task_dependencies.depends_on_task_id
      WHERE task_dependencies.task_id IN (${placeholders})
      ORDER BY tasks.title ASC
    `,
    taskIds,
  );
  const subtaskRows = db.getAllSync(
    `
      SELECT id, task_id, parent_subtask_id, title, completed, sort_order
      FROM subtasks
      WHERE task_id IN (${placeholders})
      ORDER BY sort_order ASC, id ASC
    `,
    taskIds,
  );
  const tagsByTask = createLookupMap(tagRows, "task_id");
  const dependenciesByTask = createLookupMap(dependencyRows, "task_id");
  const subtasksByTask = createLookupMap(subtaskRows, "task_id");

  return tasks.map((task) => ({
    ...task,
    completed: task.completed ? 1 : 0,
    tags: tagsByTask[task.id] || [],
    dependencies: dependenciesByTask[task.id] || [],
    subtasks: subtasksByTask[task.id] || [],
    hasBlockingDependency: (dependenciesByTask[task.id] || []).some(
      (dependency) => dependency.depends_on_status !== "Done",
    ),
    subtask_count: (subtasksByTask[task.id] || []).length,
  }));
};

const saveTaskTags = (taskId, tags) => {
  db.runSync("DELETE FROM task_tags WHERE task_id = ?", [taskId]);

  sanitizeList(tags).forEach((tag) => {
    const existingTag =
      db.getFirstSync("SELECT id FROM tags WHERE LOWER(name) = LOWER(?)", [tag.name]) ||
      db.runSync("INSERT INTO tags (name, color) VALUES (?, ?)", [
        tag.name,
        tag.color || "#7DD3FC",
      ]);

    const tagId = existingTag.id || existingTag.lastInsertRowId;
    db.runSync("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", [taskId, tagId]);
  });
};

const saveTaskDependencies = (taskId, dependencies) => {
  db.runSync("DELETE FROM task_dependencies WHERE task_id = ?", [taskId]);

  [...new Set((dependencies || []).filter((dependencyId) => dependencyId && dependencyId !== taskId))]
    .forEach((dependencyId) => {
      db.runSync(
        "INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)",
        [taskId, dependencyId],
      );
    });
};

const saveSubtasks = (taskId, subtasks) => {
  db.runSync("DELETE FROM subtasks WHERE task_id = ?", [taskId]);

  sanitizeList(subtasks).forEach((subtask, index) => {
    db.runSync(
      "INSERT INTO subtasks (task_id, parent_subtask_id, title, completed, sort_order) VALUES (?, ?, ?, ?, ?)",
      [taskId, subtask.parent_subtask_id || null, subtask.name, subtask.completed ? 1 : 0, index + 1],
    );
  });
};

const saveTaskRelations = (taskId, payload) => {
  saveTaskTags(taskId, payload.tags);
  saveTaskDependencies(taskId, payload.dependencyIds);
  saveSubtasks(taskId, payload.subtasks);
};

export const initDatabase = () => {
  db.execSync("PRAGMA foreign_keys = ON;");

  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#38BDF8'
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#2563EB',
      UNIQUE(workspace_id, name),
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#7DD3FC'
    );

    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'Medium',
      category_id INTEGER,
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Todo',
      workspace_id INTEGER DEFAULT 1,
      project_id INTEGER DEFAULT 1,
      reminder_minutes INTEGER DEFAULT 1440,
      recurrence TEXT DEFAULT 'none',
      item_type TEXT DEFAULT 'task',
      estimated_minutes INTEGER DEFAULT 0,
      habit_group_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces (id),
      FOREIGN KEY (project_id) REFERENCES projects (id)
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      parent_subtask_id INTEGER,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (parent_subtask_id) REFERENCES subtasks (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, tag_id),
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      task_id INTEGER NOT NULL,
      depends_on_task_id INTEGER NOT NULL,
      PRIMARY KEY (task_id, depends_on_task_id),
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_task_id) REFERENCES tasks (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    );
  `);

  db.execSync("DROP TABLE IF EXISTS task_attachments;");

  ensureTaskColumns();
  normalizeTaskStatus();
  createIndexes();

  db.runSync("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)", ["Work", "#6366F1"]);
  db.runSync("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)", ["Personal", "#10B981"]);
  db.runSync("INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)", ["College", "#F59E0B"]);

  ensureSeedData();
};

export const getCategories = () => db.getAllSync("SELECT * FROM categories ORDER BY name");

export const ensureCategory = ({ color = "#7DD3FC", name }) => {
  const trimmedName = name.trim();
  const existing = db.getFirstSync("SELECT * FROM categories WHERE LOWER(name) = LOWER(?)", [
    trimmedName,
  ]);

  if (existing) {
    return existing;
  }

  const result = db.runSync("INSERT INTO categories (name, color) VALUES (?, ?)", [
    trimmedName,
    color,
  ]);
  return db.getFirstSync("SELECT * FROM categories WHERE id = ?", [result.lastInsertRowId]);
};

export const getWorkspaces = () => db.getAllSync("SELECT * FROM workspaces ORDER BY name ASC");

export const getProjects = (workspaceId = null) =>
  db.getAllSync(
    `
      SELECT projects.*, workspaces.name AS workspace_name
      FROM projects
      JOIN workspaces ON workspaces.id = projects.workspace_id
      ${workspaceId ? "WHERE workspace_id = ?" : ""}
      ORDER BY projects.name ASC
    `,
    workspaceId ? [workspaceId] : [],
  );

export const getTags = () => db.getAllSync("SELECT * FROM tags ORDER BY name ASC");

export const getPreference = (key, fallback = null) => {
  const row = db.getFirstSync("SELECT value FROM preferences WHERE key = ?", [key]);
  return row ? row.value : fallback;
};

export const setPreference = (key, value) => {
  db.runSync(
    "INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
};

export const ensureWorkspace = ({ color = "#38BDF8", name }) => {
  const trimmedName = name.trim();
  const existing = db.getFirstSync("SELECT * FROM workspaces WHERE LOWER(name) = LOWER(?)", [
    trimmedName,
  ]);

  if (existing) {
    return existing;
  }

  const result = db.runSync("INSERT INTO workspaces (name, color) VALUES (?, ?)", [
    trimmedName,
    color,
  ]);
  return db.getFirstSync("SELECT * FROM workspaces WHERE id = ?", [result.lastInsertRowId]);
};

export const ensureProject = ({ color = "#2563EB", name, workspaceId = 1 }) => {
  const trimmedName = name.trim();
  const existing = db.getFirstSync(
    "SELECT * FROM projects WHERE workspace_id = ? AND LOWER(name) = LOWER(?)",
    [workspaceId, trimmedName],
  );

  if (existing) {
    return existing;
  }

  const result = db.runSync(
    "INSERT INTO projects (workspace_id, name, color) VALUES (?, ?, ?)",
    [workspaceId, trimmedName, color],
  );
  return db.getFirstSync("SELECT * FROM projects WHERE id = ?", [result.lastInsertRowId]);
};

const baseTasksQuery = `
  SELECT tasks.*,
         categories.name AS category_name,
         categories.color AS category_color,
         workspaces.name AS workspace_name,
         workspaces.color AS workspace_color,
         projects.name AS project_name,
         projects.color AS project_color
  FROM tasks
  LEFT JOIN categories ON categories.id = tasks.category_id
  LEFT JOIN workspaces ON workspaces.id = tasks.workspace_id
  LEFT JOIN projects ON projects.id = tasks.project_id
  GROUP BY tasks.id
  ORDER BY
    CASE tasks.status
      WHEN 'In Progress' THEN 0
      WHEN 'Todo' THEN 1
      WHEN 'Done' THEN 2
      ELSE 3
    END ASC,
    CASE WHEN tasks.due_date IS NOT NULL THEN 0 ELSE 1 END ASC,
    tasks.due_date ASC,
    tasks.id DESC
`;

const getItemsWithDetails = (itemType = null) =>
  attachTaskRelations(
    db.getAllSync(
      itemType
        ? baseTasksQuery.replace("GROUP BY tasks.id", "WHERE tasks.item_type = ? GROUP BY tasks.id")
        : baseTasksQuery,
      itemType ? [itemType] : [],
    ),
  );

export const getTasksWithDetails = () => getItemsWithDetails("task");

const getLatestHabitResult = (habitGroupId, excludedTaskId = null) => {
  const params = excludedTaskId ? [habitGroupId, excludedTaskId] : [habitGroupId];
  const exclusionClause = excludedTaskId ? "AND id != ?" : "";

  return db.getFirstSync(
    `
      SELECT id, status, due_date, updated_at
      FROM tasks
      WHERE item_type = 'habit'
        AND habit_group_id = ?
        AND status IN ('Done', 'Missed')
        ${exclusionClause}
      ORDER BY COALESCE(due_date, updated_at) DESC, updated_at DESC, id DESC
      LIMIT 1
    `,
    params,
  );
};

const attachHabitState = (habits) =>
  habits.map((habit) => {
    const currentGroupId = habit.habit_group_id || habit.id;
    const latestResult =
      habit.status === "Done" || habit.status === "Missed"
        ? getLatestHabitResult(currentGroupId)
        : getLatestHabitResult(currentGroupId, habit.id);
    const latestResultAt = latestResult?.due_date || latestResult?.updated_at || null;
    const shouldResetStreak =
      latestResult?.status === "Missed" &&
      (!habit.last_completed_at || new Date(latestResultAt) >= new Date(habit.last_completed_at));

    return {
      ...habit,
      current_streak: shouldResetStreak ? 0 : habit.current_streak || 0,
      last_result_status: latestResult?.status || null,
      last_result_at: latestResultAt,
      can_revert_latest_result: Boolean(latestResult),
    };
  });

export const getHabitsWithDetails = () =>
  attachHabitState(
    attachHabitStats(
      attachTaskRelations(
        db.getAllSync(
          `
            SELECT tasks.*,
                   categories.name AS category_name,
                   categories.color AS category_color,
                   workspaces.name AS workspace_name,
                   workspaces.color AS workspace_color,
                   projects.name AS project_name,
                   projects.color AS project_color
            FROM tasks
            LEFT JOIN categories ON categories.id = tasks.category_id
            LEFT JOIN workspaces ON workspaces.id = tasks.workspace_id
            LEFT JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.item_type = 'habit'
              AND tasks.id IN (
                SELECT COALESCE(
                  MAX(CASE WHEN status NOT IN ('Done', 'Missed') THEN id END),
                  MAX(id)
                )
                FROM tasks
                WHERE item_type = 'habit'
                GROUP BY habit_group_id
              )
            ORDER BY
              CASE WHEN tasks.due_date IS NOT NULL THEN 0 ELSE 1 END ASC,
              tasks.due_date ASC,
              tasks.updated_at DESC,
              tasks.id DESC
          `,
        ),
      ),
    ),
  );

export const getAllItemsWithDetails = () => getItemsWithDetails();

export const getTasks = () => getTasksWithDetails();

export const getTaskById = (taskId) => {
  const task = db.getFirstSync(
    `
      SELECT tasks.*,
             categories.name AS category_name,
             categories.color AS category_color,
             workspaces.name AS workspace_name,
             workspaces.color AS workspace_color,
             projects.name AS project_name,
             projects.color AS project_color
      FROM tasks
      LEFT JOIN categories ON categories.id = tasks.category_id
      LEFT JOIN workspaces ON workspaces.id = tasks.workspace_id
      LEFT JOIN projects ON projects.id = tasks.project_id
      WHERE tasks.id = ?
      GROUP BY tasks.id
    `,
    [taskId],
  );

  return task ? attachTaskRelations([task])[0] : null;
};

export const getHabitById = (taskId) => {
  const item = getTaskById(taskId);
  return item?.item_type === "habit" ? item : null;
};

export const insertTask = (title, description, priority = "Medium", categoryId = 1) =>
  createTask({ title, description, priority, categoryId });

export const createTask = ({
  title,
  description = "",
  itemType = "task",
  priority = "Medium",
  status = "Todo",
  categoryId = 1,
  workspaceId = 1,
  projectId = 1,
  dueDate = null,
  reminderMinutes = 1440,
  recurrence = "none",
  estimatedMinutes = 0,
  habitGroupId = null,
  tags = [],
  dependencyIds = [],
  subtasks = [],
}) => {
  const now = new Date().toISOString();
  const completed = status === "Done" ? 1 : 0;
  const result = db.runSync(
    `
      INSERT INTO tasks (
        title, description, priority, status, category_id, workspace_id, project_id, due_date,
        completed, reminder_minutes, recurrence, item_type, estimated_minutes, habit_group_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      title.trim(),
      description.trim(),
      priority,
      status,
      categoryId,
      workspaceId,
      projectId,
      dueDate,
      completed,
      reminderMinutes,
      recurrence,
      itemType,
      Number(estimatedMinutes) || 0,
      habitGroupId,
      now,
      now,
    ],
  );

  if (itemType === "habit" && !habitGroupId) {
    db.runSync("UPDATE tasks SET habit_group_id = ? WHERE id = ?", [
      result.lastInsertRowId,
      result.lastInsertRowId,
    ]);
  }

  saveTaskRelations(result.lastInsertRowId, { tags, dependencyIds, subtasks });
  return getTaskById(result.lastInsertRowId);
};

export const createHabit = ({
  title,
  description = "",
  categoryId = 1,
  workspaceId = 1,
  projectId = 1,
  dueDate = null,
  reminderMinutes = 60,
  recurrence = "daily",
  tags = [],
}) =>
  createTask({
    title,
    description,
    itemType: "habit",
    priority: "Medium",
    status: "Todo",
    categoryId,
    workspaceId,
    projectId,
    dueDate,
    reminderMinutes,
    recurrence,
    estimatedMinutes: 0,
    tags,
    dependencyIds: [],
    subtasks: [],
  });

export const updateTask = ({
  id,
  title,
  description = "",
  itemType = "task",
  priority = "Medium",
  status = "Todo",
  categoryId = 1,
  workspaceId = 1,
  projectId = 1,
  dueDate = null,
  reminderMinutes = 1440,
  recurrence = "none",
  estimatedMinutes = 0,
  habitGroupId = null,
  tags = [],
  dependencyIds = [],
  subtasks = [],
}) => {
  const existingTask = getTaskById(id);
  const completed = status === "Done" ? 1 : 0;
  db.runSync(
    `
      UPDATE tasks
      SET title = ?, description = ?, priority = ?, status = ?, category_id = ?, workspace_id = ?, project_id = ?,
          due_date = ?, completed = ?, reminder_minutes = ?, recurrence = ?, item_type = ?, estimated_minutes = ?,
          habit_group_id = ?, updated_at = ?
      WHERE id = ?
    `,
    [
      title.trim(),
      description.trim(),
      priority,
      status,
      categoryId,
      workspaceId,
      projectId,
      dueDate,
      completed,
      reminderMinutes,
      recurrence,
      itemType,
      Number(estimatedMinutes) || 0,
      itemType === "habit"
        ? habitGroupId || existingTask?.habit_group_id || existingTask?.id || id
        : null,
      new Date().toISOString(),
      id,
    ],
  );

  saveTaskRelations(id, { tags, dependencyIds, subtasks });
  return getTaskById(id);
};

export const updateHabit = ({
  id,
  title,
  description = "",
  categoryId = 1,
  workspaceId = 1,
  projectId = 1,
  dueDate = null,
  reminderMinutes = 60,
  recurrence = "daily",
  tags = [],
  status = "Todo",
  habitGroupId = null,
}) =>
  updateTask({
    id,
    title,
    description,
    itemType: "habit",
    priority: "Medium",
    status,
    categoryId,
    workspaceId,
    projectId,
    dueDate,
    reminderMinutes,
    recurrence,
    estimatedMinutes: 0,
    habitGroupId,
    tags,
    dependencyIds: [],
    subtasks: [],
  });

export const setTaskStatus = (taskId, status) => {
  db.runSync(
    "UPDATE tasks SET status = ?, completed = ?, updated_at = ? WHERE id = ?",
    [status, status === "Done" ? 1 : 0, new Date().toISOString(), taskId],
  );
  return getTaskById(taskId);
};

export const setTaskCompleted = (taskId, completed) =>
  setTaskStatus(taskId, completed ? "Done" : "Todo");

export const toggleSubtaskCompleted = (subtaskId, completed) => {
  db.runSync("UPDATE subtasks SET completed = ? WHERE id = ?", [completed ? 1 : 0, subtaskId]);
};

export const removeTask = (taskId) => {
  db.runSync("DELETE FROM tasks WHERE id = ?", [taskId]);
};

export const removeHabit = (habitId) => {
  const habit = getTaskById(habitId);
  if (!habit) {
    return;
  }

  const groupId = habit.habit_group_id || habit.id;
  db.runSync("DELETE FROM tasks WHERE item_type = 'habit' AND habit_group_id = ?", [groupId]);
};

export const setTaskReminderMinutes = (taskId, minutes) => {
  db.runSync("UPDATE tasks SET reminder_minutes = ?, updated_at = ? WHERE id = ?", [
    minutes,
    new Date().toISOString(),
    taskId,
  ]);
};

export const completeTaskAndGenerateNext = (taskId) => {
  const task = getTaskById(taskId);
  if (!task) {
    return { nextTask: null, task: null };
  }

  const completedTask = setTaskStatus(taskId, "Done");
  const nextDueDate = nextOccurrenceForRule(task.due_date, task.recurrence);

  if (!nextDueDate) {
    return { nextTask: null, task: completedTask };
  }

  const nextTask = createTask({
    title: task.title,
    description: task.description,
    itemType: task.item_type || "task",
    priority: task.priority,
    status: "Todo",
    categoryId: task.category_id || 1,
    workspaceId: task.workspace_id || 1,
    projectId: task.project_id || 1,
    dueDate: nextDueDate,
    reminderMinutes: task.reminder_minutes,
    recurrence: task.recurrence,
    estimatedMinutes: task.estimated_minutes || 0,
    habitGroupId: task.habit_group_id || task.id,
    tags: task.tags,
    dependencyIds: [],
    subtasks: task.subtasks.map((subtask) => ({ name: subtask.title })),
  });

  return { nextTask, task: completedTask };
};

export const resolveHabitAndGenerateNext = (habitId, status) => {
  const habit = getHabitById(habitId);
  if (!habit) {
    return { nextTask: null, task: null };
  }

  const resolvedHabit = setTaskStatus(habitId, status);
  const nextDueDate = nextOccurrenceForRule(habit.due_date, habit.recurrence);

  if (!nextDueDate) {
    return { nextTask: null, task: resolvedHabit };
  }

  const nextHabit = createTask({
    title: habit.title,
    description: habit.description,
    itemType: "habit",
    priority: habit.priority,
    status: "Todo",
    categoryId: habit.category_id || 1,
    workspaceId: habit.workspace_id || 1,
    projectId: habit.project_id || 1,
    dueDate: nextDueDate,
    reminderMinutes: habit.reminder_minutes,
    recurrence: habit.recurrence,
    estimatedMinutes: habit.estimated_minutes || 0,
    habitGroupId: habit.habit_group_id || habit.id,
    tags: habit.tags,
    dependencyIds: [],
    subtasks: [],
  });

  return { nextTask: nextHabit, task: resolvedHabit };
};

export const missHabitAndGenerateNext = (habitId) =>
  resolveHabitAndGenerateNext(habitId, "Missed");

export const revertHabitOutcome = (habitId) => {
  const currentHabit = getHabitById(habitId);
  if (!currentHabit) {
    return null;
  }

  if (currentHabit.status === "Done" || currentHabit.status === "Missed") {
    return setTaskStatus(currentHabit.id, "Todo");
  }

  const groupId = currentHabit.habit_group_id || currentHabit.id;
  const previousResult = db.getFirstSync(
    `
      SELECT id
      FROM tasks
      WHERE item_type = 'habit'
        AND habit_group_id = ?
        AND id != ?
        AND status IN ('Done', 'Missed')
      ORDER BY COALESCE(due_date, updated_at) DESC, updated_at DESC, id DESC
      LIMIT 1
    `,
    [groupId, currentHabit.id],
  );

  if (!previousResult) {
    return null;
  }

  removeTask(currentHabit.id);
  return setTaskStatus(previousResult.id, "Todo");
};

export const getTaskInsights = () => {
  const tasks = getTasksWithDetails();
  const totals = tasks.reduce(
    (summary, task) => ({
      total_tasks: summary.total_tasks + 1,
      done_tasks: summary.done_tasks + (task.status === "Done" ? 1 : 0),
      in_progress_tasks: summary.in_progress_tasks + (task.status === "In Progress" ? 1 : 0),
      scheduled_tasks: summary.scheduled_tasks + (task.due_date ? 1 : 0),
      overdue_tasks:
        summary.overdue_tasks + (task.status !== "Done" && isOverdueDate(task.due_date) ? 1 : 0),
      estimated_minutes: summary.estimated_minutes + (Number(task.estimated_minutes) || 0),
    }),
    {
      total_tasks: 0,
      done_tasks: 0,
      in_progress_tasks: 0,
      scheduled_tasks: 0,
      overdue_tasks: 0,
      estimated_minutes: 0,
    },
  );

  const weeklyCompletion = db.getAllSync(
    `
      SELECT substr(updated_at, 1, 10) AS day, COUNT(*) AS completed
      FROM tasks
      WHERE status = 'Done'
        AND item_type = 'task'
        AND updated_at >= datetime('now', '-6 days')
      GROUP BY substr(updated_at, 1, 10)
      ORDER BY day ASC
    `,
  );

  const tracked = db.getFirstSync(
    `
      SELECT COALESCE(SUM(duration_minutes), 0) AS tracked_minutes
      FROM time_entries
      WHERE start_time >= datetime('now', '-6 days')
    `,
  );

  return {
    ...totals,
    tracked_minutes: tracked?.tracked_minutes || 0,
    weekly_completion: weeklyCompletion,
  };
};

export const getBurndownSnapshot = () =>
  db.getAllSync(
    `
      SELECT substr(created_at, 1, 10) AS day,
             COUNT(*) AS created_count,
             SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) AS done_count
      FROM tasks
      WHERE item_type = 'task'
        AND created_at >= datetime('now', '-6 days')
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day ASC
    `,
  );

export const getHabitInsights = () => {
  const weeklyCompletion = db.getAllSync(
    `
      SELECT substr(updated_at, 1, 10) AS day, COUNT(*) AS completed
      FROM tasks
      WHERE item_type = 'habit'
        AND status = 'Done'
        AND updated_at >= datetime('now', '-6 days')
      GROUP BY substr(updated_at, 1, 10)
      ORDER BY day ASC
    `,
  );

  const habits = getHabitsWithDetails();
  const todayKey = toDayKey(new Date());
  const completedToday = habits.filter((habit) => toDayKey(habit.last_completed_at) === todayKey).length;
  const pendingHabits = habits.filter((habit) => habit.status !== "Done").length;
  const longestStreak = habits.reduce(
    (best, habit) => Math.max(best, habit.longest_streak || 0),
    0,
  );
  const activeStreaks = habits.filter((habit) => (habit.current_streak || 0) > 0).length;
  const totalCompletions = habits.reduce(
    (total, habit) => total + (habit.total_completions || 0),
    0,
  );

  return {
    total_habits: habits.length,
    completed_habits: completedToday,
    pending_habits: pendingHabits,
    daily_habits: habits.filter((habit) => habit.recurrence === "daily").length,
    weekly_habits: habits.filter((habit) => habit.recurrence === "weekly").length,
    active_streak_habits: activeStreaks,
    total_completions: totalCompletions,
    longest_streak: longestStreak,
    weekly_completion: weeklyCompletion,
  };
};
