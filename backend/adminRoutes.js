// adminRoutes.js
const express = require('express');
const router = express.Router();
const inv = require('./adminInventoryController');
const cmp = require('./adminCompoundingProductsController');

// Units and Inventory
router.get('/units', inv.listUnits);
router.get('/estoque', inv.listEstoque);
router.post('/estoque', inv.createEstoque);
router.get('/estoque/:id', inv.getEstoque);
router.put('/estoque/:id', inv.updateEstoque);
router.post('/estoque/:id/consumir', inv.consumirEstoque);

// Forms and Formulas
router.get('/formas', cmp.listFormas);
router.post('/formulas', cmp.createFormula);
router.get('/formulas/:id', cmp.getFormula);
router.put('/formulas/:id', cmp.updateFormula);
router.delete('/formulas/:id', cmp.deleteFormula);
router.put('/formulas/:id/itens', cmp.upsertItems);
router.get('/formulas/:id/estimate', cmp.estimate);

module.exports = router;
