'use strict';

const pool = require('../config/db');

// 1. Ver publicaciones pendientes de MIS asesorados (Para el Asesor)
exports.obtenerPendientes = async (req, res) => {
    const matriculaAsesor = req.usuario.matricula;

    // Validación de rol (Solo asesores)
    if (req.usuario.rol !== 2) {
        return res.status(403).json({ mensaje: 'Solo los asesores pueden ver revisiones pendientes.' });
    }

    try {
        // Esta consulta es un poco compleja ("JOINs de 4 saltos"):
        // 1. Buscamos mis asesorías activas (estado=1).
        // 2. Buscamos qué publicaciones tienen esos alumnos (integrantes).
        // 3. Filtramos solo las que están en estado 'pendiente' o 'correcciones'.
        const sql = `
            SELECT DISTINCT p.id_publi, p.nombre AS titulo, p.descripcion, p.fecha, p.estado, p.imagen_portada,
                   u.nombre AS autor_nombre, u.apellido AS autor_apellido, u.matricula AS autor_matricula
            FROM publicacion p
            JOIN integrantes i ON p.id_publi = i.id_publi
            JOIN asesorias a ON i.matricula = a.matricula_estudiante
            JOIN usuario u ON i.matricula = u.matricula
            WHERE a.matricula_asesor = ? 
              AND a.estado = 1 
              AND (p.estado = 'pendiente' OR p.estado = 'correcciones' OR p.estado = 'rechazado' OR p.estado IS NULL)
            ORDER BY p.fecha ASC
        `;

        const [publicaciones] = await pool.promise().query(sql, [matriculaAsesor]);

        // Formateamos para que se vea bien en la App
        const respuesta = publicaciones.map(p => ({
            id: p.id_publi,
            titulo: p.titulo,
            descripcion: p.descripcion,
            autor: `${p.autor_nombre} ${p.autor_apellido}`,
            fecha: p.fecha,
            estado: p.estado,
            imagen: p.imagen_portada
        }));

        console.log(`REVISIONES: Asesor ${matriculaAsesor} tiene ${publicaciones.length} tesis pendientes (incluyendo correcciones).`);

        res.json({ pendientes: respuesta });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener pendientes', error });
    }
};

// 2. Emitir Revisión (Aprobar/Rechazar/Correcciones)
exports.revisarPublicacion = async (req, res) => {
    const matriculaAsesor = req.usuario.matricula;
    const { id_publi, nuevo_estado, comentarios } = req.body;
    console.log(req.body)

    // Validar estado válido
    const estadosValidos = ['aprobado', 'rechazado', 'correcciones'];
    if (!estadosValidos.includes(nuevo_estado)) {
        return res.status(400).json({ mensaje: 'Estado inválido. Use: aprobado, rechazado o correcciones.' });
    }

    if (!id_publi || !comentarios) {
        return res.status(400).json({ mensaje: 'Faltan datos (ID o comentarios).' });
    }

    try {
        // A. Verificar que tengo permiso de revisar esta tesis (es de mi alumno)
        const sqlPermiso = `
            SELECT 1 
            FROM integrantes i
            JOIN asesorias a ON i.matricula = a.matricula_estudiante
            WHERE i.id_publi = ? AND a.matricula_asesor = ? AND a.estado = 1
            LIMIT 1
        `;
        const [permiso] = await pool.promise().query(sqlPermiso, [id_publi, matriculaAsesor]);

        if (permiso.length === 0) {
            return res.status(403).json({ mensaje: 'No puedes revisar esta publicación (No eres el asesor asignado).' });
        }

        // B. Transacción: Guardar historial + Actualizar estado
        // 1. Guardar en bitácora (revisiones_publicacion)
        await pool.promise().query(
            'INSERT INTO revisiones_publicacion (id_publi, matricula_asesor, estado_asignado, comentarios) VALUES (?, ?, ?, ?)',
            [id_publi, matriculaAsesor, nuevo_estado, comentarios]
        );

        console.log("HISTORIAL GUARDADO. Intentando actualizar publicación...");
        const [resultado] = await pool.promise().query(
            'UPDATE publicacion SET estado = ? WHERE id_publi = ?',
            [nuevo_estado, id_publi]
        );

        console.log("ACTUALIZACIÓN EXITOSA. Filas afectadas:", resultado.affectedRows); 
        
        const [verificacion] = await pool.promise().query(
            'SELECT * FROM revisiones_publicacion WHERE id_publi = ? ORDER BY id_revision DESC LIMIT 1',
            [id_publi]
        );
        console.log("🔍 DATOS EN BD SEGÚN NODE:", verificacion);

        res.json({ mensaje: `Revisión registrada. Publicación marcada como: ${nuevo_estado}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al guardar revisión', error });
    }
};

// 3. Ver Historial de Revisiones (Para Estudiante o Asesor)
exports.obtenerHistorial = async (req, res) => {
    const { id_publi } = req.params;

    try {
        const sql = `
            SELECT r.estado_asignado, r.comentarios, r.fecha_revision,
                   u.nombre AS asesor_nombre, u.apellido AS asesor_apellido
            FROM revisiones_publicacion r
            JOIN usuario u ON r.matricula_asesor = u.matricula
            WHERE r.id_publi = ?
            ORDER BY r.fecha_revision DESC
        `;

        const [historial] = await pool.promise().query(sql, [id_publi]);
        res.json({ historial });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener historial', error });
    }
};