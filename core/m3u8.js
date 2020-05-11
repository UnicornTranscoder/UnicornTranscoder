/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('UnicornTranscoder:M3U8');
const Transcoder = require('./transcoder');
const config = require('../config');
const SessionManager = require('./session-manager');
const PlexDirectories = require('../utils/plex-directories');

class M3U8 {
    static serve(req, res) {
        let sessionId = req.params.sessionId;

        if (typeof sessionId === 'undefined')
            return res.status(400).send('Invalid session id');
        debug(sessionId);

        SessionManager.killSession(sessionId, () => {
            SessionManager.saveSession(new Transcoder(sessionId, req, res));
        })
    }

    static serveChunk(req, res) {
        let sessionId = req.params.sessionId;

        let transcoder = SessionManager.getSession(sessionId);
        if (transcoder !== null) {
            SessionManager.updateTimeout(sessionId);
            transcoder.getChunk(req.params.partId, (chunkId) => {
                if (chunkId === -2 || chunkId === -1) {
                    if (!res.headersSent)
                        return res.status(404).send('Callback ' + chunkId);
                } else {
                    let file = PlexDirectories.getTemp() + sessionId + "/media-" + req.params.partId + ".ts";
                    debug('Serving ' + req.params.partId + ' for session ' + sessionId);
                    res.sendFile(file);
                }
                });
        } else {
            SessionManager.restartSession(sessionId, 'HLS', res);
        }
    }

    static serveSubtitles(req, res) {
        let sessionId = req.params.sessionId;

        let transcoder = SessionManager.getSession(sessionId);
        if (transcoder !== null) {
            SessionManager.updateTimeout(sessionId);
            transcoder.getChunk(req.params.partId, (chunkId) => {
                if (chunkId === -2 || chunkId === -1) {
                    if (!res.headersSent)
                        return res.status(404).send('Callback ' + chunkId);
                } else {
                    let file = PlexDirectories.getTemp() + sessionId + "/media-" + req.params.partId + ".vtt";
                    debug('Serving subtitles ' + req.params.partId + ' for session ' + sessionId);
                    res.sendFile(file);
                }
            }, 'sub', true);
        } else {
            SessionManager.restartSession(sessionId, 'HLS', res);
        }
    }
	
    static serveHeader(req, res) {
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
                    debug('Serving header for session ' + sessionId);
                    let file = PlexDirectories.getTemp() + sessionId + "/header";
                    res.sendFile(file);
                }
            }, req.params.streamId, true);
        } else {
            SessionManager.restartSession(sessionId, 'HLS', res);
        }
    }
}

module.exports = M3U8;