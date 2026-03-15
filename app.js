import { db, messaging } from "./firebase.js"
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  orderBy,
  updateDoc,
  doc,
  setDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
import {
  getToken,
  onMessage
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js"

const email    = localStorage.getItem("email")
const nickname = localStorage.getItem("nickname")

if (!nickname || nickname.trim() === "") {
  window.location.replace("setup.html")
}

const groupScreen      = document.getElementById("groupScreen")
const chatScreen       = document.getElementById("chatScreen")
const settingsScreen   = document.getElementById("settingsScreen")
const groupList        = document.getElementById("groupList")
const groupTitle       = document.getElementById("groupTitle")
const userRoleSpan     = document.getElementById("userRole")
const messagesDiv      = document.getElementById("messages")
const messageInput     = document.getElementById("messageInput")
const sendBtn          = document.getElementById("sendBtn")
const backBtn          = document.getElementById("backBtn")
const createGroupBtn   = document.getElementById("createGroupBtn")
const settingsBtn      = document.getElementById("settingsBtn")
const backFromSettings = document.getElementById("backFromSettings")

const settingsGroupName   = document.getElementById("settingsGroupName")
const membersList         = document.getElementById("membersList")
const addMemberEmailInput = document.getElementById("addMemberEmail")
const addMemberRoleSelect = document.getElementById("addMemberRole")
const addMemberBtn        = document.getElementById("addMemberBtn")
const renameGroupInput    = document.getElementById("renameGroupInput")
const renameGroupBtn      = document.getElementById("renameGroupBtn")
const deleteGroupBtn      = document.getElementById("deleteGroupBtn")

// ── TOAST ──
function showToast(msg, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerText = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.classList.add("show"), 10)
  setTimeout(() => {
    toast.classList.remove("show")
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// ── CONFIRM DIALOG ──
function showConfirm(msg, onConfirm) {
  const overlay = document.createElement("div")
  overlay.className = "dialog-overlay"
  overlay.innerHTML = `
    <div class="dialog-box">
      <p>${msg}</p>
      <div class="dialog-btns">
        <button class="dialog-cancel">İptal</button>
        <button class="dialog-ok danger">Evet, Devam Et</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.querySelector(".dialog-cancel").onclick = () => overlay.remove()
  overlay.querySelector(".dialog-ok").onclick = () => {
    overlay.remove()
    onConfirm()
  }
}

// ── INPUT DIALOG ──
function showInputDialog(title, desc, placeholder, onConfirm) {
  const overlay = document.createElement("div")
  overlay.className = "dialog-overlay"
  overlay.innerHTML = `
    <div class="dialog-box">
      <h3>${title}</h3>
      <p>${desc}</p>
      <input type="text" class="dialog-input" placeholder="${placeholder}" />
      <div class="dialog-btns">
        <button class="dialog-cancel">İptal</button>
        <button class="dialog-ok">Oluştur</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  const input = overlay.querySelector(".dialog-input")
  input.focus()
  overlay.querySelector(".dialog-cancel").onclick = () => overlay.remove()
  overlay.querySelector(".dialog-ok").onclick = () => {
    const val = input.value.trim()
    overlay.remove()
    onConfirm(val)
  }
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") overlay.querySelector(".dialog-ok").click()
  })
}

// ══════════════════════════════════════════
// ── BİLDİRİM SİSTEMİ ──
// ══════════════════════════════════════════

const VAPID_KEY = "BFYUlhHM0Ej2YbsMjMkSCprHIOJkGUDmzP9Wglph9dBFPayRL8zk-8LttZTTJuOyQVJlvkORWfHiLV63ODIdjtw"

let originalTitle = document.title
let unreadCount   = 0
let isPageVisible = true

// Sayfa görünürlüğünü takip et
document.addEventListener("visibilitychange", () => {
  isPageVisible = !document.hidden
  if (isPageVisible) {
    unreadCount = 0
    document.title = originalTitle
  }
})

// Tab başlığını güncelle
function updateTabTitle(senderName) {
  unreadCount++
  document.title = `(${unreadCount}) 💬 ${senderName} yazdı`
}

// Ses bildirimi
function playNotificationSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {}
}

// FCM token'ı Firestore'a kaydet
async function saveFCMToken(token) {
  try {
    const userQuery = query(collection(db, "users"), where("email", "==", email))
    const userSnap  = await getDocs(userQuery)
    if (!userSnap.empty) {
      await updateDoc(userSnap.docs[0].ref, {
        fcmTokens: arrayUnion(token)
      })
    }
  } catch (e) {
    console.warn("FCM token kaydedilemedi:", e)
  }
}

// FCM başlat
async function initFCM() {
  try {
    if (!("serviceWorker" in navigator)) return

    // Service Worker kaydet
    const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js")

    // Bildirim izni iste
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      console.warn("Bildirim izni reddedildi.")
      return
    }

    // FCM token al
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    })

    if (token) {
      await saveFCMToken(token)
    }

    // Site AÇIKKEN gelen push mesajlarını yakala
    // (site kapalıyken firebase-messaging-sw.js devreye girer)
    onMessage(messaging, payload => {
      const title = payload.data?.title || "Yeni mesaj"
      const body  = payload.data?.body  || ""
      showToast(`🔔 ${title}: ${body.slice(0, 50)}`, "info")
      playNotificationSound()
      if (!isPageVisible) updateTabTitle(title)
    })

  } catch (e) {
    console.warn("FCM başlatılamadı:", e)
  }
}

// Ana bildirim fonksiyonu — onSnapshot'tan çağrılır
// (Site açıkken yedek: Cloud Function push göndermeden önce anlık tepki)
function handleIncomingMessage(data, groupName) {
  if (data.email === email) return // kendi mesajım
  const senderName = data.nickname?.trim() || data.email?.split("@")[0] || "Birisi"

  // Uygulama içi toast
  showToast(`💬 ${senderName}: ${data.text.slice(0, 40)}${data.text.length > 40 ? "…" : ""}`, "info")

  // Ses
  playNotificationSound()

  // Tab sayacı
  if (!isPageVisible) updateTabTitle(senderName)
}

// FCM'i başlat
initFCM()

// ══════════════════════════════════════════
// ── GRUPLAR ──
// ══════════════════════════════════════════

let currentGroup    = null
let currentUserRole = null
let unsubscribe     = null

async function loadGroups() {
  const q = query(
    collection(db, "groups"),
    where("memberEmails", "array-contains", email)
  )
  const snap = await getDocs(q)
  groupList.innerHTML = ""

  if (snap.empty) {
    groupList.innerHTML = `<div class="empty-state">Henüz bir gruba katılmadın.<br>Yeni grup oluştur veya davet bekle.</div>`
    return
  }

  snap.forEach(d => {
    const data       = d.data()
    const userMember = (data.members || []).find(m => m.email === email)
    const role       = userMember ? userMember.role : "normal"

    const div = document.createElement("div")
    div.className = "groupItem"
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="group-name-text">${data.name}</span>
        <span class="role-badge ${role === 'admin' ? 'role-admin' : 'role-normal'}">
          ${role === "admin" ? "👑 Admin" : "👤 Üye"}
        </span>
      </div>
    `
    div.onclick = () => openGroup(d.id, data.name, role)
    groupList.appendChild(div)
  })
}

function openGroup(id, name, userRole) {
  currentGroup    = id
  currentUserRole = userRole
  groupTitle.innerText      = name
  userRoleSpan.innerText    = userRole === "admin" ? "👑 Admin" : "👤 Üye"
  userRoleSpan.style.color  = userRole === "admin" ? "#fbbf24" : "#94a3b8"

  groupScreen.classList.add("hidden")
  chatScreen.classList.remove("hidden")
  settingsBtn.classList.toggle("hidden", currentUserRole !== "admin")
  loadMessages()
}

backBtn.onclick = () => {
  chatScreen.classList.add("hidden")
  groupScreen.classList.remove("hidden")
  if (unsubscribe) unsubscribe()
  loadGroups()
}

// ── MESAJLAR ──
function loadMessages() {
  if (unsubscribe) unsubscribe()
  const q = query(
    collection(db, "groups", currentGroup, "messages"),
    orderBy("createdAt")
  )

  let isFirstLoad = true

  unsubscribe = onSnapshot(q, snap => {
    messagesDiv.innerHTML = ""
    snap.forEach(d => {
      const data       = d.data()
      const date       = new Date(data.createdAt)
      const timeString = `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`
      const div        = document.createElement("div")
      div.className    = "bubble"
      div.classList.add(data.email === email ? "me" : "other")
      const displayName = data.nickname?.trim() ? data.nickname : (data.email?.split("@")[0] || "Kullanıcı")
      div.innerHTML = `
        <div class="message-header">
          <span class="sender-name">${displayName}</span>
          <span class="message-time">${timeString}</span>
        </div>
        <div class="message-text">${data.text}</div>
      `
      messagesDiv.appendChild(div)
    })
    messagesDiv.scrollTop = messagesDiv.scrollHeight

    // Yeni mesaj bildirimi — ilk yükleme hariç
    if (!isFirstLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === "added") {
          handleIncomingMessage(change.doc.data(), groupTitle.innerText)
        }
      })
    }
    isFirstLoad = false
  })
}

sendBtn.onclick = async () => {
  const text = messageInput.value.trim()
  if (!text) return
  const senderNickname = nickname?.trim() || email?.split("@")[0] || "Kullanıcı"
  await addDoc(collection(db, "groups", currentGroup, "messages"), {
    text, email, nickname: senderNickname, createdAt: Date.now()
  })
  messageInput.value = ""
}

messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault()
    sendBtn.click()
  }
})

// ── GRUP OLUŞTUR ──
createGroupBtn.onclick = () => {
  showInputDialog("Yeni Grup Oluştur", "Grup adını girin", "Grup adı", async (name) => {
    if (!name) return
    const groupId = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-ğüşıöçĞÜŞİÖÇ]/g, "")
    if (!groupId) { showToast("Geçersiz grup adı!", "error"); return }

    const existing = await getDoc(doc(db, "groups", groupId))
    if (existing.exists()) {
      showToast("Bu isimde bir grup zaten var!", "error")
      return
    }

    await setDoc(doc(db, "groups", groupId), {
      name: name.trim(),
      memberEmails: [email],
      members: [{ email, role: "admin" }],
      createdAt: Date.now()
    })
    showToast("Grup oluşturuldu!", "success")
    loadGroups()
  })
}

// ── AYARLAR ──
settingsBtn.onclick = async () => {
  chatScreen.classList.add("hidden")
  settingsScreen.classList.remove("hidden")
  settingsGroupName.innerText = groupTitle.innerText
  renameGroupInput.value      = groupTitle.innerText
  await loadMembersList()
}

backFromSettings.onclick = () => {
  settingsScreen.classList.add("hidden")
  chatScreen.classList.remove("hidden")
}

async function loadMembersList() {
  const groupSnap = await getDoc(doc(db, "groups", currentGroup))
  if (!groupSnap.exists()) return
  const data    = groupSnap.data()
  const members = data.members || []

  membersList.innerHTML = ""
  members.forEach(m => {
    const div = document.createElement("div")
    div.className = "member-item"
    div.innerHTML = `
      <div class="member-info">
        <span class="member-email">${m.email}</span>
        <span class="role-badge ${m.role === 'admin' ? 'role-admin' : 'role-normal'} small">
          ${m.role === "admin" ? "👑 Admin" : "👤 Üye"}
        </span>
      </div>
      <div class="member-actions">
        ${m.email !== email ? `
          <button class="btn-toggle-role" data-email="${m.email}" data-role="${m.role}">
            ${m.role === "admin" ? "Üye Yap" : "Admin Yap"}
          </button>
          <button class="btn-remove-member" data-email="${m.email}">Çıkar</button>
        ` : `<span class="you-label">Sen</span>`}
      </div>
    `
    membersList.appendChild(div)
  })

  membersList.querySelectorAll(".btn-remove-member").forEach(btn => {
    btn.onclick = () => {
      const targetEmail = btn.dataset.email
      showConfirm(`${targetEmail} kişisini gruptan çıkarmak istediğine emin misin?`, async () => {
        const groupRef       = doc(db, "groups", currentGroup)
        const snap           = await getDoc(groupRef)
        const currentMembers = snap.data().members || []
        const memberToRemove = currentMembers.find(m => m.email === targetEmail)
        await updateDoc(groupRef, {
          memberEmails: arrayRemove(targetEmail),
          members:      arrayRemove(memberToRemove)
        })
        showToast(`${targetEmail} gruptan çıkarıldı.`, "success")
        await loadMembersList()
      })
    }
  })

  membersList.querySelectorAll(".btn-toggle-role").forEach(btn => {
    btn.onclick = async () => {
      const targetEmail  = btn.dataset.email
      const currentRole  = btn.dataset.role
      const newRole      = currentRole === "admin" ? "normal" : "admin"
      const groupRef     = doc(db, "groups", currentGroup)
      const snap         = await getDoc(groupRef)
      const currentMembers = snap.data().members || []
      const oldEntry     = currentMembers.find(m => m.email === targetEmail)
      await updateDoc(groupRef, { members: arrayRemove(oldEntry) })
      await updateDoc(groupRef, { members: arrayUnion({ email: targetEmail, role: newRole }) })
      showToast("Rol güncellendi.", "success")
      await loadMembersList()
    }
  })
}

addMemberBtn.onclick = async () => {
  const newEmail = addMemberEmailInput.value.trim()
  const role     = addMemberRoleSelect.value
  if (!newEmail) { showToast("E-posta boş olamaz!", "error"); return }

  const groupRef      = doc(db, "groups", currentGroup)
  const snap          = await getDoc(groupRef)
  const existingEmails = snap.data().memberEmails || []
  if (existingEmails.includes(newEmail)) {
    showToast("Bu kullanıcı zaten grupta!", "error"); return
  }

  await updateDoc(groupRef, {
    memberEmails: arrayUnion(newEmail),
    members:      arrayUnion({ email: newEmail, role })
  })
  addMemberEmailInput.value = ""
  showToast(`${newEmail} gruba eklendi!`, "success")
  await loadMembersList()
}

renameGroupBtn.onclick = async () => {
  const newName = renameGroupInput.value.trim()
  if (!newName) { showToast("Grup adı boş olamaz!", "error"); return }
  await updateDoc(doc(db, "groups", currentGroup), { name: newName })
  groupTitle.innerText        = newName
  settingsGroupName.innerText = newName
  showToast("Grup adı güncellendi!", "success")
}

deleteGroupBtn.onclick = () => {
  showConfirm("Grubu silmek istediğine emin misin? Bu işlem geri alınamaz!", async () => {
    const msgsSnap = await getDocs(collection(db, "groups", currentGroup, "messages"))
    for (const d of msgsSnap.docs) {
      await deleteDoc(d.ref)
    }
    await deleteDoc(doc(db, "groups", currentGroup))
    settingsScreen.classList.add("hidden")
    groupScreen.classList.remove("hidden")
    if (unsubscribe) unsubscribe()
    showToast("Grup silindi.", "info")
    loadGroups()
  })
}

loadGroups()