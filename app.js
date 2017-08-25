/**
 * Created by drouar_b on 27/04/2017.
 */

const express = require('express');
const routes = require('./routes/routes');

let app = express();

app.use('/', routes);

module.exports = app;
