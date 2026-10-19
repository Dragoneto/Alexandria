const express = require('express');
const router = express.Router();
const { create, update, remove } = require('../controllers/avaliacaoController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
