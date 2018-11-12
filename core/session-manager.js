/**
 * Created by drouar_b on 15/08/2017.
 */

const request = require('request');
const Transcoder = require('./transcoder');
const debug = require('debug')('SessionManager');
const config = require('../config');

class SessionManager {
    constructor() {
        this.downloads = [];
        this.transcoderStore = {};
        this.sendStats();
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
        return this.transcoderStore[transcoder.sessionId];
    }

    killSession(sessionId, callback = () => {}) {
        if (sessionId in this.transcoderStore && this.transcoderStore[sessionId].alive) {
            if (typeof  this.transcoderStore[sessionId].sessionTimeout !== 'undefined')
                clearTimeout(this.transcoderStore[sessionId].sessionTimeout);
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

    restartSession(sessionId, sessionType, res) {
        debug(sessionId + ' not found, restarting ' + '(' + sessionType + ')');
        this.saveSession(new Transcoder(sessionId));
        if (typeof res !== 'undefined')
            setTimeout(() => {
                res.status(404).send('Restarting session');
            }, 5000)
    }

    startDownload(file) {
        this.downloads.push(file);
    }

    stopDownload(file) {
        let index = this.downloads.indexOf(file);
        if (index !== -1) {
            this.downloads.splice(index, 1);
        }
    }

    generateStats() {
        let stats = {
            sessions: [],
            settings: config.performance
        };

        //Transcoding session
        Object.keys(this.transcoderStore).map((key) => {
            let transcoder = this.transcoderStore[key];

            let session = {
                id: key,
                status: (transcoder.transcoding ? 'TRANSCODE' : 'DONE')
            };
            if (transcoder.transcoderArgs.lastIndexOf('-codec:0') >= 0) {
                if (transcoder.transcoderArgs[transcoder.transcoderArgs.lastIndexOf('-codec:0') + 1] === "copy") {
                    session.codec = 'copy';
                } else {
                    if (transcoder.transcoderArgs[0].startsWith("-codec:")) {
                        session.codec = transcoder.transcoderArgs[1];
                    }
                }
            }
            stats.sessions.push(session);
        });

        //Download sessions
        this.downloads.forEach((dl) => {
            stats.sessions.push({
                id: dl,
                status: 'DOWNLOAD'
            })
        });

        return stats;
    }

    stats(req, res) {
        res.send(this.generateStats());
    }

    sendStats() {
        if (typeof this.statsTimeout !== 'undefined')
            clearTimeout(this.statsTimeout);

        request({
            uri: config.loadbalancer_address + '/api/update',
            method: 'POST',
            json: JSON.stringify(this.generateStats())
        }, () => {
            this.statsTimeout = setTimeout(this.sendStats.bind(this), config.ping_frequency * 1000)
        });
    }
}

module.exports = new SessionManager();