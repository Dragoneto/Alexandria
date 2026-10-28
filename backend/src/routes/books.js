const express = require('express');
const router = express.Router();
const { search, detail } = require('../controllers/bookController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rotas protegidas (precisa de token JWT)
router.get('/search', authMiddleware, search);  // GET /api/books/search
router.get('/:id', authMiddleware, detail);      // GET /api/books/:id

module.exports = router;
