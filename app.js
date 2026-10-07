import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { firebaseConfig, FIREBASE_ENABLED } from "./firebase-config.js";

const baseProposals = [
["01","Derechos","Actualizar y mejorar el Estatuto del Centro","Actualizar y mejorar el Estatuto del Centro para que todas y todos tengamos acceso al mismo y podamos conocer y hacer cumplir nuestros derechos.", 24],
["02","Participación","Eventos periódicos para el alumnado","Hacer eventos de manera periódica: torneos en entreturnos, actividades deportivas, ferias y otras propuestas, tanto dentro como fuera del colegio cuando sea posible.", 57],
["03","Escuela","Reacondicionar la escuela","Pintar aulas, marcos de puertas y ventanas y reacondicionar todo lo que sea posible utilizando el dinero recaudado.", 21],
["04","Participación","Intervenir en la Fiesta de Educación Física","Intervenir directamente en la Fiesta de Educación Física para hacerla más amena, dinámica y participativa.", 69],
["05","Escuela","Arreglar puertas de las aulas","Comprar y arreglar las manijas y trabas de las puertas de las aulas.", 45],
["06","Transparencia","Comunicar todo lo que hacemos","Comunicar de forma clara y constante las actividades, decisiones y resultados del Centro para ser 100% transparentes.", 63],
["07","Transparencia","Organización de actas, notas, ingresos y gastos","Organizar actas, notas, ingresos y gastos para evitar problemas y permitir el acceso a cualquier movimiento que se dé.", 30],
["08","Participación","Facilitar el contacto con el Centro","Hacer más fácil el contacto de todo el alumnado mediante página web, mail dedicado, Instagram, números de teléfono y presencia directa cuando se necesite.", 20],
["09","Cooperación","Cooperar con otros Centros de Estudiantes","Trabajar con otros CdEs para encontrar soluciones más rápido y lograr conquistas más grandes para nosotros y para otros estudiantes.", 17],
["10","Compromiso","Dejar la escuela mejor que como la encontramos","Dar todo de nosotros y aprovechar todo lo que podamos para dejar la escuela mejor que como la encontramos.", 54]
];

let proposals = baseProposals.map(x=>({id:"p"+x[0],num:x[0],cat:x[1],title:x[2],text:x[3],likes:x[4],comments:[]}));
let user=null, db=null, auth=null;
let localLikes=JSON.parse(localStorage.getItem("ajtt_likes_v2")||"{}");

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function openModal(id){$("#"+id).classList.remove("hidden")}
function closeModal(id){$("#"+id).classList.add("hidden")}
function requireLogin(action){if(user){action();return} sessionStorage.setItem("afterLoginAction",action.name||"");openModal("authModal")}

function render(){
 const q=$("#search").value.toLowerCase().trim(), cat=document.querySelector(".filter.active")?.dataset.cat\vert{}\vert{}"todas", sort=$("#sort").value;
 let arr=proposals.filter(p=>(cat==="todas"||p.cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")===cat)&&(p.title+" "+p.text).toLowerCase().includes(q));
 if(sort==="likes")arr.sort((a,b)=>b.likes-a.likes); if(sort==="titulo")arr.sort((a,b)=>a.title.localeCompare(b.title));
 
 $("#proposalGrid").innerHTML=arr.map(p=>{
   const isLiked = localLikes[p.id] ? "liked" : "";
   const commentsList = p.comments.length 
     ? p.comments.map(c=>`<div class="comment"><b>${esc(c.name||"Estudiante")}</b><small>${esc(c.type)} · ${esc(c.text)}</small></div>`).join("") 
     : "<small>Aún no hay aportes. Sé la primera persona en participar.</small>";

   return `<article class="proposal" data-id="${p.id}">
     <span class="num">${p.num} / ${p.cat}</span>
     <h3>${esc(p.title)}</h3>
     <p>${esc(p.text)}</p>
     <span class="tag">${p.cat}</span>
     <div class="proposalFooter">
       <button class="actionBtn likeBtn ${isLiked}" data-like="${p.id}">♥ <span>${p.likes}</span> Apoyar</button>
       <button class="actionBtn commentBtn" data-comment="${p.id}">💬 <span>${p.comments.length}</span> Comentarios</button>
     </div>
     <div class="comments" id="comments-${p.id}">${commentsList}</div>
   </article>`;
 }).join("");

 $$(".likeBtn").forEach(b=>b.onclick=()=>requireLogin(()=>like(b.dataset.like)));  $$
(".commentBtn").forEach(b=>b.onclick=()=>{const c=$("#comments-"+b.dataset.comment);c.classList.toggle("open"); if(c.classList.contains("open")) requireLogin(()=>{}); if(user) openComment(b.dataset.comment)});
}

function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function like(id){
 const p=proposals.find(x=>x.id===id); if(!p)return;
 if(localLikes[id]){toast("Ya apoyaste esta propuesta.");return}
 localLikes[id]=true;localStorage.setItem("ajtt_likes_v2",JSON.stringify(localLikes));p.likes++;
 if(FIREBASE_ENABLED&&db) await setDoc(doc(db,"proposals",id),{likes:p.likes},{merge:true}).catch(()=>{});
 render();toast("Tu apoyo quedó registrado.");
}

function openComment(id){$("#commentTitle").textContent="Aportar a la propuesta";$("#commentContext").textContent=proposals.find(p=>p.id===id)?.title\vert{}\vert{}"";$("#commentForm").dataset.id=id;openModal("commentModal")}

async function submitComment(e){
 e.preventDefault();if(!user){closeModal("commentModal");openModal("authModal");return}
 const id=e.currentTarget.dataset.id,text=$("#commentText").value.trim(),type=$("#commentType").value;if(!text)return;
 const c={name:user.displayName||"Estudiante",type,text};
 const p=proposals.find(x=>x.id===id);p.comments.push(c);
 if(FIREBASE_ENABLED&&db) await addDoc(collection(db,"proposals",id,"comments"),{...c,uid:user.uid,createdAt:serverTimestamp()}).catch(()=>{});
 e.currentTarget.reset();$("#counter").textContent="0 / 1000";closeModal("commentModal");render();toast("Aporte publicado.");
}

function newProposal(){
 requireLogin(()=>openModal("newProposalModal"));
}

async function submitProposal(e){
 e.preventDefault();if(!user){closeModal("newProposalModal");openModal("authModal");return}
 const title=$("#newTitle").value.trim(),text=$("#newText").value.trim(),cat=$("#newCategory").value;if(!title||!text)return;
 if(FIREBASE_ENABLED&&db) await addDoc(collection(db,"pendingProposals"),{title,text,cat,uid:user.uid,name:user.displayName||"Estudiante",createdAt:serverTimestamp(),status:"pendiente"});
 closeModal("newProposalModal");e.currentTarget.reset();toast("Propuesta enviada para revisión."); 
}

async function login(){
 if(!FIREBASE_ENABLED){toast("Primero configurá Firebase para activar Google.");return}
 try{const provider=new GoogleAuthProvider();await signInWithPopup(auth,provider);closeModal("authModal");toast("Sesión iniciada. Ahora podés participar.");}catch(e){toast("No se pudo iniciar sesión con Google.");console.error(e)}
}

function setup(){
 $("#accountBtn").onclick=()=>user?signOut(auth):openModal("authModal");
 $("#participateBtn").onclick=()=>openModal("authModal");
 $("#newProposalBtn").onclick=newProposal;$("#googleBtn").onclick=login;
 $("#commentForm").onsubmit=submitComment;$("#newProposalForm").onsubmit=submitProposal;
 $("#commentText").oninput=e=>$("#counter").textContent=`${e.target.value.length} / 1000`;
 $("#search").oninput=render;$("#sort").onchange=render;  $$(".filter").forEach(b=>b.onclick=()=>{$$(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render()});  $$("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
 $("#themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("ajtt_dark",document.body.classList.contains("dark"))};
 if(localStorage.getItem("ajtt_dark")==="true")document.body.classList.add("dark");
 render();
}

async function initFirebase(){
 if(!FIREBASE_ENABLED)return;
 try{
  const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);
  onAuthStateChanged(auth,u=>{user=u;$("#accountBtn").textContent=u?`✓ ${u.displayName||"Cuenta"}`:"Iniciar sesión";});
 }catch(e){console.error(e);toast("Firebase todavía no está configurado.")}
}

setup();initFirebase();
