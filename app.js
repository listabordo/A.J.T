import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

import { firebaseConfig, FIREBASE_ENABLED } from "./firebase-config.js";


// ============================================================
// NÚMERO INICIAL DE APOYOS DE CADA PROPUESTA
// ============================================================

const customLikes = {
  "01": 24,
  "02": 27,
  "03": 21,
  "04": 69,
  "05": 45,
  "06": 63,
  "07": 30,
  "08": 20,
  "09": 17,
  "10": 54
};


// ============================================================
// PROPUESTAS
// ============================================================

const baseProposals = [
  [
    "01",
    "Derechos",
    "Actualizar y mejorar el Estatuto del Centro",
    "Actualizar y mejorar el Estatuto del Centro para que todas y todos tengamos acceso al mismo y podamos conocer y hacer cumplir nuestros derechos."
  ],
  [
    "02",
    "Participación",
    "Eventos periódicos para el alumnado",
    "Hacer eventos de manera periódica: torneos en entreturnos, actividades deportivas, ferias y otras propuestas, tanto dentro como fuera del colegio cuando sea posible."
  ],
  [
    "03",
    "Escuela",
    "Reacondicionar la escuela",
    "Pintar aulas, marcos de puertas y ventanas y reacondicionar todo lo que sea posible utilizando el dinero recaudado."
  ],
  [
    "04",
    "Participación",
    "Intervenir en la Fiesta de Educación Física",
    "Intervenir directamente en la Fiesta de Educación Física para hacerla más amena, dinámica y participativa."
  ],
  [
    "05",
    "Escuela",
    "Arreglar puertas de las aulas",
    "Comprar y arreglar las manijas y trabas de las puertas de las aulas."
  ],
  [
    "06",
    "Transparencia",
    "Comunicar todo lo que hacemos",
    "Comunicar de forma clara y constante las actividades, decisiones y resultados del Centro para ser 100% transparentes."
  ],
  [
    "07",
    "Transparencia",
    "Organización de actas, notas, ingresos y gastos",
    "Organizar actas, notas, ingresos y gastos para evitar problemas y permitir el acceso a cualquier movimiento que se dé."
  ],
  [
    "08",
    "Participación",
    "Facilitar el contacto con el Centro",
    "Hacer más fácil el contacto de todo el alumnado mediante página web, mail dedicado, Instagram, números de teléfono y presencia directa cuando se necesite."
  ],
  [
    "09",
    "Cooperación",
    "Cooperar con otros Centros de Estudiantes",
    "Trabajar con otros CdEs para encontrar soluciones más rápido y lograr conquistas más grandes para nosotros y para otros estudiantes."
  ],
  [
    "10",
    "Compromiso",
    "Dejar la escuela mejor que como la encontramos",
    "Dar todo de nosotros y aprovechar todo lo que podamos para dejar la escuela mejor que como la encontramos."
  ]
];


// ============================================================
// VARIABLES
// ============================================================

let proposals = baseProposals.map(x => ({
  id: "p" + x[0],
  num: x[0],
  cat: x[1],
  title: x[2],
  text: x[3],
  likes: customLikes[x[0]] || 0,
  comments: []
}));

let user = null;
let db = null;
let auth = null;


// ============================================================
// LIKES GUARDADOS LOCALMENTE
// ============================================================

let localLikes = JSON.parse(
  localStorage.getItem("ajtt_likes_v3") || "{}"
);


// ============================================================
// UTILIDADES
// ============================================================

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function toast(t) {
  const el = $("#toast");

  if (!el) return;

  el.textContent = t;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2800);
}

function openModal(id) {
  const el = $("#" + id);

  if (el) {
    el.classList.remove("hidden");
  }
}

function closeModal(id) {
  const el = $("#" + id);

  if (el) {
    el.classList.add("hidden");
  }
}

function requireLogin(action) {
  if (user) {
    action();
    return;
  }

  sessionStorage.setItem(
    "afterLoginAction",
    action.name || ""
  );

  openModal("authModal");
}

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );
}


// ============================================================
// RENDERIZAR PROPUESTAS
// ============================================================

function render() {
  const searchEl = $("#search");
  const sortEl = $("#sort");
  const gridEl = $("#proposalGrid");

  if (!gridEl) return;

  const q = searchEl
    ? searchEl.value.toLowerCase().trim()
    : "";

  const activeFilter = document.querySelector(".filter.active");

  const cat = activeFilter?.dataset.cat || "todas";

  const sort = sortEl ? sortEl.value : "";


  let arr = proposals.filter(p => {

    const normalizedCategory = p.cat
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const categoryMatches =
      cat === "todas" ||
      normalizedCategory === cat;

    const searchMatches =
      (p.title + " " + p.text)
        .toLowerCase()
        .includes(q);

    return categoryMatches && searchMatches;
  });


  if (sort === "likes") {
    arr.sort((a, b) => b.likes - a.likes);
  }

  if (sort === "titulo") {
    arr.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  }


  gridEl.innerHTML = arr.map(p => {

    const isLiked = localLikes[p.id]
      ? "liked"
      : "";

    const commentsList = p.comments.length
      ? p.comments.map(c => `
          <div class="comment">
            <b>${esc(c.name || "Estudiante")}</b>
            <small>${esc(c.type)} · ${esc(c.text)}</small>
          </div>
        `).join("")
      : `
        <small>
          Aún no hay aportes. Sé la primera persona en participar.
        </small>
      `;


    return `
      <article class="proposal" data-id="${p.id}">

        <span class="num">
          ${p.num} / ${esc(p.cat)}
        </span>

        <h3>${esc(p.title)}</h3>

        <p>${esc(p.text)}</p>

        <span class="tag">
          ${esc(p.cat)}
        </span>

        <div class="proposalFooter">

          <button
            class="actionBtn likeBtn ${isLiked}"
            data-like="${p.id}"
          >
            ♥
            <span>${p.likes}</span>
            Apoyar
          </button>


          <button
            class="actionBtn commentBtn"
            data-comment="${p.id}"
          >
            💬
            <span>${p.comments.length}</span>
            Comentarios
          </button>

        </div>


        <div
          class="comments"
          id="comments-${p.id}"
        >
          ${commentsList}
        </div>

      </article>
    `;

  }).join("");


  // ==========================================================
  // BOTONES DE APOYAR
  // ==========================================================

  $$(".likeBtn").forEach(b => {

    b.onclick = () => {
      requireLogin(() => like(b.dataset.like));
    };

  });


  // ==========================================================
  // BOTONES DE COMENTARIOS
  // ==========================================================

  $$(".commentBtn").forEach(b => {

    b.onclick = () => {

      const c = $("#comments-" + b.dataset.comment);

      if (c) {
        c.classList.toggle("open");
      }

      requireLogin(() => {
        openComment(b.dataset.comment);
      });

    };

  });

}


// ============================================================
// LIKE / APOYO
// ============================================================

async function like(id) {

  const p = proposals.find(x => x.id === id);

  if (!p) return;


  if (localLikes[id]) {
    toast("Ya apoyaste esta propuesta.");
    return;
  }


  localLikes[id] = true;

  localStorage.setItem(
    "ajtt_likes_v3",
    JSON.stringify(localLikes)
  );


  p.likes++;


  if (FIREBASE_ENABLED && db) {

    await setDoc(
      doc(db, "proposals", id),
      {
        likes: p.likes
      },
      {
        merge: true
      }
    ).catch(() => {});

  }


  render();

  toast("Tu apoyo quedó registrado.");

}


// ============================================================
// ABRIR FORMULARIO DE COMENTARIO
// ============================================================

function openComment(id) {

  const proposal = proposals.find(
    p => p.id === id
  );


  const titleEl = $("#commentTitle");
  const contextEl = $("#commentContext");
  const formEl = $("#commentForm");


  if (titleEl) {
    titleEl.textContent =
      "Aportar a la propuesta";
  }


  if (contextEl) {
    contextEl.textContent =
      proposal?.title || "";
  }


  if (formEl) {
    formEl.dataset.id = id;
  }


  openModal("commentModal");

}


// ============================================================
// ENVIAR COMENTARIO
// ============================================================

async function submitComment(e) {

  e.preventDefault();


  if (!user) {

    closeModal("commentModal");
    openModal("authModal");

    return;
  }


  const id = e.currentTarget.dataset.id;

  const textEl = $("#commentText");
  const typeEl = $("#commentType");


  const text = textEl
    ? textEl.value.trim()
    : "";

  const type = typeEl
    ? typeEl.value
    : "";


  if (!text) return;


  const c = {
    name: user.displayName || "Estudiante",
    type,
    text
  };


  const p = proposals.find(
    x => x.id === id
  );


  if (!p) return;


  p.comments.push(c);


  if (FIREBASE_ENABLED && db) {

    await addDoc(
      collection(
        db,
        "proposals",
        id,
        "comments"
      ),
      {
        ...c,
        uid: user.uid,
        createdAt: serverTimestamp()
      }
    ).catch(() => {});

  }


  e.currentTarget.reset();


  const counter = $("#counter");

  if (counter) {
    counter.textContent = "0 / 1000";
  }


  closeModal("commentModal");

  render();

  toast("Aporte publicado.");

}


// ============================================================
// NUEVA PROPUESTA
// ============================================================

function newProposal() {

  requireLogin(() => {
    openModal("newProposalModal");
  });

}


// ============================================================
// ENVIAR NUEVA PROPUESTA
// ============================================================

async function submitProposal(e) {

  e.preventDefault();


  if (!user) {

    closeModal("newProposalModal");
    openModal("authModal");

    return;
  }


  const titleEl = $("#newTitle");
  const textEl = $("#newText");
  const categoryEl = $("#newCategory");


  const title = titleEl
    ? titleEl.value.trim()
    : "";

  const text = textEl
    ? textEl.value.trim()
    : "";

  const cat = categoryEl
    ? categoryEl.value
    : "";


  if (!title || !text) return;


  if (FIREBASE_ENABLED && db) {

    await addDoc(
      collection(db, "pendingProposals"),
      {
        title,
        text,
        cat,
        uid: user.uid,
        name: user.displayName || "Estudiante",
        createdAt: serverTimestamp(),
        status: "pendiente"
      }
    ).catch(() => {});

  }


  closeModal("newProposalModal");

  e.currentTarget.reset();

  toast("Propuesta enviada para revisión.");

}


// ============================================================
// LOGIN CON GOOGLE
// ============================================================

async function login() {

  if (!FIREBASE_ENABLED) {

    toast(
      "Primero configurá Firebase para activar Google."
    );

    return;
  }


  try {

    const provider =
      new GoogleAuthProvider();

    await signInWithPopup(
      auth,
      provider
    );


    closeModal("authModal");

    toast(
      "Sesión iniciada. Ahora podés participar."
    );


  } catch (e) {

    toast(
      "No se pudo iniciar sesión con Google."
    );

    console.error(e);

  }

}


// ============================================================
// CONFIGURACIÓN DE LA PÁGINA
// ============================================================

function setup() {

  const accountBtn = $("#accountBtn");

  if (accountBtn) {

    accountBtn.onclick = () => {

      if (user) {
        signOut(auth);
      } else {
        openModal("authModal");
      }

    };

  }


  const participateBtn =
    $("#participateBtn");

  if (participateBtn) {

    participateBtn.onclick = () => {
      openModal("authModal");
    };

  }


  const newProposalBtn =
    $("#newProposalBtn");

  if (newProposalBtn) {
    newProposalBtn.onclick = newProposal;
  }


  const googleBtn =
    $("#googleBtn");

  if (googleBtn) {
    googleBtn.onclick = login;
  }


  const commentForm =
    $("#commentForm");

  if (commentForm) {
    commentForm.onsubmit = submitComment;
  }


  const newProposalForm =
    $("#newProposalForm");

  if (newProposalForm) {
    newProposalForm.onsubmit = submitProposal;
  }


  const commentText =
    $("#commentText");

  if (commentText) {

    commentText.oninput = e => {

      const counter = $("#counter");

      if (counter) {

        counter.textContent =
          `${e.target.value.length} / 1000`;

      }

    };

  }


  const search =
    $("#search");

  if (search) {
    search.oninput = render;
  }


  const sort =
    $("#sort");

  if (sort) {
    sort.onchange = render;
  }


  $$(".filter").forEach(b => {

    b.onclick = () => {

      $$(".filter").forEach(
        x => x.classList.remove("active")
      );

      b.classList.add("active");

      render();

    };

  });


  // ==========================================================
  // CERRAR MODALES HACIENDO CLICK EN EL FONDO
  // ==========================================================

  $$(".modal").forEach(modal => {

    modal.addEventListener("click", e => {

      if (e.target === modal) {
        modal.classList.add("hidden");
      }

    });

  });


  render();

}


// ============================================================
// FIREBASE
// ============================================================

if (FIREBASE_ENABLED) {

  try {

    const app =
      initializeApp(firebaseConfig);

    auth = getAuth(app);

    db = getFirestore(app);


    // ========================================================
    // ESTADO DE AUTENTICACIÓN
    // ========================================================

    onAuthStateChanged(auth, async currentUser => {

      user = currentUser;


      const accountBtn =
        $("#accountBtn");


      if (accountBtn) {

        accountBtn.textContent =
          user
            ? "Cerrar sesión"
            : "Iniciar sesión";

      }


      // ======================================================
      // ACCIÓN PENDIENTE DESPUÉS DEL LOGIN
      // ======================================================

      if (user) {

        const pendingAction =
          sessionStorage.getItem(
            "afterLoginAction"
          );


        if (pendingAction) {

          sessionStorage.removeItem(
            "afterLoginAction"
          );

        }

      }

    });


    // ========================================================
    // ESCUCHAR PROPUESTAS Y SUS LIKES DESDE FIRESTORE
    // ========================================================

    proposals.forEach(p => {

      onSnapshot(
        doc(db, "proposals", p.id),
        snap => {

          if (!snap.exists()) {

            // Crea el documento con el número inicial
            // únicamente si todavía no existe.
            setDoc(
              doc(db, "proposals", p.id),
              {
                likes: p.likes
              },
              {
                merge: true
              }
            ).catch(() => {});

            return;
          }


          const data = snap.data();


          if (
            typeof data.likes === "number"
          ) {

            p.likes = data.likes;

          }


          render();

        },
        error => {
          console.error(
            "Error escuchando propuesta:",
            p.id,
            error
          );
        }
      );


      // ======================================================
      // ESCUCHAR COMENTARIOS
      // ======================================================

      const commentsQuery = query(
        collection(
          db,
          "proposals",
          p.id,
          "comments"
        ),
        orderBy("createdAt", "asc")
      );


      onSnapshot(
        commentsQuery,
        snap => {

          p.comments =
            snap.docs.map(d => {

              const data = d.data();

              return {
                name:
                  data.name ||
                  "Estudiante",

                type:
                  data.type ||
                  "",

                text:
                  data.text ||
                  ""
              };

            });


          render();

        },
        error => {

          console.error(
            "Error escuchando comentarios:",
            p.id,
            error
          );

        }
      );

    });


  } catch (e) {

    console.error(
      "Error inicializando Firebase:",
      e
    );

    db = null;
    auth = null;

  }

}


// ============================================================
// INICIAR APP
// ============================================================

setup();
