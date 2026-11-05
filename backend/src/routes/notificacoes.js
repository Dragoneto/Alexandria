const router = require('express').Router();
const auth = require('../middlewares/authMiddleware');
const controller = require('../controllers/notificacaoController');

router.use(auth);
router.get('/', controller.list);
router.get('/nao-lidas', controller.unread);
router.patch('/lidas', controller.markRead);
router.patch('/:id/lida', controller.markRead);

module.exports = router;
