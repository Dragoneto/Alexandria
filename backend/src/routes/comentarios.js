const express = require('express');
const router = express.Router();
const { update, remove } = require('../controllers/comentarioController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
