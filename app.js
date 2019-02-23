/**
 * Created by drouar_b on 27/04/2017.
 */

const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');
const child_process = require('child_process');
const PlexDirectories = require('./utils/plex-directories');
const debug = require('debug')('UnicornTranscoder');
const config = require('./config');
const path = require('path');

let app = express();

app.use(cors());
app.use('/', routes);

//Start EAE
function startEAE() {
    debug('Starting EAE');
    let eae = child_process.spawn(
        PlexDirectories.getEAE(),
        [],
        {
            env: Object.create(process.env),
            cwd: path.resolve(config.transcoder.temp_folder)
        }
    );

    eae.on('error', (e) => {
        debug("Can't start EAE");
        console.error(e);
        process.exit(1);
    })
}

startEAE();

module.exports = app;
