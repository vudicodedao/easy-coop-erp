const express = require('express');
const router = express.Router();
const inventoryController = require('./inventory.controller');

// Các đường dẫn cho Danh mục Kho (Tab 1)
router.get('/', inventoryController.getItems);
router.post('/', inventoryController.addItem);
router.put('/:id', inventoryController.updateItem);
router.delete('/:id', inventoryController.deleteItem);

// Các đường dẫn cho Phiếu Nhập / Xuất (Tab 2, Tab 3)
router.get('/transactions', inventoryController.getTransactions);
router.post('/transactions', inventoryController.addTransaction);
router.delete('/transactions/:id', inventoryController.removeTransaction);

module.exports = router;