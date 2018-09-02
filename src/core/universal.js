const proxy = require('./proxy');

class Universal {
    constructor(config) {
        this._config = config;
        this._cache = {};
        this._sessions = {};
        this._downloads = 0;
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
            }, this._config.transcoder_decay_time * 1000)
        } else if (sessionId !== void(0) && this._sessions[sessionId] !== void(0) && sessionId !== this._sessions[sessionId]) {
            await this.updateTimeout(this._sessions[sessionId])
        }
    }

    async ping(req, res) {
        await this.updateTimeout(req.query.session);
        proxy(req, res);
    }

    async timeline(req, res) {
        await this.updateTimeout(req.query["X-Plex-Session-Identifier"]);
        proxy(req, res);
    }

    stats(_, res) {
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
                    if (stream.transcoderArgs[i].startsWith(this._config.mount_point)) {
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
    
        streams.downloads = this._downloads;
        streams.config = this._config.public_config;
    
        res.setHeader('Content-Type', 'application/json');
    
        let cache = [];
        res.send(JSON.stringify(streams, (_, value) => {
            if (typeof (value) === 'object' && value !== null) {
                if (cache.indexOf(value) !== -1) {
                    return;
                }
                cache.push(value);
            }
            return value;
        }));
    }
}

module.exports = Universal;
