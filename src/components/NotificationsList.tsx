/**
 * NotificationsList Component
 * 
 * Full-page view of all notifications with grouping by date
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Check, Loader2 } from 'lucide-react';
import { client } from '../client';
import type { SharedProps, Notification } from '../types';
import { 
  formatNotificationTime, 
  groupNotificationsByDate,
  NOTIFICATION_CONFIG,
} from '../utils/notificationUtils';

export function NotificationsList({ setCurrentView, user }: SharedProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfileId, setUserProfileId] = useState<string | null>(null);

  // Load user profile ID
  useEffect(() => {
    if (!user) return;
    
    async function loadProfile() {
      try {
        const { data } = await client.models.UserProfile.list({
          filter: { userId: { eq: user.userId } },
          limit: 1,
        }) as { data?: { id: string }[] };
        
        if (data?.[0]?.id) {
          setUserProfileId(data[0].id);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('Load profile:', e);
      }
    }
    
    loadProfile();
  }, [user]);

  // Load notifications when we have the profile ID
  useEffect(() => {
    if (!userProfileId) return;

    let cancelled = false;

    async function loadNotifications() {
      try {
        const { data, errors } = await client.models.Notification.list({
          filter: { userId: { eq: userProfileId } },
          limit: 100,
        }) as { data?: Notification[]; errors?: unknown[] };

        if (cancelled) return;

        if (!errors && data) {
          const sorted = [...data].sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          });
          setNotifications(sorted);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('Load notifications:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotifications();
    return () => { cancelled = true; };
  }, [userProfileId]);

  const markAsRead = async (notificationId: string) => {
    try {
      await client.models.Notification.update({
        id: notificationId,
        read: true,
      });
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (e) {
      if (import.meta.env.DEV) console.error('Mark as read:', e);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    try {
      await Promise.all(
        unreadNotifications.map(n => 
          client.models.Notification.update({ id: n.id, read: true })
        )
      );
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      if (import.meta.env.DEV) console.error('Mark all as read:', e);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await client.models.Notification.delete({ id: notificationId });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (e) {
      if (import.meta.env.DEV) console.error('Delete notification:', e);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    const config = type ? NOTIFICATION_CONFIG[type] : null;
    return config?.icon || '•';
  };

  const grouped = groupNotificationsByDate(notifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (!user) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600 mb-4">Sign in to view notifications.</p>
          <button
            type="button"
            onClick={() => setCurrentView('account')}
            className="text-primary-600 hover:underline"
          >
            Go to account
          </button>
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView('home')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-600">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Mark all read
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h2>
            <p className="text-gray-600">
              You&apos;ll see notifications here when there&apos;s activity on your rides.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.today.length > 0 && (
              <NotificationGroup
                title="Today"
                notifications={grouped.today}
                getNotificationIcon={getNotificationIcon}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            )}
            {grouped.yesterday.length > 0 && (
              <NotificationGroup
                title="Yesterday"
                notifications={grouped.yesterday}
                getNotificationIcon={getNotificationIcon}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            )}
            {grouped.earlier.length > 0 && (
              <NotificationGroup
                title="Earlier"
                notifications={grouped.earlier}
                getNotificationIcon={getNotificationIcon}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

interface NotificationGroupProps {
  title: string;
  notifications: Notification[];
  getNotificationIcon: (type: Notification['type']) => string;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationGroup({ 
  title, 
  notifications, 
  getNotificationIcon, 
  onMarkAsRead,
  onDelete,
}: NotificationGroupProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
        {title}
      </h2>
      <ul className="bg-white rounded-lg shadow divide-y divide-gray-100 overflow-hidden">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className={`px-4 py-4 ${!notification.read ? 'bg-blue-50' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5" role="img" aria-hidden>
                {getNotificationIcon(notification.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {notification.title}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {notification.message}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {formatNotificationTime(notification.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!notification.read && (
                  <button
                    onClick={() => onMarkAsRead(notification.id)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Mark as read"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('Delete this notification?')) {
                      onDelete(notification.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Delete notification"
                >
                  <span className="text-sm">×</span>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
