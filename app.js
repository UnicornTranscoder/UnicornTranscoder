/**
 * Created by drouar_b on 27/04/2017.
 */

const express = require('express');
const restreamer = require('connect-restreamer');
const routes = require('./routes/routes');

let app = express();

app.use(restreamer());
app.use('/', routes);

module.exports = app;
