const express = require('express');
const router = express.Router();
const productionController = require('./production.controller');

router.get('/', productionController.getLogs);
router.post('/', productionController.addLog);
router.put('/:id', productionController.updateLog);
router.delete('/:id', productionController.deleteLog);

module.exports = router;