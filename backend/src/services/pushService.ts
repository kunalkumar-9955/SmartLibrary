import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLuxYmNTqtp7DHf0UvMonl7kF5XPNmsp7RQvGlajvf27d7r3SBIsGoZewQl7wE6uP0yz__toPvKjAxLjnb_AGPk';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '87Xf_1V3y7rmH99RaE277NL372WnY4ns57o1Vmc5-XA';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@lakshyalibrary.com';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.error('Failed to configure web-push VAPID details:', err);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: any;
}

export const sendPushToUser = async (userId: string, payload: PushPayload) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    if (!subscriptions || subscriptions.length === 0) return;

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/Logo.png',
      badge: payload.badge || '/Logo.png',
      url: payload.url || '/student/notifications',
      data: payload.data || {},
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payloadString
        );
      } catch (err: any) {
        // If subscription is expired or unsubscribed, remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error('Error sending push notification to user:', error);
  }
};

export const broadcastPushNotification = async (payload: PushPayload) => {
  try {
    const subscriptions = await PushSubscription.find();
    if (!subscriptions || subscriptions.length === 0) return;

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/Logo.png',
      badge: payload.badge || '/Logo.png',
      url: payload.url || '/student/notifications',
      data: payload.data || {},
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payloadString
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error('Error broadcasting push notification:', error);
  }
};
