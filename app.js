/**
 * Created by drouar_b on 27/04/2017.
 */

let express = require('express');
let routes = require('./routes/routes');

let app = express();

app.use('/', routes);

module.exports = app;
