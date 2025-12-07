const express = require('express');
const router = express.Router();
const revisionesControlador = require('../controladores/revisionesControlador');
const autenticar = require('../middlewares/auth');

// Asesor: Ver qué tengo pendiente de revisar
router.get('/pendientes', autenticar, revisionesControlador.obtenerPendientes);

// Asesor: Enviar mi veredicto
router.post('/revisar', autenticar, revisionesControlador.revisarPublicacion);

// Ambos: Ver qué me han dicho antes (Historial de comentarios)
router.get('/historial/:id_publi', autenticar, revisionesControlador.obtenerHistorial);

module.exports = router;