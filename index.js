const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let server = require('./qr'),
    code = require('./pair');

// Set default max listeners if necessary
require('events').EventEmitter.defaultMaxListeners = 500;

// Body parser middleware comes before routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/qr', server);
app.use('/code', code);

// Serve pair.html file
app.use('/pair', async (req, res, next) => {
    res.sendFile(path.join(process.cwd(), 'pair.html'));
});

// Serve main.html file
app.use('/', async (req, res, next) => {
    res.sendFile(path.join(process.cwd(), 'main.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:` + PORT)
});

module.exports = app;
