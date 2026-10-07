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
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

import {
  firebaseConfig,
  FIREBASE_ENABLED
} from "./firebase-config.js";


// ============================================================
// APOYOS INICIALES DE CADA PROPUESTA
// ============================================================
//
// Estos números son la base que querés mostrar.
// Firebase NO reemplaza estos valores con los likes antiguos.
// Los apoyos nuevos de Firebase se suman encima de esta base.
//

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
// ESTADO DE LAS PROPUESTAS
// ============================================================

let proposals = baseProposals.map(x => ({
  id: "p" + x[0],
  num: x[0],
  cat: x[1],
  title: x[2],
  text: x[3],

  // BASE FIJA
  baseLikes: customLikes[x[0]] || 0,

  // APOYOS NUEVOS DE FIREBASE
  extraLikes: 0,

  // SE CALCULA ABAJO
  likes: customLikes[x[0]] || 0,

  comments: []
}));


let user = null;
let db = null;
let auth = null;


// ============================================================
// LIKES LOCALES
// ============================================================

let localLikes = {};

try {
  localLikes = JSON.parse(
    localStorage.getItem("ajtt_likes_v3") || "{}"
  );
} catch (e) {
  localLikes = {};
}


// ============================================================
// ATAJOS DOM
// ============================================================

const $ = s => document.querySelector(s);

const $$ = s =>
  [...document.querySelectorAll(s)];


// ============================================================
// TOAST
// ============================================================

function toast(t) {
  const el = $("#toast");

  if (!el) return;

  el.textContent = t;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 2800);
}


// ============================================================
// MODALES
// ============================================================

function openModal(id) {
  const el = $("#" + id);

  if (!el) return;

  el.classList.remove("hidden");
}


function closeModal(id) {
  const el = $("#" + id);

  if (!el) return;

  el.classList.add("hidden");
}


// ============================================================
// LOGIN O ACCIÓN
// ============================================================

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


// ============================================================
// ESCAPAR HTML
// ============================================================

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
// ACTUALIZAR TOTAL DE APOYOS
// ============================================================

function updateLikesCount(p) {
  p.likes =
    (Number(p.baseLikes) || 0) +
    (Number(p.extraLikes) || 0);
}


// ============================================================
// RENDER
// ============================================================

function render() {
  const grid = $("#proposalGrid");

  if (!grid) return;


  const searchEl = $("#search");

  const q = searchEl
    ? searchEl.value.toLowerCase().trim()
    : "";


  const activeFilter =
    document.querySelector(".filter.active");


  const cat =
    activeFilter?.dataset.cat || "todas";


  const sortEl = $("#sort");

  const sort =
    sortEl?.value || "";


  let arr = proposals.filter(p => {

    const normalizedCategory =
      p.cat
        .toLowerCase()
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        );


    const categoryMatches =
      cat === "todas" ||
      normalizedCategory === cat;


    const searchMatches =
      (
        p.title +
        " " +
        p.text
      )
        .toLowerCase()
        .includes(q);


    return (
      categoryMatches &&
      searchMatches
    );
  });


  // Ordenar por apoyos
  if (sort === "likes") {
    arr.sort(
      (a, b) =>
        b.likes - a.likes
    );
  }


  // Ordenar por título
  if (sort === "titulo") {
    arr.sort(
      (a, b) =>
        a.title.localeCompare(
          b.title
        )
    );
  }


  grid.innerHTML = arr.map(p => {

    updateLikesCount(p);


    const isLiked =
      localLikes[p.id]
        ? "liked"
        : "";


    const commentsList =
      p.comments.length

        ? p.comments.map(c => `
            <div class="comment">
              <b>
                ${esc(
                  c.name ||
                  "Estudiante"
                )}
              </b>

              <small>
                ${esc(
                  c.type || ""
                )}
                ·
                ${esc(
                  c.text || ""
                )}
              </small>
            </div>
          `).join("")

        : `
            <small>
              Aún no hay aportes.
              Sé la primera persona
              en participar.
            </small>
          `;


    return `
      <article
        class="proposal"
        data-id="${p.id}"
      >

        <span class="num">
          ${esc(p.num)} / ${esc(p.cat)}
        </span>

        <h3>
          ${esc(p.title)}
        </h3>

        <p>
          ${esc(p.text)}
        </p>

        <span class="tag">
          ${esc(p.cat)}
        </span>

        <div class="proposalFooter">

          <button
            class="actionBtn likeBtn ${isLiked}"
            data-like="${p.id}"
            type="button"
          >
            ♥
            <span>${p.likes}</span>
            Apoyar
          </button>

          <button
            class="actionBtn commentBtn"
            data-comment="${p.id}"
            type="button"
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
  // BOTONES LIKE
  // ==========================================================

  $$(".likeBtn").forEach(button => {

    button.onclick = () => {

      requireLogin(() =>
        like(
          button.dataset.like
        )
      );

    };

  });


  // ==========================================================
  // BOTONES COMENTARIOS
  // ==========================================================

  $$(".commentBtn").forEach(button => {

    button.onclick = () => {

      const id =
        button.dataset.comment;

      const comments =
        $("#comments-" + id);


      if (comments) {
        comments.classList.toggle(
          "open"
        );
      }


      if (user) {
        openComment(id);
      } else {
        openModal("authModal");
      }

    };

  });
}


// ============================================================
// APOYAR PROPUESTA
// ============================================================

async function like(id) {

  const p =
    proposals.find(
      x => x.id === id
    );


  if (!p) return;


  // Evitar dos apoyos desde el mismo navegador
  if (localLikes[id]) {

    toast(
      "Ya apoyaste esta propuesta."
    );

    return;
  }


  // Marcar como apoyada localmente
  localLikes[id] = true;

  localStorage.setItem(
    "ajtt_likes_v3",
    JSON.stringify(localLikes)
  );


  // ==========================================================
  // FIREBASE ACTIVADO
  // ==========================================================

  if (FIREBASE_ENABLED && db) {

    try {

      // IMPORTANTE:
      // NO modificamos "likes".
      // Solo aumentamos "extraLikes".
      //
      // Esto evita que los likes viejos de Firebase
      // reemplacen los números base:
      //
      // 01 = 24
      // 02 = 27
      // etc.

      await setDoc(
        doc(
          db,
          "proposals",
          id
        ),
        {
          extraLikes:
            increment(1)
        },
        {
          merge: true
        }
      );


      toast(
        "Tu apoyo quedó registrado."
      );


    } catch (e) {

      console.error(
        "Error registrando apoyo:",
        e
      );


      // Revertir el like local
      delete localLikes[id];

      localStorage.setItem(
        "ajtt_likes_v3",
        JSON.stringify(localLikes)
      );


      toast(
        "No se pudo registrar tu apoyo."
      );

      return;
    }


    return;
  }


  // ==========================================================
  // SIN FIREBASE
  // ==========================================================

  p.extraLikes++;

  updateLikesCount(p);

  render();

  toast(
    "Tu apoyo quedó registrado."
  );
}


// ============================================================
// ABRIR COMENTARIOS
// ============================================================

function openComment(id) {

  const p =
    proposals.find(
      x => x.id === id
    );


  const title =
    $("#commentTitle");

  if (title) {
    title.textContent =
      "Aportar a la propuesta";
  }


  const context =
    $("#commentContext");

  if (context) {
    context.textContent =
      p?.title || "";
  }


  const form =
    $("#commentForm");

  if (form) {
    form.dataset.id = id;
  }


  openModal(
    "commentModal"
  );
}


// ============================================================
// ENVIAR COMENTARIO
// ============================================================

async function submitComment(e) {

  e.preventDefault();


  if (!user) {

    closeModal(
      "commentModal"
    );

    openModal(
      "authModal"
    );

    return;
  }


  const id =
    e.currentTarget.dataset.id;


  const textEl =
    $("#commentText");

  const typeEl =
    $("#commentType");


  const text =
    textEl
      ? textEl.value.trim()
      : "";


  const type =
    typeEl
      ? typeEl.value
      : "";


  if (!text) return;


  const p =
    proposals.find(
      x => x.id === id
    );


  if (!p) return;


  const c = {
    name:
      user.displayName ||
      "Estudiante",

    type,

    text
  };


  // ==========================================================
  // FIREBASE
  // ==========================================================

  if (FIREBASE_ENABLED && db) {

    try {

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
          createdAt:
            serverTimestamp()
        }
      );


    } catch (error) {

      console.error(
        "Error publicando comentario:",
        error
      );

      toast(
        "No se pudo publicar el aporte."
      );

      return;
    }

  } else {

    // ========================================================
    // SIN FIREBASE
    // ========================================================

    p.comments.push(c);
  }


  e.currentTarget.reset();


  const counter =
    $("#counter");

  if (counter) {
    counter.textContent =
      "0 / 1000";
  }


  closeModal(
    "commentModal"
  );


  render();


  toast(
    "Aporte publicado."
  );
}


// ============================================================
// NUEVA PROPUESTA
// ============================================================

function newProposal() {

  requireLogin(() => {
    openModal(
      "newProposalModal"
    );
  });
}


// ============================================================
// ENVIAR NUEVA PROPUESTA
// ============================================================

async function submitProposal(e) {

  e.preventDefault();


  if (!user) {

    closeModal(
      "newProposalModal"
    );

    openModal(
      "authModal"
    );

    return;
  }


  const titleEl =
    $("#newTitle");

  const textEl =
    $("#newText");

  const categoryEl =
    $("#newCategory");


  const title =
    titleEl
      ? titleEl.value.trim()
      : "";


  const text =
    textEl
      ? textEl.value.trim()
      : "";


  const cat =
    categoryEl
      ? categoryEl.value
      : "";


  if (!title || !text) {
    return;
  }


  if (FIREBASE_ENABLED && db) {

    try {

      await addDoc(
        collection(
          db,
          "pendingProposals"
        ),
        {
          title,
          text,
          cat,
          uid: user.uid,
          name:
            user.displayName ||
            "Estudiante",
          createdAt:
            serverTimestamp(),
          status:
            "pendiente"
        }
      );


    } catch (error) {

      console.error(
        "Error enviando propuesta:",
        error
      );

      toast(
        "No se pudo enviar la propuesta."
      );

      return;
    }
  }


  closeModal(
    "newProposalModal"
  );


  e.currentTarget.reset();


  toast(
    "Propuesta enviada para revisión."
  );
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


    closeModal(
      "authModal"
    );


    toast(
      "Sesión iniciada. Ahora podés participar."
    );


  } catch (e) {

    console.error(
      "Error iniciando sesión:",
      e
    );


    toast(
      "No se pudo iniciar sesión con Google."
    );
  }
}


// ============================================================
// CONFIGURAR INTERFAZ
// ============================================================

function setup() {

  // ==========================================================
  // CUENTA
  // ==========================================================

  const accountBtn =
    $("#accountBtn");


  if (accountBtn) {

    accountBtn.onclick = () => {

      if (user) {

        signOut(auth).catch(
          console.error
        );

      } else {

        openModal(
          "authModal"
        );
      }

    };
  }


  // ==========================================================
  // PARTICIPAR
  // ==========================================================

  const participateBtn =
    $("#participateBtn");


  if (participateBtn) {

    participateBtn.onclick = () => {

      if (user) {

        toast(
          "Ya tenés la sesión iniciada."
        );

      } else {

        openModal(
          "authModal"
        );
      }

    };
  }


  // ==========================================================
  // NUEVA PROPUESTA
  // ==========================================================

  const newProposalBtn =
    $("#newProposalBtn");


  if (newProposalBtn) {
    newProposalBtn.onclick =
      newProposal;
  }


  // ==========================================================
  // GOOGLE
  // ==========================================================

  const googleBtn =
    $("#googleBtn");


  if (googleBtn) {
    googleBtn.onclick =
      login;
  }


  // ==========================================================
  // FORMULARIO COMENTARIOS
  // ==========================================================

  const commentForm =
    $("#commentForm");


  if (commentForm) {
    commentForm.onsubmit =
      submitComment;
  }


  // ==========================================================
  // FORMULARIO NUEVA PROPUESTA
  // ==========================================================

  const newProposalForm =
    $("#newProposalForm");


  if (newProposalForm) {
    newProposalForm.onsubmit =
      submitProposal;
  }


  // ==========================================================
  // CONTADOR DE COMENTARIO
  // ==========================================================

  const commentText =
    $("#commentText");


  if (commentText) {

    commentText.oninput =
      e => {

        const counter =
          $("#counter");


        if (counter) {

          counter.textContent =
            `${e.target.value.length} / 1000`;
        }
      };
  }


  // ==========================================================
  // BUSCADOR
  // ==========================================================

  const search =
    $("#search");


  if (search) {
    search.oninput =
      render;
  }


  // ==========================================================
  // ORDEN
  // ==========================================================

  const sort =
    $("#sort");


  if (sort) {
    sort.onchange =
      render;
  }


  // ==========================================================
  // FILTROS
  // ==========================================================

  $$(".filter").forEach(
    button => {

      button.onclick = () => {

        $$(".filter").forEach(
          x =>
            x.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        render();
      };
    }
  );


  // ==========================================================
  // CERRAR MODALES CON ELEMENTOS
  // ==========================================================

  $$("[data-close-modal]").forEach(
    button => {

      button.onclick = () => {

        const id =
          button.dataset.closeModal;

        if (id) {
          closeModal(id);
        }
      };
    }
  );


  // ==========================================================
  // CERRAR MODAL TOCANDO FUERA
  // ==========================================================

  $$(".modal").forEach(
    modal => {

      modal.addEventListener(
        "click",
        e => {

          if (
            e.target === modal
          ) {

            modal.classList.add(
              "hidden"
            );
          }
        }
      );
    }
  );


  // ==========================================================
  // PRIMER RENDER
  // ==========================================================

  render();
}


// ============================================================
// FIREBASE
// ============================================================

if (FIREBASE_ENABLED) {

  try {

    const app =
      initializeApp(
        firebaseConfig
      );


    auth =
      getAuth(app);


    db =
      getFirestore(app);


    // ========================================================
    // ESTADO DE AUTENTICACIÓN
    // ========================================================

    onAuthStateChanged(
      auth,
      currentUser => {

        user =
          currentUser;


        const accountBtn =
          $("#accountBtn");


        if (accountBtn) {

          accountBtn.textContent =
            user
              ? "Cerrar sesión"
              : "Iniciar sesión";
        }


        render();
      }
    );


    // ========================================================
    // ESCUCHAR DATOS DE CADA PROPUESTA
    // ========================================================
    //
    // MUY IMPORTANTE:
    //
    // Firebase solamente lee "extraLikes".
    //
    // NO lee el antiguo campo "likes".
    //
    // Entonces:
    //
    // Propuesta 01:
    // 24 base + extraLikes
    //
    // Propuesta 02:
    // 27 base + extraLikes
    //
    // etc.
    //

    proposals.forEach(p => {

      const proposalRef =
        doc(
          db,
          "proposals",
          p.id
        );


      // ======================================================
      // LIKES
      // ======================================================

      onSnapshot(
        proposalRef,
        snap => {

          if (snap.exists()) {

            const data =
              snap.data();


            p.extraLikes =
              Number(
                data.extraLikes || 0
              );
          }


          updateLikesCount(p);

          render();
        },

        error => {

          console.error(
            "Error leyendo apoyos de " +
            p.id,
            error
          );
        }
      );


      // ======================================================
      // COMENTARIOS
      // ======================================================

      const commentsQuery =
        query(
          collection(
            db,
            "proposals",
            p.id,
            "comments"
          ),
          orderBy(
            "createdAt",
            "asc"
          )
        );


      onSnapshot(
        commentsQuery,
        snap => {

          p.comments =
            snap.docs.map(
              d => {

                const data =
                  d.data();


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
              }
            );


          render();
        },

        error => {

          console.error(
            "Error leyendo comentarios de " +
            p.id,
            error
          );

        }
      );

    });


  } catch (error) {

    console.error(
      "Error inicializando Firebase:",
      error
    );


    db = null;
    auth = null;
  }
}


// ============================================================
// INICIAR APLICACIÓN
// ============================================================

setup();
