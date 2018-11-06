/**
 * Created by drouar_b on 18/08/2017.
 */

const debug = require('debug')('Dash');
const Transcoder = require('./transcoder');
const SessionManager = require('./session-manager');
const config = require('../config');
const utils = require('../utils/utils');

class Dash {
    static serve(req, res) {
        let sessionId = req.query.session;

        if (typeof sessionId === 'undefined')
            return res.status(400).send('Invalid session id');
        debug(sessionId);

        SessionManager.killSession(sessionId, () => {
            SessionManager.saveSession(new Transcoder(sessionId, req, res));
        })
    }

    static serveInit(req, res) {
        let sessionId = req.params.sessionId;

        let transcoder = SessionManager.getSession(sessionId);
        if (transcoder !== null) {
            SessionManager.updateTimeout(sessionId);
            transcoder.getChunk(0, (chunkId) => {
                // -2 -> getChunk timeout
                // -1 -> Session not alive
                if (chunkId === -2 || chunkId === -1) {
                    if (!res.headersSent)
                        return res.status(404).send('Callback ' + chunkId);
                } else {
                    debug('Serving init-stream' + req.params.streamId + '.m4s for session ' + sessionId);
                    let file = config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s";
                    res.sendFile(file);
                }
            }, req.params.streamId, true);
        } else {
            SessionManager.restartSession(sessionId, 'DASH', res);
        }
    }

    static serveChunk(req, res) {
        let sessionId = req.params.sessionId;

        let transcoder = SessionManager.getSession(sessionId);
        if (transcoder !== null) {
            SessionManager.updateTimeout(sessionId);
            transcoder.getChunk(parseInt(req.params.partId) + 1, (chunkId) => {
                if (chunkId === -2 || chunkId === -1) {
                    if (!res.headersSent)
                        return res.status(404).send('Callback ' + chunkId);
                } else {
                    let file = config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + ".m4s";
                    debug('Serving chunk-stream' + req.params.streamId + "-" + utils.pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                    res.sendFile(file);
                }
            }, req.params.streamId);
        } else {
            SessionManager.restartSession(sessionId, 'DASH', res);
        }
    }
}

module.exports = Dash;
