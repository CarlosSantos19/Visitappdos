const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/me', authController.verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
