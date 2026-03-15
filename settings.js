import { db, auth } from "./firebase.js"
import {
  doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const email = localStorage.getItem("email")
if (!email) window.location.replace("login.html")

const backBtn             = document.getElementById("backBtn")
const themeLight          = document.getElementById("themeLight")
const themeDark           = document.getElementById("themeDark")
const langTR              = document.getElementById("langTR")
const langEN              = document.getElementById("langEN")
const langInfoBox         = document.getElementById("langInfoBox")
const enableNotifications = document.getElementById("enableNotifications")
const enableSound         = document.getElementById("enableSound")
const enableDesktop       = document.getElementById("enableDesktop")
const profileVisibility   = document.getElementById("profileVisibility")
const showOnlineStatus    = document.getElementById("showOnlineStatus")
const showActivityStatus  = document.getElementById("showActivityStatus")
const exportDataBtn       = document.getElementById("exportDataBtn")
const clearCacheBtn       = document.getElementById("clearCacheBtn")
const saveBtn             = document.getElementById("saveBtn")
const resetBtn            = document.getElementById("resetBtn")
const successMsg          = document.getElementById("successMsg")
const errorMsg            = document.getElementById("errorMsg")

let currentTheme    = localStorage.getItem("theme")    || "dark"
let currentLanguage = localStorage.getItem("language") || "tr"

function showToast(msg, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`
  toast.innerText = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.classList.add("show"), 10)
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300) }, 3000)
}

backBtn.onclick = () => window.location.replace("profile.html")

// ── TEMA ──
function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("theme-light")
    themeLight.classList.add("active")
    themeDark.classList.remove("active")
  } else {
    document.body.classList.remove("theme-light")
    themeDark.classList.add("active")
    themeLight.classList.remove("active")
  }
  localStorage.setItem("theme", theme)
  currentTheme = theme
}

themeLight.onclick = () => applyTheme("light")
themeDark.onclick  = () => applyTheme("dark")

// ── DİL ──
const translations = {
  tr: {
    langInfo: "Dil değişikliği kaydedilir. Tam uygulama için sayfayı yenileyebilirsiniz.",
    saved: "Ayarlar kaydedildi!",
    langSet: "Dil Türkçe olarak ayarlandı"
  },
  en: {
    langInfo: "Language change is saved. You may refresh for full effect.",
    saved: "Settings saved!",
    langSet: "Language set to English"
  }
}

function applyLanguage(lang) {
  currentLanguage = lang
  localStorage.setItem("language", lang)
  if (lang === "en") {
    langEN.classList.add("active")
    langTR.classList.remove("active")
  } else {
    langTR.classList.add("active")
    langEN.classList.remove("active")
  }
  // UI metinlerini güncelle
  const t = translations[lang]
  langInfoBox.innerText = t.langInfo
  successMsg.innerText  = t.saved
}

langTR.onclick = () => { applyLanguage("tr"); showToast(translations.tr.langSet, "info") }
langEN.onclick = () => { applyLanguage("en"); showToast(translations.en.langSet, "info") }

// ── TOGGLE ──
function bindToggle(el) { el.onclick = () => el.classList.toggle("active") }
bindToggle(enableNotifications)
bindToggle(enableSound)
bindToggle(enableDesktop)
bindToggle(showOnlineStatus)
bindToggle(showActivityStatus)

// ── AYARLARI YÜKLE ──
async function loadSettings() {
  try {
    const user    = auth.currentUser
    if (!user) return

    const userDoc  = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data()

    // Tema
    applyTheme(currentTheme)
    // Dil
    applyLanguage(currentLanguage)

    // Bildirimler
    if (userData.notifications) {
      if (!userData.notifications.enabled) enableNotifications.classList.remove("active")
      if (!userData.notifications.sound)   enableSound.classList.remove("active")
      if (!userData.notifications.desktop) enableDesktop.classList.remove("active")
    }

    // Gizlilik
    if (userData.privacy?.profileVisibility) profileVisibility.value = userData.privacy.profileVisibility
    if (userData.privacy?.showOnlineStatus   === false) showOnlineStatus.classList.remove("active")
    if (userData.privacy?.showActivityStatus === false) showActivityStatus.classList.remove("active")

  } catch (e) {
    console.error("Ayarları yükleme hatası:", e)
  }
}

// ── KAYDET ──
saveBtn.onclick = async () => {
  try {
    saveBtn.disabled = true
    saveBtn.innerHTML = '<span class="loading-spinner"></span>'
    successMsg.style.display = "none"
    errorMsg.style.display   = "none"

    const user    = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const privacy = userDoc.data()?.privacy || {}

    await updateDoc(doc(db, "users", user.uid), {
      notifications: {
        enabled: enableNotifications.classList.contains("active"),
        sound:   enableSound.classList.contains("active"),
        desktop: enableDesktop.classList.contains("active")
      },
      privacy: {
        ...privacy,
        profileVisibility:  profileVisibility.value,
        showOnlineStatus:   showOnlineStatus.classList.contains("active"),
        showActivityStatus: showActivityStatus.classList.contains("active")
      }
    })

    successMsg.style.display = "block"
    successMsg.innerText = translations[currentLanguage].saved
    showToast(translations[currentLanguage].saved, "success")
    setTimeout(() => { successMsg.style.display = "none" }, 3000)
  } catch (e) {
    errorMsg.style.display = "block"
    errorMsg.innerText = "Kaydetme başarısız oldu"
    showToast("Kaydetme başarısız oldu", "error")
  } finally {
    saveBtn.disabled  = false
    saveBtn.innerText = "💾 Kaydet"
  }
}

// ── SIFIRLA ──
resetBtn.onclick = () => {
  if (!confirm("Tüm ayarları sıfırlamak istediğinize emin misiniz?")) return
  applyTheme("dark")
  applyLanguage("tr")
  enableNotifications.classList.add("active")
  enableSound.classList.add("active")
  enableDesktop.classList.add("active")
  profileVisibility.value = "public"
  showOnlineStatus.classList.add("active")
  showActivityStatus.classList.add("active")
  showToast("Ayarlar sıfırlandı", "info")
}

// ── VERİ İNDİR ──
exportDataBtn.onclick = async () => {
  try {
    exportDataBtn.disabled = true
    const user    = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const { twoFactorSecret, backupCodes, ...exportData } = userDoc.data()
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const link = document.createElement("a")
    link.href     = URL.createObjectURL(blob)
    link.download = `chitchat-data-${Date.now()}.json`
    link.click()
    showToast("Verileriniz indirildi", "success")
  } catch (e) {
    showToast("İndirme başarısız oldu", "error")
  } finally {
    exportDataBtn.disabled = false
  }
}

// ── ÖNBELLEKTEN TEMİZLE ──
clearCacheBtn.onclick = () => {
  try {
    clearCacheBtn.disabled = true
    const keep = ["email", "nickname", "userNo", "theme", "language"]
    Object.keys(localStorage).forEach(k => { if (!keep.includes(k)) localStorage.removeItem(k) })
    sessionStorage.clear()
    showToast("Önbellek temizlendi", "success")
  } catch (e) {
    showToast("Temizleme başarısız", "error")
  } finally {
    clearCacheBtn.disabled = false
  }
}

// ── BAŞLAT ──
auth.onAuthStateChanged(user => {
  if (user) {
    loadSettings()
  } else {
    window.location.replace("login.html")
  }
})
