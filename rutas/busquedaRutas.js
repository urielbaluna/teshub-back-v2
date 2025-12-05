const express = require('express');
const router = express.Router();
const autenticar = require('../middlewares/auth');
const { busquedaGeneral, busquedaEventos } = require('../controladores/busquedaControlador');

router.get('/buscar', autenticar, busquedaGeneral);
router.get('/buscar/eventos', autenticar, busquedaEventos);

module.exports = router;