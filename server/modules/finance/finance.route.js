const express = require('express');
const router = express.Router();
const financeController = require('./finance.controller');

router.get('/', financeController.getRecords);
router.post('/', financeController.addRecord);
router.put('/:id', financeController.updateRecord);
router.delete('/:id', financeController.deleteRecord);

module.exports = router;