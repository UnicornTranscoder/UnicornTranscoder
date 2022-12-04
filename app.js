/**
 * Created by drouar_b on 27/04/2017.
 */

const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');
const debug = require('debug')('UnicornTranscoder');
const config = require('./config');
const mkdirp = require('mkdirp');

mkdirp(config.transcoder.temp_folder).catch((err) =>  {
    if (err) {
        debug("Can't create temp folder");
        console.error(err);
        process.exit(1);
    }
});

let app = express();

app.use(cors());
app.use('/', routes);
app.use('/', express.static('public'));

module.exports = app;
