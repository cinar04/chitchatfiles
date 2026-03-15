import { db, auth } from "./firebase.js"
import {
  doc,
  getDoc,
  updateDoc,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const email = localStorage.getItem("email")
if (!email) window.location.replace("login.html")

const backBtn         = document.getElementById("backBtn")
const devicesList     = document.getElementById("devicesList")
const logoutAllBtn    = document.getElementById("logoutAllBtn")
const renameDialog    = document.getElementById("renameDialog")
const newDeviceName   = document.getElementById("newDeviceName")
const confirmRenameBtn = document.getElementById("confirmRenameBtn")
const cancelRenameBtn  = document.getElementById("cancelRenameBtn")

let currentSessionId = sessionStorage.getItem("sessionId") || generateSessionId()
let renameTargetId   = null

function generateSessionId() {
  const id = Math.random().toString(36).substring(2, 15) + Date.now()
  sessionStorage.setItem("sessionId", id)
  return id
}

function showToast(msg, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerText = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.classList.add("show"), 10)
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300) }, 3000)
}

backBtn.onclick = () => window.location.replace("profile.html")

function getDeviceInfo() {
  const ua = navigator.userAgent
  let deviceType = "💻 Bilgisayar"
  let browser = "Bilinmeyen"
  let os = "Bilinmeyen"

  if (ua.includes("Edg"))     browser = "Edge"
  else if (ua.includes("Chrome"))  browser = "Chrome"
  else if (ua.includes("Firefox")) browser = "Firefox"
  else if (ua.includes("Safari"))  browser = "Safari"
  else if (ua.includes("Opera"))   browser = "Opera"

  if (ua.includes("Windows"))      os = "Windows"
  else if (ua.includes("Mac"))      os = "macOS"
  else if (ua.includes("iPhone"))   { os = "iOS"; deviceType = "📱 iPhone" }
  else if (ua.includes("iPad"))     { os = "iPadOS"; deviceType = "📱 iPad" }
  else if (ua.includes("Android"))  { os = "Android"; deviceType = "📱 Android" }
  else if (ua.includes("Linux"))    os = "Linux"

  return { deviceType, browser, os, userAgent: ua }
}

async function getLocationInfo() {
  try {
    const res  = await fetch("https://ipapi.co/json/")
    const data = await res.json()
    return { city: data.city || "Bilinmeyen", country: data.country_name || "Bilinmeyen", ip: data.ip || "Bilinmeyen" }
  } catch {
    return { city: "Bilinmeyen", country: "Bilinmeyen", ip: "Bilinmeyen" }
  }
}

async function loadDevices() {
  try {
    const user = auth.currentUser
    if (!user) { window.location.replace("login.html"); return }

    const userDoc  = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data()
    const devices  = userData.devices || []

    if (devices.length === 0) {
      devicesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>Henüz aktif cihaz kaydı yok</p>
        </div>`
      return
    }

    devicesList.innerHTML = ""
    devices.forEach(device => {
      const isCurrent    = device.sessionId === currentSessionId
      const lastLoginDate = new Date(device.lastLogin).toLocaleDateString("tr-TR", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
      })

      const div = document.createElement("div")
      div.className = `device-card ${isCurrent ? "current" : ""}`
      div.innerHTML = `
        <div class="device-icon ${isCurrent ? "current" : ""}">
          ${device.deviceType?.includes("📱") ? "📱" : "💻"}
        </div>
        <div class="device-info">
          <div class="device-header">
            <span class="device-name">${device.name || device.browser}</span>
            ${isCurrent ? '<span class="current-badge"><span class="status-dot"></span>Bu Cihaz</span>' : ""}
          </div>
          <div class="device-details">
            <div class="device-detail"><span class="detail-icon">🖥️</span><span>${device.os} • ${device.browser}</span></div>
            <div class="device-detail"><span class="detail-icon">📍</span><span>${device.location?.city || "Bilinmeyen"}, ${device.location?.country || "Bilinmeyen"}</span></div>
            <div class="device-detail"><span class="detail-icon">⏰</span><span>Son giriş: ${lastLoginDate}</span></div>
            <div class="device-detail"><span class="detail-icon">🔗</span><span>IP: ${device.location?.ip || "Gizli"}</span></div>
          </div>
          ${!isCurrent ? `
            <div class="device-actions">
              <button class="btn-rename" data-id="${device.sessionId}">✏️ Adlandır</button>
              <button class="btn-remove" data-id="${device.sessionId}">🗑️ Çıkar</button>
            </div>` : ""}
        </div>`
      devicesList.appendChild(div)
    })

    document.querySelectorAll(".btn-rename").forEach(btn => {
      btn.onclick = e => {
        const sessionId = e.target.dataset.id
        const device    = devices.find(d => d.sessionId === sessionId)
        renameTargetId  = sessionId
        newDeviceName.value = device.name || device.browser
        renameDialog.classList.add("show")
        newDeviceName.focus()
      }
    })

    document.querySelectorAll(".btn-remove").forEach(btn => {
      btn.onclick = e => {
        const sessionId = e.target.dataset.id
        const device    = devices.find(d => d.sessionId === sessionId)
        if (confirm(`"${device.name || device.browser}" cihazını çıkarmak istiyor musunuz?`)) {
          removeDevice(sessionId)
        }
      }
    })
  } catch (e) {
    console.error("Cihaz yükleme hatası:", e)
    devicesList.innerHTML = `<div class="empty-state"><p style="color:#f87171;">Cihazlar yüklenemedi: ${e.message}</p></div>`
  }
}

confirmRenameBtn.onclick = async () => {
  const newName = newDeviceName.value.trim()
  if (!newName) { showToast("Cihaz adı boş olamaz", "error"); return }
  if (newName.length > 30) { showToast("Maksimum 30 karakter", "error"); return }

  try {
    confirmRenameBtn.disabled = true
    const user    = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const devices = userDoc.data().devices || []
    const idx     = devices.findIndex(d => d.sessionId === renameTargetId)
    if (idx !== -1) {
      devices[idx].name = newName
      await updateDoc(doc(db, "users", user.uid), { devices })
      renameDialog.classList.remove("show")
      showToast("Cihaz adı güncellendi", "success")
      await loadDevices()
    }
  } catch (e) {
    showToast("İşlem başarısız oldu", "error")
  } finally {
    confirmRenameBtn.disabled = false
  }
}

cancelRenameBtn.onclick = () => renameDialog.classList.remove("show")
renameDialog.onclick    = e => { if (e.target === renameDialog) renameDialog.classList.remove("show") }

async function removeDevice(sessionId) {
  try {
    const user    = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const devices = userDoc.data().devices || []
    const toRemove = devices.find(d => d.sessionId === sessionId)
    await updateDoc(doc(db, "users", user.uid), { devices: arrayRemove(toRemove) })
    showToast("Cihaz kaldırıldı", "success")
    await loadDevices()
  } catch (e) {
    showToast("Cihaz silinemedi", "error")
  }
}

logoutAllBtn.onclick = async () => {
  if (!confirm("Bu cihaz dışındaki tüm cihazlardan çıkış yapılacak. Emin misiniz?")) return
  try {
    logoutAllBtn.disabled = true
    logoutAllBtn.innerHTML = '<span class="loading-spinner"></span>'
    const user    = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const devices = userDoc.data().devices || []
    const current = devices.find(d => d.sessionId === currentSessionId)
    await updateDoc(doc(db, "users", user.uid), { devices: current ? [current] : [] })
    showToast("Tüm diğer cihazlardan çıkış yapıldı", "success")
    await loadDevices()
  } catch (e) {
    showToast("İşlem başarısız oldu", "error")
  } finally {
    logoutAllBtn.disabled = false
    logoutAllBtn.innerText = "🚪 Tümünden Çıkış Yap"
  }
}

async function saveCurrentDevice() {
  try {
    const user = auth.currentUser
    if (!user) return

    const deviceInfo = getDeviceInfo()
    const location   = await getLocationInfo()

    const userDoc = await getDoc(doc(db, "users", user.uid))
    if (!userDoc.exists()) return

    const devices = userDoc.data().devices || []
    const existingIdx = devices.findIndex(d => d.sessionId === currentSessionId)

    const newDevice = {
      sessionId:  currentSessionId,
      deviceType: deviceInfo.deviceType,
      browser:    deviceInfo.browser,
      os:         deviceInfo.os,
      userAgent:  deviceInfo.userAgent,
      location:   location,
      lastLogin:  new Date().toISOString(),
      name:       `${deviceInfo.os} • ${deviceInfo.browser}`
    }

    if (existingIdx !== -1) {
      devices[existingIdx] = newDevice
    } else {
      devices.push(newDevice)
    }

    if (devices.length > 10) {
      devices.sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin))
      devices.splice(10)
    }

    await updateDoc(doc(db, "users", user.uid), { devices })
  } catch (e) {
    console.error("Cihaz kaydetme hatası:", e)
  }
}

// ── BAŞLAT: auth hazır olunca çalıştır ──
auth.onAuthStateChanged(async user => {
  if (user) {
    await saveCurrentDevice()
    await loadDevices()
  } else {
    window.location.replace("login.html")
  }
})
