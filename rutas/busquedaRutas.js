const express = require('express');
const router = express.Router();
const autenticar = require('../middlewares/auth');
const { busquedaGeneral } = require('../controladores/busquedaControlador');

router.get('/buscar', autenticar, busquedaGeneral);

module.exports = router;