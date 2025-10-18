// server.js - Minimal Express server wiring new admin routes
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const adminRoutes = require('./adminRoutes');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mount admin API under /admin
app.use('/admin', adminRoutes);

const port = process.env.PORT || 4001;
app.listen(port, () => console.log(`Admin API listening on :${port}`));
