const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "short" });

const toDayKey = (date) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const minutesToLabel = (minutes) => {
  if (!minutes) {
    return "0m";
  }

  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (!hours) {
    return `${remainingMinutes}m`;
  }

  if (!remainingMinutes) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

export const buildSevenDaySeries = (rows, fieldName) => {
  const lookup = new Map(rows.map((row) => [row.day, Number(row[fieldName]) || 0]));
  const today = new Date();
  const result = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    const day = toDayKey(current);

    result.push({
      day,
      label: DAY_LABEL_FORMATTER.format(current),
      value: lookup.get(day) || 0,
    });
  }

  return result;
};

export const buildBurndownSeries = (tasks) => {
  const today = new Date();
  let remaining = tasks.filter((task) => task.status !== "Done").length;
  const result = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - offset);
    const dayKey = toDayKey(current);
    const completedThatDay = tasks.filter(
      (task) => task.status === "Done" && task.updated_at?.slice(0, 10) === dayKey,
    ).length;

    remaining = Math.max(0, remaining - completedThatDay);
    result.push({
      day: dayKey,
      label: DAY_LABEL_FORMATTER.format(current),
      value: remaining,
    });
  }

  return result;
};

export const buildHabitConsistencySeries = (rows) => buildSevenDaySeries(rows, "completed");

export const buildHabitSummary = ({ habits, insights }) => {
  const completionRate =
    insights.total_habits > 0
      ? Math.round((insights.active_streak_habits / insights.total_habits) * 100)
      : 0;
  const nextHabits = habits
    .filter((habit) => habit.status !== "Done")
    .sort((leftHabit, rightHabit) => {
      if (!leftHabit.due_date) {
        return 1;
      }
      if (!rightHabit.due_date) {
        return -1;
      }
      return new Date(leftHabit.due_date) - new Date(rightHabit.due_date);
    })
    .slice(0, 3);

  return {
    completionRate,
    nextHabits,
    pendingHabits: insights.pending_habits || 0,
  };
};

export const buildWeeklyReport = ({ insights, tasks }) => {
  const completionRate =
    insights.total_tasks > 0 ? Math.round((insights.done_tasks / insights.total_tasks) * 100) : 0;
  const overdueRate =
    insights.total_tasks > 0 ? Math.round((insights.overdue_tasks / insights.total_tasks) * 100) : 0;
  const focusTasks = tasks
    .filter((task) => task.status === "In Progress" || task.hasBlockingDependency)
    .slice(0, 3);

  return {
    completionRate,
    overdueRate,
    focusTasks,
  };
};
