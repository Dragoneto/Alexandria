const express = require('express');
const router = express.Router();
const { search } = require('../controllers/bookController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rotas protegidas (precisa de token JWT)
router.get('/search', authMiddleware, search);  // GET /api/books/search

module.exports = router;
