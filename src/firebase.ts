import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey: 'AIzaSyAkOPWDK-0Rel9evcYlzcYJe8iy5jrn_Tc',
  authDomain: 'chhathi-maiya-app.firebaseapp.com',
  projectId: 'chhathi-maiya-app',
  storageBucket: 'chhathi-maiya-app.firebasestorage.app',
  messagingSenderId: '677740882914',
  appId: '1:677740882914:web:825d90bc294749c49b67bb',
  measurementId: 'G-M29JYVJ1NQ'
};

// Web Push Certificate Key (VAPID Key)
export const VAPID_KEY = 'BKJS7i6MilbOse97OyXjAyCPbmNSZNmpTd1lOmjXbvnWcBaJlKetRJs3dg0sFfFRYw5W8NKT5jYaQSP37Aa0sJ0';

// Initialize Firebase singleton
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Initialize Firebase Cloud Messaging safely (only in supported browser environments)
export const requestPushNotificationPermission = async () => {
  try {
    const supported = await isSupported();
    if (!supported || typeof window === 'undefined' || !('Notification' in window)) {
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (currentToken) {
        try {
          localStorage.setItem('chhathi_push_token', currentToken);
        } catch {}
        return currentToken;
      }
    }
  } catch (err) {
    console.warn('Web Push Notification setup notice:', err);
  }
  return null;
};
