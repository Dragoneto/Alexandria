const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rotas públicas (não precisa de login)
router.post('/register', register);  // POST /api/auth/register
router.post('/login', login);        // POST /api/auth/login
router.post('/forgot-password', forgotPassword);  // POST /api/auth/forgot-password
router.post('/reset-password', resetPassword);    // POST /api/auth/reset-password
router.put('/profile', authMiddleware, updateProfile);  // PUT /api/auth/profile

// Rotas protegidas (precisa de token JWT)
router.get('/profile', authMiddleware, getProfile);  // GET /api/auth/profile

module.exports = router;
