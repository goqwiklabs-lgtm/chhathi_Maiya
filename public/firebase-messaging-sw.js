// Firebase Cloud Messaging Background Service Worker
// Scripts for firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAkOPWDK-0Rel9evcYlzcYJe8iy5jrn_Tc",
  authDomain: "chhathi-maiya-app.firebaseapp.com",
  projectId: "chhathi-maiya-app",
  storageBucket: "chhathi-maiya-app.firebasestorage.app",
  messagingSenderId: "677740882914",
  appId: "1:677740882914:web:825d90bc294749c49b67bb"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Chhathi Maiya Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'छठ महापर्व की पावन शुभकामनाएं 🙏',
    icon: '/logo.svg',
    badge: '/logo.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
