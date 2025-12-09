const express = require('express');
const router = express.Router();
const usuariosControlador = require('../controladores/usuariosControladores');
const upload = require('../middlewares/uploadImagen');
const autenticar = require('../middlewares/auth');

// Registrar usuario
router.post('/registrar', upload.single('imagen'), usuariosControlador.registrarUsuario);
// Login
router.post('/login', usuariosControlador.loginUsuario);
//Solicitar codigo de actualización
router.post('/solicitar-codigo', autenticar, usuariosControlador.solicitarCodigoActualizacion);
//codigo de contraseña
router.post('/codigo-contrasena', usuariosControlador.codigoContrasena);
// Actualizar contraseña
router.put('/actualizar-contrasena', usuariosControlador.actualizarContrasena);
// Actualizar usuario
router.put('/actualizar', autenticar, upload.single('imagen'), usuariosControlador.actualizarUsuario);
//Eliminar usuario
router.post('/eliminar', autenticar, usuariosControlador.eliminarCuenta);
// Ver usuario
router.get('/ver-info', autenticar, usuariosControlador.obtenerUsuario);
//Ver info y publicaciones de un usuario
router.post('/ver-info-publicaciones', autenticar, usuariosControlador.obtenerUsuarioConPublicaciones);
// Obtener eventos de un usuario por matrícula (público o protegido según tu middleware)
router.get('/:matricula/eventos', autenticar, usuariosControlador.obtenerUsuarioConEventos);
// Obtener eventos del usuario autenticado
router.get('/eventos', autenticar, usuariosControlador.obtenerUsuarioConEventos);
// Aprobar asesor
router.put('/:matricula/aprobar', autenticar, usuariosControlador.aprobarAsesor);
// Seguir/Dejar de seguir usuario
router.post('/conectar', autenticar, usuariosControlador.alternarConexion);
// Obtener sugerencias de usuarios
router.get('/sugerencias', autenticar, usuariosControlador.obtenerSugerencias);
// Obtener catalogo de intereses
router.get('/intereses/catalogo', autenticar, usuariosControlador.obtenerCatalogoIntereses);
// Actualizar intereses
router.post('/intereses/actualizar', autenticar, usuariosControlador.actualizarMisIntereses);

router.get('/conexiones', autenticar, usuariosControlador.obtenerMisConexiones);

module.exports = router;