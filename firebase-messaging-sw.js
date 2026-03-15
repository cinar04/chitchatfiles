importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js")

firebase.initializeApp({
  apiKey: "AIzaSyCn8TB2KdUoOB8ePfE9oLcic54ZkhSRfIM",
  authDomain: "chit-f4d4e.firebaseapp.com",
  projectId: "chit-f4d4e",
  storageBucket: "chit-f4d4e.firebasestorage.app",
  messagingSenderId: "1090199679595",
  appId: "1:1090199679595:web:8ea09750b5b40c8ec6b72e"
})

const messaging = firebase.messaging()

// Site kapalıyken gelen push bildirimleri burada gösterilir
messaging.onBackgroundMessage(payload => {
  const title = payload.data?.title || "ChitChat"
  const body  = payload.data?.body  || "Yeni mesaj var"
  const groupId = payload.data?.groupId || "chitchat"

  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: groupId,
    renotify: true,
    data: { url: "/" }
  })
})

// Bildirime tıklanınca uygulamayı aç / öne getir
self.addEventListener("notificationclick", e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(e.notification.data?.url || "/")
    })
  )
})