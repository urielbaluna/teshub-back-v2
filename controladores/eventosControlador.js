'use strict';

const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Crear evento
exports.crearEvento = async (req, res) => {
    const { titulo, fecha, descripcion, latitud, longitud, organizadores_matriculas, cupo_maximo } = req.body;
    let urlFoto = req.file ? 'uploads/eventos/' + req.file.filename : null;

    // Validar campos obligatorios
    if (!titulo || !fecha || !descripcion || !latitud || !longitud || !organizadores_matriculas) {
        // Borrar imagen si se subió pero faltan campos
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
            fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        }
        return res.status(400).json({ mensaje: 'Todos los campos son obligatorios (titulo, fecha, descripcion, latitud, longitud, organizadores_matriculas)' });
    }

    // Establecer cupo por defecto si no se proporciona
    const cupoFinal = cupo_maximo || 50;

    // Parsear organizadores_matriculas (viene como string separado por comas)
    const organizadoresArray = organizadores_matriculas.toString().split(',').map(m => m.trim()).filter(Boolean);

    if (organizadoresArray.length === 0) {
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
            fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        }
        return res.status(400).json({ mensaje: 'Debe haber al menos un organizador' });
    }

    // Opción C: Verificar que el usuario autenticado esté en la lista de organizadores
    const matriculaUsuario = req.usuario.matricula;
    if (!organizadoresArray.includes(matriculaUsuario.toString())) {
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
            fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        }
        return res.status(403).json({ mensaje: 'Debes estar incluido como organizador para crear este evento' });
    }

    try {
        // Verificar que todas las matrículas existan en la BD
        const sqlCheck = `SELECT matricula FROM usuario WHERE matricula IN (?)`;
        pool.query(sqlCheck, [organizadoresArray], (err, results) => {
            if (err) {
                if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                    fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                }
                return res.status(500).json({ mensaje: 'Error al verificar organizadores', error: err });
            }

            const existentes = results.map(r => r.matricula.toString());
            const noExistentes = organizadoresArray.filter(m => !existentes.includes(m));

            if (noExistentes.length > 0) {
                if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                    fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                }
                return res.status(400).json({ 
                    mensaje: `Las siguientes matrículas no son válidas: ${noExistentes.join(', ')}` 
                });
            }

            // Todas las matrículas son válidas, obtener el siguiente ID
            const sqlMaxId = 'SELECT COALESCE(MAX(id_evento), 0) + 1 AS next_id FROM evento';
            pool.query(sqlMaxId, (errId, resultId) => {
                if (errId) {
                    if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                        fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                    }
                    return res.status(500).json({ mensaje: 'Error al generar ID', error: errId });
                }

                const id_evento = resultId[0].next_id;

                // Insertar el evento
                const sqlEvento = `INSERT INTO evento (id_evento, titulo, fecha, descripcion, url_foto, latitud, longitud, cupo_maximo) 
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                
                // Convertir fecha ISO 8601 a formato MySQL DATETIME si es necesario
                const fechaMySQL = fecha; // MySQL acepta ISO 8601 directamente
                
                pool.query(sqlEvento, [id_evento, titulo, fechaMySQL, descripcion, urlFoto, latitud, longitud, cupoFinal], (errEvento, resultEvento) => {
                    if (errEvento) {
                        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                            fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                        }
                        return res.status(500).json({ mensaje: 'Error al crear evento', error: errEvento });
                    }

                    // Insertar organizadores en la tabla relacional
                    const values = organizadoresArray.map(matricula => [id_evento, matricula]);
                    const sqlOrganizadores = `INSERT INTO evento_organizadores (id_evento, matricula) VALUES ?`;
                    
                    pool.query(sqlOrganizadores, [values], (errOrg) => {
                        if (errOrg) {
                            // Si falla, eliminar el evento creado
                            pool.query('DELETE FROM evento WHERE id_evento = ?', [id_evento]);
                            if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                                fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                            }
                            return res.status(500).json({ mensaje: 'Error al agregar organizadores', error: errOrg });
                        }

                        // Obtener datos completos del evento creado para la respuesta
                        obtenerEventoCompleto(id_evento, res);
                    });
                });
            });
        });
    } catch (error) {
        if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
            fs.unlinkSync(path.join(__dirname, '..', urlFoto));
        }
        res.status(500).json({ mensaje: 'Error en el servidor', error });
    }
};

// Función auxiliar para obtener evento completo con organizadores
function obtenerEventoCompleto(id_evento, res) {
    const sqlEvento = `
        SELECT e.id_evento, e.titulo, e.fecha, e.descripcion, e.url_foto, e.latitud, e.longitud, e.cupo_maximo
        FROM evento e
        WHERE e.id_evento = ?
    `;
    
    pool.query(sqlEvento, [id_evento], (err, eventos) => {
        if (err || eventos.length === 0) {
            return res.status(500).json({ mensaje: 'Error al obtener evento creado' });
        }

        const evento = eventos[0];

        // Obtener organizadores con nombre y apellido
        const sqlOrganizadores = `
            SELECT u.matricula, u.nombre, u.apellido
            FROM evento_organizadores eo
            JOIN usuario u ON eo.matricula = u.matricula
            WHERE eo.id_evento = ?
        `;

        pool.query(sqlOrganizadores, [id_evento], (errOrg, organizadores) => {
            if (errOrg) {
                return res.status(500).json({ mensaje: 'Error al obtener organizadores' });
            }

            res.status(201).json({
                mensaje: 'Evento creado exitosamente.',
                evento: {
                    id: evento.id_evento,
                    titulo: evento.titulo,
                    fecha: evento.fecha,
                    descripcion: evento.descripcion,
                    urlFoto: evento.url_foto,
                    cupoMaximo: evento.cupo_maximo,
                    ubicacion: {
                        latitud: parseFloat(evento.latitud),
                        longitud: parseFloat(evento.longitud)
                    },
                    organizadores: organizadores.map(org => ({
                        matricula: org.matricula.toString(),
                        nombre: org.nombre,
                        apellido: org.apellido
                    }))
                }
            });
        });
    });
}

// Listar todos los eventos
exports.listarEventos = (req, res) => {
    const matriculaUsuario = req.usuario.matricula;
    const sqlEventos = 'SELECT id_evento, titulo, fecha, descripcion, url_foto, latitud, longitud, cupo_maximo FROM evento ORDER BY fecha DESC';
    
    pool.query(sqlEventos, (err, eventos) => {
        if (err) {
            return res.status(500).json({ mensaje: 'Error al obtener eventos', error: err });
        }

        if (eventos.length === 0) {
            return res.status(200).json({ eventos: [] });
        }

        // Obtener organizadores para cada evento
        let eventosCompletos = [];
        let contador = 0;

        eventos.forEach(evento => {
            const sqlOrganizadores = `
                SELECT u.matricula, u.nombre, u.apellido
                FROM evento_organizadores eo
                JOIN usuario u ON eo.matricula = u.matricula
                WHERE eo.id_evento = ?
            `;

            pool.query(sqlOrganizadores, [evento.id_evento], (errOrg, organizadores) => {
                if (errOrg) {
                    contador++;
                    if (contador === eventos.length) {
                        res.status(200).json({ eventos: eventosCompletos });
                    }
                    return;
                }

                // Obtener información de asistencia
                const sqlAsistentes = 'SELECT COUNT(*) as total FROM evento_asistentes WHERE id_evento = ?';
                pool.query(sqlAsistentes, [evento.id_evento], (errAsist, asistentes) => {
                    const asistentesRegistrados = asistentes && asistentes[0] ? asistentes[0].total : 0;

                    // Verificar si el usuario actual está registrado
                    const sqlUsuarioRegistrado = 'SELECT * FROM evento_asistentes WHERE id_evento = ? AND matricula = ?';
                    pool.query(sqlUsuarioRegistrado, [evento.id_evento, matriculaUsuario], (errUser, userReg) => {
                        const usuarioRegistrado = userReg && userReg.length > 0;

                        eventosCompletos.push({
                            id: evento.id_evento,
                            titulo: evento.titulo,
                            fecha: evento.fecha,
                            descripcion: evento.descripcion,
                            urlFoto: evento.url_foto,
                            ubicacion: {
                                latitud: parseFloat(evento.latitud),
                                longitud: parseFloat(evento.longitud)
                            },
                            cupoMaximo: evento.cupo_maximo,
                            asistentesRegistrados: asistentesRegistrados,
                            usuarioRegistrado: usuarioRegistrado,
                            organizadores: organizadores.map(org => ({
                                matricula: org.matricula.toString(),
                                nombre: org.nombre,
                                apellido: org.apellido
                            }))
                        });

                        contador++;
                        if (contador === eventos.length) {
                            res.status(200).json({ eventos: eventosCompletos });
                        }
                    });
                });
            });
        });
    });
};

// Ver un evento específico
exports.verEvento = (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    const sqlEvento = `
        SELECT e.id_evento, e.titulo, e.fecha, e.descripcion, e.url_foto, e.latitud, e.longitud, e.cupo_maximo
        FROM evento e
        WHERE e.id_evento = ?
    `;

    pool.query(sqlEvento, [id], (err, eventos) => {
        if (err) {
            return res.status(500).json({ mensaje: 'Error al obtener evento', error: err });
        }

        if (eventos.length === 0) {
            return res.status(404).json({ mensaje: 'Evento no encontrado' });
        }

        const evento = eventos[0];

        // Obtener organizadores
        const sqlOrganizadores = `
            SELECT u.matricula, u.nombre, u.apellido
            FROM evento_organizadores eo
            JOIN usuario u ON eo.matricula = u.matricula
            WHERE eo.id_evento = ?
        `;

        pool.query(sqlOrganizadores, [id], (errOrg, organizadores) => {
            if (errOrg) {
                return res.status(500).json({ mensaje: 'Error al obtener organizadores', error: errOrg });
            }

            // Obtener información de asistencia
            const sqlAsistentes = 'SELECT COUNT(*) as total FROM evento_asistentes WHERE id_evento = ?';
            pool.query(sqlAsistentes, [id], (errAsist, asistentes) => {
                const asistentesRegistrados = asistentes && asistentes[0] ? asistentes[0].total : 0;

                // Verificar si el usuario actual está registrado
                const sqlUsuarioRegistrado = 'SELECT * FROM evento_asistentes WHERE id_evento = ? AND matricula = ?';
                pool.query(sqlUsuarioRegistrado, [id, matriculaUsuario], (errUser, userReg) => {
                    const usuarioRegistrado = userReg && userReg.length > 0;

                    res.status(200).json({
                        evento: {
                            id: evento.id_evento,
                            titulo: evento.titulo,
                            fecha: evento.fecha,
                            descripcion: evento.descripcion,
                            urlFoto: evento.url_foto,
                            ubicacion: {
                                latitud: parseFloat(evento.latitud),
                                longitud: parseFloat(evento.longitud)
                            },
                            cupoMaximo: evento.cupo_maximo,
                            asistentesRegistrados: asistentesRegistrados,
                            usuarioRegistrado: usuarioRegistrado,
                            organizadores: organizadores.map(org => ({
                                matricula: org.matricula.toString(),
                                nombre: org.nombre,
                                apellido: org.apellido
                            }))
                        }
                    });
                });
            });
        });
    });
};

// Actualizar evento
exports.actualizarEvento = (req, res) => {
    const { id } = req.params;
    const { titulo, fecha, descripcion, latitud, longitud, organizadores_matriculas, cupo_maximo } = req.body;
    let urlFoto = req.file ? 'uploads/eventos/' + req.file.filename : null;

    // Verificar que el usuario sea organizador del evento
    const matriculaUsuario = req.usuario.matricula;
    const sqlVerificar = `SELECT * FROM evento_organizadores WHERE id_evento = ? AND matricula = ?`;

    pool.query(sqlVerificar, [id, matriculaUsuario], (errVerif, resultVerif) => {
        if (errVerif) {
            if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                fs.unlinkSync(path.join(__dirname, '..', urlFoto));
            }
            return res.status(500).json({ mensaje: 'Error al verificar permisos', error: errVerif });
        }

        if (resultVerif.length === 0) {
            if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                fs.unlinkSync(path.join(__dirname, '..', urlFoto));
            }
            return res.status(403).json({ mensaje: 'No tienes permisos para actualizar este evento' });
        }

        // Construir query de actualización dinámicamente
        let campos = [];
        let valores = [];

        if (titulo) {
            campos.push('titulo = ?');
            valores.push(titulo);
        }
        if (fecha) {
            campos.push('fecha = ?');
            valores.push(fecha);
        }
        if (descripcion) {
            campos.push('descripcion = ?');
            valores.push(descripcion);
        }
        if (latitud) {
            campos.push('latitud = ?');
            valores.push(latitud);
        }
        if (longitud) {
            campos.push('longitud = ?');
            valores.push(longitud);
        }
        if (cupo_maximo) {
            campos.push('cupo_maximo = ?');
            valores.push(cupo_maximo);
        }
        if (urlFoto) {
            // Eliminar foto anterior
            pool.query('SELECT url_foto FROM evento WHERE id_evento = ?', [id], (errFoto, resultFoto) => {
                if (!errFoto && resultFoto[0] && resultFoto[0].url_foto) {
                    const rutaAnterior = path.join(__dirname, '..', resultFoto[0].url_foto);
                    if (fs.existsSync(rutaAnterior)) {
                        fs.unlinkSync(rutaAnterior);
                    }
                }
            });
            campos.push('url_foto = ?');
            valores.push(urlFoto);
        }

        if (campos.length === 0 && !organizadores_matriculas) {
            if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                fs.unlinkSync(path.join(__dirname, '..', urlFoto));
            }
            return res.status(400).json({ mensaje: 'No hay datos para actualizar' });
        }

        // Actualizar evento
        if (campos.length > 0) {
            valores.push(id);
            const sqlUpdate = `UPDATE evento SET ${campos.join(', ')} WHERE id_evento = ?`;

            pool.query(sqlUpdate, valores, (errUpdate) => {
                if (errUpdate) {
                    if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                        fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                    }
                    return res.status(500).json({ mensaje: 'Error al actualizar evento', error: errUpdate });
                }

                actualizarOrganizadores();
            });
        } else {
            actualizarOrganizadores();
        }

        function actualizarOrganizadores() {
            if (organizadores_matriculas) {
                const organizadoresArray = organizadores_matriculas.toString().split(',').map(m => m.trim()).filter(Boolean);

                // Verificar que el usuario siga en la lista
                if (!organizadoresArray.includes(matriculaUsuario.toString())) {
                    return res.status(403).json({ mensaje: 'No puedes eliminarte a ti mismo de los organizadores' });
                }

                // Verificar que todas las matrículas existan
                const sqlCheck = `SELECT matricula FROM usuario WHERE matricula IN (?)`;
                pool.query(sqlCheck, [organizadoresArray], (err, results) => {
                    if (err) {
                        return res.status(500).json({ mensaje: 'Error al verificar organizadores', error: err });
                    }

                    const existentes = results.map(r => r.matricula.toString());
                    const noExistentes = organizadoresArray.filter(m => !existentes.includes(m));

                    if (noExistentes.length > 0) {
                        return res.status(400).json({ 
                            mensaje: `Las siguientes matrículas no son válidas: ${noExistentes.join(', ')}` 
                        });
                    }

                    // Eliminar organizadores actuales
                    pool.query('DELETE FROM evento_organizadores WHERE id_evento = ?', [id], (errDel) => {
                        if (errDel) {
                            return res.status(500).json({ mensaje: 'Error al actualizar organizadores', error: errDel });
                        }

                        // Insertar nuevos organizadores
                        const values = organizadoresArray.map(matricula => [id, matricula]);
                        const sqlOrganizadores = `INSERT INTO evento_organizadores (id_evento, matricula) VALUES ?`;

                        pool.query(sqlOrganizadores, [values], (errIns) => {
                            if (errIns) {
                                return res.status(500).json({ mensaje: 'Error al agregar organizadores', error: errIns });
                            }

                            obtenerEventoCompleto(id, res);
                        });
                    });
                });
            } else {
                obtenerEventoCompleto(id, res);
            }
        }
    });
};

// Eliminar evento
exports.eliminarEvento = (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    // Verificar que el usuario sea organizador del evento
    const sqlVerificar = `SELECT * FROM evento_organizadores WHERE id_evento = ? AND matricula = ?`;

    pool.query(sqlVerificar, [id, matriculaUsuario], (errVerif, resultVerif) => {
        if (errVerif) {
            return res.status(500).json({ mensaje: 'Error al verificar permisos', error: errVerif });
        }

        if (resultVerif.length === 0) {
            return res.status(403).json({ mensaje: 'No tienes permisos para eliminar este evento' });
        }

        // Obtener foto para eliminarla
        pool.query('SELECT url_foto FROM evento WHERE id_evento = ?', [id], (errFoto, resultFoto) => {
            const urlFoto = resultFoto[0]?.url_foto;

            // Eliminar evento (ON DELETE CASCADE eliminará organizadores automáticamente)
            pool.query('DELETE FROM evento WHERE id_evento = ?', [id], (errDel) => {
                if (errDel) {
                    return res.status(500).json({ mensaje: 'Error al eliminar evento', error: errDel });
                }

                // Eliminar foto del servidor
                if (urlFoto && fs.existsSync(path.join(__dirname, '..', urlFoto))) {
                    fs.unlinkSync(path.join(__dirname, '..', urlFoto));
                }

                res.status(200).json({ mensaje: 'Evento eliminado exitosamente' });
            });
        });
    });
};

// Registrarse a un evento
exports.registrarseEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    try {
        // 1. Verificar que el evento exista
        const sqlEvento = 'SELECT id_evento, cupo_maximo FROM evento WHERE id_evento = ?';
        pool.query(sqlEvento, [id], (err, eventos) => {
            if (err) {
                return res.status(500).json({ mensaje: 'Error al buscar evento', error: err });
            }

            if (eventos.length === 0) {
                return res.status(404).json({ mensaje: 'Evento no encontrado' });
            }

            const evento = eventos[0];

            // 2. Verificar cupo disponible
            const sqlCount = 'SELECT COUNT(*) as total FROM evento_asistentes WHERE id_evento = ?';
            pool.query(sqlCount, [id], (err, countResult) => {
                if (err) {
                    return res.status(500).json({ mensaje: 'Error al verificar cupo', error: err });
                }

                const asistentesActuales = countResult[0].total;

                if (asistentesActuales >= evento.cupo_maximo) {
                    return res.status(400).json({ mensaje: 'El evento ya no tiene cupo disponible' });
                }

                // 3. Verificar que el usuario no esté ya registrado
                const sqlCheck = 'SELECT * FROM evento_asistentes WHERE id_evento = ? AND matricula = ?';
                pool.query(sqlCheck, [id, matriculaUsuario], (err, registros) => {
                    if (err) {
                        return res.status(500).json({ mensaje: 'Error al verificar registro', error: err });
                    }

                    if (registros.length > 0) {
                        return res.status(400).json({ mensaje: 'Ya estás registrado en este evento' });
                    }

                    // 4. Registrar al usuario
                    const sqlInsert = 'INSERT INTO evento_asistentes (id_evento, matricula) VALUES (?, ?)';
                    pool.query(sqlInsert, [id, matriculaUsuario], (err) => {
                        if (err) {
                            return res.status(500).json({ mensaje: 'Error al registrarse', error: err });
                        }

                        res.status(200).json({ 
                            mensaje: 'Te has registrado exitosamente al evento',
                            asistentesRegistrados: asistentesActuales + 1,
                            cupoDisponible: evento.cupo_maximo - (asistentesActuales + 1)
                        });
                    });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor', error });
    }
};

// Cancelar registro a un evento
exports.cancelarRegistroEvento = async (req, res) => {
    const { id } = req.params;
    const matriculaUsuario = req.usuario.matricula;

    try {
        // 1. Verificar que el evento exista
        const sqlEvento = 'SELECT id_evento FROM evento WHERE id_evento = ?';
        pool.query(sqlEvento, [id], (err, eventos) => {
            if (err) {
                return res.status(500).json({ mensaje: 'Error al buscar evento', error: err });
            }

            if (eventos.length === 0) {
                return res.status(404).json({ mensaje: 'Evento no encontrado' });
            }

            // 2. Verificar que el usuario esté registrado
            const sqlCheck = 'SELECT * FROM evento_asistentes WHERE id_evento = ? AND matricula = ?';
            pool.query(sqlCheck, [id, matriculaUsuario], (err, registros) => {
                if (err) {
                    return res.status(500).json({ mensaje: 'Error al verificar registro', error: err });
                }

                if (registros.length === 0) {
                    return res.status(400).json({ mensaje: 'No estás registrado en este evento' });
                }

                // 3. Eliminar el registro
                const sqlDelete = 'DELETE FROM evento_asistentes WHERE id_evento = ? AND matricula = ?';
                pool.query(sqlDelete, [id, matriculaUsuario], (err) => {
                    if (err) {
                        return res.status(500).json({ mensaje: 'Error al cancelar registro', error: err });
                    }

                    res.status(200).json({ mensaje: 'Registro cancelado exitosamente' });
                });
            });
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor', error });
    }
};
