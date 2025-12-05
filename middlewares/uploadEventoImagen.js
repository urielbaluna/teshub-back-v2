const multer = require('multer');
const fs = require('fs');
const path = require('path');

const EVENTOS_FOLDER = path.join(__dirname, '..', 'uploads', 'eventos');

if (!fs.existsSync(EVENTOS_FOLDER)) {
    fs.mkdirSync(EVENTOS_FOLDER, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, EVENTOS_FOLDER);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
        allowedExtensions.includes(ext) ||
        file.mimetype.startsWith('image/')
    ) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes para eventos'), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;
