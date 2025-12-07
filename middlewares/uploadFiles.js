const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = path.join(__dirname, '..', 'uploads', 'generales');
        
        // Determinar carpeta según el campo
        if (file.fieldname === 'portada' || file.fieldname === 'foto') {
            uploadPath = path.join(__dirname, '..', 'uploads', 'eventos');
            if (req.baseUrl.includes('publicaciones') || req.baseUrl.includes('usuarios')) {
                 uploadPath = path.join(__dirname, '..', 'uploads', 'publicaciones');
            }
        } else if (file.fieldname === 'archivos') { 
            uploadPath = path.join(__dirname, '..', 'uploads', 'publicaciones');
        } else if (file.fieldname === 'imagen') { 
            uploadPath = path.join(__dirname, '..', 'uploads', 'imagenes');
        }

        // Crear carpeta si no existe
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // --- SOLUCIÓN: Agregamos path.extname ---
        const ext = path.extname(file.originalname); // Obtiene .jpg, .png, .pdf
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        
        // Nombre final: [Timestamp]-[Random]-[Campo].ext
        cb(null, uniqueSuffix + '-' + file.fieldname + ext); 
    }
});

const upload = multer({ storage: storage });

module.exports = upload;