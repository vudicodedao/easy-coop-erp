const express = require('express');
const router = express.Router();
const memberController = require('./member.controller');

router.get('/', memberController.getMembers);
router.post('/', memberController.addMember);

// Thêm route DELETE có chứa ID
router.delete('/:id', memberController.deleteMember);
// Thêm route PUT để cập nhật
router.put('/:id', memberController.updateMember);

module.exports = router;