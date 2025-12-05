'use strict';

const pool = require('../config/db');

function busquedaGeneral(req, res) {
    const { palabra } = req.query;

    if (!palabra) {
        return res.status(400).json({ mensaje: 'Parámetro "palabra" es requerido.' });
    }

    const palabras = palabra.trim().split(/\s+/);
    let resultados = {};
    let pendientes = 2;
    let respondido = false;

    function finalizar() {
        pendientes--;
        if (pendientes === 0 && !respondido) {
            respondido = true;
            res.status(200).json(resultados);
        }
    }

    // Buscar publicaciones (solo ids primero)
    const sqlPub = `
        SELECT * FROM publicacion
        WHERE ${palabras.map(() => `(nombre LIKE ? OR descripcion LIKE ?)`).join(' OR ')}
    `;
    const paramsPub = palabras.flatMap(p => [`%${p}%`, `%${p}%`]);
    pool.query(sqlPub, paramsPub, (err, pubs) => {
        if (err && !respondido) {
            respondido = true;
            return res.status(500).json({ mensaje: 'Error en la búsqueda de publicaciones', error: err });
        }
        if (!pubs.length) {
            resultados.publicaciones = [];
            return finalizar();
        }

        // Obtener archivos, integrantes, comentarios y evaluaciones de todas las publicaciones encontradas
        const ids = pubs.map(p => p.id_publi);

        // 1. Archivos
        const sqlArchivos = `SELECT id_publi, ruta FROM archivos WHERE id_publi IN (?)`;
        pool.query(sqlArchivos, [ids], (errA, archivos) => {
            if (errA && !respondido) {
                respondido = true;
                return res.status(500).json({ mensaje: 'Error al obtener archivos', error: errA });
            }

            // 2. Integrantes
            const sqlIntegrantes = `
                SELECT i.id_publi, u.matricula, u.nombre, u.apellido
                FROM integrantes i
                JOIN usuario u ON i.matricula = u.matricula
                WHERE i.id_publi IN (?)
            `;
            pool.query(sqlIntegrantes, [ids], (errI, integrantes) => {
                if (errI && !respondido) {
                    respondido = true;
                    return res.status(500).json({ mensaje: 'Error al obtener integrantes', error: errI });
                }

                // 3. Comentarios
                const sqlComentarios = `
                    SELECT c.id_publi, c.comentario, u.nombre, c.matricula
                    FROM comentario c
                    JOIN usuario u ON c.matricula = u.matricula
                    WHERE c.id_publi IN (?)
                `;
                pool.query(sqlComentarios, [ids], (errC, comentarios) => {
                    if (errC && !respondido) {
                        respondido = true;
                        return res.status(500).json({ mensaje: 'Error al obtener comentarios', error: errC });
                    }

                    // 4. Evaluaciones
                    const sqlEval = `
                        SELECT id_publi, AVG(evaluacion) as promedio, COUNT(*) as total
                        FROM evaluacion
                        WHERE id_publi IN (?)
                        GROUP BY id_publi
                    `;
                    pool.query(sqlEval, [ids], (errE, evals) => {
                        if (errE && !respondido) {
                            respondido = true;
                            return res.status(500).json({ mensaje: 'Error al obtener evaluaciones', error: errE });
                        }

                        // Armar publicaciones completas
                        resultados.publicaciones = pubs.map(pub => {
                            return {
                                id_publi: pub.id_publi,
                                nombre: pub.nombre,
                                descripcion: pub.descripcion,
                                fecha: pub.fecha,
                                archivos: archivos.filter(a => a.id_publi === pub.id_publi).map(a => a.ruta),
                                integrantes: integrantes
                                    .filter(i => i.id_publi === pub.id_publi)
                                    .map(i => ({
                                        matricula: i.matricula,
                                        nombre_completo: `${i.nombre} ${i.apellido}`
                                    })),
                                comentarios: comentarios
                                    .filter(c => c.id_publi === pub.id_publi)
                                    .map(c => ({
                                        comentario: c.comentario,
                                        nombre: c.nombre,
                                        matricula: c.matricula
                                    })),
                                calificacion_promedio: (() => {
                                    const e = evals.find(ev => ev.id_publi === pub.id_publi);
                                    return e ? Number(e.promedio).toFixed(2) : "0.00";
                                })(),
                                total_calificaciones: (() => {
                                    const e = evals.find(ev => ev.id_publi === pub.id_publi);
                                    return e ? e.total : 0;
                                })()
                            };
                        });

                        finalizar();
                    });
                });
            });
        });
    });

    // Buscar perfiles
    const sqlPerf = `
        SELECT matricula, nombre, apellido, rol, imagen FROM usuario
        WHERE ${palabras.map(() => `(nombre LIKE ? OR apellido LIKE ? OR correo LIKE ?)`).join(' OR ')}
    `;
    const paramsPerf = palabras.flatMap(p => [`%${p}%`, `%${p}%`, `%${p}%`]);
    pool.query(sqlPerf, paramsPerf, (err, perfiles) => {
        if (err && !respondido) {
            respondido = true;
            return res.status(500).json({ mensaje: 'Error en la búsqueda de perfiles', error: err });
        }

        if (!perfiles.length) {
            resultados.perfiles = [];
            return finalizar();
        }

        // Para cada perfil, obtener el número de publicaciones y la mejor publicación
        let pendientesPerfiles = perfiles.length;

        perfiles.forEach((perfil, idx) => {
            // 1. Contar publicaciones en las que participa
            const sqlCount = `SELECT COUNT(*) AS total FROM integrantes WHERE matricula = ?`;
            pool.query(sqlCount, [perfil.matricula], (errCount, countRes) => {
                if (errCount) {
                    perfil.total_publicaciones = 0;
                } else {
                    perfil.total_publicaciones = countRes[0].total;
                }

                // 2. Obtener la publicación con mayor evaluación promedio en la que participa
                const sqlBestPubli = `
                    SELECT p.id_publi, p.nombre, AVG(e.evaluacion) AS promedio
                    FROM integrantes i
                    JOIN publicacion p ON i.id_publi = p.id_publi
                    LEFT JOIN evaluacion e ON p.id_publi = e.id_publi
                    WHERE i.matricula = ?
                    GROUP BY p.id_publi
                    ORDER BY promedio DESC
                    LIMIT 1
                `;
                pool.query(sqlBestPubli, [perfil.matricula], (errBest, bestRes) => {
                    if (!errBest && bestRes.length > 0) {
                        perfil.mejor_publicacion = {
                            id_publi: bestRes[0].id_publi,
                            nombre: bestRes[0].nombre,
                            promedio: bestRes[0].promedio ? Number(bestRes[0].promedio).toFixed(2) : 0
                        };
                    } else {
                        perfil.mejor_publicacion = 0;
                    }

                    pendientesPerfiles--;
                    if (pendientesPerfiles === 0) {
                        resultados.perfiles = perfiles;
                        finalizar();
                    }
                });
            });
        });
    });
}

function busquedaEventos(req, res) {
    const { palabra, lat, lng, radioKm, fecha_inicio, fecha_fin } = req.query;
    const usuarioMat = req.usuario ? req.usuario.matricula : null;

    // Construir SELECT (incluye distancia si proveen lat/lng)
    let params = [];
    let distanciaSelect = '';
    if (lat && lng) {
        distanciaSelect = `, (6371 * acos(
            cos(radians(?)) * cos(radians(latitud)) *
            cos(radians(longitud) - radians(?)) +
            sin(radians(?)) * sin(radians(latitud))
        )) AS distancia`;
        params.push(lat, lng, lat);
    }

    const whereParts = [];
    if (palabra && palabra.trim()) {
        const palabras = palabra.trim().split(/\s+/);
        const likeClause = palabras.map(() => `(titulo LIKE ? OR descripcion LIKE ?)`).join(' OR ');
        whereParts.push(`(${likeClause})`);
        params.push(...palabras.flatMap(p => [`%${p}%`, `%${p}%`]));
    }
    if (fecha_inicio) {
        whereParts.push('fecha >= ?');
        params.push(fecha_inicio);
    }
    if (fecha_fin) {
        whereParts.push('fecha <= ?');
        params.push(fecha_fin);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    let sql = `SELECT id_evento, titulo, fecha, descripcion, cupo_maximo, url_foto, latitud, longitud, fecha_creacion${distanciaSelect}
               FROM evento
               ${whereSql}
               ORDER BY fecha DESC
               LIMIT 200`;
    if (lat && lng && radioKm) {
        sql += ` HAVING distancia <= ?`;
        params.push(Number(radioKm));
    }

    pool.query(sql, params, (err, eventos) => {
        if (err) return res.status(500).json({ mensaje: 'Error al buscar eventos', error: err });
        if (!eventos || eventos.length === 0) return res.status(200).json({ eventos: [] });

        const ids = eventos.map(e => e.id_evento);

        const sqlAsist = `SELECT id_evento, COUNT(*) AS total FROM evento_asistentes WHERE id_evento IN (?) GROUP BY id_evento`;
        const sqlOrg = `SELECT eo.id_evento, u.matricula, u.nombre, u.apellido FROM evento_organizadores eo JOIN usuario u ON eo.matricula = u.matricula WHERE eo.id_evento IN (?)`;

        pool.query(sqlAsist, [ids], (errA, asistCounts) => {
            if (errA) return res.status(500).json({ mensaje: 'Error al obtener asistentes', error: errA });

            pool.query(sqlOrg, [ids], (errO, orgRows) => {
                if (errO) return res.status(500).json({ mensaje: 'Error al obtener organizadores', error: errO });

                // Si hay usuario, checar inscritos
                if (usuarioMat) {
                    const sqlReg = `SELECT id_evento FROM evento_asistentes WHERE id_evento IN (?) AND matricula = ?`;
                    pool.query(sqlReg, [ids, usuarioMat], (errR, regs) => {
                        if (errR) return res.status(500).json({ mensaje: 'Error al verificar inscripción', error: errR });
                        const regSet = new Set((regs || []).map(r => r.id_evento));
                        const asistMap = new Map((asistCounts || []).map(a => [a.id_evento, a.total]));
                        const orgMap = orgRows.reduce((m, r) => {
                            (m[r.id_evento] = m[r.id_evento] || []).push({ matricula: r.matricula, nombre: r.nombre, apellido: r.apellido });
                            return m;
                        }, {});
                        const resultado = eventos.map(ev => ({
                            id_evento: ev.id_evento,
                            titulo: ev.titulo,
                            descripcion: ev.descripcion,
                            fecha: ev.fecha,
                            cupo_maximo: ev.cupo_maximo,
                            url_foto: ev.url_foto,
                            latitud: ev.latitud,
                            longitud: ev.longitud,
                            fecha_creacion: ev.fecha_creacion,
                            asistentes_count: Number(asistMap.get(ev.id_evento) || 0),
                            organizadores: orgMap[ev.id_evento] || [],
                            inscrito: regSet.has(ev.id_evento),
                            distancia: ev.distancia !== undefined ? Number(ev.distancia).toFixed(2) : undefined
                        }));
                        return res.status(200).json({ eventos: resultado });
                    });
                } else {
                    const asistMap = new Map((asistCounts || []).map(a => [a.id_evento, a.total]));
                    const orgMap = orgRows.reduce((m, r) => {
                        (m[r.id_evento] = m[r.id_evento] || []).push({ matricula: r.matricula, nombre: r.nombre, apellido: r.apellido });
                        return m;
                    }, {});
                    const resultado = eventos.map(ev => ({
                        id_evento: ev.id_evento,
                        titulo: ev.titulo,
                        descripcion: ev.descripcion,
                        fecha: ev.fecha,
                        cupo_maximo: ev.cupo_maximo,
                        url_foto: ev.url_foto,
                        latitud: ev.latitud,
                        longitud: ev.longitud,
                        fecha_creacion: ev.fecha_creacion,
                        asistentes_count: Number(asistMap.get(ev.id_evento) || 0),
                        organizadores: orgMap[ev.id_evento] || [],
                        inscrito: false,
                        distancia: ev.distancia !== undefined ? Number(ev.distancia).toFixed(2) : undefined
                    }));
                    return res.status(200).json({ eventos: resultado });
                }
            });
        });
    });
}

module.exports = {
    busquedaGeneral,
    busquedaEventos
};