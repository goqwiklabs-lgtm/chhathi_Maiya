import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const secDecrypt = (hex: string, key = 'chhathi_2026') => {
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substr(i, 2), 16);
    out += String.fromCharCode(byte ^ key.charCodeAt((i / 2) % key.length));
  }
  return out;
};

export const firebaseConfig = {
  apiKey: secDecrypt('22211200271128347d606572284558331104503a44536b5a190b312b11500026075a40583c3c0b'),
  authDomain: secDecrypt('00000000000000725f515b4f0245091104460f3640555057100d091104460a305f'),
  projectId: secDecrypt('00000000000000725f515b4f0245091104'),
  storageBucket: secDecrypt('00000000000000725f515b4f0245091104460f3640555057100d1b151b1a0838571e534613'),
  messagingSenderId: secDecrypt('555f5f564058516700090302'),
  appId: secDecrypt('52525e56435f5d6f0a08000f525c5216110a53670005560f530a0b534d5c5e6b0b53060f015e5f0316'),
  measurementId: secDecrypt('244525534d22300978017c67')
};

// Web Push Certificate Key (VAPID Key - Encrypted)
export const VAPID_KEY = secDecrypt('2123223243015f125b5c5079100d51563b11313573497166010526322e26042f4674035a2c05300302061e085172537c0f230d1526221a6c56570245250e2e332d1f5c080a7e796256023100253b396c05715306102258');

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
