const publicIp = require('public-ip');

class Universal {
    constructor(config, websocket) {
        this._config = config;
        this._ws = websocket;
        this._cache = {};
        this._sessions = {};
        this._downloads = 0;
        this._ip = null;
        setInterval(this._stats.bind(this), config.server.loadUpdateInterval);
    }

    getCache(id) {
        return this._cache[id];
    }

    deleteCache(id) {
        delete this._cache[id];
    }

    putCache(id, val) {
        this._cache[id] = val;
        return val;
    }

    async updatePlexSessionId(id, value) {
        if (id !== void(0)) {
            this._sessions[id] = value.toString();
        }
    }

    async forceNewTranscoder(sessionId, transcoder, plexSessionId = void(0), plexSessionValue = void(0)) {
        const cacheVal = this.getCache(sessionId);
        if (cacheVal !== void(0)) {
            await cacheVal.killInstance();
        }
        this.putCache(sessionId, transcoder);
        this.updatePlexSessionId(plexSessionId, plexSessionValue);
        await this.updateTimeout(sessionId);
    }

    async stopTranscoder(req, res) {
        if (this._cache[req.query.session] !== void (0)) {
            console.log(`Stop ${req.query.session}`);
            if (this._cache[req.query.session] !== void (0)) {
                await this._cache[req.query.session].killInstance();
            }
        }
        res.send('');
    }

    async updateTimeout(sessionId) {
        if (sessionId !== void (0) && this._cache[sessionId] !== void (0) && this._cache[sessionId].alive) {
            if (this._cache[sessionId].sessionTimeout !== void (0)) {
                clearTimeout(this._cache[sessionId].sessionTimeout);
            }
            this._cache[sessionId].sessionTimeout = setTimeout(async () => {
                console.log(`${sessionId} timed out`);
                if (this._cache[sessionId] !== void (0)) {
                    await this._cache[sessionId].killInstance();
                }
            }, this._config.plex.transcoderDecayTime * 1000);
        }
        else if (sessionId !== void (0) && this._sessions[sessionId] !== void (0) && sessionId !== this._sessions[sessionId]) {
            await this.updateTimeout(this._sessions[sessionId]);
        }
    }

    async ping(req) {
        await this.updateTimeout(req.query.session);
    }

    async timeline(req) {
        await this.updateTimeout(req.query['X-Plex-Session-Identifier']);
    }

    _getPublicIp() {
        if (this._ip === null) {
            try {
                this._ip = await publicIp.v4();
            }
            catch (e1) {
                try {
                    this._ip = await publicIp.v6();
                }
                catch (e2) {
                    this._ip = '127.0.0.1';
                }
            }
        }
        return this._ip;
    }

    async _stats() {
        const codecs = {};
        const files = [];
        let sessions = 0;
        let transcoding = 0;
        for (const stream of Object.keys(this._cache).map(k => this._cache[k])) {
            sessions++;
            if (stream.transcoderArgs === void(0)) {
                continue;
            }

            for (let i = 0; i < stream.transcoderArgs.length; i++) {
                if (typeof (stream.transcoderArgs[i].startsWith) === 'function' && stream.transcoderArgs[i].startsWith(this._config.plex.mount)) {
                    files.push(stream.transcoderArgs[i]);
                    i = stream.transcoderArgs.length;
                }
            }

            if (stream.transcoding === true) {
                transcoding++;
                const last = stream.transcoderArgs.lastIndexOf('-codec:0');
                if (last >= 0) {
                    if (stream.transcoderArgs[last + 1] === 'copy') {
                        streams.codecscopy = (streams.codecscopy || 0) + 1;
                    }
                    else if (stream.transcoderArgs[0].startsWith('-codec:')) {
                        codecs[stream.transcoderArgs[1]] = (codecs[stream.transcoderArgs[1]] || 0) + 1;
                    }
                }
            }
        }

        this._ws.send('load', {
            codecs,
            sessions,
            transcoding,
            ip: this._getPublicIp(),
            downloads: this._downloads,
            config: this._config.load
        });
    }
}

module.exports = Universal;
