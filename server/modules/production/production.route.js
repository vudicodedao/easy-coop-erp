const express = require('express');
const router = express.Router();
const productionController = require('./production.controller');

router.get('/', productionController.getLogs);
router.post('/', productionController.addLog);
router.put('/:id', productionController.updateLog);
router.delete('/:id', productionController.deleteLog);

// [THÊM MỚI] - API xử lý Trả / Báo mất công cụ
router.post('/tool-action', productionController.handleToolAction);

module.exports = router;