/**
 * Notification Utilities
 * 
 * Helper functions for in-app notifications
 */

import type { NotificationType, Ride, Notification } from '../types';
import { getShortDisplayName } from './rideUtils';

// Notification type configuration
export const NOTIFICATION_CONFIG: Record<NotificationType, { icon: string; defaultTitle: string }> = {
  ride_booked: { icon: '✓', defaultTitle: 'Ride Booked' },
  ride_cancelled: { icon: '✕', defaultTitle: 'Ride Cancelled' },
  ride_started: { icon: '▶', defaultTitle: 'Ride Started' },
  ride_completed: { icon: '✓', defaultTitle: 'Ride Completed' },
  participant_joined: { icon: '+', defaultTitle: 'New Participant' },
  participant_cancelled: { icon: '-', defaultTitle: 'Participant Cancelled' },
  ride_expiring: { icon: '⏰', defaultTitle: 'Ride Expiring Soon' },
};

/**
 * Generate notification title based on type and ride
 */
export function getNotificationTitle(type: NotificationType, ride?: Partial<Ride>): string {
  const rideName = ride ? getShortDisplayName(ride) : 'Ride';
  
  switch (type) {
    case 'ride_booked':
      return `Booking confirmed: ${rideName}`;
    case 'ride_cancelled':
      return `Ride cancelled: ${rideName}`;
    case 'ride_started':
      return `Ride started: ${rideName}`;
    case 'ride_completed':
      return `Ride completed: ${rideName}`;
    case 'participant_joined':
      return `New participant joined: ${rideName}`;
    case 'participant_cancelled':
      return `Participant cancelled: ${rideName}`;
    case 'ride_expiring':
      return `Ride expiring soon: ${rideName}`;
    default:
      return 'Notification';
  }
}

/**
 * Generate notification message based on type and context
 */
export function getNotificationMessage(
  type: NotificationType, 
  ride?: Partial<Ride>,
  participantName?: string
): string {
  const rideName = ride ? getShortDisplayName(ride) : 'your ride';
  
  switch (type) {
    case 'ride_booked':
      return `Your booking for ${rideName} has been confirmed.`;
    case 'ride_cancelled':
      return `The ride ${rideName} has been cancelled.`;
    case 'ride_started':
      return `The driver has started the ride ${rideName}.`;
    case 'ride_completed':
      return `The ride ${rideName} has been completed. Please leave a rating!`;
    case 'participant_joined':
      return participantName 
        ? `${participantName} has joined ${rideName}.`
        : `A new participant has joined ${rideName}.`;
    case 'participant_cancelled':
      return participantName
        ? `${participantName} has cancelled their spot on ${rideName}.`
        : `A participant has cancelled their spot on ${rideName}.`;
    case 'ride_expiring':
      return `Your ride ${rideName} will expire soon. Make sure to start it on time!`;
    default:
      return 'You have a new notification.';
  }
}

/**
 * Create notification data object (for use with Amplify create)
 */
export function createNotificationData(
  userId: string,
  type: NotificationType,
  ride?: Partial<Ride>,
  participantName?: string
): {
  userId: string;
  rideId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
} {
  return {
    userId,
    rideId: ride?.id,
    type,
    title: getNotificationTitle(type, ride),
    message: getNotificationMessage(type, ride, participantName),
    read: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Format notification timestamp for display
 */
export function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Get unread notification count
 */
export function getUnreadCount(notifications: Notification[]): number {
  return notifications.filter(n => !n.read).length;
}

/**
 * Sort notifications by date (newest first)
 */
export function sortNotificationsByDate(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });
}

/**
 * Group notifications by date (Today, Yesterday, Earlier)
 */
export function groupNotificationsByDate(notifications: Notification[]): {
  today: Notification[];
  yesterday: Notification[];
  earlier: Notification[];
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const result = {
    today: [] as Notification[],
    yesterday: [] as Notification[],
    earlier: [] as Notification[],
  };

  for (const notification of sortNotificationsByDate(notifications)) {
    const notifDate = new Date(notification.createdAt);
    const notifDateOnly = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate());

    if (notifDateOnly.getTime() === today.getTime()) {
      result.today.push(notification);
    } else if (notifDateOnly.getTime() === yesterday.getTime()) {
      result.yesterday.push(notification);
    } else {
      result.earlier.push(notification);
    }
  }

  return result;
}
