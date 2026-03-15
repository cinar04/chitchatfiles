import { db, auth } from "./firebase.js"
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const email = localStorage.getItem("email")

if (!email) {
  window.location.replace("login.html")
}

const searchInput = document.getElementById("searchInput")
const clearBtn = document.getElementById("clearBtn")
const resultsContainer = document.querySelector(".results-container")
const backBtn = document.getElementById("backBtn")
const profileModal = document.getElementById("profileModal")

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

// ── GERI DÖN ──
backBtn.onclick = () => {
  window.location.replace("index.html")
}

// ── CLEAR BUTTON ──
clearBtn.onclick = () => {
  searchInput.value = ""
  searchInput.focus()
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <p>Kullanıcı aramak için bir ad veya e-posta girin</p>
    </div>
  `
}

// ── KULLANICI ARAMASI ──
async function searchUsers(searchTerm) {
  if (!searchTerm.trim()) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>Kullanıcı aramak için bir ad veya e-posta girin</p>
      </div>
    `
    return
  }

  try {
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div class="loading-spinner"></div>
        <p style="color: #94a3b8; margin-top: 16px;">Aranıyor...</p>
      </div>
    `

    const searchLower = searchTerm.toLowerCase().trim()
    let results = []

    // Nickname ile ara
    if (searchTerm.match(/^[a-zA-Z0-9]/)) {
      const q1 = query(
        collection(db, "users"),
        limit(10)
      )
      const snap1 = await getDocs(q1)
      snap1.forEach(doc => {
        const data = doc.data()
        if (data.nickname && data.nickname.toLowerCase().includes(searchLower)) {
          results.push({ ...data, uid: doc.id })
        }
      })
    }

    // E-posta ile ara
    if (searchTerm.includes("@")) {
      const q2 = query(
        collection(db, "users"),
        where("email", "==", searchLower)
      )
      const snap2 = await getDocs(q2)
      snap2.forEach(doc => {
        if (!results.find(r => r.uid === doc.id)) {
          results.push({ ...doc.data(), uid: doc.id })
        }
      })
    }

    // Kullanıcı numarası ile ara
    if (searchTerm.match(/^[0-9]{6}$/)) {
      const userNo = parseInt(searchTerm)
      const q3 = query(
        collection(db, "users"),
        where("userNo", "==", userNo)
      )
      const snap3 = await getDocs(q3)
      snap3.forEach(doc => {
        if (!results.find(r => r.uid === doc.id)) {
          results.push({ ...doc.data(), uid: doc.id })
        }
      })
    }

    // Tüm kullanıcıları al ve nickname'de ara (fallback)
    if (results.length === 0) {
      const q4 = query(
        collection(db, "users"),
        limit(20)
      )
      const snap4 = await getDocs(q4)
      snap4.forEach(doc => {
        const data = doc.data()
        if (
          data.nickname?.toLowerCase().includes(searchLower) ||
          data.email?.toLowerCase().includes(searchLower)
        ) {
          results.push({ ...data, uid: doc.id })
        }
      })
    }

    // Kendiyi sonuçlardan çıkar
    results = results.filter(r => r.email !== email)

    // Sonuçları göster
    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <div style="font-size: 32px; margin-bottom: 12px;">😕</div>
          <p>Kullanıcı bulunamadı</p>
        </div>
      `
      return
    }

    resultsContainer.innerHTML = ""
    results.forEach(user => {
      const div = document.createElement("div")
      div.className = "user-card"
      div.onclick = () => showUserProfile(user)

      const avatarHtml = user.avatarUrl
        ? `<img src="${user.avatarUrl}" alt="avatar">`
        : "👤"

      const bio = user.bio || "Biyografi belirtilmemiş"
      const bioText = bio.length > 60 ? bio.substring(0, 60) + "..." : bio

      div.innerHTML = `
        <div class="user-avatar-small">
          ${avatarHtml}
        </div>
        <div class="user-info">
          <div class="user-name">${user.nickname || user.email.split("@")[0]}</div>
          <div class="user-email">${user.email}</div>
          <div class="user-bio">${bioText}</div>
          <div class="user-status">
            <span class="status-badge ${user.lastLogin ? '' : 'offline'}"></span>
            <span>${user.userNo ? `#${user.userNo}` : '#------'}</span>
          </div>
        </div>
      `
      resultsContainer.appendChild(div)
    })

  } catch (e) {
    console.error("Arama hatası:", e)
    resultsContainer.innerHTML = `
      <div class="no-results">
        <p style="color: #f87171;">Arama sırasında hata oluştu</p>
      </div>
    `
  }
}

// ── KULLANICI PROFİLİNİ GÖSTER ──
async function showUserProfile(userData) {
  const modal = document.getElementById("profileModal")
  const modalContent = modal.querySelector("div")

  const avatarHtml = userData.avatarUrl
    ? `<img src="${userData.avatarUrl}" alt="avatar" style="width: 100%; height: 100%; object-fit: cover;">`
    : "👤"

  const bioHtml = userData.bio
    ? `<p style="margin: 16px 0 0 0; color: #cbd5e1; font-size: 13px; line-height: 1.6;">${userData.bio}</p>`
    : ""

  const socialHtml = userData.social
    ? `
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #334155;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Sosyal Medya</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${userData.social.instagram ? `<a href="https://instagram.com/${userData.social.instagram}" target="_blank" style="color: #667eea; text-decoration: none; font-size: 13px;">📷 Instagram: @${userData.social.instagram}</a>` : ""}
          ${userData.social.twitter ? `<a href="https://twitter.com/${userData.social.twitter}" target="_blank" style="color: #667eea; text-decoration: none; font-size: 13px;">𝕏 Twitter: @${userData.social.twitter}</a>` : ""}
          ${userData.social.linkedin ? `<a href="https://linkedin.com/in/${userData.social.linkedin}" target="_blank" style="color: #667eea; text-decoration: none; font-size: 13px;">💼 LinkedIn: ${userData.social.linkedin}</a>` : ""}
        </div>
      </div>
    `
    : ""

  const joinedDate = userData.createdAt
    ? new Date(userData.createdAt).toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : "Belirtilmemiş"

  modalContent.innerHTML = `
    <div style="text-align: right; margin-bottom: 16px;">
      <button id="closeModalBtn" style="background: none; border: none; color: #e2e8f0; font-size: 24px; cursor: pointer;">✕</button>
    </div>

    <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 48px; overflow: hidden; margin: 0 auto 16px; border: 3px solid rgba(255, 255, 255, 0.2);">
      ${avatarHtml}
    </div>

    <h2 style="margin: 12px 0; text-align: center; font-size: 22px; font-weight: 600;">${userData.nickname || userData.email.split("@")[0]}</h2>
    <p style="text-align: center; color: #94a3b8; font-size: 13px; margin: 8px 0;">${userData.email}</p>
    <p style="text-align: center; color: #cbd5e1; font-size: 12px; margin: 0;">#${userData.userNo || "------"}</p>

    ${bioHtml}

    <div style="margin-top: 20px; padding: 16px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; border: 1px solid rgba(102, 126, 234, 0.2);">
      <div style="display: flex; justify-content: space-between; font-size: 13px; color: #cbd5e1; margin-bottom: 8px;">
        <span>Üyelik Tarihi</span>
        <span style="font-weight: 600;">${joinedDate}</span>
      </div>
    </div>

    ${socialHtml}

    <button id="messageUserBtn" style="width: 100%; padding: 12px; margin-top: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: opacity 0.3s ease;">
      💬 Mesaj Gönder
    </button>
  `

  document.getElementById("closeModalBtn").onclick = () => {
    modal.style.display = "none"
  }

  document.getElementById("messageUserBtn").onclick = () => {
    // Mesaj gönderme özelliği (future implementation)
    showToast("Yakında kullanılabilecek!", "info")
  }

  modal.style.display = "block"
}

// ── MODAL KAPATMA ──
profileModal.onclick = (e) => {
  if (e.target === profileModal) {
    profileModal.style.display = "none"
  }
}

// ── ARAMA EVENT LİSTENERLARI ──
let searchTimeout
searchInput.addEventListener("input", (e) => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    searchUsers(e.target.value)
  }, 300) // Debounce
})

// Enter tuşu ile arama
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchUsers(searchInput.value)
  }
})
