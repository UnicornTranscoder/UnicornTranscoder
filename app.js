/**
 * Created by drouar_b on 27/04/2017.
 */

var express = require('express');
var routes = require('./routes/routes');

var app = express();

app.use('/', routes);

module.exports = app;
