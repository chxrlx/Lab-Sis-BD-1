const $ = (s) => document.querySelector(s);

const state = {
  view: "libros",
  q: ""
};

const api = {
  async get(path) {
    const r = await fetch(path);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || j.message || "Error");
    return j;
  },
  async send(path, method, body) {
    const r = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || j.message || "Error");
    return j;
  }
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1600);
}

function setActiveNav() {
  document.querySelectorAll(".chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
}

function openModal(title, subtitle, bodyEl, footerEl) {
  $("#modalTitle").textContent = title;
  $("#modalSubtitle").textContent = subtitle || "";
  const body = $("#modalBody");
  const foot = $("#modalFooter");
  body.innerHTML = "";
  foot.innerHTML = "";
  body.appendChild(bodyEl);
  footerEl?.forEach((x) => foot.appendChild(x));
  $("#modal").classList.add("show");
}

function closeModal() {
  $("#modal").classList.remove("show");
}

$("#modalClose").addEventListener("click", closeModal);
$("#modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") closeModal();
});

document.querySelectorAll(".chip").forEach((b) => {
  b.addEventListener("click", () => {
    state.view = b.dataset.view;
    $("#search").value = "";
    state.q = "";
    setActiveNav();
    render();
  });
});

$("#search").addEventListener("input", (e) => {
  state.q = e.target.value.trim();
});

$("#refresh").addEventListener("click", () => render());
$("#newBtn").addEventListener("click", () => onNew());

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  children.forEach((c) => el.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return el;
}

function table(headers, rows) {
  const thead = h("thead", {}, [h("tr", {}, headers.map((x) => h("th", {}, [x])))]);
  const tbody = h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c) => h("td", {}, [c])))));
  return h("table", { class: "table" }, [thead, tbody]);
}

function field(label, name, value = "", full = false) {
  const input = h("input", { class: "input", name, value: String(value ?? "") });
  return h("div", { class: `field ${full ? "full" : ""}` }, [
    h("div", { class: "label" }, [label]),
    input
  ]);
}

function readForm(root) {
  const obj = {};
  root.querySelectorAll("input[name], select[name]").forEach((i) => {
    obj[i.name] = i.value.trim();
  });
  return obj;
}

function selectField(label, name, options, selected) {
  const sel = h("select", { class: "input", name }, []);
  (options || []).forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.id ?? o.ID;
    opt.textContent = o.nombre ?? o.NOMBRE ?? o.titulo ?? o.TITULO ?? `#${o.id ?? o.ID}`;
    if (selected != null && Number(selected) === Number(opt.value)) opt.selected = true;
    sel.appendChild(opt);
  });
  return h("div", { class: "field" }, [h("div", { class: "label" }, [label]), sel]);
}

// =========================
// RENDER ROUTER
// =========================
async function render() {
  setActiveNav();

  const titleMap = {
    libros:        ["Libros",        "Catálogo general"],
    autores:       ["Autores",       "Gestión de autores"],
    editoriales:   ["Editoriales",   "Gestión de editoriales"],
    categorias:    ["Categorías",    "Gestión de categorías"],
    lanzamientos:  ["Lanzamientos",  "Ediciones por libro"],
    publicaciones: ["Publicaciones", "Copias físicas del catálogo"],
    usuarios:      ["Usuarios",      "Lectores registrados"],
    prestamos:     ["Préstamos",     "Circulación de material"]
  };

  const [title, hint] = titleMap[state.view] || ["Vista", ""];
  $("#viewTitle").textContent = title;
  $("#viewHint").textContent = hint;

  const content = $("#content");
  content.innerHTML = "Cargando...";

  try {
    if (state.view === "libros")        return renderLibros();
    if (state.view === "autores")       return renderAutores();
    if (state.view === "editoriales")   return renderEditoriales();
    if (state.view === "categorias")    return renderCategorias();
    if (state.view === "lanzamientos")  return renderLanzamientos();
    if (state.view === "publicaciones") return renderPublicaciones();
    if (state.view === "usuarios")      return renderUsuarios();
    if (state.view === "prestamos")     return renderPrestamos();
  } catch (e) {
    content.innerHTML = "";
    content.appendChild(h("div", {}, [`Error: ${e.message}`]));
  }
}

async function onNew() {
  if (state.view === "libros")        return newLibro();
  if (state.view === "autores")       return newAutor();
  if (state.view === "editoriales")   return newEditorial();
  if (state.view === "categorias")    return newCategoria();
  if (state.view === "lanzamientos")  return newLanzamiento();
  if (state.view === "publicaciones") return newPublicacion();
  if (state.view === "usuarios")      return newUsuario();
  if (state.view === "prestamos")     return newPrestamo();
}

// =========================
// LIBROS
// =========================
async function renderLibros() {
  const { data } = await api.get(`/api/libros?q=${encodeURIComponent(state.q)}`);
  const rows = data.map((x) => {
    const disp = Number(x.disponibles || 0);
    const tot  = Number(x.total_publicaciones || 0);
    const badge =
      tot === 0  ? h("span", { class: "badge warn" }, ["Sin copias"]) :
      disp > 0   ? h("span", { class: "badge ok" },   [`${disp}/${tot} disponibles`]) :
                   h("span", { class: "badge bad" },   [`0/${tot} disponibles`]);

    const btns = h("div", { class: "actions" }, [
      h("button", { class: "btn",    onClick: () => libroDetalle(x.id_libro) }, ["Detalle"]),
      h("button", { class: "btn danger", onClick: () => delLibro(x.id_libro) }, ["Eliminar"])
    ]);
    return [String(x.id_libro), x.titulo, x.autor || "—", x.editorial || "—", x.categoria || "—", badge, btns];
  });

  $("#content").innerHTML = "";
  $("#content").appendChild(table(["ID","Título","Autor","Editorial","Categoría","Disponibilidad","Acciones"], rows));
}

async function libroDetalle(id) {
  const r = await api.get(`/api/libros/${id}/detail`);
  const { libro, lanzamientos } = r.data;

  const body = h("div", {}, [
    h("div", { class: "muted" }, [`Libro #${libro.id_libro}`]),
    h("div", { style: "margin:10px 0;font-weight:800;" }, [libro.titulo]),
    h("div", { class: "muted" }, [
      `Autor: ${libro.autor_nombre || "—"} · Editorial: ${libro.editorial_nombre || "—"} · Categoría: ${libro.categoria_nombre || "—"}`
    ]),
    libro.sinopsis ? h("div", { class: "muted", style: "margin-top:6px;" }, [libro.sinopsis]) : h("span"),
    h("hr", { style: "border:0;border-top:1px solid var(--border);margin:12px 0;" }),
    h("div", { style: "font-weight:800;margin-bottom:6px;" }, ["Lanzamientos"]),
    lanzamientos.length
      ? table(
          ["ID", "ISBN", "Idioma", "Edición", "Fecha", "Copias"],
          lanzamientos.map((lp) => [
            String(lp.id_lanzamiento),
            lp.isbn ?? "—",
            lp.idioma ?? "—",
            lp.numero_edicion ?? "—",
            lp.fecha_lanzamiento ?? "—",
            `${lp.disponibles}/${lp.total}`
          ])
        )
      : h("div", { class: "muted" }, ["—"])
  ]);

  openModal("Detalle de libro", "Catálogo", body, [
    h("button", { class: "btn", onClick: () => editLibro(libro) }, ["Editar"]),
    h("button", { class: "btn", onClick: closeModal }, ["Cerrar"])
  ]);
}

async function newLibro() {
  const [autores, editoriales, categorias] = await Promise.all([
    api.get("/api/select/autores"),
    api.get("/api/select/editoriales"),
    api.get("/api/select/categorias")
  ]);

  const form = h("div", { class: "form" }, [
    field("Título", "titulo", ""),
    selectField("Autor", "id_autor", autores.data),
    selectField("Editorial", "id_editorial", editoriales.data),
    selectField("Categoría", "id_categoria", categorias.data),
    field("Sinopsis", "sinopsis", "", true)
  ]);

  const save = async () => {
    const payload = readForm(form);
    payload.id_autor     = payload.id_autor     ? Number(payload.id_autor)     : null;
    payload.id_editorial = payload.id_editorial ? Number(payload.id_editorial) : null;
    payload.id_categoria = payload.id_categoria ? Number(payload.id_categoria) : null;
    await api.send("/api/libros", "POST", payload);
    toast("Libro creado");
    closeModal();
    render();
  };

  openModal("Nuevo libro", "Catálogo", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editLibro(libro) {
  const [autores, editoriales, categorias] = await Promise.all([
    api.get("/api/select/autores"),
    api.get("/api/select/editoriales"),
    api.get("/api/select/categorias")
  ]);

  const form = h("div", { class: "form" }, [
    field("Título", "titulo", libro.titulo),
    selectField("Autor", "id_autor", autores.data, libro.id_autor),
    selectField("Editorial", "id_editorial", editoriales.data, libro.id_editorial),
    selectField("Categoría", "id_categoria", categorias.data, libro.id_categoria),
    field("Sinopsis", "sinopsis", libro.sinopsis || "", true)
  ]);

  const save = async () => {
    const payload = readForm(form);
    payload.id_autor     = payload.id_autor     ? Number(payload.id_autor)     : null;
    payload.id_editorial = payload.id_editorial ? Number(payload.id_editorial) : null;
    payload.id_categoria = payload.id_categoria ? Number(payload.id_categoria) : null;
    await api.send(`/api/libros/${libro.id_libro}`, "PUT", payload);
    toast("Libro actualizado");
    closeModal();
    render();
  };

  openModal("Editar libro", `ID ${libro.id_libro}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delLibro(id) {
  if (!confirm("¿Eliminar libro? Se eliminarán sus lanzamientos y publicaciones.")) return;
  await api.send(`/api/libros/${id}`, "DELETE");
  toast("Libro eliminado");
  render();
}

// =========================
// AUTORES
// =========================
async function renderAutores() {
  const { data } = await api.get(`/api/autores?q=${encodeURIComponent(state.q)}`);
  const rows = data.map((x) => ([
    String(x.id_autor),
    x.nombre,
    x.apellidos,
    x.nacionalidad || "—",
    h("div", { class: "actions" }, [
      h("button", { class: "btn",    onClick: () => editAutor(x) },        ["Editar"]),
      h("button", { class: "btn danger", onClick: () => delAutor(x.id_autor) }, ["Eliminar"])
    ])
  ]));

  $("#content").innerHTML = "";
  $("#content").appendChild(table(["ID","Nombre","Apellidos","Nacionalidad","Acciones"], rows));
}

async function newAutor() {
  const form = h("div", { class: "form" }, [
    field("Nombre",       "nombre",       ""),
    field("Apellidos",    "apellidos",    ""),
    field("Nacionalidad", "nacionalidad", "")
  ]);

  const save = async () => {
    await api.send("/api/autores", "POST", readForm(form));
    toast("Autor creado");
    closeModal();
    render();
  };

  openModal("Nuevo autor", "Catálogo", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editAutor(x) {
  const form = h("div", { class: "form" }, [
    field("Nombre",       "nombre",       x.nombre),
    field("Apellidos",    "apellidos",    x.apellidos),
    field("Nacionalidad", "nacionalidad", x.nacionalidad || "")
  ]);

  const save = async () => {
    await api.send(`/api/autores/${x.id_autor}`, "PUT", readForm(form));
    toast("Autor actualizado");
    closeModal();
    render();
  };

  openModal("Editar autor", `ID ${x.id_autor}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delAutor(id) {
  if (!confirm("¿Eliminar autor?")) return;
  await api.send(`/api/autores/${id}`, "DELETE");
  toast("Autor eliminado");
  render();
}

// =========================
// EDITORIALES
// =========================
async function renderEditoriales() {
  const { data } = await api.get(`/api/editoriales?q=${encodeURIComponent(state.q)}`);
  const rows = data.map((x) => ([
    String(x.id_editorial),
    x.nombre,
    x.pais || "—",
    h("div", { class: "actions" }, [
      h("button", { class: "btn",    onClick: () => editEditorial(x) },           ["Editar"]),
      h("button", { class: "btn danger", onClick: () => delEditorial(x.id_editorial) }, ["Eliminar"])
    ])
  ]));

  $("#content").innerHTML = "";
  $("#content").appendChild(table(["ID","Nombre","País","Acciones"], rows));
}

async function newEditorial() {
  const form = h("div", { class: "form" }, [
    field("Nombre", "nombre", ""),
    field("País",   "pais",   "")
  ]);

  const save = async () => {
    await api.send("/api/editoriales", "POST", readForm(form));
    toast("Editorial creada");
    closeModal();
    render();
  };

  openModal("Nueva editorial", "Catálogo", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editEditorial(x) {
  const form = h("div", { class: "form" }, [
    field("Nombre", "nombre", x.nombre),
    field("País",   "pais",   x.pais || "")
  ]);

  const save = async () => {
    await api.send(`/api/editoriales/${x.id_editorial}`, "PUT", readForm(form));
    toast("Editorial actualizada");
    closeModal();
    render();
  };

  openModal("Editar editorial", `ID ${x.id_editorial}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delEditorial(id) {
  if (!confirm("¿Eliminar editorial?")) return;
  await api.send(`/api/editoriales/${id}`, "DELETE");
  toast("Editorial eliminada");
  render();
}

// =========================
// CATEGORIAS
// =========================
async function renderCategorias() {
  const { data } = await api.get(`/api/categorias?q=${encodeURIComponent(state.q)}`);
  const rows = data.map((x) => ([
    String(x.id_categoria),
    x.nombre,
    h("div", { class: "actions" }, [
      h("button", { class: "btn",    onClick: () => editCategoria(x) },           ["Editar"]),
      h("button", { class: "btn danger", onClick: () => delCategoria(x.id_categoria) }, ["Eliminar"])
    ])
  ]));

  $("#content").innerHTML = "";
  $("#content").appendChild(table(["ID","Nombre","Acciones"], rows));
}

async function newCategoria() {
  const form = h("div", { class: "form" }, [field("Nombre", "nombre", "")]);

  const save = async () => {
    await api.send("/api/categorias", "POST", readForm(form));
    toast("Categoría creada");
    closeModal();
    render();
  };

  openModal("Nueva categoría", "Catálogo", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editCategoria(x) {
  const form = h("div", { class: "form" }, [field("Nombre", "nombre", x.nombre)]);

  const save = async () => {
    await api.send(`/api/categorias/${x.id_categoria}`, "PUT", readForm(form));
    toast("Categoría actualizada");
    closeModal();
    render();
  };

  openModal("Editar categoría", `ID ${x.id_categoria}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delCategoria(id) {
  if (!confirm("¿Eliminar categoría?")) return;
  await api.send(`/api/categorias/${id}`, "DELETE");
  toast("Categoría eliminada");
  render();
}

// =========================
// LANZAMIENTOS
// =========================
async function renderLanzamientos() {
  const { data } = await api.get(`/api/lanzamientos?libro_id=0`);
  const rows = data.map((x) => ([
    String(x.id_lanzamiento),
    x.libro_titulo,
    x.isbn ?? "—",
    x.idioma ?? "—",
    x.numero_edicion ?? "—",
    x.fecha_lanzamiento ?? "—",
    h("div", { class: "actions" }, [
      h("button", { class: "btn",    onClick: () => editLanzamiento(x) },               ["Editar"]),
      h("button", { class: "btn danger", onClick: () => delLanzamiento(x.id_lanzamiento) }, ["Eliminar"])
    ])
  ]));

  $("#content").innerHTML = "";
  $("#content").appendChild(table(["ID","Libro","ISBN","Idioma","Ed.","Fecha","Acciones"], rows));
}

async function newLanzamiento() {
  const libros = await api.get("/api/select/libros");

  const form = h("div", { class: "form" }, [
    selectField("Libro",            "id_libro",           libros.data),
    field("ISBN",                   "isbn",               ""),
    field("Idioma",                 "idioma",             "Español"),
    field("Número de edición",      "numero_edicion",     ""),
    field("Fecha lanzamiento",      "fecha_lanzamiento",  "")
  ]);

  const save = async () => {
    const payload = readForm(form);
    payload.id_libro       = Number(payload.id_libro);
    payload.numero_edicion = payload.numero_edicion ? Number(payload.numero_edicion) : null;
    await api.send("/api/lanzamientos", "POST", payload);
    toast("Lanzamiento creado");
    closeModal();
    render();
  };

  openModal("Nuevo lanzamiento", "Catálogo", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editLanzamiento(x) {
  const libros = await api.get("/api/select/libros");

  const form = h("div", { class: "form" }, [
    selectField("Libro",        "id_libro",          libros.data, x.id_libro),
    field("ISBN",               "isbn",              x.isbn ?? ""),
    field("Idioma",             "idioma",            x.idioma ?? "Español"),
    field("Número de edición",  "numero_edicion",    x.numero_edicion ?? ""),
    field("Fecha lanzamiento",  "fecha_lanzamiento", x.fecha_lanzamiento ?? "")
  ]);

  const save = async () => {
    const payload = readForm(form);
    payload.id_libro       = Number(payload.id_libro);
    payload.numero_edicion = payload.numero_edicion ? Number(payload.numero_edicion) : null;
    await api.send(`/api/lanzamientos/${x.id_lanzamiento}`, "PUT", payload);
    toast("Lanzamiento actualizado");
    closeModal();
    render();
  };

  openModal("Editar lanzamiento", `ID ${x.id_lanzamiento}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delLanzamiento(id) {
  if (!confirm("¿Eliminar lanzamiento? Se eliminarán sus publicaciones.")) return;
  await api.send(`/api/lanzamientos/${id}`, "DELETE");
  toast("Lanzamiento eliminado");
  render();
}

// =========================
// PUBLICACIONES
// =========================
async function renderPublicaciones() {
  const { data } = await api.get(
    `/api/publicaciones?q=${encodeURIComponent(state.q)}`
  );
  const rows = data.map((x) => {
    const est = x.estado || "—";
    const badge =
      est === "Disponible" ? h("span", { class: "badge ok" },   ["Disponible"]) :
      est === "Prestado"   ? h("span", { class: "badge bad" },  ["Prestado"])   :
                             h("span", { class: "badge warn" }, [est]);
    return [
      String(x.id_publicacion),
      x.codigo_inventario,
      x.libro_titulo,
      x.isbn ?? "—",
      x.numero_edicion ?? "—",
      badge,
      x.ubicacion_estante || "—",
      h("div", { class: "actions" }, [
        h("button", { class: "btn",    onClick: () => editPublicacion(x) },                 ["Editar"]),
        h("button", { class: "btn danger", onClick: () => delPublicacion(x.id_publicacion) }, ["Eliminar"])
      ])
    ];
  });

  $("#content").innerHTML = "";
  $("#content").appendChild(
    table(["ID","Código","Libro","ISBN","Ed.","Estado","Estante","Acciones"], rows)
  );
}

async function newPublicacion() {
  const lanzamientos = await api.get("/api/select/lanzamientos?libro_id=0");

  const form = h("div", { class: "form" }, [
    selectField("Lanzamiento",     "id_lanzamiento",    lanzamientos.data),
    field("Código inventario",     "codigo_inventario", ""),
    field("Ubicación (estante)",   "ubicacion_estante", ""),
    field("Estado",                "estado",            "Disponible")
  ]);

  const save = async () => {
    const payload = readForm(form);
    payload.id_lanzamiento = Number(payload.id_lanzamiento);
    await api.send("/api/publicaciones", "POST", payload);
    toast("Publicación creada");
    closeModal();
    render();
  };

  openModal("Nueva publicación", "Catálogo", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editPublicacion(x) {
  const form = h("div", { class: "form" }, [
    field("Ubicación (estante)", "ubicacion_estante", x.ubicacion_estante || ""),
    field("Estado",              "estado",            x.estado || "Disponible")
  ]);

  const save = async () => {
    await api.send(`/api/publicaciones/${x.id_publicacion}`, "PUT", readForm(form));
    toast("Publicación actualizada");
    closeModal();
    render();
  };

  openModal("Editar publicación", `ID ${x.id_publicacion} — ${x.codigo_inventario}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delPublicacion(id) {
  if (!confirm("¿Eliminar publicación?")) return;
  await api.send(`/api/publicaciones/${id}`, "DELETE");
  toast("Publicación eliminada");
  render();
}

// =========================
// USUARIOS
// =========================
async function renderUsuarios() {
  const { data } = await api.get(`/api/usuarios?q=${encodeURIComponent(state.q)}`);
  const rows = data.map((x) => ([
    String(x.id_usuario),
    x.nombre,
    x.apellidos,
    x.correo,
    x.telefono || "—",
    x.estado === "Activo"
      ? h("span", { class: "badge ok" },  ["Activo"])
      : h("span", { class: "badge bad" }, [x.estado || "—"]),
    h("div", { class: "actions" }, [
      h("button", { class: "btn",    onClick: () => editUsuario(x) },          ["Editar"]),
      h("button", { class: "btn danger", onClick: () => delUsuario(x.id_usuario) }, ["Eliminar"])
    ])
  ]));

  $("#content").innerHTML = "";
  $("#content").appendChild(table(["ID","Nombre","Apellidos","Correo","Teléfono","Estado","Acciones"], rows));
}

async function newUsuario() {
  const form = h("div", { class: "form" }, [
    field("Nombre",    "nombre",    ""),
    field("Apellidos", "apellidos", ""),
    field("Correo",    "correo",    ""),
    field("Teléfono",  "telefono",  ""),
    field("Estado (Activo/Inactivo)", "estado", "Activo")
  ]);

  const save = async () => {
    await api.send("/api/usuarios", "POST", readForm(form));
    toast("Usuario creado");
    closeModal();
    render();
  };

  openModal("Nuevo usuario", "Biblioteca", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function editUsuario(x) {
  const form = h("div", { class: "form" }, [
    field("Nombre",    "nombre",    x.nombre),
    field("Apellidos", "apellidos", x.apellidos),
    field("Correo",    "correo",    x.correo),
    field("Teléfono",  "telefono",  x.telefono || ""),
    field("Estado",    "estado",    x.estado || "Activo")
  ]);

  const save = async () => {
    await api.send(`/api/usuarios/${x.id_usuario}`, "PUT", readForm(form));
    toast("Usuario actualizado");
    closeModal();
    render();
  };

  openModal("Editar usuario", `ID ${x.id_usuario}`, form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Guardar"])
  ]);
}

async function delUsuario(id) {
  if (!confirm("¿Eliminar usuario?")) return;
  await api.send(`/api/usuarios/${id}`, "DELETE");
  toast("Usuario eliminado");
  render();
}

// =========================
// PRESTAMOS
// =========================
async function renderPrestamos() {
  const { data } = await api.get(`/api/prestamos?estado=`);
  const rows = data.map((p) => {
    const est = p.estado || "—";
    const badge =
      est === "En curso"  ? h("span", { class: "badge ok" },   ["En curso"])  :
      est === "Devuelto"  ? h("span", { class: "badge warn" }, ["Devuelto"])  :
                            h("span", { class: "badge bad" },  [est]);

    const canReturn = est === "En curso";
    return [
      String(p.id_prestamo),
      p.usuario_nombre,
      p.libro_titulo,
      p.codigo_inventario,
      p.fecha_prestamo,
      p.fecha_limite,
      p.fecha_devolucion || "—",
      badge,
      canReturn
        ? h("button", { class: "btn primary", onClick: () => devolverPrestamo(p.id_prestamo) }, ["Devolver"])
        : h("span", { class: "muted" }, ["—"])
    ];
  });

  $("#content").innerHTML = "";
  $("#content").appendChild(
    table(["ID","Usuario","Libro","Código","Préstamo","Límite","Devolución","Estado","Acción"], rows)
  );
}

async function newPrestamo() {
  const [usuarios, publicaciones] = await Promise.all([
    api.get("/api/select/usuarios"),
    api.get("/api/select/publicaciones")
  ]);

  if (!publicaciones.data.length) {
    alert("No hay publicaciones disponibles para préstamo.");
    return;
  }

  const today = new Date();
  const limit = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const fmt   = (d) => d.toISOString().slice(0, 10);

  const form = h("div", { class: "form" }, [
    selectField("Usuario",      "id_usuario",     usuarios.data),
    selectField("Publicación",  "id_publicacion", publicaciones.data),
    field("Fecha límite (YYYY-MM-DD)", "fecha_limite", fmt(limit))
  ]);

  const save = async () => {
    const payload = readForm(form);
    payload.id_usuario     = Number(payload.id_usuario);
    payload.id_publicacion = Number(payload.id_publicacion);
    await api.send("/api/prestamos", "POST", payload);
    toast("Préstamo registrado");
    closeModal();
    render();
  };

  openModal("Nuevo préstamo", "Circulación", form, [
    h("button", { class: "btn", onClick: closeModal }, ["Cancelar"]),
    h("button", { class: "btn primary", onClick: save }, ["Crear"])
  ]);
}

async function devolverPrestamo(id) {
  if (!confirm("¿Registrar devolución de este préstamo?")) return;
  await api.send(`/api/prestamos/${id}/devolver`, "PUT", {});
  toast("Devolución registrada");
  render();
}

render();
