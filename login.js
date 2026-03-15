import { auth, db } from "./firebase.js"

import {
signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"

import {
doc,
getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

document.getElementById("loginBtn").onclick = async () => {

const email=document.getElementById("email").value.trim()
const password=document.getElementById("password").value.trim()

if(!email||!password){
document.getElementById("error").innerText="Bilgileri doldur!"
return
}

try{

const cred=await signInWithEmailAndPassword(auth,email,password)

if(!cred.user.emailVerified){
document.getElementById("error").innerText="Önce email doğrula!"
return
}

const snap=await getDoc(doc(db,"users",cred.user.uid))

const user=snap.data()

localStorage.setItem("nickname",user.nickname)
localStorage.setItem("userNo",user.userNo)

window.location.href="index.html"

}catch(e){

document.getElementById("error").innerText="Giriş hatası"

}

}