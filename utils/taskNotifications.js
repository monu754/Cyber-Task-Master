import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const NOTIFICATION_CHANNEL_ID = "task-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const REMINDER_OPTIONS = [
  { label: "At time of task", value: 0 },
  { label: "5 minutes before", value: 5 },
  { label: "15 minutes before", value: 15 },
  { label: "30 minutes before", value: 30 },
  { label: "1 hour before", value: 60 },
  { label: "2 hours before", value: 120 },
  { label: "6 hours before", value: 360 },
  { label: "12 hours before", value: 720 },
  { label: "1 day before", value: 1440 },
  { label: "2 days before", value: 2880 },
  { label: "1 week before", value: 10080 },
];

export const normalizeReminderMinutes = (minutes) =>
  minutes === null || minutes === undefined ? 1440 : minutes;

const ensureNotificationChannel = async () => {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "Task reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#6366F1",
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

export const requestNotificationPermissions = async () => {
  try {
    await ensureNotificationChannel();
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
  } catch (error) {
    console.error("Permission error:", error);
  }
};

export const cancelTaskNotifications = async (taskId) => {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    for (const notification of scheduledNotifications) {
      if (notification.content.data?.taskId === taskId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error("Error canceling notifications:", error);
  }
};

const getReminderTime = (task) => {
  const dueDate = new Date(task.due_date);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  const reminderMinutes = normalizeReminderMinutes(task.reminder_minutes);
  const reminderTime =
    reminderMinutes > 0
      ? new Date(dueDate.getTime() - reminderMinutes * 60 * 1000)
      : dueDate;

  return {
    dueDate,
    reminderMinutes,
    reminderTime,
  };
};

export const scheduleSingleNotification = async (task) => {
  if (!task?.due_date || task.completed === 1) {
    return;
  }

  try {
    const now = new Date();
    const scheduleData = getReminderTime(task);

    if (!scheduleData) {
      return;
    }

    const { dueDate, reminderMinutes, reminderTime } = scheduleData;

    if (dueDate <= now) {
      return;
    }

    if (reminderTime <= now) {
      return;
    }

    await ensureNotificationChannel();

    let title = "Task Due";
    let body = `"${task.title}" is due now!`;

    if (reminderMinutes > 0) {
      if (reminderMinutes < 60) {
        title = `Due in ${reminderMinutes} minutes`;
      } else if (reminderMinutes < 1440) {
        title = `Due in ${reminderMinutes / 60} hours`;
      } else {
        title = `Due in ${reminderMinutes / 1440} days`;
      }

      body = `"${task.title}" is due soon!`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          taskId: task.id,
          reminderMinutes,
          taskTitle: task.title,
        },
        sound: true,
      },
      trigger: {
        type: "date",
        date: reminderTime,
        channelId: Platform.OS === "android" ? NOTIFICATION_CHANNEL_ID : undefined,
      },
    });
  } catch (error) {
    console.error("Notification scheduling error:", error);
  }
};

export const syncTaskNotifications = async (tasks) => {
  try {
    const pendingTasks = tasks.filter((task) => task.due_date && task.completed === 0);

    for (const task of pendingTasks) {
      await cancelTaskNotifications(task.id);
      await scheduleSingleNotification(task);
    }
  } catch (error) {
    console.error("Error syncing notifications:", error);
  }
};

export const getReminderLabel = (minutes) => {
  const normalizedMinutes = normalizeReminderMinutes(minutes);
  const option = REMINDER_OPTIONS.find((item) => item.value === normalizedMinutes);
  return option ? option.label : "Custom";
};
