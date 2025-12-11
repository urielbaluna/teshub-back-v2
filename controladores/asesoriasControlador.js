'use strict';

const pool = require('../config/db');

function obtenerNombreRol(numero) {
    switch (numero) {
        case 1: return 'Administrador';
        case 2: return 'Asesor';
        case 3: return 'Estudiante';
        default: return 'Desconocido';
    }
}

// 1. Estudiante solicita a un Profesor ser su asesor
exports.solicitarAsesoria = async (req, res) => {
    const matriculaEstudiante = req.usuario.matricula;
    const { matricula_asesor } = req.body;

    if (!matricula_asesor) {
        return res.status(400).json({ mensaje: 'Debes indicar la matrícula del asesor' });
    }

    try {
        // A. Verificar que el destino sea realmente un Asesor (Rol 2)
        const [asesor] = await pool.promise().query('SELECT rol FROM usuario WHERE matricula = ? AND estado = 1', [matricula_asesor]);
        
        if (asesor.length === 0 || asesor[0].rol !== 2) {
            return res.status(400).json({ mensaje: 'La matrícula proporcionada no corresponde a un Asesor activo.' });
        }

        // B. Verificar si ya existe una solicitud (Pendiente o Activa)
        const [existente] = await pool.promise().query(
            'SELECT * FROM asesorias WHERE matricula_estudiante = ? AND matricula_asesor = ? AND (estado = 0 OR estado = 1)',
            [matriculaEstudiante, matricula_asesor]
        );

        if (existente.length > 0) {
            return res.status(400).json({ mensaje: 'Ya tienes una solicitud pendiente o activa con este asesor.' });
        }

        // C. Crear la solicitud (Estado 0 = Pendiente)
        await pool.promise().query(
            'INSERT INTO asesorias (matricula_asesor, matricula_estudiante, estado) VALUES (?, ?, 0)',
            [matricula_asesor, matriculaEstudiante]
        );

        res.status(201).json({ mensaje: 'Solicitud enviada. Espera a que el asesor te acepte.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al solicitar asesoría', error });
    }
};

// 2. Asesor responde (Acepta o Rechaza)
exports.responderSolicitud = async (req, res) => {
    const matriculaAsesor = req.usuario.matricula;
    const { id_asesoria, accion } = req.body; // accion: 'aceptar' o 'rechazar'

    if (!id_asesoria || !accion) return res.status(400).json({ mensaje: 'Faltan datos' });

    try {
        // Verificar que la solicitud me pertenezca
        const [solicitud] = await pool.promise().query(
            'SELECT * FROM asesorias WHERE id_asesoria = ? AND matricula_asesor = ?',
            [id_asesoria, matriculaAsesor]
        );

        if (solicitud.length === 0) {
            return res.status(404).json({ mensaje: 'Solicitud no encontrada o no te corresponde.' });
        }

        let nuevoEstado;
        if (accion === 'aceptar') nuevoEstado = 1; // Activa
        else if (accion === 'rechazar') nuevoEstado = 2; // Rechazada/Finalizada
        else return res.status(400).json({ mensaje: 'Acción inválida' });

        await pool.promise().query(
            'UPDATE asesorias SET estado = ? WHERE id_asesoria = ?',
            [nuevoEstado, id_asesoria]
        );

        res.json({ mensaje: `Solicitud ${accion === 'aceptar' ? 'aceptada' : 'rechazada'} correctamente.` });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error al responder', error });
    }
};

// 3. Ver mi Asesor actual (Para Estudiante) - CORREGIDO EL ERROR DE 'rol'
exports.obtenerMiAsesor = async (req, res) => {
    const matriculaEstudiante = req.usuario.matricula;

    try {
        // 1. Obtener datos básicos del asesor
        const sql = `
            SELECT a.id_asesoria, a.fecha_solicitud, a.estado,
                   u.matricula, u.nombre, u.apellido, u.imagen, u.correo, u.rol,
                   u.carrera, u.semestre, u.biografia, u.ubicacion
            FROM asesorias a
            JOIN usuario u ON a.matricula_asesor = u.matricula
            WHERE a.matricula_estudiante = ? AND a.estado IN (0, 1)
            ORDER BY a.estado DESC LIMIT 1
        `;

        const [rows] = await pool.promise().query(sql, [matriculaEstudiante]);

        if (rows.length === 0) {
            return res.json({ mensaje: 'No tienes asesor asignado', asesor: null });
        }

        const asesorData = rows[0];
        
        // 2. OBTENER INTERESES DEL ASESOR (Esto faltaba y causaba el crash)
        const [intereses] = await pool.promise().query(
            `SELECT i.id_interes, i.nombre 
             FROM usuario_intereses ui 
             JOIN intereses i ON ui.id_interes = i.id_interes 
             WHERE ui.matricula = ?`,
            [asesorData.matricula]
        );
        asesorData.intereses = intereses; // <--- Agregamos la lista

        // 3. OBTENER ESTADÍSTICAS DEL ASESOR (Para prevenir futuros errores)
        const [stats] = await pool.promise().query(`
            SELECT 
                (SELECT COUNT(*) FROM conexiones WHERE seguido_matricula = ?) as seguidores,
                (SELECT COUNT(*) FROM conexiones WHERE seguidor_matricula = ?) as seguidos
        `, [asesorData.matricula, asesorData.matricula]);
        asesorData.estadisticas = stats[0];

        // 4. Formatear Rol
        let rolTexto = 'Asesor';
        if(asesorData.rol === 1) rolTexto = 'Administrador';
        if(asesorData.rol === 3) rolTexto = 'Estudiante';
        asesorData.rol = rolTexto; 

        // 5. Rellenar campos extra
        asesorData.total_publicaciones = 0; // Podrías hacer un count real si quisieras
        asesorData.publicacion_destacada = null;
        // Asesores siempre están activos si aparecen aquí, pero por consistencia:
        asesorData.estado = 1; 

        res.json({ 
            asesor: asesorData,
            estado_texto: asesorData.estado === 1 ? 'Activo' : 'Pendiente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al obtener asesor', error });
    }
};

// 4. Ver mis Solicitudes Pendientes (Para Asesor)
exports.listarSolicitudesPendientes = async (req, res) => {
    const matriculaAsesor = req.usuario.matricula;

    try {
        const sql = `
            SELECT a.id_asesoria, a.fecha_solicitud,
                   u.matricula, u.nombre, u.apellido, u.imagen, u.carrera
            FROM asesorias a
            JOIN usuario u ON a.matricula_estudiante = u.matricula
            WHERE a.matricula_asesor = ? AND a.estado = 0
        `;

        const [rows] = await pool.promise().query(sql, [matriculaAsesor]);
        
        // Verifica en consola si está encontrando algo
        console.log(`Buscando solicitudes para asesor ${matriculaAsesor}. Encontradas: ${rows.length}`);
        
        res.json({ solicitudes: rows });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error', error });
    }
};

// 5. Ver mis Estudiantes Asesorados (Para Asesor)
exports.listarMisAsesorados = async (req, res) => {
    const matriculaAsesor = req.usuario.matricula;

    try {
        const sql = `
            SELECT a.id_asesoria, a.fecha_solicitud,
                   u.matricula, u.nombre, u.apellido, u.imagen, u.carrera, u.semestre
            FROM asesorias a
            JOIN usuario u ON a.matricula_estudiante = u.matricula
            WHERE a.matricula_asesor = ? AND a.estado = 1
        `;

        const [rows] = await pool.promise().query(sql, [matriculaAsesor]);
        
        // Formatear rol por si acaso se necesita
        const response = rows.map(u => ({
            ...u,
            rol: 'Estudiante', // Siempre son estudiantes
            total_publicaciones: 0,
            publicacion_destacada: null
        }));

        res.json({ asesorados: response });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error', error });
    }
};