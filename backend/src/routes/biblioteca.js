const express = require('express');
const router = express.Router();
const { list, add, update, remove } = require('../controllers/bibliotecaController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', list);  // GET  /api/biblioteca
router.post('/', add);
router.patch('/:id', update);
router.delete('/:id', remove);  // DELETE /api/biblioteca/123
  // POST /api/biblioteca

module.exports = router;
