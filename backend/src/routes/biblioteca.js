const express = require('express');
const router = express.Router();
const { list, add, remove } = require('../controllers/bibliotecaController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', list);  // GET  /api/biblioteca
router.post('/', add);
router.delete('/:id', remove);  // DELETE /api/biblioteca/123
  // POST /api/biblioteca

module.exports = router;
