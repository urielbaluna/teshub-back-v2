'use strict';

const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Helper para procesar tags (igual que en publicaciones)
const procesarTags = (tagsInput) => {
    if (!tagsInput) return [];
    if (Array.isArray(tagsInput)) return tagsInput;
    return tagsInput.split(',').map(tag => tag.trim()).filter(t => t !== '');
};

// Crear evento (Actualizado con categoría, ubicación textual y tags)
exports.crearEvento = async (req, res) => {
    const matriculaUsuario = req.usuario.matricula;
    const { titulo, fecha, descripcion, latitud, longitud, organizadores_matriculas, cupo_maximo, categoria, ubicacion_nombre, tags } = req.body;
    let urlFoto = req.file ? 'uploads/eventos/' + req.file.filename : null;

    // Validaciones
    if (!titulo || !fecha || !descripcion || !latitud || !longitud || !organizadores_matriculas) {
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        return res.status(400).json({ mensaje: 'Faltan campos obligatorios' });
    }

    const cupoFinal = cupo_maximo || 50;
    const categoriaFinal = categoria || 'General';
    const ubicacionFinal = ubicacion_nombre || 'Ubicación por definir';

    // Procesar organizadores
    const organizadoresArray = organizadores_matriculas.toString().split(',').map(m => m.trim()).filter(Boolean);
    
    // Validar que el creador esté en la lista
    if (!organizadoresArray.includes(matriculaUsuario.toString())) {
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        return res.status(403).json({ mensaje: 'Debes incluirte como organizador' });
    }

    try {
        // 1. Verificar existencia de organizadores
        const [users] = await pool.promise().query('SELECT matricula FROM usuario WHERE matricula IN (?)', [organizadoresArray]);
        const existentes = users.map(r => r.matricula.toString());
        const noExistentes = organizadoresArray.filter(m => !existentes.includes(m));

        if (noExistentes.length > 0) {
            if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) fs.unlinkSync(path.join(__dirname, '..', urlFoto));
            return res.status(400).json({ mensaje: `Usuarios no encontrados: ${noExistentes.join(', ')}` });
        }

        // 2. Insertar Evento (Con nuevos campos)
        const sqlEvento = `
            INSERT INTO evento (titulo, fecha, descripcion, url_foto, latitud, longitud, cupo_maximo, categoria, ubicacion_nombre) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await pool.promise().query(sqlEvento, [titulo, fecha, descripcion, urlFoto, latitud, longitud, cupoFinal, categoriaFinal, ubicacionFinal]);
        const idEvento = result.insertId;

        // 3. Insertar Relación Organizadores
        const valuesOrg = organizadoresArray.map(m => [idEvento, m]);
        await pool.promise().query('INSERT INTO evento_organizadores (id_evento, matricula) VALUES ?', [valuesOrg]);

        // 4. Insertar Etiquetas (Tags)
        const listaTags = procesarTags(tags);
        if (listaTags.length > 0) {
            for (const tagName of listaTags) {
                let idEtiqueta;
                const [tagExistente] = await pool.promise().query('SELECT id_etiqueta FROM etiquetas WHERE nombre = ?', [tagName]);
                
                if (tagExistente.length > 0) {
                    idEtiqueta = tagExistente[0].id_etiqueta;
                } else {
                    const [newTag] = await pool.promise().query('INSERT INTO etiquetas (nombre) VALUES (?)', [tagName]);
                    idEtiqueta = newTag.insertId;
                }
                await pool.promise().query('INSERT IGNORE INTO evento_etiquetas (id_evento, id_etiqueta) VALUES (?, ?)', [idEvento, idEtiqueta]);
            }
        }

        res.status(201).json({ mensaje: 'Evento creado exitosamente', id_evento: idEvento });

    } catch (error) {
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        console.error(error);
        res.status(500).json({ mensaje: 'Error al crear evento', error });
    }
};

// Listar eventos (Actualizado con filtros y nuevos campos)
exports.listarEventos = async (req, res) => {
    const matriculaUsuario = req.usuario.matricula;
    const { categoria, busqueda } = req.query; 

    try {
        let sql = `
            SELECT e.*, 
                   (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento) as asistentes_registrados,
                   (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento AND matricula = ?) as usuario_registrado,
                   (SELECT GROUP_CONCAT(et.nombre SEPARATOR ', ') 
                    FROM etiquetas et 
                    JOIN evento_etiquetas ee ON et.id_etiqueta = ee.id_etiqueta 
                    WHERE ee.id_evento = e.id_evento) as tags
            FROM evento e
            WHERE 1=1
        `;
        
        const params = [matriculaUsuario];

        if (categoria && categoria !== 'Todas' && categoria !== 'all') {
            sql += ' AND e.categoria = ?';
            params.push(categoria);
        }

        if (busqueda) {
            sql += ' AND (e.titulo LIKE ? OR e.descripcion LIKE ?)';
            params.push(`%${busqueda}%`, `%${busqueda}%`);
        }

        sql += ' ORDER BY e.fecha DESC';

        const [eventos] = await pool.promise().query(sql, params);

        // --- NUEVO: Obtener organizadores para estos eventos ---
        if (eventos.length > 0) {
            const idsEventos = eventos.map(e => e.id_evento);
            
            // Consulta masiva de organizadores
            const sqlOrgs = `
                SELECT eo.id_evento, u.matricula, u.nombre, u.apellido, u.imagen
                FROM evento_organizadores eo
                JOIN usuario u ON eo.matricula = u.matricula
                WHERE eo.id_evento IN (?)
            `;
            
            const [organizadores] = await pool.promise().query(sqlOrgs, [idsEventos]);

            // Agrupar organizadores por id_evento
            const orgsPorEvento = {};
            organizadores.forEach(org => {
                if (!orgsPorEvento[org.id_evento]) orgsPorEvento[org.id_evento] = [];
                orgsPorEvento[org.id_evento].push({
                    matricula: org.matricula.toString(),
                    nombre: org.nombre,
                    apellido: org.apellido,
                    imagen: org.imagen
                });
            });

            // Asignar al resultado final
            const respuesta = eventos.map(ev => ({
                ...ev,
                id: ev.id_evento, // Android espera "id" a veces
                tags: ev.tags ? ev.tags.split(', ') : [],
                usuario_registrado: ev.usuario_registrado > 0,
                ubicacion: { latitud: Number(ev.latitud), longitud: Number(ev.longitud) },
                // Aquí inyectamos la lista (o vacía si no hay)
                organizadores: orgsPorEvento[ev.id_evento] || [] 
            }));

            res.json({ eventos: respuesta });
        } else {
            res.json({ eventos: [] });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al listar eventos', error });
    }
};

// Ver evento específico
exports.verEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    try {
        const sql = `
            SELECT e.*, 
                   (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento) as asistentes_registrados,
                   (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento AND matricula = ?) as usuario_registrado
            FROM evento e
            WHERE e.id_evento = ?
        `;
        
        const [rows] = await pool.promise().query(sql, [matriculaUsuario, id]);

        if (rows.length === 0) return res.status(404).json({ mensaje: 'Evento no encontrado' });
        const evento = rows[0];

        // Obtener organizadores
        const [organizadores] = await pool.promise().query(
            'SELECT u.matricula, u.nombre, u.apellido, u.imagen FROM usuario u JOIN evento_organizadores eo ON u.matricula = eo.matricula WHERE eo.id_evento = ?',
            [id]
        );

        // Obtener tags
        const [tags] = await pool.promise().query(
            'SELECT et.nombre FROM etiquetas et JOIN evento_etiquetas ee ON et.id_etiqueta = ee.id_etiqueta WHERE ee.id_evento = ?',
            [id]
        );

        res.json({
            evento: {
                ...evento,
                tags: tags.map(t => t.nombre),
                organizadores,
                usuario_registrado: evento.usuario_registrado > 0,
                ubicacion: { latitud: Number(evento.latitud), longitud: Number(evento.longitud) }
            }
        });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error del servidor', error });
    }
};

// Actualizar evento
exports.actualizarEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;
    const { titulo, fecha, descripcion, latitud, longitud, organizadores_matriculas, cupo_maximo, categoria, ubicacion_nombre, tags } = req.body;
    
    // Manejo de imagen
    let urlFoto = req.file ? 'uploads/eventos/' + req.file.filename : undefined; // undefined para no sobreescribir si no se envía

    try {
        // 1. Verificar permiso (Solo organizadores)
        const [perms] = await pool.promise().query('SELECT * FROM evento_organizadores WHERE id_evento = ? AND matricula = ?', [id, matriculaUsuario]);
        if (perms.length === 0) {
            if (req.file) fs.unlinkSync(path.join(__dirname, '..', urlFoto));
            return res.status(403).json({ mensaje: 'No tienes permiso' });
        }

        // 2. Construir Update dinámico
        let campos = [];
        let valores = [];

        if (titulo) { campos.push('titulo = ?'); valores.push(titulo); }
        if (fecha) { campos.push('fecha = ?'); valores.push(fecha); }
        if (descripcion) { campos.push('descripcion = ?'); valores.push(descripcion); }
        if (latitud) { campos.push('latitud = ?'); valores.push(latitud); }
        if (longitud) { campos.push('longitud = ?'); valores.push(longitud); }
        if (cupo_maximo) { campos.push('cupo_maximo = ?'); valores.push(cupo_maximo); }
        if (categoria) { campos.push('categoria = ?'); valores.push(categoria); }
        if (ubicacion_nombre) { campos.push('ubicacion_nombre = ?'); valores.push(ubicacion_nombre); }
        
        if (urlFoto) {
            // Borrar foto anterior
            const [old] = await pool.promise().query('SELECT url_foto FROM evento WHERE id_evento = ?', [id]);
            if (old[0]?.url_foto && fs.existsSync(path.join(__dirname, '..', old[0].url_foto))) {
                fs.unlinkSync(path.join(__dirname, '..', old[0].url_foto));
            }
            campos.push('url_foto = ?');
            valores.push(urlFoto);
        }

        if (campos.length > 0) {
            valores.push(id);
            await pool.promise().query(`UPDATE evento SET ${campos.join(', ')} WHERE id_evento = ?`, valores);
        }

        // 3. Actualizar Organizadores (si se enviaron)
        if (organizadores_matriculas) {
            const orgsArray = organizadores_matriculas.toString().split(',').map(m => m.trim());
            if (!orgsArray.includes(matriculaUsuario.toString())) {
                return res.status(400).json({ mensaje: 'No puedes eliminarte a ti mismo de los organizadores' });
            }
            // Borrar y reinsertar
            await pool.promise().query('DELETE FROM evento_organizadores WHERE id_evento = ?', [id]);
            const valuesOrg = orgsArray.map(m => [id, m]);
            await pool.promise().query('INSERT INTO evento_organizadores (id_evento, matricula) VALUES ?', [valuesOrg]);
        }

        // 4. Actualizar Tags (si se enviaron)
        if (tags) {
            const listaTags = procesarTags(tags);
            await pool.promise().query('DELETE FROM evento_etiquetas WHERE id_evento = ?', [id]);
            
            for (const tagName of listaTags) {
                let idEtiqueta;
                const [tagExistente] = await pool.promise().query('SELECT id_etiqueta FROM etiquetas WHERE nombre = ?', [tagName]);
                if (tagExistente.length > 0) idEtiqueta = tagExistente[0].id_etiqueta;
                else {
                    const [newTag] = await pool.promise().query('INSERT INTO etiquetas (nombre) VALUES (?)', [tagName]);
                    idEtiqueta = newTag.insertId;
                }
                await pool.promise().query('INSERT IGNORE INTO evento_etiquetas (id_evento, id_etiqueta) VALUES (?, ?)', [id, idEtiqueta]);
            }
        }

        res.json({ mensaje: 'Evento actualizado correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al actualizar', error });
    }
};

// Eliminar evento (Async)
exports.eliminarEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    try {
        const [perms] = await pool.promise().query('SELECT * FROM evento_organizadores WHERE id_evento = ? AND matricula = ?', [id, matriculaUsuario]);
        if (perms.length === 0) return res.status(403).json({ mensaje: 'No tienes permiso' });

        // Borrar foto
        const [old] = await pool.promise().query('SELECT url_foto FROM evento WHERE id_evento = ?', [id]);
        if (old[0]?.url_foto && fs.existsSync(path.join(__dirname, '..', old[0].url_foto))) {
            fs.unlinkSync(path.join(__dirname, '..', old[0].url_foto));
        }

        await pool.promise().query('DELETE FROM evento WHERE id_evento = ?', [id]);
        res.json({ mensaje: 'Evento eliminado' });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error', error });
    }
};

// Registrar asistencia (Async)
exports.registrarseEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    try {
        const [evento] = await pool.promise().query('SELECT cupo_maximo FROM evento WHERE id_evento = ?', [id]);
        if (evento.length === 0) return res.status(404).json({ mensaje: 'Evento no encontrado' });

        const [asistentes] = await pool.promise().query('SELECT COUNT(*) as total FROM evento_asistentes WHERE id_evento = ?', [id]);
        
        if (asistentes[0].total >= evento[0].cupo_maximo) {
            return res.status(400).json({ mensaje: 'Cupo lleno' });
        }

        await pool.promise().query('INSERT IGNORE INTO evento_asistentes (id_evento, matricula) VALUES (?, ?)', [id, matriculaUsuario]);
        res.json({ mensaje: 'Registro exitoso' });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error', error });
    }
};

// Cancelar asistencia (Async)
exports.cancelarRegistroEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    try {
        const [result] = await pool.promise().query('DELETE FROM evento_asistentes WHERE id_evento = ? AND matricula = ?', [id, matriculaUsuario]);
        if (result.affectedRows === 0) return res.status(400).json({ mensaje: 'No estabas registrado' });
        
        res.json({ mensaje: 'Registro cancelado' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error', error });
    }
};