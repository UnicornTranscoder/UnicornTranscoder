/**
 * Created by drouar_b on 15/08/2017.
 */

const request = require('request');
const geoip = require('geoip-lite');
const Transcoder = require('./transcoder');
const debug = require('debug')('UnicornTranscoder:SessionManager');
const config = require('../config');

class SessionManager {
    constructor() {
        this.downloads = [];
        this.transcoderStore = {};
        this.optimizerStore = {};
        this.sendStats();
    }

    stopTranscoder(req, res) {
        if (typeof req.query.session !== 'undefined' && req.query.session in this.transcoderStore) {
            debug('Stop ' + req.query.session);
            return this.killSession(req.query.session, () => {
                res.send('');
            });
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
                this.killSession(sessionId);
            }, config.transcoder_decay_time * 1000)
        }
    }

    saveSession(transcoder) {
        if (transcoder.alive) {
            debug('save ' + transcoder.sessionId);
            transcoder.sessionManager = this;
            this.transcoderStore[transcoder.sessionId] = transcoder;
            this.updateTimeout(transcoder.sessionId);
            this.sendStats();
        }
        return transcoder;
    }

    killSession(sessionId, callback = () => {}) {
        if (sessionId in this.transcoderStore && this.transcoderStore[sessionId].alive) {
            debug('kill ' + sessionId);
            if (typeof  this.transcoderStore[sessionId].sessionTimeout !== 'undefined')
                clearTimeout(this.transcoderStore[sessionId].sessionTimeout);
            this.transcoderStore[sessionId].killInstance(() => {
                delete this.transcoderStore[sessionId];
                callback();
                this.sendStats();
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
        this.sendStats();
    }

    stopDownload(file) {
        let index = this.downloads.indexOf(file);
        if (index !== -1) {
            this.downloads.splice(index, 1);
            this.sendStats();
        }
    }

    saveOptimizer(sessionId, optimizer) {
        this.optimizerStore[sessionId] = optimizer;
        this.sendStats();
    }

    getOptimizer(sessionId) {
        return this.optimizerStore[sessionId]
    }

    stopOptimizer(sessionId) {
        if (typeof this.optimizerStore[sessionId] !== 'undefined') {
            this.optimizerStore[sessionId].clean();
            delete this.optimizerStore[sessionId];
            return true;
        }
        return false;
    }

    generateStats() {
        let stats = {
            sessions: [],
            name: config.instance_address,
            settings: config.performance,
            url: config.instance_address,
        };

        //Transcoding session
        Object.keys(this.transcoderStore).map((key) => {
            let transcoder = this.transcoderStore[key];

            if (typeof transcoder.transcoderArgs === 'undefined')
                return;

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
            json: this.generateStats()
        }, () => {
            this.statsTimeout = setTimeout(this.sendStats.bind(this), config.ping_frequency * 1000)
        });
    }

    resolve(req, res) {
        if (typeof req.query.ip === 'undefined' || typeof config.routing === 'undefined') {
            res.send({
                client: config.instance_address,
                ping: config.instance_address
            });
            if (typeof config.routing !== 'undefined')
                debug('Undefined IP, sending default route');
            return;
        }
        let resolved = geoip.lookup(req.query.ip);
        if (resolved === null) {
            res.send({
                client: config.instance_address,
                ping: config.instance_address
            });
            debug(`Invalid ip '${req.query.ip}', sending default route`);
            return;
        }
        if (resolved.country in config.routing) {
            res.send({
                client: config.routing[resolved.country],
                ping: config.instance_address
            });
            debug(`Routing ${req.query.ip} to ${resolved.country} gateway`);
            return;
        }
        res.send({
            client: config.instance_address,
            ping: config.instance_address
        });
        debug(`Routing ${req.query.ip} to default gateway`);
    }
}

module.exports = new SessionManager();