/**
 * Created by drouar_b on 18/08/2017.
 */

const fs = require('fs');
const debug = require('debug')('Dash');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const config = require('../utils/config');

let dash = {};

dash.serve = function (req, res) {
    debug(req.query.session);
    universal.cache[req.query.session] = new Transcoder(req.query.session, req, res)
};

dash.serveInit = function (req, res) {
    let sessionId = req.params.sessionId;

    if (fs.existsSync(config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s")) {
        debug('Serving ' + req.params.partId + ' for session ' + sessionId);
        res.sendFile(config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s");
    } else {
        res.status(404).send('Not found');
    }
};

dash.serveChunk = function (req, res) {
    let sessionId = req.params.sessionId;

    if (fs.existsSync(config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + req.params.partId + ".m4s")) {
        debug('Serving ' + req.params.partId + ' for session ' + sessionId);
        res.sendFile(config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + req.params.partId + ".m4s");
    } else {
        res.status(404).send('Not found');
    }
};

module.exports = dash;