const express = require('express');
const router = express.Router();
const publicacionesControlador = require('../controladores/publicacionesControlador');
const upload = require('../middlewares/uploadFiles');
const autenticar = require('../middlewares/auth');

const uploadCampos = upload.fields([
    { name: 'portada', maxCount: 1 },
    { name: 'archivos', maxCount: 10 }
]);

router.post('/crear', autenticar, uploadCampos, publicacionesControlador.registrarPublicacion);
router.get('/ver/:id_publi', autenticar, publicacionesControlador.verPublicacion);
router.put('/actualizar/:id_publi', autenticar, uploadCampos, publicacionesControlador.actualizarPublicacion);
router.delete('/eliminar/:id_publi', autenticar, publicacionesControlador.eliminarPublicacion);
router.get('/listar', autenticar, publicacionesControlador.listarPublicaciones);
router.post('/calificar', autenticar, publicacionesControlador.calificarPublicacion);
router.post('/comentar', autenticar, publicacionesControlador.comentarPublicacion);
router.post('/eliminar-comentario', autenticar, publicacionesControlador.eliminarComentario);
router.post('/eliminar-archivo', autenticar, publicacionesControlador.eliminarArchivoAdjunto);
router.post('/:id_publi/vista', autenticar, publicacionesControlador.incrementarVistas);
router.post('/:id_publi/descarga', autenticar, publicacionesControlador.incrementarDescargas);

module.exports = router;