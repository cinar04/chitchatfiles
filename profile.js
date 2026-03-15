import { auth, db } from "./firebase.js"
import {
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const email = localStorage.getItem("email")

if (!email) {
  window.location.replace("login.html")
}

// ── CLOUDINARY AYARLARI ──
// Cloudinary Dashboard > Settings > Upload > Upload Presets kısmından unsigned preset oluştur
const CLOUDINARY_CLOUD_NAME    = "dj4urbprc"
const CLOUDINARY_UPLOAD_PRESET = "chitchat"

// ── DOM ELEMENTLERİ ──
const backBtn           = document.getElementById("backBtn")
const displayName       = document.getElementById("displayName")
const userEmail         = document.getElementById("userEmail")
const userNo            = document.getElementById("userNo")

const nicknameInput     = document.getElementById("nicknameInput")
const updateNicknameBtn = document.getElementById("updateNicknameBtn")
const cancelNicknameBtn = document.getElementById("cancelNicknameBtn")
const nicknameError     = document.getElementById("nicknameError")
const nicknameSuccess   = document.getElementById("nicknameSuccess")

const avatarContainer   = document.getElementById("avatarContainer")
const avatarFileInput   = document.getElementById("avatarFileInput")
const avatarPreview     = document.getElementById("avatarPreview")
const selectAvatarBtn   = document.getElementById("selectAvatarBtn")
const uploadAvatarBtn   = document.getElementById("uploadAvatarBtn")
const removeAvatarBtn   = document.getElementById("removeAvatarBtn")
const avatarError       = document.getElementById("avatarError")
const avatarSuccess     = document.getElementById("avatarSuccess")

const resetPasswordBtn  = document.getElementById("resetPasswordBtn")
const passwordError     = document.getElementById("passwordError")
const passwordSuccess   = document.getElementById("passwordSuccess")

const logoutBtn         = document.getElementById("logoutBtn")

const bioInput          = document.getElementById("bioInput")
const bioCount          = document.getElementById("bioCount")
const updateBioBtn      = document.getElementById("updateBioBtn")
const cancelBioBtn      = document.getElementById("cancelBioBtn")
const bioError          = document.getElementById("bioError")
const bioSuccess        = document.getElementById("bioSuccess")

const instagramInput    = document.getElementById("instagramInput")
const twitterInput      = document.getElementById("twitterInput")
const youtubeInput      = document.getElementById("youtubeInput")
const linkedinInput     = document.getElementById("linkedinInput")
const discordInput      = document.getElementById("discordInput")
const twitchInput       = document.getElementById("twitchInput")
const githubInput       = document.getElementById("githubInput")
const spotifyInput      = document.getElementById("spotifyInput")
const updateSocialBtn   = document.getElementById("updateSocialBtn")
const cancelSocialBtn   = document.getElementById("cancelSocialBtn")
const socialError       = document.getElementById("socialError")
const socialSuccess     = document.getElementById("socialSuccess")

const twoFactorBtn      = document.getElementById("twoFactorBtn")
const devicesBtn        = document.getElementById("devicesBtn")
const privacyBtn        = document.getElementById("privacyBtn")
const settingsBtn       = document.getElementById("settingsBtn")

let selectedAvatarFile  = null
let originalNickname    = ""
let currentPublicId     = ""  // Cloudinary'deki mevcut resmin public_id'si (silmek için)

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

function showError(element, msg) {
  element.innerText = msg
  element.style.display = "block"
  setTimeout(() => { element.style.display = "none"; element.innerText = "" }, 5000)
}

function showSuccess(element, msg) {
  element.innerText = msg
  element.style.display = "block"
  setTimeout(() => { element.style.display = "none"; element.innerText = "" }, 5000)
}

// ── AVATAR GÖRSELİNİ GÜNCELLE ──
function setAvatarImage(url) {
  const makeImg = () => {
    const img = document.createElement("img")
    img.src = url
    img.style.cssText = "width:100%;height:100%;object-fit:cover;"
    return img
  }
  avatarPreview.innerHTML = ""
  avatarPreview.appendChild(makeImg())
  avatarContainer.innerHTML = ""
  avatarContainer.appendChild(makeImg())
  avatarContainer.style.background = "none"
}

function resetAvatarUI() {
  avatarContainer.innerHTML = "👤"
  avatarContainer.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  avatarPreview.innerHTML = "👤"
  avatarPreview.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
}

// ── PROFİL YÜKLE ──
async function loadProfileInfo() {
  try {
    const user = auth.currentUser
    if (!user) { window.location.replace("login.html"); return }

    const userDoc = await getDoc(doc(db, "users", user.uid))
    if (!userDoc.exists()) return

    const userData = userDoc.data()
    originalNickname = userData.nickname || email.split("@")[0]
    currentPublicId  = userData.avatarPublicId || ""

    displayName.innerText = originalNickname
    userEmail.innerText   = email
    userNo.innerText      = `#${userData.userNo || "-----"}`
    nicknameInput.value   = originalNickname

    bioInput.value = userData.bio || ""
    updateBioCount()

    if (userData.social) {
      instagramInput.value = userData.social.instagram || ""
      twitterInput.value   = userData.social.twitter   || ""
      youtubeInput.value   = userData.social.youtube   || ""
      linkedinInput.value  = userData.social.linkedin  || ""
      discordInput.value   = userData.social.discord   || ""
      twitchInput.value    = userData.social.twitch    || ""
      githubInput.value    = userData.social.github    || ""
      spotifyInput.value   = userData.social.spotify   || ""
    }

    if (userData.avatarUrl) {
      setAvatarImage(userData.avatarUrl)
    }
  } catch (e) {
    console.error("Profil yükleme hatası:", e)
    showToast("Profil bilgileri yüklenemedi", "error")
  }
}

// ── NİCKNAME ──
updateNicknameBtn.onclick = async () => {
  const newNickname = nicknameInput.value.trim()
  if (!newNickname) { showError(nicknameError, "Kullanıcı adı boş olamaz"); return }
  if (newNickname.length < 2 || newNickname.length > 50) {
    showError(nicknameError, "Kullanıcı adı 2-50 karakter arasında olmalıdır"); return
  }
  try {
    updateNicknameBtn.disabled = true
    updateNicknameBtn.innerHTML = '<span class="loading-spinner"></span>'
    const user = auth.currentUser
    await updateProfile(user, { displayName: newNickname })
    await updateDoc(doc(db, "users", user.uid), { nickname: newNickname })
    localStorage.setItem("nickname", newNickname)
    displayName.innerText = newNickname
    originalNickname = newNickname
    showSuccess(nicknameSuccess, "Kullanıcı adı güncellendi!")
    showToast("Profil güncellendi", "success")
  } catch (e) {
    showError(nicknameError, "Güncelleme başarısız oldu")
  } finally {
    updateNicknameBtn.disabled = false
    updateNicknameBtn.innerText = "Kaydet"
  }
}

cancelNicknameBtn.onclick = () => { nicknameInput.value = originalNickname }

// ── AVATAR SEÇ ──
selectAvatarBtn.onclick = () => avatarFileInput.click()

avatarFileInput.onchange = (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (!["image/png", "image/jpeg"].includes(file.type)) {
    showError(avatarError, "Sadece PNG veya JPEG formatları desteklenir"); return
  }
  if (file.size > 5 * 1024 * 1024) {
    showError(avatarError, "Dosya boyutu maksimum 5MB olmalıdır"); return
  }

  selectedAvatarFile = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    const img = document.createElement("img")
    img.src = ev.target.result
    img.style.cssText = "width:100%;height:100%;object-fit:cover;"
    avatarPreview.innerHTML = ""
    avatarPreview.appendChild(img)
  }
  reader.readAsDataURL(file)
  uploadAvatarBtn.disabled = false
}

// ── AVATAR UPLOAD — Cloudinary ──
uploadAvatarBtn.onclick = async () => {
  if (!selectedAvatarFile) {
    showError(avatarError, "Lütfen önce bir dosya seçin"); return
  }

  try {
    uploadAvatarBtn.disabled = true
    uploadAvatarBtn.innerHTML = '<span class="loading-spinner"></span>'

    const user = auth.currentUser
    const formData = new FormData()
    formData.append("file", selectedAvatarFile)
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET)
    // Kullanıcıya özel sabit public_id → her yüklemede üzerine yazar
    formData.append("public_id", `avatars/${user.uid}`)
    formData.append("overwrite", "true")
    formData.append("invalidate", "true")  // CDN önbelleğini temizle

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: formData }
    )

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.error?.message || "Cloudinary yükleme hatası")
    }

    const data = await res.json()
    // Cache buster: Cloudinary aynı public_id'yi güncellediğinde tarayıcı önbelleği bozulmasın diye
    const avatarUrl = data.secure_url + "?v=" + Date.now()

    await updateDoc(doc(db, "users", user.uid), {
      avatarUrl:      data.secure_url,
      avatarPublicId: data.public_id
    })

    currentPublicId = data.public_id
    setAvatarImage(avatarUrl)

    showSuccess(avatarSuccess, "Profil fotoğrafı güncellendi!")
    showToast("Avatar yüklendi", "success")
    selectedAvatarFile = null
    uploadAvatarBtn.disabled = true
    uploadAvatarBtn.innerText = "Yükle"
    avatarFileInput.value = ""
  } catch (e) {
    console.error("Avatar upload hatası:", e)
    showError(avatarError, "Fotoğraf yükleme başarısız: " + e.message)
    uploadAvatarBtn.disabled = false
    uploadAvatarBtn.innerText = "Yükle"
  }
}

// ── AVATAR KALDIR ──
// Not: Cloudinary'den silmek için backend gerekir (API secret client'ta açık olmamalı).
// Burada sadece Firestore'dan temizliyoruz; Cloudinary'deki dosya kalır
// (üzerine yazılacağı için sorun olmaz).
removeAvatarBtn.onclick = async () => {
  try {
    removeAvatarBtn.disabled = true
    removeAvatarBtn.innerHTML = '<span class="loading-spinner"></span>'

    const user = auth.currentUser
    await updateDoc(doc(db, "users", user.uid), {
      avatarUrl:      "",
      avatarPublicId: ""
    })

    currentPublicId = ""
    resetAvatarUI()
    showSuccess(avatarSuccess, "Profil fotoğrafı kaldırıldı")
    showToast("Avatar kaldırıldı", "success")
  } catch (e) {
    console.error("Avatar kaldırma hatası:", e)
    showError(avatarError, "Avatar kaldırılamadı")
  } finally {
    removeAvatarBtn.disabled = false
    removeAvatarBtn.innerText = "Kaldır"
  }
}

// ── ŞİFRE SIFIRLAMA ──
resetPasswordBtn.onclick = async () => {
  try {
    resetPasswordBtn.disabled = true
    resetPasswordBtn.innerHTML = '<span class="loading-spinner"></span>'
    passwordError.style.display = "none"
    await sendPasswordResetEmail(auth, email)
    showSuccess(passwordSuccess, "Doğrulama e-postası gönderildi!")
    showToast("E-posta gönderildi", "success")
  } catch (e) {
    let msg = "E-posta gönderilemedi"
    if (e.code === "auth/user-not-found")    msg = "Bu e-posta ile kayıtlı kullanıcı yok"
    if (e.code === "auth/invalid-email")     msg = "Geçersiz e-posta formatı"
    if (e.code === "auth/too-many-requests") msg = "Çok fazla deneme. Biraz bekle"
    showError(passwordError, msg)
  } finally {
    resetPasswordBtn.disabled = false
    resetPasswordBtn.innerText = "Şifre Sıfırlama E-postası Gönder"
  }
}

// ── ÇIKIŞ ──
logoutBtn.onclick = async () => {
  try {
    await auth.signOut()
    localStorage.removeItem("email")
    localStorage.removeItem("nickname")
    localStorage.removeItem("userNo")
    window.location.replace("login.html")
  } catch (e) {
    showToast("Çıkış başarısız oldu", "error")
  }
}

backBtn.onclick = () => window.location.replace("index.html")

// ── BİYOGRAFİ ──
function updateBioCount() {
  const count = bioInput.value.length
  if (count > 200) { bioInput.value = bioInput.value.substring(0, 200) }
  bioCount.innerText = Math.min(count, 200)
}
bioInput.addEventListener("input", updateBioCount)

updateBioBtn.onclick = async () => {
  const newBio = bioInput.value.trim()
  if (newBio.length > 200) { showError(bioError, "Biyografi maksimum 200 karakter olmalıdır"); return }
  try {
    updateBioBtn.disabled = true
    updateBioBtn.innerHTML = '<span class="loading-spinner"></span>'
    await updateDoc(doc(db, "users", auth.currentUser.uid), { bio: newBio })
    showSuccess(bioSuccess, "Biyografi güncellendi!")
    showToast("Biyografi başarıyla kaydedildi", "success")
  } catch (e) {
    showError(bioError, "Güncelleme başarısız oldu")
  } finally {
    updateBioBtn.disabled = false
    updateBioBtn.innerText = "Kaydet"
  }
}

cancelBioBtn.onclick = async () => {
  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid))
  bioInput.value = userDoc.data()?.bio || ""
  updateBioCount()
}

// ── SOSYAL MEDYA ──
updateSocialBtn.onclick = async () => {
  const instagram = instagramInput.value.trim().replace("@", "")
  const twitter   = twitterInput.value.trim().replace("@", "")
  const youtube   = youtubeInput.value.trim().replace("@", "")
  const linkedin  = linkedinInput.value.trim().replace("in/", "")
  const discord   = discordInput.value.trim()
  const twitch    = twitchInput.value.trim()
  const github    = githubInput.value.trim()
  const spotify   = spotifyInput.value.trim()

  if (instagram && !instagram.match(/^[a-zA-Z0-9_.]{3,30}$/)) { showError(socialError, "Geçersiz Instagram kullanıcı adı"); return }
  if (twitter   && !twitter.match(/^[a-zA-Z0-9_]{3,15}$/))    { showError(socialError, "Geçersiz Twitter kullanıcı adı"); return }
  if (youtube   && !youtube.match(/^[a-zA-Z0-9_.\-]{3,50}$/)) { showError(socialError, "Geçersiz YouTube kanal adı"); return }
  if (linkedin  && !linkedin.match(/^[a-zA-Z0-9-]{2,30}$/))   { showError(socialError, "Geçersiz LinkedIn profil"); return }
  if (github    && !github.match(/^[a-zA-Z0-9_.\-]{2,39}$/))  { showError(socialError, "Geçersiz GitHub kullanıcı adı"); return }

  try {
    updateSocialBtn.disabled = true
    updateSocialBtn.innerHTML = '<span class="loading-spinner"></span>'
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      social: {
        instagram: instagram || "",
        twitter:   twitter   || "",
        youtube:   youtube   || "",
        linkedin:  linkedin  || "",
        discord:   discord   || "",
        twitch:    twitch    || "",
        github:    github    || "",
        spotify:   spotify   || ""
      }
    })
    showSuccess(socialSuccess, "Sosyal medya profilleri güncellendi!")
    showToast("Profilleriniz kaydedildi", "success")
  } catch (e) {
    showError(socialError, "Güncelleme başarısız oldu")
  } finally {
    updateSocialBtn.disabled = false
    updateSocialBtn.innerText = "Kaydet"
  }
}

cancelSocialBtn.onclick = async () => {
  const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid))
  const social  = userDoc.data()?.social || {}
  instagramInput.value = social.instagram || ""
  twitterInput.value   = social.twitter   || ""
  youtubeInput.value   = social.youtube   || ""
  linkedinInput.value  = social.linkedin  || ""
  discordInput.value   = social.discord   || ""
  twitchInput.value    = social.twitch    || ""
  githubInput.value    = social.github    || ""
  spotifyInput.value   = social.spotify   || ""
}

// ── NAVİGASYON ──
twoFactorBtn.onclick = () => window.location.replace("two-factor.html")
devicesBtn.onclick   = () => window.location.replace("devices.html")
privacyBtn.onclick   = () => window.location.replace("privacy.html")
settingsBtn.onclick  = () => window.location.replace("settings.html")

// ── BAŞLAT ──
auth.onAuthStateChanged((user) => {
  if (user) {
    loadProfileInfo()
  } else {
    window.location.replace("login.html")
  }
})
