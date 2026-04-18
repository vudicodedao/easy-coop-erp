const express = require('express');
const router = express.Router();
const memberController = require('./member.controller');

router.get('/', memberController.getMembers);
router.post('/', memberController.addMember);
router.delete('/:id', memberController.deleteMember);
router.put('/:id', memberController.updateMember);

// [THÊM MỚI] - Route Khôi phục mật khẩu
router.put('/:id/reset-password', memberController.resetPassword);

module.exports = router;