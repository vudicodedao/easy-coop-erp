const express = require('express');
const router = express.Router();
const salesController = require('./sales.controller');

router.get('/', salesController.getOrders);
router.post('/', salesController.addOrder);
router.put('/:id', salesController.updateStatus);
router.delete('/:id', salesController.removeOrder);

module.exports = router;