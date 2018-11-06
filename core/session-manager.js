/**
 * Created by drouar_b on 15/08/2017.
 */

const debug = require('debug')('SessionManager');
const config = require('../config');

class SessionManager {
    constructor() {
        this.transcoderStore = {};
    }

    stopTranscoder(req, res) {
        if (typeof req.query.session !== 'undefined' && req.query.session in this.transcoderStore) {
            debug('Stop ' + req.query.session);
            this.transcoderStore[req.query.session].killInstance();
            return res.send('');
        }
        res.status(400).send('Invalid session id');
    }

    ping(req, res) {
        if (typeof req.query.session !== 'undefined' && req.query.session in this.transcoderStore) {
            this.updateTimeout(req.query.session);
            return res.send('');
        }
        res.status(400).send('Invalid session id');
    }

    updateTimeout(sessionId) {
        if (sessionId in this.transcoderStore && this.transcoderStore[sessionId].alive) {
            if (typeof this.transcoderStore[sessionId].sessionTimeout !== 'undefined')
                clearTimeout(this.transcoderStore[sessionId].sessionTimeout);

            this.transcoderStore[sessionId].sessionTimeout = setTimeout(() => {
                debug(sessionId + ' timed out');
                if (sessionId in this.transcoderStore)
                    this.transcoderStore[sessionId].killInstance()
            }, config.transcoder_decay_time * 1000)
        }
    }

    saveSession(transcoder) {
        this.transcoderStore[transcoder.sessionId] = transcoder;
        this.updateTimeout(transcoder.sessionId);
    }

    killSession(sessionId, callback) {
        if (sessionId in this.transcoderStore && this.transcoderStore[sessionId].alive) {
            this.transcoderStore[sessionId].killInstance(true, () => {
                delete this.transcoderStore[sessionId];
                callback();
            })
        } else {
            callback();
        }
    }

    getSession(sessionId) {
        if (sessionId in this.transcoderStore && this.transcoderStore[sessionId].alive) {
            return this.transcoderStore[sessionId];
        }
        return null;
    }
}

module.exports = new SessionManager();