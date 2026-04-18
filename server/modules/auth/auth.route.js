const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

router.post('/register', authController.register);
router.post('/login', authController.login);

// [THÊM MỚI] - Route Đổi Mật khẩu
router.put('/change-password', authController.changePassword);

module.exports = router;