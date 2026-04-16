const express = require("express");
const { openDb } = require("./db");

function apiRouter() {
  const router = express.Router();
  const db = openDb();

  const toInt = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  // =========================
  // AUTORES
  // =========================
  router.get("/autores", (req, res) => {
    const q = String(req.query.q || "").trim();
    const rows = db
      .prepare(
        `SELECT id_autor, nombre, apellidos, nacionalidad
         FROM autor
         WHERE (?='' OR nombre LIKE '%'||?||'%' OR apellidos LIKE '%'||?||'%')
         ORDER BY id_autor DESC;`
      )
      .all(q, q, q);
    res.json({ ok: true, data: rows });
  });

  router.post("/autores", (req, res) => {
    const { nombre, apellidos, nacionalidad } = req.body || {};
    if (!nombre?.trim() || !apellidos?.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre y apellidos son requeridos." });
    }
    const info = db
      .prepare(`INSERT INTO autor (nombre, apellidos, nacionalidad) VALUES (?,?,?)`)
      .run(nombre.trim(), apellidos.trim(), nacionalidad ?? null);
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/autores/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { nombre, apellidos, nacionalidad } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    if (!nombre?.trim() || !apellidos?.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre y apellidos requeridos." });
    }
    const info = db
      .prepare(`UPDATE autor SET nombre=?, apellidos=?, nacionalidad=? WHERE id_autor=?`)
      .run(nombre.trim(), apellidos.trim(), nacionalidad ?? null, id);
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/autores/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db.prepare(`DELETE FROM autor WHERE id_autor=?`).run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // EDITORIALES
  // =========================
  router.get("/editoriales", (req, res) => {
    const q = String(req.query.q || "").trim();
    const rows = db
      .prepare(
        `SELECT id_editorial, nombre, pais
         FROM editorial
         WHERE (?='' OR nombre LIKE '%'||?||'%')
         ORDER BY id_editorial DESC;`
      )
      .all(q, q);
    res.json({ ok: true, data: rows });
  });

  router.post("/editoriales", (req, res) => {
    const { nombre, pais } = req.body || {};
    if (!nombre?.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre requerido." });
    }
    const info = db
      .prepare(`INSERT INTO editorial (nombre, pais) VALUES (?,?)`)
      .run(nombre.trim(), pais ?? null);
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/editoriales/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { nombre, pais } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    if (!nombre?.trim()) return res.status(400).json({ ok: false, message: "Nombre requerido." });
    const info = db
      .prepare(`UPDATE editorial SET nombre=?, pais=? WHERE id_editorial=?`)
      .run(nombre.trim(), pais ?? null, id);
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/editoriales/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db.prepare(`DELETE FROM editorial WHERE id_editorial=?`).run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // CATEGORIAS
  // =========================
  router.get("/categorias", (req, res) => {
    const q = String(req.query.q || "").trim();
    const rows = db
      .prepare(
        `SELECT id_categoria, nombre
         FROM categoria
         WHERE (?='' OR nombre LIKE '%'||?||'%')
         ORDER BY nombre;`
      )
      .all(q, q);
    res.json({ ok: true, data: rows });
  });

  router.post("/categorias", (req, res) => {
    const { nombre } = req.body || {};
    if (!nombre?.trim()) return res.status(400).json({ ok: false, message: "Nombre requerido." });
    const info = db.prepare(`INSERT INTO categoria (nombre) VALUES (?)`).run(nombre.trim());
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/categorias/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { nombre } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    if (!nombre?.trim()) return res.status(400).json({ ok: false, message: "Nombre requerido." });
    const info = db
      .prepare(`UPDATE categoria SET nombre=? WHERE id_categoria=?`)
      .run(nombre.trim(), id);
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/categorias/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db.prepare(`DELETE FROM categoria WHERE id_categoria=?`).run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // LIBROS
  // =========================
  router.get("/libros", (req, res) => {
    const q = String(req.query.q || "").trim();
    const rows = db
      .prepare(
        `SELECT
           l.id_libro, l.titulo, l.sinopsis,
           a.nombre || ' ' || a.apellidos AS autor,
           e.nombre AS editorial,
           c.nombre AS categoria,
           (SELECT COUNT(*)
              FROM lanzamiento_publicacion lp
              JOIN publicacion p ON p.id_lanzamiento = lp.id_lanzamiento
              WHERE lp.id_libro = l.id_libro) AS total_publicaciones,
           (SELECT COUNT(*)
              FROM lanzamiento_publicacion lp
              JOIN publicacion p ON p.id_lanzamiento = lp.id_lanzamiento
              WHERE lp.id_libro = l.id_libro AND p.estado = 'Disponible') AS disponibles
         FROM libro l
         LEFT JOIN autor a     ON a.id_autor         = l.id_autor
         LEFT JOIN editorial e ON e.id_editorial     = l.id_editorial
         LEFT JOIN categoria c ON c.id_categoria     = l.id_categoria
         WHERE (?='' OR l.titulo LIKE '%'||?||'%'
                OR a.nombre LIKE '%'||?||'%' OR a.apellidos LIKE '%'||?||'%')
         ORDER BY l.id_libro DESC;`
      )
      .all(q, q, q, q);
    res.json({ ok: true, data: rows });
  });

  router.get("/libros/:id/detail", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });

    const libro = db
      .prepare(
        `SELECT l.*,
                a.nombre || ' ' || a.apellidos AS autor_nombre,
                e.nombre AS editorial_nombre,
                c.nombre AS categoria_nombre
         FROM libro l
         LEFT JOIN autor a     ON a.id_autor     = l.id_autor
         LEFT JOIN editorial e ON e.id_editorial = l.id_editorial
         LEFT JOIN categoria c ON c.id_categoria = l.id_categoria
         WHERE l.id_libro=?;`
      )
      .get(id);

    if (!libro) return res.status(404).json({ ok: false, message: "Libro no encontrado." });

    const lanzamientos = db
      .prepare(
        `SELECT lp.*,
                (SELECT COUNT(*) FROM publicacion p WHERE p.id_lanzamiento = lp.id_lanzamiento) AS total,
                (SELECT COUNT(*) FROM publicacion p WHERE p.id_lanzamiento = lp.id_lanzamiento AND p.estado='Disponible') AS disponibles
         FROM lanzamiento_publicacion lp
         WHERE lp.id_libro=?
         ORDER BY lp.id_lanzamiento DESC;`
      )
      .all(id);

    res.json({ ok: true, data: { libro, lanzamientos } });
  });

  router.post("/libros", (req, res) => {
    const { titulo, id_autor, id_editorial, id_categoria, sinopsis } = req.body || {};
    if (!titulo?.trim()) return res.status(400).json({ ok: false, message: "Título requerido." });

    const info = db
      .prepare(
        `INSERT INTO libro (titulo, id_autor, id_editorial, id_categoria, sinopsis)
         VALUES (?,?,?,?,?)`
      )
      .run(
        titulo.trim(),
        id_autor ? Number(id_autor) : null,
        id_editorial ? Number(id_editorial) : null,
        id_categoria ? Number(id_categoria) : null,
        sinopsis ?? null
      );
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/libros/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { titulo, id_autor, id_editorial, id_categoria, sinopsis } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    if (!titulo?.trim()) return res.status(400).json({ ok: false, message: "Título requerido." });

    const info = db
      .prepare(
        `UPDATE libro
         SET titulo=?, id_autor=?, id_editorial=?, id_categoria=?, sinopsis=?
         WHERE id_libro=?`
      )
      .run(
        titulo.trim(),
        id_autor ? Number(id_autor) : null,
        id_editorial ? Number(id_editorial) : null,
        id_categoria ? Number(id_categoria) : null,
        sinopsis ?? null,
        id
      );
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/libros/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db.prepare(`DELETE FROM libro WHERE id_libro=?`).run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // LANZAMIENTOS
  // =========================
  router.get("/lanzamientos", (req, res) => {
    const libroId = toInt(req.query.libro_id);
    const rows = db
      .prepare(
        `SELECT lp.*, l.titulo AS libro_titulo
         FROM lanzamiento_publicacion lp
         JOIN libro l ON l.id_libro = lp.id_libro
         WHERE (?=0 OR lp.id_libro=?)
         ORDER BY lp.id_lanzamiento DESC;`
      )
      .all(libroId, libroId);
    res.json({ ok: true, data: rows });
  });

  router.post("/lanzamientos", (req, res) => {
    const { id_libro, isbn, idioma, fecha_lanzamiento, numero_edicion } = req.body || {};
    if (!id_libro) return res.status(400).json({ ok: false, message: "id_libro requerido." });

    const cleanIsbn = String(isbn ?? "").trim() || null;
    const cleanIdioma = String(idioma ?? "").trim() || "Español";
    const cleanFecha = String(fecha_lanzamiento ?? "").trim() || null;

    const info = db
      .prepare(
        `INSERT INTO lanzamiento_publicacion (id_libro, isbn, idioma, fecha_lanzamiento, numero_edicion)
         VALUES (?,?,?,?,?)`
      )
      .run(
        Number(id_libro),
        cleanIsbn,
        cleanIdioma,
        cleanFecha,
        numero_edicion ? Number(numero_edicion) : null
      );
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/lanzamientos/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { id_libro, isbn, idioma, fecha_lanzamiento, numero_edicion } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });

    const cleanIsbn = String(isbn ?? "").trim() || null;
    const cleanIdioma = String(idioma ?? "").trim() || "Español";
    const cleanFecha = String(fecha_lanzamiento ?? "").trim() || null;

    const info = db
      .prepare(
        `UPDATE lanzamiento_publicacion
         SET id_libro=?, isbn=?, idioma=?, fecha_lanzamiento=?, numero_edicion=?
         WHERE id_lanzamiento=?`
      )
      .run(
        Number(id_libro),
        cleanIsbn,
        cleanIdioma,
        cleanFecha,
        numero_edicion ? Number(numero_edicion) : null,
        id
      );
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/lanzamientos/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db
      .prepare(`DELETE FROM lanzamiento_publicacion WHERE id_lanzamiento=?`)
      .run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // PUBLICACIONES
  // =========================
  router.get("/publicaciones", (req, res) => {
    const q = String(req.query.q || "").trim();
    const estado = String(req.query.estado || "").trim();
    const rows = db
      .prepare(
        `SELECT p.id_publicacion, p.id_lanzamiento, p.codigo_inventario,
                p.ubicacion_estante, p.estado,
                l.titulo AS libro_titulo, lp.isbn, lp.numero_edicion
         FROM publicacion p
         JOIN lanzamiento_publicacion lp ON lp.id_lanzamiento = p.id_lanzamiento
         JOIN libro l ON l.id_libro = lp.id_libro
         WHERE (?='' OR p.codigo_inventario LIKE '%'||?||'%' OR l.titulo LIKE '%'||?||'%')
           AND (?='' OR p.estado=?)
         ORDER BY p.id_publicacion DESC;`
      )
      .all(q, q, q, estado, estado);
    res.json({ ok: true, data: rows });
  });

  router.get("/publicaciones/lookup", (req, res) => {
    const codigo = String(req.query.codigo || "").trim();
    if (!codigo) return res.status(400).json({ ok: false, message: "codigo requerido" });

    const row = db
      .prepare(
        `SELECT p.id_publicacion, p.codigo_inventario, p.estado, l.titulo AS libro_titulo
         FROM publicacion p
         JOIN lanzamiento_publicacion lp ON lp.id_lanzamiento = p.id_lanzamiento
         JOIN libro l ON l.id_libro = lp.id_libro
         WHERE p.codigo_inventario=?;`
      )
      .get(codigo);

    if (!row) return res.status(404).json({ ok: false, message: "No encontrado" });
    res.json({ ok: true, data: row });
  });

  router.post("/publicaciones", (req, res) => {
    const { id_lanzamiento, codigo_inventario, ubicacion_estante, estado } = req.body || {};
    if (!id_lanzamiento || !codigo_inventario?.trim()) {
      return res.status(400).json({ ok: false, message: "id_lanzamiento y codigo_inventario son requeridos." });
    }
    const info = db
      .prepare(
        `INSERT INTO publicacion (id_lanzamiento, codigo_inventario, ubicacion_estante, estado)
         VALUES (?,?,?,?)`
      )
      .run(
        Number(id_lanzamiento),
        codigo_inventario.trim(),
        ubicacion_estante ?? null,
        estado ?? "Disponible"
      );
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/publicaciones/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { ubicacion_estante, estado } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });

    const info = db
      .prepare(`UPDATE publicacion SET ubicacion_estante=?, estado=? WHERE id_publicacion=?`)
      .run(ubicacion_estante ?? null, estado ?? "Disponible", id);
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/publicaciones/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db.prepare(`DELETE FROM publicacion WHERE id_publicacion=?`).run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // USUARIOS
  // =========================
  router.get("/usuarios", (req, res) => {
    const q = String(req.query.q || "").trim();
    const rows = db
      .prepare(
        `SELECT id_usuario, nombre, apellidos, correo, telefono, estado
         FROM usuario
         WHERE (?='' OR nombre LIKE '%'||?||'%' OR apellidos LIKE '%'||?||'%' OR correo LIKE '%'||?||'%')
         ORDER BY id_usuario DESC;`
      )
      .all(q, q, q, q);
    res.json({ ok: true, data: rows });
  });

  router.post("/usuarios", (req, res) => {
    const { nombre, apellidos, correo, telefono, estado } = req.body || {};
    if (!nombre?.trim() || !apellidos?.trim() || !correo?.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre, apellidos y correo son requeridos." });
    }
    const info = db
      .prepare(
        `INSERT INTO usuario (nombre, apellidos, correo, telefono, estado) VALUES (?,?,?,?,?)`
      )
      .run(nombre.trim(), apellidos.trim(), correo.trim(), telefono ?? null, estado ?? "Activo");
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  });

  router.put("/usuarios/:id", (req, res) => {
    const id = toInt(req.params.id);
    const { nombre, apellidos, correo, telefono, estado } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    if (!nombre?.trim() || !apellidos?.trim() || !correo?.trim()) {
      return res.status(400).json({ ok: false, message: "Nombre, apellidos y correo son requeridos." });
    }
    const info = db
      .prepare(
        `UPDATE usuario SET nombre=?, apellidos=?, correo=?, telefono=?, estado=? WHERE id_usuario=?`
      )
      .run(nombre.trim(), apellidos.trim(), correo.trim(), telefono ?? null, estado ?? "Activo", id);
    res.json({ ok: true, changes: info.changes });
  });

  router.delete("/usuarios/:id", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });
    const info = db.prepare(`DELETE FROM usuario WHERE id_usuario=?`).run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // PRESTAMOS
  // =========================
  router.get("/prestamos", (req, res) => {
    const estado = String(req.query.estado || "").trim();
    const rows = db
      .prepare(
        `SELECT pr.id_prestamo,
                pr.id_usuario, u.nombre || ' ' || u.apellidos AS usuario_nombre,
                pr.id_publicacion, p.codigo_inventario, l.titulo AS libro_titulo,
                pr.fecha_prestamo, pr.fecha_limite, pr.fecha_devolucion, pr.estado
         FROM prestamo pr
         JOIN usuario u     ON u.id_usuario       = pr.id_usuario
         JOIN publicacion p ON p.id_publicacion   = pr.id_publicacion
         JOIN lanzamiento_publicacion lp ON lp.id_lanzamiento = p.id_lanzamiento
         JOIN libro l       ON l.id_libro         = lp.id_libro
         WHERE (?='' OR pr.estado=?)
         ORDER BY pr.id_prestamo DESC;`
      )
      .all(estado, estado);
    res.json({ ok: true, data: rows });
  });

  router.post("/prestamos", (req, res) => {
    const { id_usuario, id_publicacion, fecha_limite } = req.body || {};
    if (!id_usuario || !id_publicacion || !fecha_limite) {
      return res.status(400).json({ ok: false, message: "id_usuario, id_publicacion y fecha_limite son requeridos." });
    }
    try {
      const info = db
        .prepare(`INSERT INTO prestamo (id_usuario, id_publicacion, fecha_limite) VALUES (?,?,?)`)
        .run(Number(id_usuario), Number(id_publicacion), String(fecha_limite));
      res.status(201).json({ ok: true, id: info.lastInsertRowid });
    } catch (e) {
      if (String(e.message).includes("no está disponible")) {
        return res.status(409).json({ ok: false, message: "La publicación no está disponible para préstamo." });
      }
      throw e;
    }
  });

  router.put("/prestamos/:id/devolver", (req, res) => {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID inválido." });

    const prestamo = db
      .prepare(`SELECT id_prestamo, estado FROM prestamo WHERE id_prestamo=?`)
      .get(id);
    if (!prestamo) return res.status(404).json({ ok: false, message: "Préstamo no encontrado." });
    if (prestamo.estado !== "En curso") {
      return res.status(409).json({ ok: false, message: "El préstamo no está en curso." });
    }

    // Trigger trg_marcar_como_devuelto fires on this update and sets estado='Devuelto'
    const info = db
      .prepare(`UPDATE prestamo SET fecha_devolucion=CURRENT_DATE WHERE id_prestamo=?`)
      .run(id);
    res.json({ ok: true, changes: info.changes });
  });

  // =========================
  // SELECTS para UI
  // =========================
  router.get("/select/autores", (req, res) => {
    const rows = db
      .prepare(`SELECT id_autor AS id, nombre || ' ' || apellidos AS nombre FROM autor ORDER BY nombre`)
      .all();
    res.json({ ok: true, data: rows });
  });

  router.get("/select/editoriales", (req, res) => {
    const rows = db
      .prepare(`SELECT id_editorial AS id, nombre FROM editorial ORDER BY nombre`)
      .all();
    res.json({ ok: true, data: rows });
  });

  router.get("/select/categorias", (req, res) => {
    const rows = db
      .prepare(`SELECT id_categoria AS id, nombre FROM categoria ORDER BY nombre`)
      .all();
    res.json({ ok: true, data: rows });
  });

  router.get("/select/libros", (req, res) => {
    const rows = db
      .prepare(`SELECT id_libro AS id, titulo AS nombre FROM libro ORDER BY titulo`)
      .all();
    res.json({ ok: true, data: rows });
  });

  router.get("/select/usuarios", (req, res) => {
    const rows = db
      .prepare(
        `SELECT id_usuario AS id, nombre || ' ' || apellidos AS nombre
         FROM usuario WHERE estado='Activo' ORDER BY nombre`
      )
      .all();
    res.json({ ok: true, data: rows });
  });

  router.get("/select/lanzamientos", (req, res) => {
    const libroId = toInt(req.query.libro_id);
    const rows = db
      .prepare(
        `SELECT lp.id_lanzamiento AS id,
                l.titulo || COALESCE(' — Ed.' || lp.numero_edicion, '') || COALESCE(' (' || lp.isbn || ')', '') AS nombre
         FROM lanzamiento_publicacion lp
         JOIN libro l ON l.id_libro = lp.id_libro
         WHERE (?=0 OR lp.id_libro=?)
         ORDER BY lp.id_lanzamiento DESC;`
      )
      .all(libroId, libroId);
    res.json({ ok: true, data: rows });
  });

  router.get("/select/publicaciones", (req, res) => {
    const rows = db
      .prepare(
        `SELECT p.id_publicacion AS id,
                l.titulo || ' [' || p.codigo_inventario || '] — ' || p.estado AS nombre
         FROM publicacion p
         JOIN lanzamiento_publicacion lp ON lp.id_lanzamiento = p.id_lanzamiento
         JOIN libro l ON l.id_libro = lp.id_libro
         WHERE p.estado='Disponible'
         ORDER BY p.id_publicacion DESC;`
      )
      .all();
    res.json({ ok: true, data: rows });
  });

  return router;
}

module.exports = { apiRouter };