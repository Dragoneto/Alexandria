const express = require('express');
const router = express.Router();
const { create, detail, listByBook, listMine, remove, update } = require('../controllers/avaliacaoController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

// Rotas fixas antes de '/:id': senão GET /minhas cairia no detalhe e responderia 400
router.get('/minhas', listMine);
router.get('/livro/:livroId', listByBook);
router.get('/:id', detail);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
