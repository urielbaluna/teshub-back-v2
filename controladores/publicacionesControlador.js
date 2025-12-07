'use strict';

const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Helper para procesar tags (Separa string por comas y limpia espacios)
const procesarTags = (tagsInput) => {
    if (!tagsInput) return [];
    if (Array.isArray(tagsInput)) return tagsInput;
    return tagsInput.split(',').map(tag => tag.trim()).filter(t => t !== '');
};

function tiempoTranscurrido(fecha) {
    if (!fecha) return 'Reciente';
    const ahora = new Date();
    const fechaPub = new Date(fecha);
    const diffMs = ahora - fechaPub;
    const diffSeg = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSeg / 60);
    const diffHoras = Math.floor(diffMin / 60);
    const diffDias = Math.floor(diffHoras / 24);

    if (diffDias > 0) return `hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;
    if (diffHoras > 0) return `hace ${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
    if (diffMin > 0) return `hace ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
    return `hace ${diffSeg} segundo${diffSeg !== 1 ? 's' : ''}`;
}

exports.registrarPublicacion = async (req, res) => {
    const matriculaSolicitante = req.usuario.matricula;
    const rolSolicitante = req.usuario.rol;
    
    // Recibimos campos nuevos: tags
    let { titulo, colaboradores, descripcion, tags } = req.body;
    
    // Manejo de archivos (Multer fields)
    // Asumimos que en rutas usarás: upload.fields([{ name: 'portada', maxCount: 1 }, { name: 'archivos' }])
    const archivosDocs = req.files && req.files['archivos'] ? req.files['archivos'].map(f => 'uploads/publicaciones/' + f.filename) : [];
    const portada = req.files && req.files['portada'] ? 'uploads/publicaciones/' + req.files['portada'][0].filename : null;

    if (!titulo || !descripcion) {
        return res.status(400).json({ mensaje: 'Título y descripción son obligatorios' });
    }

    // 1. Definir Estado Inicial
    // Si es Estudiante -> Pendiente. Si es Asesor/Admin -> Aprobado directo.
    let estadoInicial = (rolSolicitante === 1 || rolSolicitante === 2) ? 'aprobado' : 'pendiente';

    // 2. Procesar Colaboradores
    let colaboradoresArray = [];
    if (colaboradores) {
        if (Array.isArray(colaboradores)) {
            colaboradoresArray = colaboradores.flatMap(c => c.toString().split(',').map(x => x.trim()));
        } else {
            colaboradoresArray = colaboradores.toString().split(',').map(c => c.trim());
        }
    }
    // Asegurar que el creador esté en la lista
    if (!colaboradoresArray.includes(matriculaSolicitante.toString())) {
        colaboradoresArray.push(matriculaSolicitante.toString());
    }

    try {
        // Verificar existencia de colaboradores
        if (colaboradoresArray.length > 0) {
            const [users] = await pool.promise().query('SELECT matricula FROM usuario WHERE matricula IN (?)', [colaboradoresArray]);
            const existentes = users.map(u => u.matricula.toString());
            const noExistentes = colaboradoresArray.filter(m => !existentes.includes(m));
            
            if (noExistentes.length > 0) {
                return res.status(400).json({ mensaje: `Colaboradores no encontrados: ${noExistentes.join(', ')}` });
            }
        }

        // 3. Insertar Publicación
        const sqlPubli = `INSERT INTO publicacion (nombre, descripcion, fecha, estado, imagen_portada, vistas, descargas) 
                          VALUES (?, ?, CURDATE(), ?, ?, 0, 0)`;
        
        const [result] = await pool.promise().query(sqlPubli, [titulo, descripcion, estadoInicial, portada]);
        const idPubli = result.insertId;

        // 4. Insertar Integrantes
        if (colaboradoresArray.length > 0) {
            const valoresIntegrantes = colaboradoresArray.map(m => [m, idPubli]);
            await pool.promise().query('INSERT IGNORE INTO integrantes (matricula, id_publi) VALUES ?', [valoresIntegrantes]);
        }

        // 5. Insertar Archivos (PDFs)
        if (archivosDocs.length > 0) {
            const valoresArchivos = archivosDocs.map(ruta => [idPubli, ruta]);
            await pool.promise().query('INSERT INTO archivos (id_publi, ruta) VALUES ?', [valoresArchivos]);
        }

        // 6. Insertar Etiquetas (Tags)
        const listaTags = procesarTags(tags);
        if (listaTags.length > 0) {
            for (const tagName of listaTags) {
                // a. Verificar si existe la etiqueta, si no crearla
                // Usamos INSERT IGNORE o un check previo
                let idEtiqueta;
                const [tagExistente] = await pool.promise().query('SELECT id_etiqueta FROM etiquetas WHERE nombre = ?', [tagName]);
                
                if (tagExistente.length > 0) {
                    idEtiqueta = tagExistente[0].id_etiqueta;
                } else {
                    const [newTag] = await pool.promise().query('INSERT INTO etiquetas (nombre) VALUES (?)', [tagName]);
                    idEtiqueta = newTag.insertId;
                }

                // b. Relacionar Publicación <-> Etiqueta
                await pool.promise().query('INSERT IGNORE INTO publicacion_etiquetas (id_publi, id_etiqueta) VALUES (?, ?)', [idPubli, idEtiqueta]);
            }
        }

        res.status(200).json({ 
            mensaje: estadoInicial === 'pendiente' ? 'Publicación enviada a revisión.' : 'Publicación registrada exitosamente.',
            id_publi: idPubli 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al registrar publicación', error });
    }
}

exports.listarPublicaciones = async (req, res) => {
    try {
        const sql = `
            SELECT p.id_publi, p.nombre, p.descripcion, p.fecha, p.imagen_portada, p.vistas, p.descargas,
                   (SELECT AVG(evaluacion) FROM evaluacion WHERE id_publi = p.id_publi) as rating,
                   (SELECT GROUP_CONCAT(e.nombre SEPARATOR ', ') 
                    FROM etiquetas e 
                    JOIN publicacion_etiquetas pe ON e.id_etiqueta = pe.id_etiqueta 
                    WHERE pe.id_publi = p.id_publi) as tags,
                   (SELECT GROUP_CONCAT(CONCAT(u.nombre, ' ', u.apellido) SEPARATOR ', ')
                    FROM usuario u
                    JOIN integrantes i ON u.matricula = i.matricula
                    WHERE i.id_publi = p.id_publi) as autores
            FROM publicacion p
            WHERE p.estado = 'aprobado'
            ORDER BY p.fecha DESC
        `;

        const [publicaciones] = await pool.promise().query(sql);

        const resultado = publicaciones.map(pub => ({
            id: pub.id_publi,
            title: pub.nombre,
            author: pub.autores || 'Anónimo',
            description: pub.descripcion,
            tags: pub.tags ? pub.tags.split(', ') : [],
            rating: pub.rating ? Number(pub.rating).toFixed(1) : "0.0",
            downloads: pub.descargas,
            views: pub.vistas,
            image: pub.imagen_portada,
            date: pub.fecha,
            // AQUÍ ESTABA EL ERROR: Asegúrate de llamar a la función
            hace_cuanto: tiempoTranscurrido(pub.fecha), 
            type: "PDF"
        }));

        res.status(200).json({ publicaciones: resultado });

    } catch (error) {
        console.error(error); // Agrega log para ver errores en consola
        res.status(500).json({ mensaje: 'Error al obtener feed', error });
    }
}

exports.verPublicacion = async (req, res) => {
    const { id_publi } = req.params;

    try {
        // Obtener datos principales
        const sql = `
            SELECT p.*, 
                   (SELECT AVG(evaluacion) FROM evaluacion WHERE id_publi = p.id_publi) as promedio_calificacion,
                   (SELECT COUNT(*) FROM evaluacion WHERE id_publi = p.id_publi) as total_calificaciones
            FROM publicacion p
            WHERE p.id_publi = ?
        `;
        const [rows] = await pool.promise().query(sql, [id_publi]);

        if (rows.length === 0) return res.status(404).json({ mensaje: 'Publicación no encontrada' });
        const publi = rows[0];

        // Consultas paralelas para detalles
        const [archivos] = await pool.promise().query('SELECT ruta FROM archivos WHERE id_publi = ?', [id_publi]);
        const [integrantes] = await pool.promise().query(
            `SELECT u.matricula, u.nombre, u.apellido, u.imagen 
             FROM usuario u JOIN integrantes i ON u.matricula = i.matricula 
             WHERE i.id_publi = ?`, [id_publi]);
        
        const [comentarios] = await pool.promise().query(
            `SELECT c.comentario, u.nombre, u.imagen 
             FROM comentario c JOIN usuario u ON c.matricula = u.matricula 
             WHERE c.id_publi = ?`, [id_publi]);

        const [tags] = await pool.promise().query(
            `SELECT e.nombre FROM etiquetas e 
             JOIN publicacion_etiquetas pe ON e.id_etiqueta = pe.id_etiqueta 
             WHERE pe.id_publi = ?`, [id_publi]);

        res.json({
            publicacion: {
                ...publi,
                archivos: archivos.map(a => a.ruta),
                integrantes,
                comentarios,
                tags: tags.map(t => t.nombre),
                calificacion_promedio: publi.promedio_calificacion ? Number(publi.promedio_calificacion).toFixed(1) : "0.0"
            }
        });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error del servidor', error });
    }
}

// Actualizar (Modificado para usar promesas y respetar tags/portada)
exports.actualizarPublicacion = async (req, res) => {
    const matriculaSolicitante = req.usuario.matricula;
    const { id_publi } = req.params;
    // Datos de texto: título, descripción, tags.
    const { titulo, descripcion, tags } = req.body; 

    // 1. Manejo de archivo de Portada (asumiendo Multer fields: 'portada')
    const portadaNueva = req.files && req.files['portada'] 
        ? 'uploads/publicaciones/' + req.files['portada'][0].filename 
        : null;

    try {
        // 2. Verificar Permiso y Obtener Estado Actual/Ruta de Imagen Vieja
        const [publiDataRows] = await pool.promise().query(
            `SELECT p.estado, p.imagen_portada, i.matricula 
             FROM publicacion p 
             LEFT JOIN integrantes i ON p.id_publi = i.id_publi 
             WHERE p.id_publi = ?`,
            [id_publi]
        );
        
        if (publiDataRows.length === 0) return res.status(404).json({ mensaje: 'Publicación no encontrada' });

        const currentStatus = publiDataRows[0].estado;
        const oldImagePath = publiDataRows[0].imagen_portada;
        const esIntegrante = publiDataRows.some(row => row.matricula == matriculaSolicitante);
        
        if (!esIntegrante && req.usuario.rol !== 1) {
            // Borrar archivo nuevo si no tiene permiso
            if (portadaNueva) fs.unlinkSync(path.join(__dirname, '..', portadaNueva));
            return res.status(403).json({ mensaje: 'No tienes permiso para editar esta publicación.' });
        }

        // 3. Construir query de actualización dinámicamente
        let campos = [];
        let valores = [];
        let updateMessage = 'Publicación actualizada.';
        
        const agregar = (campo, valor) => { if (valor?.trim() !== undefined && valor?.trim() !== '') { campos.push(`${campo} = ?`); valores.push(valor.trim()); } };

        agregar('nombre', titulo);
        agregar('descripcion', descripcion);

        // 4. LÓGICA DE RESUBMISIÓN (Si edita un trabajo rechazado, se marca como 'pendiente')
        if (currentStatus === 'correcciones' || currentStatus === 'rechazado') {
            campos.push('estado = ?');
            valores.push('pendiente');
            updateMessage = 'Publicación reenviada a revisión.';
        } 

        // 5. Manejar nueva Portada
        if (portadaNueva) {
            // Borrar archivo viejo
            if (oldImagePath && fs.existsSync(path.join(__dirname, '..', oldImagePath))) {
                fs.unlinkSync(path.join(__dirname, '..', oldImagePath));
            }
            campos.push('imagen_portada = ?');
            valores.push(portadaNueva);
        }
        
        if (campos.length === 0 && !tags) {
             if (portadaNueva) fs.unlinkSync(path.join(__dirname, '..', portadaNueva));
             return res.status(400).json({ mensaje: 'Nada para actualizar' });
        }
        
        // 6. Ejecutar Update Básico (Título, Descripción, Estado)
        valores.push(id_publi);
        await pool.promise().query(`UPDATE publicacion SET ${campos.join(', ')} WHERE id_publi = ?`, valores);
        
        // 7. Actualizar Tags
        if (tags) {
            const listaTags = procesarTags(tags); 
            await pool.promise().query('DELETE FROM publicacion_etiquetas WHERE id_publi = ?', [id_publi]);
            
            // Lógica para reinsertar tags
            for (const tagName of listaTags) {
                let idEtiqueta;
                const [tagExistente] = await pool.promise().query('SELECT id_etiqueta FROM etiquetas WHERE nombre = ?', [tagName]);
                if (tagExistente.length > 0) {
                    idEtiqueta = tagExistente[0].id_etiqueta;
                } else {
                    const [newTag] = await pool.promise().query('INSERT INTO etiquetas (nombre) VALUES (?)', [tagName]);
                    idEtiqueta = newTag.insertId;
                }
                await pool.promise().query('INSERT IGNORE INTO publicacion_etiquetas (id_publi, id_etiqueta) VALUES (?, ?)', [id_publi, idEtiqueta]);
            }
        }
        
        // Nota: La lógica para eliminar/reemplazar archivos adjuntos (PDFs) no está incluida aquí. 
        // Si quieres modificar PDFs, necesitas endpoints separados o extender este controlador.

        res.json({ mensaje: updateMessage });

    } catch (error) {
        console.error("Error al actualizar publicación:", error);
        // Limpiar el archivo nuevo si falló la BD
        if (portadaNueva && fs.existsSync(path.join(__dirname, '..', portadaNueva))) {
             fs.unlinkSync(path.join(__dirname, '..', portadaNueva));
        }
        res.status(500).json({ mensaje: 'Error al actualizar', error });
    }
}

// Eliminar (Usando promesas para limpieza)
exports.eliminarPublicacion = async (req, res) => {
    const matriculaSolicitante = req.usuario.matricula;
    const { id_publi } = req.params;

    try {
        const [integrantes] = await pool.promise().query('SELECT matricula FROM integrantes WHERE id_publi = ?', [id_publi]);
        if (integrantes.length === 0) return res.status(404).json({ mensaje: 'No existe' });

        const esIntegrante = integrantes.some(i => i.matricula == matriculaSolicitante);
        if (!esIntegrante && req.usuario.rol !== 1) return res.status(403).json({ mensaje: 'Sin permiso' });

        // Borrar archivos físicos
        const [archivos] = await pool.promise().query('SELECT ruta FROM archivos WHERE id_publi = ?', [id_publi]);
        archivos.forEach(a => {
            const p = path.join(__dirname, '..', a.ruta);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        // Borrar portada física
        const [publi] = await pool.promise().query('SELECT imagen_portada FROM publicacion WHERE id_publi = ?', [id_publi]);
        if (publi[0]?.imagen_portada) {
            const p = path.join(__dirname, '..', publi[0].imagen_portada);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }

        // Borrar de BD (CASCADE se encarga de tablas hijas, pero archivos no siempre)
        await pool.promise().query('DELETE FROM publicacion WHERE id_publi = ?', [id_publi]);

        res.json({ mensaje: 'Publicación eliminada' });

    } catch (error) {
        console.log(error);
        
        res.status(500).json({ mensaje: 'Error', error });
    }
}

// --- NUEVAS FUNCIONES DE MÉTRICAS ---

exports.incrementarVistas = async (req, res) => {
    const { id_publi } = req.params;
    try {
        await pool.promise().query('UPDATE publicacion SET vistas = vistas + 1 WHERE id_publi = ?', [id_publi]);
        res.json({ mensaje: 'Vista registrada' });
    } catch (error) {
        res.status(500).json(error);
    }
}

exports.incrementarDescargas = async (req, res) => {
    const { id_publi } = req.params;
    try {
        await pool.promise().query('UPDATE publicacion SET descargas = descargas + 1 WHERE id_publi = ?', [id_publi]);
        res.json({ mensaje: 'Descarga registrada' });
    } catch (error) {
        res.status(500).json(error);
    }
}

// Funciones pequeñas existentes (Promisified)
exports.calificarPublicacion = async (req, res) => {
    const matricula = req.usuario.matricula;
    const { id_publi, evaluacion } = req.body;

    try {
        const [check] = await pool.promise().query('SELECT * FROM evaluacion WHERE matricula = ? AND id_publi = ?', [matricula, id_publi]);
        if (check.length > 0) return res.status(400).json({ mensaje: 'Ya calificaste esta publicación' });

        await pool.promise().query('INSERT INTO evaluacion (matricula, id_publi, evaluacion) VALUES (?, ?, ?)', [matricula, id_publi, evaluacion]);
        res.json({ mensaje: 'Calificación guardada' });
    } catch (error) {
        res.status(500).json({ error });
    }
}

exports.comentarPublicacion = async (req, res) => {
    const matricula = req.usuario.matricula;
    const { id_publi, comentario } = req.body;
    try {
        await pool.promise().query('INSERT INTO comentario (comentario, matricula, id_publi) VALUES (?, ?, ?)', [comentario, matricula, id_publi]);
        res.json({ mensaje: 'Comentario guardado' });
    } catch (error) {
        res.status(500).json({ error });
    }
}

exports.eliminarComentario = async (req, res) => {
    const matriculaSolicitante = req.usuario.matricula;
    const rol = req.usuario.rol;
    const { matricula, id_publi, comentario } = req.body;

    // Validaciones básicas
    if (!matricula || !id_publi || !comentario || comentario.trim() === "") {
        return res.status(400).json({ mensaje: 'Los campos matrícula, id_publi y comentario son obligatorios' });
    }

    // Validación de permisos: Solo el dueño del comentario o un Admin (rol 1) pueden borrarlo
    if (matriculaSolicitante.toString() !== matricula.toString() && rol !== 1) {
        return res.status(403).json({ mensaje: 'No tienes permiso para eliminar este comentario' });
    }

    try {
        const sqlDelete = 'DELETE FROM comentario WHERE matricula = ? AND id_publi = ? AND comentario = ?';
        
        // Ejecución con promesa
        const [result] = await pool.promise().query(sqlDelete, [matricula, id_publi, comentario.trim()]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'Comentario no encontrado o ya fue eliminado' });
        }

        res.json({ mensaje: 'Comentario eliminado correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al eliminar comentario', error });
    }
}