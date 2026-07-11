const express = require('express');
const searchController = require('../controllers/searchController');

const router = express.Router();

// Public route — smart search is available to unauthenticated Home screen visitors too
router.get('/', searchController.search);

module.exports = router;
