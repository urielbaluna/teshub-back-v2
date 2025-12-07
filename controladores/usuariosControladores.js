'use strict';

const jwt = require('../servicios/jwt');
require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function validarContrasena(contrasena) {
    // Al menos una mayúscula, una minúscula, un número, un caracter especial y mínimo 4 caracteres
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{4,}$/;
    return regex.test(contrasena);
}

function tiempoTranscurrido(fecha) {
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
};

exports.registrarUsuario = async (req, res) => {
    // 1. Recibimos 'rol' y 'codigo_acceso' desde la App
    const { nombre, apellido, correo, matricula, contrasena, rol, codigo_acceso } = req.body;
    let imagen = req.file ? 'uploads/imagenes/' + req.file.filename : null;

    // --- Validaciones básicas ---
    if (!nombre || !apellido || !correo || !matricula || !contrasena) {
        if (imagen && fs.existsSync(path.join(__dirname, '..', imagen))) fs.unlinkSync(path.join(__dirname, '..', imagen));
        return res.status(400).json({ mensaje: 'Campos obligatorios faltantes' });
    }

    if (!validarContrasena(contrasena)) {
        if (imagen && fs.existsSync(path.join(__dirname, '..', imagen))) fs.unlinkSync(path.join(__dirname, '..', imagen));
        return res.status(400).json({ mensaje: 'La contraseña debe tener: Mayúscula, minúscula, número, símbolo y mín 4 caracteres.' });
    }

    // --- Lógica de Roles y Seguridad ---
    let rolFinal = parseInt(rol) || 3; // Si no envían rol, asumimos Estudiante (3)
    let estadoInicial = 1; // 1: Activo

    // Si es Admin por longitud de matrícula (regla legacy que tenías)
    if (matricula.toString().length == 5) rolFinal = 1;

    try {
        // VALIDACIÓN DE ASESOR (Rol 2)
        if (rolFinal === 2) {
            if (!codigo_acceso) {
                if (imagen && fs.existsSync(path.join(__dirname, '..', imagen))) fs.unlinkSync(path.join(__dirname, '..', imagen));
                return res.status(400).json({ mensaje: 'El registro de Asesor requiere un código de invitación.' });
            }

            // Verificar código en BD (Promesa)
            const [codigos] = await pool.promise().query(
                'SELECT * FROM codigos_acceso WHERE codigo = ? AND esta_usado = 0 AND (rol_destino = 2 OR rol_destino IS NULL)', 
                [codigo_acceso]
            );

            if (codigos.length === 0) {
                if (imagen && fs.existsSync(path.join(__dirname, '..', imagen))) fs.unlinkSync(path.join(__dirname, '..', imagen));
                return res.status(403).json({ mensaje: 'Código de invitación inválido o ya utilizado.' });
            }
            // Si pasa, estadoInicial se mantiene en 1 (Activo)
        }

        // --- Verificación de Duplicados ---
        const [existentes] = await pool.promise().query(
            'SELECT matricula, correo FROM usuario WHERE matricula = ? OR correo = ? LIMIT 1', 
            [matricula, correo]
        );

        if (existentes.length > 0) {
            if (imagen && fs.existsSync(path.join(__dirname, '..', imagen))) fs.unlinkSync(path.join(__dirname, '..', imagen));
            
            const user = existentes[0];
            if (user.matricula == matricula) return res.status(400).json({ mensaje: 'La matrícula ya está registrada.' });
            if (user.correo == correo) return res.status(400).json({ mensaje: 'El correo ya está registrado.' });
        }

        // --- Hash y Registro ---
        const hash = await bcrypt.hash(contrasena, 10);

        const sqlInsert = `INSERT INTO usuario (matricula, nombre, apellido, contrasena, correo, rol, imagen, estado) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        await pool.promise().query(sqlInsert, [matricula, nombre, apellido, hash, correo, rolFinal, imagen, estadoInicial]);

        // --- Quemar el código si fue usado ---
        if (rolFinal === 2 && codigo_acceso) {
            await pool.promise().query(
                'UPDATE codigos_acceso SET esta_usado = 1, usado_por_matricula = ? WHERE codigo = ?',
                [matricula, codigo_acceso]
            );
        }

        res.status(200).json({ mensaje: 'Usuario registrado exitosamente.' });

    } catch (error) {
        // Borrar imagen en caso de error SQL
        if (imagen && fs.existsSync(path.join(__dirname, '..', imagen))) fs.unlinkSync(path.join(__dirname, '..', imagen));
        console.error(error);
        res.status(500).json({ mensaje: 'Error en el servidor', error });
    }
};


exports.loginUsuario = async (req, res) => {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
        return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    const sql = 'SELECT * FROM usuario WHERE correo = ? AND estado != 0';

    pool.query(sql, [correo], async(err, results) => {
        if (err) {
            console.error('Error en consulta:', err);
            return res.status(500).json({ mensaje: 'Error de servidor', err });
        }

        if (results.length === 0) {
            console.log('No se encontró usuario con ese correo:', correo);
            return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
        }

        const usuario = results[0];

        console.log('Usuario encontrado:', usuario);
        
        const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
        console.log('Contraseña coincide:', coincide);
        if (!coincide) {
            return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
        }
        if (usuario.estado === 2) {
            return res.status(403).json({ 
                mensaje: 'Tu cuenta de Asesor aún está en proceso de revisión/aprobación.' 
            });
        }

        const token = jwt.crearToken(usuario);
        let rolNombre = '';
        switch (usuario.rol) {
            case 1:
                rolNombre = 'Administrador';
                break;
            case 2:
                rolNombre = 'Asesor';
                break;
            case 3:
                rolNombre = 'Estudiante';
                break;
            default:
                rolNombre = 'Ora, que haces aqui?';
        }
        res.status(200).json({ token, matricula: usuario.matricula, nombre: usuario.nombre, apellido: usuario.apellido, correo: usuario.correo, rol: rolNombre });
    });
};

// Solicitar código
exports.solicitarCodigoActualizacion = async(req, res) => {
    const matricula = req.usuario.matricula;

    try {
        // 1. Obtener correo del usuario
        const [users] = await pool.promise().query('SELECT correo FROM usuario WHERE matricula = ? AND estado = 1', [matricula]);
        
        if (users.length === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        const correo = users[0].correo;

        // 2. Generar código
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 3. Calcular expiración (ej: 10 minutos desde ahora)
        const fechaExpiracion = new Date(Date.now() + 10 * 60 * 1000);

        // 4. GUARDAR EN BD (En vez de let codigos = {})
        // Primero invalidamos códigos anteriores no usados para este correo para no acumular basura
        await pool.promise().query('UPDATE codigos_verificacion SET usado = 1 WHERE correo = ?', [correo]);
        
        // Insertamos el nuevo
        await pool.promise().query(
            'INSERT INTO codigos_verificacion (correo, codigo, fecha_expiracion) VALUES (?, ?, ?)',
            [correo, codigo, fechaExpiracion]
        );

        // 5. Enviar correo (Tu lógica de nodemailer se mantiene igual)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.CORREO_APP, pass: process.env.PASS_CORREO_APP }
        });

        await transporter.sendMail({
            from: process.env.CORREO_APP,
            to: correo,
            subject: 'Código de verificación TesHub',
            text: `Tu código de seguridad es: ${codigo}. Expira en 10 minutos.`
        });

        res.json({ mensaje: 'Código enviado al correo' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ mensaje: 'Error al generar código', error });
    }
};

exports.actualizarUsuario = async(req, res) => {
    const matricula = req.usuario.matricula;
    // Recibimos también el 'codigo' que el usuario ingresó en la app
    const { nombre, apellido, correo, contrasena, carrera, semestre, biografia, ubicacion, codigo } = req.body;

    // --- LÓGICA DE VERIFICACIÓN DE CÓDIGO (SEGURIDAD) ---
    // Solo pedimos código si se intenta cambiar datos sensibles (Correo o Contraseña)
    if (correo || contrasena) {
        if (!codigo) {
            return res.status(400).json({ mensaje: 'Para actualizar correo o contraseña, se requiere el código de verificación.' });
        }

        try {
            // 1. Buscamos el correo actual del usuario para verificar el código asociado a él
            const [u] = await pool.promise().query('SELECT correo FROM usuario WHERE matricula = ?', [matricula]);
            const correoActual = u[0].correo;

            // 2. Consultar BD: ¿Existe un código válido, no usado y no expirado?
            const [rows] = await pool.promise().query(
                `SELECT * FROM codigos_verificacion 
                 WHERE correo = ? AND codigo = ? AND usado = 0 AND fecha_expiracion > NOW()`,
                [correoActual, codigo]
            );

            if (rows.length === 0) {
                return res.status(400).json({ mensaje: 'El código es inválido o ha expirado.' });
            }

            // 3. Marcar código como usado (para que no lo usen dos veces)
            await pool.promise().query('UPDATE codigos_verificacion SET usado = 1 WHERE id = ?', [rows[0].id]);

        } catch (err) {
            return res.status(500).json({ mensaje: 'Error al verificar código', error: err });
        }
    }

    let campos = [];
    let valores = [];

    // --- Validaciones de campos de texto existentes ---
    if (nombre && nombre.trim() !== "") {
        campos.push('nombre = ?');
        valores.push(nombre.trim());
    }
    if (apellido && apellido.trim() !== "") {
        campos.push('apellido = ?');
        valores.push(apellido.trim());
    }
    if (correo && correo.trim() !== "") {
        campos.push('correo = ?');
        valores.push(correo.trim());
    }

    // --- NUEVOS CAMPOS DEL PERFIL ---
    if (carrera && carrera.trim() !== "") {
        campos.push('carrera = ?');
        valores.push(carrera.trim());
    }
    if (semestre && semestre.trim() !== "") {
        campos.push('semestre = ?');
        valores.push(semestre.trim());
    }
    if (biografia && biografia.trim() !== "") {
        campos.push('biografia = ?');
        valores.push(biografia.trim());
    }
    if (ubicacion && ubicacion.trim() !== "") {
        campos.push('ubicacion = ?');
        valores.push(ubicacion.trim());
    }
    // --------------------------------

    // Validación de Contraseña
    if (contrasena && contrasena.trim() !== "") {
        if (!validarContrasena(contrasena)) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos una mayúscula, una minúscula, un número, un caracter especial y mínimo 4 caracteres.' });
        }
        const hash = await bcrypt.hash(contrasena, 10);
        campos.push('contrasena = ?');
        valores.push(hash);
    }

    // Lógica para actualizar (con o sin imagen)
    const ejecutarQuery = () => {
        if (campos.length === 0) {
            return res.status(400).json({ mensaje: 'Nada para actualizar' });
        }

        valores.push(matricula);
        const sql = `UPDATE usuario SET ${campos.join(', ')} WHERE matricula = ? AND estado = 1`;

        pool.query(sql, valores, (err, result) => {
            if (err) {
                console.error('Error al actualizar:', err);
                return res.status(500).json({ mensaje: 'Error al actualizar', err });
            }
            // delete codigos[matricula]; // Descomentar si usas códigos de verificación
            res.json({ mensaje: 'Usuario actualizado correctamente' });
        });
    };

    // Si hay nueva imagen, maneja el borrado de la anterior
    if (req.file) {
        pool.query('SELECT imagen FROM usuario WHERE matricula = ?', [matricula], (err, results) => {
            if (err) return res.status(500).json({ mensaje: 'Error al buscar imagen anterior', err });

            let imagenAnterior = null;
            if (results[0] && results[0].imagen) {
                imagenAnterior = results[0].imagen;
            }

            // Borrar archivo físico anterior si existe
            if (imagenAnterior) {
                const rutaImagen = path.join(__dirname, '..', imagenAnterior);
                fs.unlink(rutaImagen, (errUnlink) => {
                    if (errUnlink && errUnlink.code !== 'ENOENT') console.error('Error al borrar imagen anterior:', errUnlink);
                });
            }

            // Agregar la nueva ruta al array de actualización
            campos.push('imagen = ?');
            valores.push('uploads/imagenes/' + req.file.filename);

            // Ejecutar la actualización en BD
            ejecutarQuery();
        });
    } else {
        // Si no hay imagen, ejecuta directo
        ejecutarQuery();
    }
};

exports.eliminarCuenta = async (req, res) => {
    const matriculaSolicitante = req.usuario.matricula;
    const rolSolicitante = req.usuario.rol; 
    const { matricula } = req.body; 

    // 1. Determinar a quién vamos a eliminar
    let matriculaAEliminar;
    if (rolSolicitante === 1) { // Admin
        if (!matricula) {
            return res.status(400).json({ mensaje: 'Debes especificar la matrícula a eliminar' });
        }
        matriculaAEliminar = matricula;
    } else {
        matriculaAEliminar = matriculaSolicitante;
    }

    try {
        // 2. Verificar rol del usuario a eliminar antes de desactivarlo
        const [users] = await pool.promise().query(
            'SELECT rol FROM usuario WHERE matricula = ? AND estado = 1', 
            [matriculaAEliminar]
        );

        if (users.length === 0) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado o ya desactivado' });
        }

        const rolAEliminar = users[0].rol;

        // 3. Desactivar cuenta (Soft Delete)
        await pool.promise().query(
            'UPDATE usuario SET estado = 0 WHERE matricula = ?', 
            [matriculaAEliminar]
        );

        // 4. LÓGICA EXTRA: Si era Asesor, liberar a sus estudiantes
        if (rolAEliminar === 2) { // 2 = Asesor
            // Cambiamos el estado de la asesoría a 2 (Finalizada/Cancelada) o borramos el registro
            // Asumiendo que en tu tabla 'asesorias', estado 1 es Activo.
            await pool.promise().query(
                'UPDATE asesorias SET estado = 2 WHERE matricula_asesor = ? AND estado = 1', 
                [matriculaAEliminar]
            );
        }
        
        // (Opcional) Si es Estudiante, cancelar sus solicitudes pendientes
        if (rolAEliminar === 3) {
             await pool.promise().query(
                'DELETE FROM asesorias WHERE matricula_estudiante = ? AND estado = 0', 
                [matriculaAEliminar]
            );
        }

        res.json({ mensaje: 'Cuenta desactivada correctamente y relaciones actualizadas.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ mensaje: 'Error al desactivar cuenta', error: err });
    }
};

exports.codigoContrasena = async (req, res) => {
    const { correo } = req.body;

    if (!correo) {
        return res.status(400).json({ mensaje: 'El correo es obligatorio' });
    }

    try {
        // 1. Verificar si el correo existe
        const [users] = await pool.promise().query(
            'SELECT correo FROM usuario WHERE correo = ? AND estado = 1', 
            [correo]
        );

        if (users.length === 0) {
            return res.status(404).json({ mensaje: 'Correo no encontrado' });
        }

        // 2. Generar código
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const fechaExpiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        // 3. GUARDAR EN BD (Esto es lo nuevo)
        // Invalidar códigos anteriores
        await pool.promise().query('UPDATE codigos_verificacion SET usado = 1 WHERE correo = ?', [correo]);
        
        // Insertar el nuevo
        await pool.promise().query(
            'INSERT INTO codigos_verificacion (correo, codigo, fecha_expiracion) VALUES (?, ?, ?)',
            [correo, codigo, fechaExpiracion]
        );

        // 4. Enviar correo
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.CORREO_APP,
                pass: process.env.PASS_CORREO_APP
            }
        });

        await transporter.sendMail({
            from: process.env.CORREO_APP,
            to: correo,
            subject: 'Recuperación de contraseña - TesHub',
            text: `Tu código de verificación es: ${codigo}. Este código expira en 1 hora.`
        });

        res.json({ mensaje: 'Código enviado al correo' });

    } catch (error) {
        console.error('Error en codigoContrasena:', error);
        res.status(500).json({ mensaje: 'Error al procesar la solicitud', error });
    }
};

exports.actualizarContrasena = async (req, res) => {
    const { correo, codigo, nuevaContrasena } = req.body;

    if (!correo || !codigo || !nuevaContrasena) {
        return res.status(400).json({ mensaje: 'Faltan datos.' });
    }

    try {
        // 1. VERIFICAR EN BD
        const [rows] = await pool.promise().query(
            `SELECT * FROM codigos_verificacion 
             WHERE correo = ? AND codigo = ? AND usado = 0 AND fecha_expiracion > NOW()`,
            [correo, codigo]
        );

        if (rows.length === 0) {
            return res.status(400).json({ mensaje: 'Código inválido o expirado.' });
        }

        // 2. Validar password
        if (!validarContrasena(nuevaContrasena)) {
            return res.status(400).json({ mensaje: 'La contraseña no cumple los requisitos.' });
        }

        // 3. Hashear y Actualizar
        const hash = await bcrypt.hash(nuevaContrasena, 10);
        
        await pool.promise().query('UPDATE usuario SET contrasena = ? WHERE correo = ? AND estado = 1', [hash, correo]);
        
        // 4. Quemar código
        await pool.promise().query('UPDATE codigos_verificacion SET usado = 1 WHERE id = ?', [rows[0].id]);

        res.json({ mensaje: 'Contraseña actualizada correctamente' });

    } catch (err) {
        res.status(500).json({ mensaje: 'Error interno', error: err });
    }
};

exports.obtenerUsuario = async (req, res) => {
    const matricula = req.usuario.matricula;

    // 1. USUARIO: Consultamos datos personales + los NUEVOS campos (carrera, bio, etc.)
    const sqlUsuario = `
        SELECT matricula, nombre, apellido, correo, rol, imagen, 
               carrera, semestre, biografia, ubicacion 
        FROM usuario 
        WHERE matricula = ? AND estado = 1`;

    pool.query(sqlUsuario, [matricula], (err, results) => {
        if (err) return res.status(500).json({ mensaje: 'Error de servidor', err });
        if (results.length === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const usuario = results[0];

        // Lógica original de Roles
        let rolNombre = '';
        switch (usuario.rol) {
            case 1: rolNombre = 'Administrador'; break;
            case 2: rolNombre = 'Asesor'; break;
            case 3: rolNombre = 'Estudiante'; break;
            default: rolNombre = 'Desconocido';
        }

        // 2. INTERESES (Nueva funcionalidad)
        // Obtenemos los temas que le interesan al usuario
        const sqlIntereses = `
            SELECT i.id_interes, i.nombre 
            FROM usuario_intereses ui
            JOIN intereses i ON ui.id_interes = i.id_interes
            WHERE ui.matricula = ?`;

        pool.query(sqlIntereses, [matricula], (err2, interesesRes) => {
            if (err2) return res.status(500).json({ mensaje: 'Error al obtener intereses', err: err2 });
            
            // Agregamos los intereses al objeto usuario
            usuario.intereses = interesesRes; 

            // 3. NETWORKING (Nueva funcionalidad)
            // Contamos seguidores y seguidos
            const sqlRed = `
                SELECT 
                    (SELECT COUNT(*) FROM conexiones WHERE seguido_matricula = ?) as seguidores,
                    (SELECT COUNT(*) FROM conexiones WHERE seguidor_matricula = ?) as seguidos
            `;
            
            pool.query(sqlRed, [matricula, matricula], (err3, redRes) => {
                if (err3) return res.status(500).json({ mensaje: 'Error al obtener red', err: err3 });
                
                usuario.estadisticas = {
                    seguidores: redRes[0].seguidores,
                    seguidos: redRes[0].seguidos
                };

                // 4. TOTAL PUBLICACIONES (Tu lógica original)
                const sqlTotal = 'SELECT COUNT(*) AS total FROM integrantes WHERE matricula = ?';
                pool.query(sqlTotal, [matricula], (err4, totalRes) => {
                    if (err4) return res.status(500).json({ mensaje: 'Error al contar publicaciones', err: err4 });
                    
                    const total_publicaciones = totalRes[0]?.total || 0;

                    // 5. PUBLICACIÓN DESTACADA (Tu lógica original)
                    const sqlDestacada = `
                        SELECT p.nombre, AVG(e.evaluacion) as promedio
                        FROM integrantes i
                        JOIN publicacion p ON i.id_publi = p.id_publi
                        LEFT JOIN evaluacion e ON p.id_publi = e.id_publi
                        WHERE i.matricula = ?
                        GROUP BY p.id_publi
                        ORDER BY promedio DESC
                        LIMIT 1
                    `;
                    pool.query(sqlDestacada, [matricula], (err5, destRes) => {
                        if (err5) return res.status(500).json({ mensaje: 'Error al buscar publicación destacada', err: err5 });
                        
                        const publicacion_destacada = destRes.length > 0 ? destRes[0].nombre : null;

                        // 6. RESPUESTA FINAL CONSOLIDADA
                        res.json({
                            ...usuario,
                            rol: rolNombre, // Sobreescribimos el número con el nombre
                            total_publicaciones,
                            publicacion_destacada
                        });
                    });
                });
            });
        });
    });
};


exports.obtenerUsuarioConPublicaciones = (req, res) => {
    const matricula = req.body?.matricula || req.usuario?.matricula;
    if (!matricula) return res.status(400).json({ mensaje: 'Matrícula requerida' });

    // 1. Datos Usuario
    pool.query(`SELECT matricula, nombre, apellido, imagen, rol, estado, correo, carrera, semestre, biografia, ubicacion FROM usuario WHERE matricula = ?`, [matricula], (err, users) => {
        if (err) return res.status(500).json({ mensaje: 'Error', err });
        if (users.length === 0) return res.status(404).json({ mensaje: 'No encontrado' });
        const u = users[0];

        // 2. Intereses
        pool.query(`SELECT i.id_interes, i.nombre FROM usuario_intereses ui JOIN intereses i ON ui.id_interes = i.id_interes WHERE ui.matricula = ?`, [matricula], (err2, intereses) => {
            
            // 3. Red
            pool.query(`SELECT (SELECT COUNT(*) FROM conexiones WHERE seguido_matricula = ?) as seguidores, (SELECT COUNT(*) FROM conexiones WHERE seguidor_matricula = ?) as seguidos`, [matricula, matricula], (err3, red) => {
                
                // 4. Publicaciones
                const sqlPubs = `
                    SELECT p.id_publi, p.nombre AS proyecto_nombre, p.descripcion, p.fecha, p.imagen_portada, p.estado
                    FROM publicacion p
                    JOIN integrantes i ON p.id_publi = i.id_publi
                    WHERE i.matricula = ?
                    ORDER BY p.fecha DESC`;

                pool.query(sqlPubs, [matricula], (err4, pubs) => {
                    if (err4) return res.status(500).json({ mensaje: 'Error pubs', err: err4 });

                    // FORMATO DE PUBLICACIONES
                    const pubsFormat = pubs.map(p => ({
                        id_publi: p.id_publi,
                        proyecto_nombre: p.proyecto_nombre,
                        descripcion: p.descripcion,
                        imagen_portada: p.imagen_portada,
                        estado: p.estado,
                        // AQUI SE LLAMA AL HELPER
                        hace_cuanto: p.fecha ? tiempoTranscurrido(p.fecha) : 'Reciente' 
                    }));

                    let rolNombre = u.rol === 1 ? 'Admin' : (u.rol === 2 ? 'Asesor' : 'Estudiante');
                    if (u.estado === 0) rolNombre += ' (Inactivo)';

                    res.json({
                        matricula: u.matricula,
                        nombre: u.nombre,
                        apellido: u.apellido,
                        imagen: u.imagen,
                        correo: u.correo,
                        rol: rolNombre,
                        carrera: u.carrera || '',
                        semestre: u.semestre || '',
                        biografia: u.biografia || '',
                        ubicacion: u.ubicacion || '',
                        intereses: intereses || [],
                        estadisticas: {
                            seguidores: red[0].seguidores,
                            seguidos: red[0].seguidos,
                            total_publicaciones: pubs.length
                        },
                        publicaciones: pubsFormat
                    });
                    console.log(pubsFormat);
                    
                });
            });
        });
    });
};

exports.obtenerUsuarioConEventos = async (req, res) => {
    const matricula = req.body?.matricula || req.params?.matricula || req.usuario?.matricula;
    const tipo = (req.query?.tipo || '').toLowerCase(); // 'organizador' | 'asistente' | '' (ambos)

    if (!matricula) {
        return res.status(400).json({ mensaje: 'Matrícula no proporcionada' });
    }

    // 1. Obtener datos básicos del usuario (Solo lo necesario para el header)
    const sqlUsuario = 'SELECT matricula, nombre, apellido, imagen, rol, estado FROM usuario WHERE matricula = ? LIMIT 1';
    
    pool.query(sqlUsuario, [matricula], (errU, users) => {
        if (errU) return res.status(500).json({ mensaje: 'Error de servidor', err: errU });
        if (!users || users.length === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const usuario = users[0];

        // 2. Construir consulta de Eventos (AHORA CON CATEGORIA Y UBICACION_NOMBRE)
        let sqlEvents;
        let params;

        // Seleccionamos los campos nuevos que agregamos a la BD
        const selectFields = `
            e.id_evento, e.titulo, e.descripcion, e.fecha, e.cupo_maximo, 
            e.url_foto, e.latitud, e.longitud, e.fecha_creacion,
            e.categoria, e.ubicacion_nombre
        `;

        if (tipo === 'organizador') {
            sqlEvents = `
                SELECT ${selectFields}, 1 AS es_organizador, 0 AS es_asistente
                FROM evento e
                JOIN evento_organizadores eo ON e.id_evento = eo.id_evento
                WHERE eo.matricula = ?
                ORDER BY e.fecha DESC
            `;
            params = [matricula];
        } else if (tipo === 'asistente') {
            sqlEvents = `
                SELECT ${selectFields}, 0 AS es_organizador, 1 AS es_asistente
                FROM evento e
                JOIN evento_asistentes ea ON e.id_evento = ea.id_evento
                WHERE ea.matricula = ?
                ORDER BY e.fecha DESC
            `;
            params = [matricula];
        } else {
            // Ambos
            sqlEvents = `
                SELECT ${selectFields},
                       IF(eo.matricula IS NULL, 0, 1) AS es_organizador,
                       IF(ea.matricula IS NULL, 0, 1) AS es_asistente
                FROM evento e
                LEFT JOIN evento_organizadores eo ON e.id_evento = eo.id_evento AND eo.matricula = ?
                LEFT JOIN evento_asistentes ea ON e.id_evento = ea.id_evento AND ea.matricula = ?
                WHERE eo.matricula IS NOT NULL OR ea.matricula IS NOT NULL
                ORDER BY e.fecha DESC
            `;
            params = [matricula, matricula];
        }

        pool.query(sqlEvents, params, (errE, eventos) => {
            if (errE) return res.status(500).json({ mensaje: 'Error al obtener eventos', err: errE });

            // Formatear respuesta
            const listaEventos = (eventos || []).map(ev => ({
                id_evento: ev.id_evento,
                titulo: ev.titulo,
                descripcion: ev.descripcion,
                fecha: ev.fecha,
                cupo_maximo: ev.cupo_maximo,
                url_foto: ev.url_foto,
                latitud: ev.latitud,
                longitud: ev.longitud,
                fecha_creacion: ev.fecha_creacion,
                // Nuevos campos
                categoria: ev.categoria || 'General',
                ubicacion_nombre: ev.ubicacion_nombre || 'Ubicación por definir',
                // Flags
                es_organizador: Boolean(ev.es_organizador),
                es_asistente: Boolean(ev.es_asistente)
            }));

            let rolNombre = '';
            switch (usuario.rol) {
                case 1: rolNombre = 'Administrador'; break;
                case 2: rolNombre = 'Asesor'; break;
                case 3: rolNombre = 'Estudiante'; break;
                default: rolNombre = 'Desconocido';
            }

            res.json({
                matricula: usuario.matricula,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                imagen: usuario.imagen,
                rol: rolNombre,
                eventos: listaEventos
            });
        });
    });
};

exports.aprobarAsesor = async (req, res) => {
    // Idealmente verificar que req.usuario.rol === 1 (Admin)
    if (!req.usuario || req.usuario.rol !== 1) {
        return res.status(403).json({ mensaje: 'Acceso denegado' });
    }

    const matricula = req.params?.matricula || req.body?.matricula;
    if (!matricula) {
        return res.status(400).json({ mensaje: 'Matrícula requerida' });
    }

    const sql = 'UPDATE usuario SET estado = 1 WHERE matricula = ? AND rol = 2';
    pool.query(sql, [matricula], (err, result) => {
        if(err) return res.status(500).json({mensaje: 'Error'});
        if(result.affectedRows === 0) return res.status(404).json({mensaje: 'Asesor no encontrado o ya activo'});
        
        res.json({mensaje: 'Asesor aprobado correctamente'});
    });
};

// Recibe: { "matricula_destino": 12345 }
exports.alternarConexion = async (req, res) => {
    const seguidor = req.usuario.matricula;
    const seguido = req.body.matricula_destino;

    if (seguidor == seguido) return res.status(400).json({ mensaje: 'No te puedes seguir a ti mismo' });

    // Verificar si ya existe la conexión
    const sqlCheck = 'SELECT * FROM conexiones WHERE seguidor_matricula = ? AND seguido_matricula = ?';
    pool.query(sqlCheck, [seguidor, seguido], (err, results) => {
        if (err) return res.status(500).json({ error: err });

        if (results.length > 0) {
            // Ya existe -> Borrar (Dejar de seguir)
            pool.query('DELETE FROM conexiones WHERE seguidor_matricula = ? AND seguido_matricula = ?', [seguidor, seguido], (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({ mensaje: 'Dejaste de seguir al usuario', estado: 'no_seguido' });
            });
        } else {
            // No existe -> Insertar (Seguir)
            pool.query('INSERT INTO conexiones (seguidor_matricula, seguido_matricula) VALUES (?, ?)', [seguidor, seguido], (err) => {
                if (err) return res.status(500).json({ error: err });
                res.json({ mensaje: 'Ahora sigues al usuario', estado: 'seguido' });
            });
        }
    });
};

// Devuelve usuarios con intereses en común que NO sigo aún
exports.obtenerSugerencias = async (req, res) => {
    const miMatricula = req.usuario.matricula;

    const sql = `
        SELECT DISTINCT u.matricula, u.nombre, u.apellido, u.carrera, u.imagen, 
               (SELECT COUNT(*) FROM usuario_intereses ui2 
                WHERE ui2.matricula = u.matricula 
                AND ui2.id_interes IN (SELECT id_interes FROM usuario_intereses WHERE matricula = ?)
               ) as coincidencias
        FROM usuario u
        JOIN usuario_intereses ui ON u.matricula = ui.matricula
        WHERE u.matricula != ? 
        AND u.estado = 1
        AND u.matricula NOT IN (SELECT seguido_matricula FROM conexiones WHERE seguidor_matricula = ?)
        AND ui.id_interes IN (SELECT id_interes FROM usuario_intereses WHERE matricula = ?)
        ORDER BY coincidencias DESC
        LIMIT 10
    `;

    pool.query(sql, [miMatricula, miMatricula, miMatricula, miMatricula], (err, results) => {
        if (err) return res.status(500).json({ mensaje: 'Error al obtener sugerencias', err });
        res.json(results);
    });
};

// GET /intereses (Catálogo completo para mostrar en el selector)
exports.obtenerCatalogoIntereses = async (req, res) => {
    pool.query('SELECT * FROM intereses ORDER BY nombre ASC', (err, results) => {
        if (err) return res.status(500).json({ mensaje: 'Error de servidor', err });
        res.json(results);
    });
};

// Recibe: { "intereses": [1, 4, 8] }  <- Array de IDs
exports.actualizarMisIntereses = async (req, res) => {
    const matricula = req.usuario.matricula;
    const { intereses } = req.body; // Array de IDs

    if (!Array.isArray(intereses)) {
        return res.status(400).json({ mensaje: 'Formato de intereses inválido' });
    }

    // Transacción manual simple: Borrar anteriores -> Insertar nuevos
    pool.getConnection((err, connection) => {
        if (err) return res.status(500).json({ error: err });

        connection.beginTransaction(err => {
            if (err) { connection.release(); return res.status(500).json({ error: err }); }

            // 1. Borrar existentes
            connection.query('DELETE FROM usuario_intereses WHERE matricula = ?', [matricula], (err) => {
                if (err) { 
                    return connection.rollback(() => { connection.release(); res.status(500).json({ error: err }); });
                }

                // Si el array está vacío, terminamos aquí (borró todo)
                if (intereses.length === 0) {
                    return connection.commit(err => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err }); });
                        connection.release();
                        res.json({ mensaje: 'Intereses actualizados (limpios)' });
                    });
                }

                // 2. Insertar nuevos
                const valores = intereses.map(id => [matricula, id]);
                connection.query('INSERT INTO usuario_intereses (matricula, id_interes) VALUES ?', [valores], (err) => {
                    if (err) { 
                        return connection.rollback(() => { connection.release(); res.status(500).json({ error: err }); });
                    }

                    connection.commit(err => {
                        if (err) return connection.rollback(() => { connection.release(); res.status(500).json({ error: err }); });
                        connection.release();
                        res.json({ mensaje: 'Intereses actualizados correctamente' });
                    });
                });
            });
        });
    });
};