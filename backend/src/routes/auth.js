const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rotas públicas (não precisa de login)
router.post('/register', register);  // POST /api/auth/register
router.post('/login', login);        // POST /api/auth/login

// Rotas protegidas (precisa de token JWT)
router.get('/profile', authMiddleware, getProfile);  // GET /api/auth/profile

module.exports = router;
