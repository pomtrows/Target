import { getCurrentWeekId, getWeekDates, getWeeksInMonth } from './weekUtils';
import { getObjectivesForWeek } from './progressUtils';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Helper to extract days and times from objective
const getObjectiveSchedule = (objective) => {
  const assignments = objective?.assignments || [];
  const daysStr = assignments.find(a => typeof a === 'string' && a.startsWith('days:'));
  const timeStr = assignments.find(a => typeof a === 'string' && a.startsWith('time:'));
  
  let days = [];
  if (daysStr) {
    days = daysStr.replace('days:', '').split(',').map(Number).filter(d => !isNaN(d));
  }
  
  let startTime = '';
  let endTime = '';
  if (timeStr) {
    const parts = timeStr.replace('time:', '').split('-');
    startTime = parts[0] || '';
    endTime = parts[1] || '';
  }
  
  return { days, startTime, endTime };
};

// Deterministic hash to generate a unique integer ID from objective ID and day
const getNotificationId = (objectiveId, day) => {
  let hash = 0;
  const str = `${objectiveId}-${day}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

// Check if notification API is supported
export const isNotificationSupported = () => {
  return Capacitor.isNativePlatform() || 'Notification' in window;
};

// Get current permission status
export const getNotificationStatus = () => {
  if (Capacitor.isNativePlatform()) {
    return localStorage.getItem('capacitor_notification_permission') || 'default';
  }
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

// Request notification permission
export const requestNotificationPermission = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await LocalNotifications.requestPermissions();
      const status = res.display === 'granted' ? 'granted' : 'denied';
      localStorage.setItem('capacitor_notification_permission', status);
      return status;
    } catch (e) {
      console.error('Error requesting Capacitor permissions:', e);
      return 'denied';
    }
  }

  if (!isNotificationSupported()) return 'unsupported';
  
  // Mobile browsers might require user gesture (already handled in UI onClick)
  const permission = await Notification.requestPermission();
  return permission;
};

// Core function to trigger a system notification
export const triggerNotification = async (title, options = {}) => {
  if (localStorage.getItem('notifications_enabled') === 'false') {
    return false;
  }

  if (Capacitor.isNativePlatform()) {
    const perm = getNotificationStatus();
    if (perm !== 'granted') return false;
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 1000000),
            title: title,
            body: options.body || '',
            schedule: { at: new Date(Date.now() + 500) },
            vibrate: true,
            sound: true
          }
        ]
      });
      return true;
    } catch (e) {
      console.error('Error triggering native notification:', e);
      return false;
    }
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const defaultOptions = {
    icon: '/pwa-icon.png',
    badge: '/pwa-icon.png',
    vibrate: [200, 100, 200],
    ...options
  };

  // Try to use Service Worker registration first (better mobile support)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration) {
        await registration.showNotification(title, defaultOptions);
        return true;
      }
    } catch (e) {
      console.warn('Service Worker notification failed, falling back to window.Notification', e);
    }
  }

  // Fallback to standard window Notification
  try {
    new Notification(title, defaultOptions);
    return true;
  } catch (e) {
    console.error('Failed to trigger notification', e);
    return false;
  }
};

// Send a test notification
export const sendTestNotification = async () => {
  if (localStorage.getItem('notifications_enabled') === 'false') {
    // Temporarily bypass check for manual test
    localStorage.setItem('notifications_enabled', 'true');
    const res = await triggerNotification('Target - Test réussi ! 🎯', {
      body: 'Les notifications sont correctement configurées sur cet appareil.',
    });
    return res;
  }
  return triggerNotification('Target - Test réussi ! 🎯', {
    body: 'Les notifications sont correctement configurées sur cet appareil.',
  });
};

// Check objectives schedule and send notification if starting in 15 mins
export const checkAndTriggerNotifications = async (objectives) => {
  if (localStorage.getItem('notifications_enabled') === 'false') {
    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications && pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }
      } catch (e) {
        console.error('Failed to cancel notifications on disabled:', e);
      }
    }
    return;
  }

  if (Capacitor.isNativePlatform()) {
    const perm = getNotificationStatus();
    if (perm !== 'granted') return;

    try {
      // 1. Cancel all pending notifications first to avoid duplicates/outdated ones
      const pending = await LocalNotifications.getPending();
      if (pending.notifications && pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }

      // 2. Schedule new notifications for this week
      const currentWeekId = getCurrentWeekId();
      const weekObjectives = getObjectivesForWeek(objectives, currentWeekId, getWeeksInMonth);
      const now = new Date();
      const newNotifications = [];

      weekObjectives.forEach(objective => {
        const { days, startTime } = getObjectiveSchedule(objective);
        if (days.length === 0 || !startTime) return;

        const weekDates = getWeekDates(currentWeekId);
        if (!weekDates) return;

        const startOfWeek = new Date(weekDates.start);

        days.forEach(day => {
          const targetDate = new Date(startOfWeek);
          targetDate.setDate(startOfWeek.getDate() + (day - 1));

          const [hours, minutes] = startTime.split(':').map(Number);
          targetDate.setHours(hours, minutes, 0, 0);

          // Trigger exactly 15 minutes before the start time
          const triggerTime = new Date(targetDate.getTime() - 15 * 60 * 1000);

          // Only schedule if in the future
          if (triggerTime > now) {
            const notifId = getNotificationId(objective.id, day);
            newNotifications.push({
              id: notifId,
              title: `Rappel : ${objective.title} ⏱️`,
              body: `Cet objectif commence dans 15 minutes (à ${startTime}). Préparez-vous !`,
              schedule: { at: triggerTime },
              vibrate: true,
              sound: true
            });
          }
        });
      });

      if (newNotifications.length > 0) {
        await LocalNotifications.schedule({
          notifications: newNotifications
        });
        console.log(`[Capacitor] Scheduled ${newNotifications.length} notifications.`);
      }
    } catch (e) {
      console.error('[Capacitor] Failed to schedule notifications:', e);
    }
    return;
  }

  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  const currentWeekId = getCurrentWeekId();
  const weekObjectives = getObjectivesForWeek(objectives, currentWeekId, getWeeksInMonth);
  const now = new Date();

  weekObjectives.forEach(objective => {
    const { days, startTime } = getObjectiveSchedule(objective);
    if (days.length === 0 || !startTime) return;

    const weekDates = getWeekDates(currentWeekId);
    if (!weekDates) return;

    const startOfWeek = new Date(weekDates.start);

    days.forEach(day => {
      // day = 1 (Lundi) to 7 (Dimanche)
      const targetDate = new Date(startOfWeek);
      targetDate.setDate(startOfWeek.getDate() + (day - 1));

      const [hours, minutes] = startTime.split(':').map(Number);
      targetDate.setHours(hours, minutes, 0, 0);

      // Trigger time is exactly 15 minutes before the start time
      const triggerTime = new Date(targetDate.getTime() - 15 * 60 * 1000);

      // Notification is valid within a 15-minute window before the start time
      if (now >= triggerTime && now < targetDate) {
        const dateStr = targetDate.toISOString().slice(0, 10);
        const storageKey = `notified:${objective.id}:${dateStr}`;

        if (!localStorage.getItem(storageKey)) {
          triggerNotification(`Rappel : ${objective.title} ⏱️`, {
            body: `Cet objectif commence dans 15 minutes (à ${startTime}). Préparez-vous !`,
            tag: objective.id,
            requireInteraction: true
          });
          localStorage.setItem(storageKey, 'true');
        }
      }
    });
  });
};
