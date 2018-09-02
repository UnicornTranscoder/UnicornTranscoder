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
    }

    async stopTranscoder(req, res) {
        if (this._cache[req.query.session] !== void(0)) {
            console.log('Stop ' + req.query.session);
            if (this._cache[req.query.session] !== void(0)) {
                await this._cache[req.query.session].killInstance();
            }
        }
        res.send('');
    }

    async updateTimeout(sessionId) {
        if (sessionId !== void(0) && this._cache[sessionId] !== void(0) && this._cache[sessionId].alive) {
            if (this._cache[sessionId].sessionTimeout !== void(0)) {
                clearTimeout(this._cache[sessionId].sessionTimeout);
            }
            this._cache[sessionId].sessionTimeout = setTimeout(async() => {
                console.log(sessionId + ' timed out');
                if (this._cache[sessionId] !== void(0)) {
                    await this._cache[sessionId].killInstance();
                }
            }, this._config.plex.transcoderDecayTime * 1000)
        } else if (sessionId !== void(0) && this._sessions[sessionId] !== void(0) && sessionId !== this._sessions[sessionId]) {
            await this.updateTimeout(this._sessions[sessionId])
        }
    }

    async ping(req, res) {
        await this.updateTimeout(req.query.session);
    }

    async timeline(req, res) {
        await this.updateTimeout(req.query["X-Plex-Session-Identifier"]);
    }

    async _stats() {
        const streams = {
            files: [],
            codecs: {},
            sessions: 0,
            transcoding: 0
        };
    
        for (let key of Object.keys(this._cache)) {
            let stream = this._cache[key];
    
            streams.sessions++;
    
            if (stream.transcoderArgs === void(0)) {
                continue;
            }
    
            for (let i = 0; i < stream.transcoderArgs.length; i++) {
                if (typeof(stream.transcoderArgs[i].startsWith) === "function") {
                    if (stream.transcoderArgs[i].startsWith(this._config.plex.mount)) {
                        streams.files.push(stream.transcoderArgs[i]);
                        i = stream.transcoderArgs.length;
                    }
                }
            }
    
            if (stream.transcoding == true) {
                streams.transcoding++;
    
                if (stream.transcoderArgs.lastIndexOf('-codec:0') >= 0) {
                    if (stream.transcoderArgs[stream.transcoderArgs.lastIndexOf('-codec:0') + 1] == "copy") {
                        if (streams.codecs["copy"] === void(0)) {
                            streams.codecs["copy"] = 1;
                        }
                        else {
                            streams.codecs["copy"]++;
                        }
                    } else {
                        if (stream.transcoderArgs[0].startsWith("-codec:")) {
                            if (streams.codecs[stream.transcoderArgs[1]] === void(0)) {
                                streams.codecs[stream.transcoderArgs[1]] = 1;
                            }
                            else {
                                streams.codecs[stream.transcoderArgs[1]]++;
                            }
                        }
                    }
                }
            }
        }

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
    
        streams.downloads = this._downloads;
        streams.config = this._config.load;
        streams.ip = this._ip;
    
        this._ws.send("load", streams);
    }
}

module.exports = Universal;
