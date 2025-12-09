'use strict';

const pool = require('../config/db');

// Helper para formatear tiempos
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

// ==========================================
// 1. FUNCIONES HELPERS DE BÚSQUEDA
// ==========================================

// --- A. Buscar Publicaciones ---
const buscarPublicaciones = async (terminos) => {
    const conditions = terminos.map(() => `(p.nombre LIKE ? OR p.descripcion LIKE ?)`).join(' OR ');
    const params = terminos.flatMap(t => [`%${t}%`, `%${t}%`]);

    const sql = `
        SELECT p.id_publi, p.nombre, p.descripcion, p.fecha, p.imagen_portada, p.vistas, p.descargas,
               (SELECT AVG(evaluacion) FROM evaluacion WHERE id_publi = p.id_publi) as rating,
               (SELECT GROUP_CONCAT(CONCAT(u.nombre, ' ', u.apellido) SEPARATOR ', ')
                FROM integrantes i JOIN usuario u ON i.matricula = u.matricula
                WHERE i.id_publi = p.id_publi) as autores,
               (SELECT GROUP_CONCAT(e.nombre SEPARATOR ', ')
                FROM publicacion_etiquetas pe JOIN etiquetas e ON pe.id_etiqueta = e.id_etiqueta
                WHERE pe.id_publi = p.id_publi) as tags
        FROM publicacion p
        WHERE p.estado = 'aprobado' 
        AND (${conditions})
        LIMIT 20
    `;

    const [rows] = await pool.promise().query(sql, params);

    return rows.map(pub => ({
        id_publi: pub.id_publi,
        nombre: pub.nombre,
        descripcion: pub.descripcion,
        autor: pub.autores || 'Anónimo',
        fecha: pub.fecha,
        hace_cuanto: tiempoTranscurrido(pub.fecha),
        tags: pub.tags ? pub.tags.split(', ') : [],
        rating: pub.rating ? Number(pub.rating).toFixed(1) : "0.0",
        vistas: pub.vistas,
        imagen_portada: pub.imagen_portada
    }));
};

// --- B. Buscar Usuarios ---
const buscarUsuarios = async (terminos, miMatricula) => {
    const conditions = terminos.map(() => `(nombre LIKE ? OR apellido LIKE ? OR carrera LIKE ?)`).join(' OR ');
    const params = terminos.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]);

    const sql = `
        SELECT matricula, nombre, apellido, imagen, carrera, semestre, rol,
               (SELECT COUNT(*) FROM conexiones WHERE seguidor_matricula = ? AND seguido_matricula = usuario.matricula) as es_seguidor
        FROM usuario
        WHERE estado = 1
        AND (${conditions})
        LIMIT 20
    `;

    const paramsFinales = [miMatricula, ...params];
    const [rows] = await pool.promise().query(sql, paramsFinales);

    const usuariosCompletos = await Promise.all(rows.map(async (u) => {
        const [intereses] = await pool.promise().query(
            `SELECT i.nombre FROM usuario_intereses ui JOIN intereses i ON ui.id_interes = i.id_interes WHERE ui.matricula = ?`, 
            [u.matricula]
        );
        
        let rolNombre = '';
        switch (u.rol) {
            case 1: rolNombre = 'Admin'; break;
            case 2: rolNombre = 'Asesor'; break;
            case 3: rolNombre = 'Estudiante'; break;
        }

        return {
            ...u,
            rol: rolNombre,
            intereses: intereses.map(i => i.nombre),
            siguiendo: u.es_seguidor > 0
        };
    }));

    return usuariosCompletos;
};

// --- C. (NUEVO) Buscar Eventos para Busqueda General ---
const buscarEventosGeneral = async (terminos, miMatricula) => {
    // Busca coincidencias en título, descripción o nombre del lugar
    const conditions = terminos.map(() => `(titulo LIKE ? OR descripcion LIKE ? OR ubicacion_nombre LIKE ?)`).join(' OR ');
    // Genera los parámetros %termino%
    const paramsWhere = terminos.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]);

    const sql = `
        SELECT id_evento, titulo, fecha, descripcion, cupo_maximo, url_foto, 
               latitud, longitud, ubicacion_nombre, categoria, fecha_creacion,
               (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento) as asistentes_registrados,
               (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento AND matricula = ?) as usuario_registrado
        FROM evento e
        WHERE (${conditions})
        ORDER BY fecha DESC
        LIMIT 20
    `;

    // Primero va la matricula (para el subquery), luego los terminos del WHERE
    const paramsFinales = [miMatricula || 0, ...paramsWhere];

    const [rows] = await pool.promise().query(sql, paramsFinales);

    return rows.map(ev => ({
        id: ev.id_evento,
        titulo: ev.titulo,
        descripcion: ev.descripcion,
        fecha: ev.fecha,
        hace_cuanto: tiempoTranscurrido(ev.fecha_creacion),
        categoria: ev.categoria,
        ubicacion: {
            nombre: ev.ubicacion_nombre,
            lat: ev.latitud,
            lng: ev.longitud
        },
        imagen: ev.url_foto,
        cupo: {
            maximo: ev.cupo_maximo,
            registrados: ev.asistentes_registrados
        },
        inscrito: ev.usuario_registrado > 0
    }));
};

// ==========================================
// 2. CONTROLADORES EXPORTADOS
// ==========================================

exports.busquedaGeneral = async (req, res) => {
    const { palabra } = req.query;
    const miMatricula = req.usuario ? req.usuario.matricula : null;

    if (!palabra) return res.status(400).json({ mensaje: 'El parámetro "palabra" es requerido.' });

    const terminos = palabra.trim().split(/\s+/);

    try {
        // Ejecutamos las 3 búsquedas simultáneamente
        const [publicaciones, usuarios, eventos] = await Promise.all([
            buscarPublicaciones(terminos),
            buscarUsuarios(terminos, miMatricula),
            buscarEventosGeneral(terminos, miMatricula) // <--- Agregado aquí
        ]);
        console.log(eventos);
        

        res.status(200).json({
            publicaciones,
            perfiles: usuarios,
            eventos // <--- Agregado a la respuesta JSON
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error en la búsqueda general', error });
    }
};

// Exportamos los helpers por si se necesitan individualmente
exports.buscarPublicaciones = buscarPublicaciones;
exports.buscarUsuarios = buscarUsuarios;
exports.buscarEventosGeneral = buscarEventosGeneral;


// 3. Búsqueda de Eventos AVANZADA (Se mantiene igual para filtros específicos de mapa/fechas)
exports.busquedaEventos = async (req, res) => {
    // ... (Mantén tu código original de busquedaEventos aquí, no es necesario cambiarlo)
    // Este endpoint se usará cuando el usuario esté específicamente en la sección de "Eventos"
    // y quiera filtrar por distancia, fecha exacta, etc.
    const { palabra, lat, lng, radioKm, fecha_inicio, fecha_fin, categoria } = req.query;
    const usuarioMat = req.usuario ? req.usuario.matricula : null;

    try {
        let params = [];
        let whereClauses = ['1=1'];
        let selectDistancia = '';

        if (palabra) {
            const terminos = palabra.trim().split(/\s+/);
            const textConditions = terminos.map(() => `(titulo LIKE ? OR descripcion LIKE ? OR ubicacion_nombre LIKE ?)`).join(' OR ');
            whereClauses.push(`(${textConditions})`);
            params.push(...terminos.flatMap(t => [`%${t}%`, `%${t}%`, `%${t}%`]));
        }

        if (fecha_inicio) {
            whereClauses.push('fecha >= ?');
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            whereClauses.push('fecha <= ?');
            params.push(fecha_fin);
        }
        if (categoria && categoria !== 'all') {
            whereClauses.push('categoria = ?');
            params.push(categoria);
        }

        if (lat && lng) {
            selectDistancia = `, (6371 * acos(
                cos(radians(?)) * cos(radians(latitud)) *
                cos(radians(longitud) - radians(?)) +
                sin(radians(?)) * sin(radians(latitud))
            )) AS distancia`;
            params.unshift(lat, lng, lat);
        }

        let sql = `
            SELECT id_evento, titulo, fecha, descripcion, cupo_maximo, url_foto, 
                   latitud, longitud, ubicacion_nombre, categoria, fecha_creacion
                   ${selectDistancia},
                   (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento) as asistentes_registrados,
                   (SELECT COUNT(*) FROM evento_asistentes WHERE id_evento = e.id_evento AND matricula = ?) as usuario_registrado
            FROM evento e
            WHERE ${whereClauses.join(' AND ')}
        `;
        
        const paramsFinales = [];
        if (lat && lng) paramsFinales.push(lat, lng, lat);
        paramsFinales.push(usuarioMat || 0);
        
        // Ajuste de índices para tomar los params correctos del WHERE
        // Si hay lat/lng, params ya tiene esos 3 al inicio. Si no, no.
        // Pero arriba usamos unshift, así que 'params' ya tiene todo mezclado.
        // CORRECCION: Es más seguro reconstruir paramsFinales basado en el orden de ? en el SQL.
        
        // Orden SQL: [lat, lng, lat] (si existe) -> [usuarioMat] -> [whereParams] -> [havingParams]
        
        // Extraemos los params del WHERE (quitando lat/lng si se pusieron al inicio de 'params')
        const whereParamsOnly = (lat && lng) ? params.slice(3) : params;
        
        paramsFinales.push(...whereParamsOnly);

        let having = '';
        if (lat && lng && radioKm) {
            having = ` HAVING distancia <= ?`;
            paramsFinales.push(Number(radioKm));
        }

        sql += having + ' ORDER BY fecha DESC LIMIT 50';

        const [eventos] = await pool.promise().query(sql, paramsFinales);

        const resultado = eventos.map(ev => ({
            id: ev.id_evento,
            titulo: ev.titulo,
            descripcion: ev.descripcion,
            fecha: ev.fecha,
            hace_cuanto: tiempoTranscurrido(ev.fecha_creacion),
            categoria: ev.categoria,
            ubicacion: {
                nombre: ev.ubicacion_nombre,
                lat: ev.latitud,
                lng: ev.longitud
            },
            imagen: ev.url_foto,
            cupo: {
                maximo: ev.cupo_maximo,
                registrados: ev.asistentes_registrados
            },
            inscrito: ev.usuario_registrado > 0,
            distancia: ev.distancia ? Number(ev.distancia).toFixed(1) + ' km' : null
        }));
        console.log(resultado);
        

        res.json({ eventos: resultado });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al buscar eventos', error });
    }
};