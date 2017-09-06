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
    debug(req.query.session);
    universal.cache[req.query.session] = new Transcoder(req.query.session, req, res);

    if (typeof req.query['X-Plex-Session-Identifier'] != 'undefined') {
        universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }
};

dash.serveInit = function (req, res) {
    let sessionId = req.params.sessionId;

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.cache[sessionId].getChunk(1, () => {
            debug('Serving init-stream' + req.params.streamId + '.m4s for session ' + sessionId);
            res.sendFile(config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s");
        }, req.params.streamId)
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }

    universal.updateTimeout(sessionId);
};

dash.serveChunk = function (req, res) {
    let sessionId = req.params.sessionId;

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.cache[sessionId].getChunk(parseInt(req.params.partId) + 1, (chunkId) => {
            debug('Serving chunk-stream' + req.params.streamId + "-" + utils.pad(chunkId, 5) + '.m4s for session ' + sessionId);
            res.sendFile(config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + utils.pad(chunkId, 5) + ".m4s");
        }, req.params.streamId)
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }

    universal.updateTimeout(sessionId);
};

module.exports = dash;
