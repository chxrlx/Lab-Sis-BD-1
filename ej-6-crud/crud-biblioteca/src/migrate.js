function migrateIfNeeded(db) {
  db.pragma("foreign_keys = OFF");

  const tx = db.transaction(() => {
    // Drop old-schema tables (uppercase names) if they exist
    const oldTables = [
      "PRESTAMO_ITEM", "RESERVA", "PRESTAMO", "EJEMPLAR", "EDICION",
      "LIBRO_AUTOR", "LIBRO", "USUARIO", "EDITORIAL", "AUTOR"
    ];
    for (const t of oldTables) {
      if (tableExists(db, t)) {
        db.exec(`DROP TABLE IF EXISTS ${t};`);
      }
    }

    // Create new schema tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS autor (
        id_autor     INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT NOT NULL,
        apellidos    TEXT NOT NULL,
        nacionalidad TEXT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS editorial (
        id_editorial INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT NOT NULL,
        pais         TEXT
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS categoria (
        id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre       TEXT NOT NULL UNIQUE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS libro (
        id_libro     INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo       TEXT NOT NULL,
        id_autor     INTEGER,
        id_editorial INTEGER,
        id_categoria INTEGER,
        sinopsis     TEXT,
        FOREIGN KEY (id_autor)     REFERENCES autor(id_autor)         ON DELETE SET NULL,
        FOREIGN KEY (id_editorial) REFERENCES editorial(id_editorial) ON DELETE SET NULL,
        FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria) ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS lanzamiento_publicacion (
        id_lanzamiento   INTEGER PRIMARY KEY AUTOINCREMENT,
        id_libro         INTEGER NOT NULL,
        isbn             TEXT UNIQUE,
        idioma           TEXT DEFAULT 'Español',
        fecha_lanzamiento DATE,
        numero_edicion   INTEGER,
        FOREIGN KEY (id_libro) REFERENCES libro(id_libro) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS publicacion (
        id_publicacion    INTEGER PRIMARY KEY AUTOINCREMENT,
        id_lanzamiento    INTEGER NOT NULL,
        codigo_inventario TEXT UNIQUE NOT NULL,
        ubicacion_estante TEXT,
        estado            TEXT DEFAULT 'Disponible',
        FOREIGN KEY (id_lanzamiento) REFERENCES lanzamiento_publicacion(id_lanzamiento) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS usuario (
        id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre     TEXT NOT NULL,
        apellidos  TEXT NOT NULL,
        correo     TEXT UNIQUE NOT NULL,
        telefono   TEXT,
        estado     TEXT DEFAULT 'Activo'
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS prestamo (
        id_prestamo      INTEGER PRIMARY KEY AUTOINCREMENT,
        id_usuario       INTEGER NOT NULL,
        id_publicacion   INTEGER NOT NULL,
        fecha_prestamo   DATE DEFAULT CURRENT_DATE,
        fecha_limite     DATE NOT NULL,
        fecha_devolucion DATE,
        estado           TEXT DEFAULT 'En curso',
        FOREIGN KEY (id_usuario)     REFERENCES usuario(id_usuario)         ON DELETE CASCADE,
        FOREIGN KEY (id_publicacion) REFERENCES publicacion(id_publicacion) ON DELETE CASCADE
      );
    `);

    // Indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_libro_titulo            ON libro(titulo);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_lanzamiento_isbn        ON lanzamiento_publicacion(isbn);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_usuario_correo          ON usuario(correo);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_fk_libro_autor          ON libro(id_autor);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_fk_publicacion_lanz     ON publicacion(id_lanzamiento);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_fk_prestamo_usuario     ON prestamo(id_usuario);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_fk_prestamo_publicacion ON prestamo(id_publicacion);`);

    // Triggers (from esquema.txt)
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_validar_disponibilidad
      BEFORE INSERT ON prestamo
      FOR EACH ROW
      BEGIN
        SELECT RAISE(ABORT, 'Error: Esta publicación no está disponible para préstamo.')
        WHERE (SELECT estado FROM publicacion WHERE id_publicacion = NEW.id_publicacion) != 'Disponible';
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_marcar_como_prestado
      AFTER INSERT ON prestamo
      FOR EACH ROW
      BEGIN
        UPDATE publicacion
        SET estado = 'Prestado'
        WHERE id_publicacion = NEW.id_publicacion;
      END;
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_marcar_como_devuelto
      AFTER UPDATE OF fecha_devolucion ON prestamo
      FOR EACH ROW
      WHEN NEW.fecha_devolucion IS NOT NULL AND OLD.fecha_devolucion IS NULL
      BEGIN
        UPDATE publicacion
        SET estado = 'Disponible'
        WHERE id_publicacion = NEW.id_publicacion;

        UPDATE prestamo
        SET estado = 'Devuelto'
        WHERE id_prestamo = NEW.id_prestamo;
      END;
    `);
  });

  tx();
  db.pragma("foreign_keys = ON");
}

function tableExists(db, name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
}

module.exports = { migrateIfNeeded };