import { db, auth } from "./firebase.js"
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const email = localStorage.getItem("email")

if (!email) {
  window.location.replace("login.html")
}

// DOM Elements
const backBtn = document.getElementById("backBtn")
const profileVisibility = document.getElementById("profileVisibility")
const showLastSeen = document.getElementById("showLastSeen")
const showOnline = document.getElementById("showOnline")
const showTyping = document.getElementById("showTyping")
const showReadReceipts = document.getElementById("showReadReceipts")
const disableForward = document.getElementById("disableForward")
const messageRetention = document.getElementById("messageRetention")
const blockedUsersList = document.getElementById("blockedUsersList")
const blockUserEmail = document.getElementById("blockUserEmail")
const blockUserBtn = document.getElementById("blockUserBtn")
const saveBtn = document.getElementById("saveBtn")
const blockSuccess = document.getElementById("blockSuccess")
const blockError = document.getElementById("blockError")

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

// ── TOGGLE SWITCH KONTROLÜ ──
function createToggleListener(element) {
  return () => {
    element.classList.toggle("active")
  }
}

// Toggle listeners
showLastSeen.onclick = createToggleListener(showLastSeen)
showOnline.onclick = createToggleListener(showOnline)
showTyping.onclick = createToggleListener(showTyping)
showReadReceipts.onclick = createToggleListener(showReadReceipts)
disableForward.onclick = createToggleListener(disableForward)

// ── GERI DÖN ──
backBtn.onclick = () => {
  window.location.replace("profile.html")
}

// ── GİZLİLİK AYARLARINI YÜKLE ──
async function loadPrivacySettings() {
  try {
    const user = auth.currentUser
    if (!user) return

    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data()

    // Profil gizliliği
    if (userData.privacy?.profileVisibility) {
      profileVisibility.value = userData.privacy.profileVisibility
    }

    // Çevrimiçi durumu
    if (userData.privacy?.showLastSeen === false) {
      showLastSeen.classList.remove("active")
    }
    if (userData.privacy?.showOnline === false) {
      showOnline.classList.remove("active")
    }
    if (userData.privacy?.showTyping === false) {
      showTyping.classList.remove("active")
    }

    // Mesaj gizliliği
    if (userData.privacy?.showReadReceipts === false) {
      showReadReceipts.classList.remove("active")
    }
    if (userData.privacy?.disableForward === true) {
      disableForward.classList.add("active")
    }
    if (userData.privacy?.messageRetention) {
      messageRetention.value = userData.privacy.messageRetention
    }

    // Engellenenler listesi
    await loadBlockedUsers(userData.blockedUsers || [])
  } catch (e) {
    console.error("Gizlilik ayarları yükleme hatası:", e)
  }
}

// ── ENGELLENEN KULLANICI LISTESINI YÜKLE ──
async function loadBlockedUsers(blockedUsers) {
  if (!blockedUsers || blockedUsers.length === 0) {
    blockedUsersList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <p>Engellenen kullanıcı yok</p>
      </div>
    `
    return
  }

  blockedUsersList.innerHTML = ""

  blockedUsers.forEach((blockedUser) => {
    const div = document.createElement("div")
    div.className = "blocked-user"

    const blockDate = new Date(blockedUser.blockedAt).toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })

    div.innerHTML = `
      <div class="blocked-user-info">
        <div class="blocked-user-avatar">
          ${blockedUser.avatarUrl ? `<img src="${blockedUser.avatarUrl}" alt="avatar">` : "👤"}
        </div>
        <div class="blocked-user-details">
          <div class="blocked-user-name">${blockedUser.nickname || blockedUser.email.split("@")[0]}</div>
          <div class="blocked-user-email">${blockedUser.email}</div>
          <div class="blocked-user-date">${blockDate}'de engellendi</div>
        </div>
      </div>
      <button class="btn-unblock" data-email="${blockedUser.email}">Engeli Kaldır</button>
    `
    blockedUsersList.appendChild(div)
  })

  // Engeli kaldırma butonları
  document.querySelectorAll(".btn-unblock").forEach((btn) => {
    btn.onclick = (e) => {
      const blockedEmail = e.target.dataset.email
      unblockUser(blockedEmail)
    }
  })
}

// ── KULLANICI ENGELLE ──
blockUserBtn.onclick = async () => {
  const blockedEmail = blockUserEmail.value.trim().toLowerCase()

  if (!blockedEmail) {
    showToast("E-posta adresi girin", "error")
    return
  }

  if (!blockedEmail.includes("@")) {
    showToast("Geçersiz e-posta adresi", "error")
    return
  }

  if (blockedEmail === email) {
    showToast("Kendinizi engelleyemezsiniz", "error")
    return
  }

  try {
    blockUserBtn.disabled = true

    const user = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const userData = userDoc.data()
    const blockedUsers = userData.blockedUsers || []

    // Zaten engellendi mi kontrol et
    if (blockedUsers.find((u) => u.email === blockedEmail)) {
      showToast("Bu kullanıcı zaten engellendi", "error")
      return
    }

    // Engellenen kullanıcının bilgilerini al
    const blockedUserQuery = query(
      collection(db, "users"),
      where("email", "==", blockedEmail)
    )
    const blockedUserSnap = await getDocs(blockedUserQuery)

    if (blockedUserSnap.empty) {
      showToast("Kullanıcı bulunamadı", "error")
      return
    }

    const blockedUserData = blockedUserSnap.docs[0].data()

    const newBlockedUser = {
      email: blockedEmail,
      nickname: blockedUserData.nickname,
      avatarUrl: blockedUserData.avatarUrl,
      blockedAt: new Date().toISOString()
    }

    await updateDoc(doc(db, "users", user.uid), {
      blockedUsers: arrayUnion(newBlockedUser)
    })

    blockUserEmail.value = ""
    showToast(`${blockedEmail} engellendi`, "success")
    await loadBlockedUsers([...blockedUsers, newBlockedUser])
  } catch (e) {
    console.error("Engelleme hatası:", e)
    showToast("Engelleme başarısız oldu", "error")
  } finally {
    blockUserBtn.disabled = false
  }
}

// ── ENGEL KALDIR ──
async function unblockUser(blockedEmail) {
  try {
    const user = auth.currentUser
    const userDoc = await getDoc(doc(db, "users", user.uid))
    const blockedUsers = userDoc.data().blockedUsers || []

    const blockedUser = blockedUsers.find((u) => u.email === blockedEmail)

    if (blockedUser) {
      await updateDoc(doc(db, "users", user.uid), {
        blockedUsers: arrayRemove(blockedUser)
      })

      showToast(`${blockedEmail}'nin engeli kaldırıldı`, "success")
      await loadBlockedUsers(blockedUsers.filter((u) => u.email !== blockedEmail))
    }
  } catch (e) {
    console.error("Engel kaldırma hatası:", e)
    showToast("İşlem başarısız oldu", "error")
  }
}

// ── GİZLİLİK AYARLARINI KAYDET ──
saveBtn.onclick = async () => {
  try {
    saveBtn.disabled = true
    saveBtn.innerHTML = '<span class="loading-spinner"></span>'

    const user = auth.currentUser

    const privacySettings = {
      profileVisibility: profileVisibility.value,
      showLastSeen: showLastSeen.classList.contains("active"),
      showOnline: showOnline.classList.contains("active"),
      showTyping: showTyping.classList.contains("active"),
      showReadReceipts: showReadReceipts.classList.contains("active"),
      disableForward: disableForward.classList.contains("active"),
      messageRetention: messageRetention.value
    }

    await updateDoc(doc(db, "users", user.uid), {
      privacy: privacySettings
    })

    showToast("Gizlilik ayarları kaydedildi", "success")
  } catch (e) {
    console.error("Kaydetme hatası:", e)
    showToast("Kaydetme başarısız oldu", "error")
  } finally {
    saveBtn.disabled = false
    saveBtn.innerText = "💾 Kaydet"
  }
}

// İlk yükleme
loadPrivacySettings()
