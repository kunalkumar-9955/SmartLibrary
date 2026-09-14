import { notificationService } from '../services/api';

// Convert base64 VAPID key to Uint8Array for PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register Service Worker if supported
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Sync or create push subscription and save to backend
 */
export async function syncPushSubscription(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    const registration = await registerServiceWorker();
    if (!registration) return false;

    // Get public VAPID key from env or backend
    let publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      try {
        const res = await notificationService.getVapidPublicKey();
        if (res.data?.success && res.data?.data?.publicKey) {
          publicKey = res.data.data.publicKey;
        }
      } catch (e) {
        console.error('Failed to fetch VAPID key from backend:', e);
      }
    }

    if (!publicKey) {
      publicKey = 'BLuxYmNTqtp7DHf0UvMonl7kF5XPNmsp7RQvGlajvf27d7r3SBIsGoZewQl7wE6uP0yz__toPvKjAxLjnb_AGPk';
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    if (subscription) {
      await notificationService.subscribePush({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Web Push subscription registration error (non-fatal):', error);
    return false;
  }
}

/**
 * Initialize Web Push Notification immediately after login.
 * Flow:
 * - Check Notification.permission
 * - If "default" -> Request permission immediately
 * - If granted -> register SW, obtain push subscription, save to backend
 * - If "granted" already -> sync subscription
 * - If "denied" -> do not repeatedly ask, do not block login
 */
export async function initPushNotificationsOnLogin(): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  try {
    const currentPermission = Notification.permission;

    if (currentPermission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await syncPushSubscription();
      }
    } else if (currentPermission === 'granted') {
      await syncPushSubscription();
    }
    // If 'denied', do not ask repeatedly and do not block
  } catch (err) {
    console.warn('Notification permission flow error (non-fatal):', err);
  }
}
