import { useState, useEffect, useCallback } from 'react';

export type NotificationType =
  | 'stream_received' | 'cliff_reached' | 'stream_completed'
  | 'stream_cancelled' | 'stream_transferred' | 'topup_received';

export interface Notification {
  id:        string;
  type:      NotificationType;
  message:   string;
  streamId:  string;
  read:      boolean;
  timestamp: string;
}

const PREFS_KEY = 'flowstar_notif_prefs';

const defaultPrefs: Record<NotificationType, boolean> = {
  stream_received:    true,
  cliff_reached:      true,
  stream_completed:   true,
  stream_cancelled:   true,
  stream_transferred: true,
  topup_received:     true,
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') ?? defaultPrefs;
    } catch { return defaultPrefs; }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    if (!prefs[notif.type]) return;
    const full: Notification = {
      ...notif,
      id:        crypto.randomUUID(),
      read:      false,
      timestamp: new Date().toISOString(),
    };
    setNotifications(prev => [full, ...prev]);

    // Browser push
    if (Notification.permission === 'granted') {
      new Notification('FlowStar', { body: notif.message, icon: '/favicon.ico' });
    }
  }, [prefs]);

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const updatePref = (type: NotificationType, enabled: boolean) => {
    const next = { ...prefs, [type]: enabled };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const requestPushPermission = () => Notification.requestPermission();

  // Poll contract events every 30s
  useEffect(() => {
    const poll = async () => {
      // Replace with your actual contract event polling logic
      // const events = await fetchContractEvents();
      // events.forEach(e => addNotification(mapEventToNotification(e)));
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [addNotification]);

  return { notifications, unreadCount, addNotification, markAllRead, updatePref, prefs, requestPushPermission };
}