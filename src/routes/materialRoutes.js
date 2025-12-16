const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { authenticate } = require('../middleware/auth');
const Class = require('../models/Class');

router.get('/', authenticate, materialController.listMaterials);
router.get('/create', authenticate, async (req, res) => {
    const classes = await Class.find({ teacher: req.user._id });
    res.render('material/create', { user: req.user, classes });
});
router.get('/:id', authenticate, materialController.getMaterial);
router.get('/:id/download', authenticate, materialController.downloadMaterial);

router.post('/create', authenticate, materialController.uploadMaterial, materialController.createMaterial);

module.exports = router;
