const express = require('express');
const router = express.Router();
const reportController = require('./report.controller');

router.get('/stats', reportController.getStats);

module.exports = router;