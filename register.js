import { auth, db } from "./firebase.js"

import {
createUserWithEmailAndPassword,
sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"

import {
doc,
setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

const btn = document.getElementById("registerBtn")

btn.onclick = async () => {

const nickname = document.getElementById("nickname").value.trim()
const email = document.getElementById("email").value.trim()
const password = document.getElementById("password").value.trim()

if(!nickname || !email || !password){
alert("Bilgileri doldur")
return
}

try{

const cred = await createUserWithEmailAndPassword(auth,email,password)

await sendEmailVerification(cred.user)

const userNo = Math.floor(Math.random()*900000)+100000

await setDoc(doc(db,"users",cred.user.uid),{

nickname:nickname,
email:email,
userNo:userNo,
createdAt:Date.now()

})

alert("Doğrulama emaili gönderildi!")

location.href="login.html"

}catch(e){

alert(e.message)

}

}