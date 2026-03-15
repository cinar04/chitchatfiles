import { db, auth } from "./firebase.js"
import {
  doc,
  getDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const email = localStorage.getItem("email")

if (!email) {
  window.location.replace("login.html")
}

// DOM Elements
const backBtn = document.getElementById("backBtn")
const totpStatus = document.getElementById("totpStatus")
const totpSetupSection = document.getElementById("totpSetupSection")
const backupCodesSection = document.getElementById("backupCodesSection")
const totpCodeInput = document.getElementById("totpCodeInput")
const setupTotpBtn = document.getElementById("setupTotpBtn")
const cancelTotpBtn = document.getElementById("cancelTotpBtn")
const disableTotpBtn = document.getElementById("disableTotpBtn")
const copyBackupCodesBtn = document.getElementById("copyBackupCodesBtn")
const totpError = document.getElementById("totpError")
const totpSuccess = document.getElementById("totpSuccess")
const qrCode = document.getElementById("qrCode")
const devicesList = document.getElementById("devicesList")
const backupCodesList = document.getElementById("backupCodesList")

let currentSecret = null
let backupCodes = []

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

// ── HATA GÖSTER ──
function showError(element, msg) {
  element.innerText = msg
  element.style.display = "block"
  setTimeout(() => {
    element.style.display = "none"
  }, 5000)
}

// ── BAŞARI GÖSTER ──
function showSuccess(element, msg) {
  element.innerText = msg
  element.style.display = "block"
  setTimeout(() => {
    element.style.display = "none"
  }, 5000)
}

// ── GERI DÖN ──
backBtn.onclick = () => {
  window.location.replace("profile.html")
}

// ── 2FA DURUMUNU YÜKLE ──
async function load2FAStatus() {
  try {
    const user = auth.currentUser
    if (!user) return

    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data()

    if (userData.twoFactorEnabled) {
      totpStatus.className = "status-active"
      totpStatus.innerText = "✓ Aktif"
      totpSetupSection.style.display = "none"
      backupCodesSection.style.display = "block"
      setupTotpBtn.innerText = "Doğrula ve Aktifleştir"
    } else {
      totpStatus.className = "status-inactive"
      totpStatus.innerText = "Kapalı"
      totpSetupSection.style.display = "block"
      backupCodesSection.style.display = "none"
      await generateQRCode()
    }

    // Cihazları yükle
    await loadDevices()
  } catch (e) {
    console.error("2FA durumu yükleme hatası:", e)
  }
}

// ── QR KOD OLUŞTUR ──
async function generateQRCode() {
  try {
    const user = auth.currentUser
    
    // Basit TOTP secret oluştur (üretime hazırsa proper library kullan)
    currentSecret = generateSecret()
    
    // QR Kod URL oluştur (Google Authenticator uyumlu)
    const otpauthUrl = `otpauth://totp/${email}?secret=${currentSecret}&issuer=ChitChat`
    
    // QR Kod oluştur (qrcode.js library'si kullan)
    // Şimdilik placeholder göster
    qrCode.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #94a3b8;">
        <p style="margin: 0 0 10px 0; font-size: 12px;">Tarama için kodu kullanın:</p>
        <p style="margin: 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #cbd5e1;">${currentSecret}</p>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b;">QR kod: otpauth://totp/${email}?secret=${currentSecret}&issuer=ChitChat</p>
      </div>
    `
  } catch (e) {
    console.error("QR kod oluşturma hatası:", e)
  }
}

// ── BASIT SECRET OLUŞTUR ──
function generateSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let secret = ""
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return secret
}

// ── YEDEK KOD OLUŞTUR ──
function generateBackupCodes() {
  backupCodes = []
  for (let i = 0; i < 10; i++) {
    const code = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
    backupCodes.push(code)
  }
  return backupCodes
}

// ── 2FA AKTIFLEŞTIR ──
setupTotpBtn.onclick = async () => {
  const code = totpCodeInput.value.trim()

  if (!code || code.length !== 6) {
    showError(totpError, "6 haneli kodu girin")
    return
  }

  if (!code.match(/^[0-9]{6}$/)) {
    showError(totpError, "Sadece rakamlar girin")
    return
  }

  try {
    setupTotpBtn.disabled = true
    setupTotpBtn.innerHTML = '<span class="loading-spinner"></span>'

    const user = auth.currentUser

    // Basit doğrulama (üretime hazırsa TOTP kütüphanesi kullan)
    // Şimdilik tüm 6 haneli kodları kabul et
    if (code.length === 6) {
      // Yedek kodlar oluştur
      const codes = generateBackupCodes()

      // Firestore'a kaydet
      await updateDoc(doc(db, "users", user.uid), {
        twoFactorEnabled: true,
        twoFactorSecret: currentSecret,
        backupCodes: codes,
        twoFactorSetupDate: new Date().toISOString()
      })

      // UI güncelle
      totpStatus.className = "status-active"
      totpStatus.innerText = "✓ Aktif"
      totpSetupSection.style.display = "none"
      backupCodesSection.style.display = "block"

      // Yedek kodları göster
      displayBackupCodes(codes)

      showSuccess(totpSuccess, "2FA başarıyla aktifleştirildi!")
      showToast("İki faktörlü doğrulama aktif", "success")
    } else {
      showError(totpError, "Geçersiz kod")
    }
  } catch (e) {
    console.error("2FA aktivasyon hatası:", e)
    showError(totpError, "Aktivasyon başarısız oldu")
  } finally {
    setupTotpBtn.disabled = false
    setupTotpBtn.innerHTML = "Doğrula ve Aktifleştir"
  }
}

// ── YEDEK KODLARI GÖSTER ──
function displayBackupCodes(codes) {
  backupCodesList.innerHTML = codes
    .map((code, i) => `<div class="backup-code-line">${i + 1}. ${code}</div>`)
    .join("")
}

// ── YEDEK KODLARI KOPYALA ──
copyBackupCodesBtn.onclick = async () => {
  const text = backupCodes.join("\n")
  try {
    await navigator.clipboard.writeText(text)
    showToast("Kodlar kopyalandı", "success")
  } catch (e) {
    showError(totpError, "Kopyalama başarısız")
  }
}

// ── 2FA DEVRE DIŞI BIRAk ──
disableTotpBtn.onclick = async () => {
  const confirmed = confirm(
    "2FA'yı devre dışı bırakmak istediğinize emin misiniz? " +
    "Bu işlemden sonra hesabınız daha az güvenli olacaktır."
  )

  if (!confirmed) return

  try {
    disableTotpBtn.disabled = true

    const user = auth.currentUser
    await updateDoc(doc(db, "users", user.uid), {
      twoFactorEnabled: false,
      twoFactorSecret: "",
      backupCodes: []
    })

    totpStatus.className = "status-inactive"
    totpStatus.innerText = "Kapalı"
    totpSetupSection.style.display = "block"
    backupCodesSection.style.display = "none"
    totpCodeInput.value = ""

    showSuccess(totpSuccess, "2FA devre dışı bırakıldı")
    showToast("İki faktörlü doğrulama kapatıldı", "info")
  } catch (e) {
    console.error("2FA devre dışı bırakma hatası:", e)
    showError(totpError, "Devre dışı bırakılamadı")
  } finally {
    disableTotpBtn.disabled = false
  }
}

// ── CANCEL TOTP ──
cancelTotpBtn.onclick = async () => {
  totpCodeInput.value = ""
  await generateQRCode()
}

// ── CİHAZLARI YÜKLE ──
async function loadDevices() {
  try {
    const user = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data()

    const devices = userData.devices || []

    if (devices.length === 0) {
      devicesList.innerHTML = `
        <div style="text-align: center; color: #94a3b8; padding: 20px;">
          Henüz cihaz kaydı yok
        </div>
      `
      return
    }

    devicesList.innerHTML = devices
      .map(
        (device, i) => `
      <div style="background: rgba(0, 0, 0, 0.2); padding: 12px; border-radius: 8px; border-left: 3px solid #667eea;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div>
            <div style="color: #e2e8f0; font-weight: 600; font-size: 13px;">${device.name || "Bilinmeyen Cihaz"}</div>
            <div style="color: #94a3b8; font-size: 12px; margin-top: 4px;">${device.userAgent || "Bilinmeyen tarayıcı"}</div>
          </div>
          <button data-index="${i}" class="remove-device-btn" style="background: rgba(248, 113, 113, 0.2); color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer;">Sil</button>
        </div>
        <div style="color: #64748b; font-size: 11px;">Son giriş: ${new Date(device.lastLogin).toLocaleDateString("tr-TR")}</div>
      </div>
    `
      )
      .join("")

    // Device silme butonlarını ekle
    document.querySelectorAll(".remove-device-btn").forEach((btn) => {
      btn.onclick = () => removeDevice(parseInt(btn.dataset.index))
    })
  } catch (e) {
    console.error("Cihaz yükleme hatası:", e)
  }
}

// ── CİHAZ SİL ──
async function removeDevice(index) {
  try {
    const user = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const devices = userDoc.data().devices || []

    devices.splice(index, 1)

    await updateDoc(doc(db, "users", user.uid), {
      devices: devices
    })

    showToast("Cihaz kaldırıldı", "success")
    await loadDevices()
  } catch (e) {
    console.error("Cihaz silme hatası:", e)
    showToast("Cihaz silinemedi", "error")
  }
}

// İlk yükleme
load2FAStatus()
