/**
 * Created by drouar_b on 18/08/2017.
 */

const fs = require('fs');
const debug = require('debug')('Dash');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const config = require('../utils/config');
const utils = require('../utils/utils');

let dash = {};

dash.serve = function (req, res) {

    // Plex header
    res.header('X-Plex-Protocol', '1.0');

    debug(req.query.session);
    universal.cache[req.query.session] = new Transcoder(req.query.session, req, res)
};

dash.serveInit = function (req, res) {

    // Allow CORS
    res.header('Access-Control-Allow-Origin', '*');

    // Plex header
    res.header('X-Plex-Protocol', '1.0');

    let count = 0;
    let sessionId = req.params.sessionId;

    function doWork() {
        if (!req.connection.destroyed) {
            if (fs.existsSync(config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s")) {
                debug('Serving init-stream' + req.params.streamId + '.m4s for session ' + sessionId);
                res.download(config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s");
            } else {
                if (count < 20) {
                    count++;
                    setTimeout(doWork, 1000);
                } else {
                    res.status(404).send('Not found');
                }
            }
        }
    }
    doWork();

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.updateTimeout(sessionId);
    }
};

dash.serveChunk = function (req, res) {

    // Allow CORS
    res.header('Access-Control-Allow-Origin', '*');

    // Plex header
    res.header('X-Plex-Protocol', '1.0');

    let count = 0;
    let sessionId = req.params.sessionId;

    function doWork() {
        if (!req.connection.destroyed) {
            if (fs.existsSync(config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + ".m4s")) {
                debug('Serving chunk-stream' + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                res.download(config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + ".m4s");
            } else {
                if (count < 20) {
                    count++;
                    setTimeout(doWork, 1000);
                } else {
                    res.status(404).send('Not found');
                }
            }
        }
    }
    doWork();

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.updateTimeout(sessionId);
    }
};

module.exports = dash;
