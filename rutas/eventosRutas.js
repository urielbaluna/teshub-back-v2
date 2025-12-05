const express = require('express');
const router = express.Router();
const eventosControlador = require('../controladores/eventosControlador');
const upload = require('../middlewares/uploadEventoImagen');
const autenticar = require('../middlewares/auth');

// Crear evento
router.post('/', autenticar, upload.single('foto'), eventosControlador.crearEvento);

// Listar todos los eventos
router.get('/', autenticar, eventosControlador.listarEventos);

// Ver evento específico
router.get('/:id', autenticar, eventosControlador.verEvento);

// Actualizar evento
router.put('/:id', autenticar, upload.single('foto'), eventosControlador.actualizarEvento);

// Eliminar evento
router.delete('/:id', autenticar, eventosControlador.eliminarEvento);

// Registrarse a un evento
router.post('/:id/registrarse', autenticar, eventosControlador.registrarseEvento);

// Cancelar registro a un evento
router.delete('/:id/cancelar-registro', autenticar, eventosControlador.cancelarRegistroEvento);

module.exports = router;
