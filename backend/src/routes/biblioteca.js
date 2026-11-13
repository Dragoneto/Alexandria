const express = require('express');
const router = express.Router();
const {
  list,
  add,
  update,
  remove,
  registrarDia,
  diasDeLeitura,
} = require('../controllers/bibliotecaController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', list); // GET  /api/biblioteca
router.post('/', add); // POST /api/biblioteca
router.post('/dia-de-leitura', registrarDia); // POST /api/biblioteca/dia-de-leitura (tracker)
router.get('/dias-de-leitura', diasDeLeitura); // GET  /api/biblioteca/dias-de-leitura (perfil)
router.patch('/:id', update);
router.delete('/:id', remove); // DELETE /api/biblioteca/123

module.exports = router;
