const express = require('express');
const router = express.Router();
const asesoriasControlador = require('../controladores/asesoriasControlador');
const autenticar = require('../middlewares/auth');

// Estudiante: Solicitar
router.post('/solicitar', autenticar, asesoriasControlador.solicitarAsesoria);

// Estudiante: Ver status
router.get('/mi-asesor', autenticar, asesoriasControlador.obtenerMiAsesor);

// Asesor: Responder (Aceptar/Rechazar)
router.put('/responder', autenticar, asesoriasControlador.responderSolicitud);

// Asesor: Listas
router.get('/pendientes', autenticar, asesoriasControlador.listarSolicitudesPendientes);
router.get('/mis-alumnos', autenticar, asesoriasControlador.listarMisAsesorados);

module.exports = router;