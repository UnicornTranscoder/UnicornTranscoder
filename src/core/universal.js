const proxy = require('./proxy');
const loadConfig = require('../utils/config');

const config = loadConfig();
let universal = {};
universal.cache = {};
universal.sessions = {};
universal.downloads = 0;

universal.stopTranscoder = function (req, res) {
    if (typeof universal.cache[req.query.session] !== 'undefined') {
        console.log('Stop ' + req.query.session);
        if (typeof universal.cache[req.query.session] !== 'undefined')
            universal.cache[req.query.session].killInstance();
    }
    res.send('');
};

universal.updateTimeout = function (sessionId) {
    if (typeof sessionId !== 'undefined' && typeof universal.cache[sessionId] !== 'undefined' && universal.cache[sessionId].alive) {
        if (typeof universal.cache[sessionId].sessionTimeout !== 'undefined')
            clearTimeout(universal.cache[sessionId].sessionTimeout);

        universal.cache[sessionId].sessionTimeout = setTimeout(() => {
            console.log(sessionId + ' timed out');
            if (typeof universal.cache[sessionId] !== 'undefined')
                universal.cache[sessionId].killInstance()
        }, config.transcoder_decay_time * 1000)
    } else if (typeof sessionId !== 'undefined' && typeof universal.sessions[sessionId] !== 'undefined' && sessionId !== universal.sessions[sessionId]) {
        universal.updateTimeout(universal.sessions[sessionId])
    }
};

universal.ping = function (req, res) {
    universal.updateTimeout(req.query.session);
    proxy(req, res);
};

universal.timeline = function (req, res) {
    universal.updateTimeout(req.query["X-Plex-Session-Identifier"]);
    proxy(req, res);
};

universal.stats = function (req, res) {
    let streams = {};

    streams.files = [];
    streams.codecs = {};
    streams.sessions = 0;
    streams.transcoding = 0;

    Object.keys(universal.cache).map((key, index) => {
        let stream = universal.cache[key];

        streams.sessions++;

        if (typeof stream.transcoderArgs === "undefined")
            return;

        for (let i = 0; i < stream.transcoderArgs.length; i++) {
            if (typeof stream.transcoderArgs[i].startsWith === "function") {
                if (stream.transcoderArgs[i].startsWith(config.mount_point)) {
                    streams.files.push(stream.transcoderArgs[i]);
                    i = stream.transcoderArgs.length;
                }
            }
        }

        if (stream.transcoding == true) {
            streams.transcoding++;

            if (stream.transcoderArgs.lastIndexOf('-codec:0') >= 0) {
                if (stream.transcoderArgs[stream.transcoderArgs.lastIndexOf('-codec:0') + 1] == "copy") {
                    if (typeof streams.codecs["copy"] === "undefined")
                        streams.codecs["copy"] = 1;
                    else
                        streams.codecs["copy"]++;
                } else {
                    if (stream.transcoderArgs[0].startsWith("-codec:")) {
                        if (typeof streams.codecs[stream.transcoderArgs[1]] == 'undefined')
                            streams.codecs[stream.transcoderArgs[1]] = 1;
                        else
                            streams.codecs[stream.transcoderArgs[1]]++;
                    }
                }
            }
        }
    });

    streams.downloads = universal.downloads;
    streams.config = config.public_config;

    res.setHeader('Content-Type', 'application/json');

    let cache = [];
    res.send(JSON.stringify(streams, (_, value) => {
        if (typeof(value) === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                return;
            }
            cache.push(value);
        }
        return value;
    }));
};

module.exports = universal;