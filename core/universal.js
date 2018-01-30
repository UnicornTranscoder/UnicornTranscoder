/**
 * Created by drouar_b on 15/08/2017.
 */

const debug = require('debug')('universal');
const proxy = require('./proxy');

let universal = {};
universal.cache = {};
universal.sessions = {};

universal.stopTranscoder = function (req, res) {
    if (typeof universal.cache[req.query.session] != 'undefined') {
        debug('Stop ' + req.query.session);
        universal.cache[req.query.session].killInstance();
    }
    res.send('');
};

universal.updateTimeout = function (sessionId) {
    if (typeof sessionId != 'undefined' && typeof universal.cache[sessionId] != 'undefined' && universal.cache[sessionId].alive) {
        if (universal.cache[sessionId].timeout != undefined)
            clearTimeout(universal.cache[sessionId].timeout);

        universal.cache[sessionId].timeout = setTimeout(() => {
            debug(sessionId + ' timed out');
            universal.cache[sessionId].killInstance()
        }, 120000)
    } else if (typeof sessionId != 'undefined' && typeof universal.sessions[sessionId] != 'undefined' && sessionId != universal.sessions[sessionId]) {
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

    streams.codecs = {};
    streams.sessions = 0;
    streams.transcoding = 0;

    Object.keys(universal.sessions).map((key, index) => {
        let stream = universal.sessions[key];

        streams.sessions++;
        if (stream.alive == true)
            stream.transcoding++;

        if (stream.transcoderArgs.indexOf('-codec:0') > 0) {
            if (typeof streams.codecs[stream.transcoderArgs[stream.transcoderArgs.indexOf('-codec:0') + 1]] == 'undefined')
                streams.codecs[stream.transcoderArgs[stream.transcoderArgs.indexOf('-codec:0') + 1]] = 0;
            else
                streams.codecs[stream.transcoderArgs[stream.transcoderArgs.indexOf('-codec:0') + 1]]++;
        }
    });

    res.send(JSON.stringify(streams));
};

module.exports = universal;