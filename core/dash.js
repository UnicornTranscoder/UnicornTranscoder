/**
 * Created by drouar_b on 18/08/2017.
 */

const fs = require('fs');
const debug = require('debug')('Dash');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const config = require('../config');
const utils = require('../utils/utils');

let dash = {};

dash.serve = function (req, res) {
    debug(req.query.session);

    if (typeof universal.cache[req.params.sessionId] !== 'undefined')
        universal.cache[req.params.sessionId].killInstance();

    universal.cache[req.query.session] = new Transcoder(req.query.session, req, res);

    if (typeof req.query['X-Plex-Session-Identifier'] !== 'undefined') {
        universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }

    universal.updateTimeout(req.query.session);
};

dash.serveInit = function (req, res) {
    let sessionId = req.params.sessionId;

    if ((typeof universal.cache[sessionId]) !== 'undefined' && universal.cache[sessionId].alive === true) {
        universal.cache[sessionId].getChunk(0, (chunkId) => {
            let file = config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s";


            if (chunkId == -2 || (chunkId == -1 && !fs.existsSync(file))) {
                res.status(404).send('Callback ' + chunkId);
            } else {
                debug('Serving init-stream' + req.params.streamId + '.m4s for session ' + sessionId);
                res.sendFile(file);
            }
        }, req.params.streamId, true);

        universal.updateTimeout(sessionId);
    } else {
        debug(sessionId + ' not found');

        universal.cache[sessionId] = new Transcoder(sessionId);
        universal.updateTimeout(sessionId);

        setTimeout(() => {
            res.status(404).send('Restarting session');
        }, 10000);
    }
};

dash.serveChunk = function (req, res) {
    let sessionId = req.params.sessionId;

    if ((typeof universal.cache[sessionId]) !== 'undefined' && universal.cache[sessionId].alive === true) {
        universal.cache[sessionId].getChunk(parseInt(req.params.partId) + 1, (chunkId) => {
            let file = config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + ".m4s";

            if (chunkId == -2) {
                res.status(404).send('Callback ' + chunkId);
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                debug('Serving fake chunk-stream' + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                res.send('');
            } else {
                debug('Serving chunk-stream' + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                res.sendFile(file);
            }
        }, req.params.streamId);

        universal.updateTimeout(sessionId);
    } else {
        debug(req.params.sessionId + ' not found');

        universal.cache[sessionId] = new Transcoder(sessionId);
        universal.updateTimeout(sessionId);

        setTimeout(() => {
            res.status(404).send('Restarting session');
        }, 10000);
    }
};

module.exports = dash;
