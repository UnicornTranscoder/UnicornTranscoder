/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('m3u8');
const Transcoder = require('./transcoder');
const config = require('../utils/config');

let m3u8 = {};
let cache = {};

m3u8.serve = function (req, res) {
    debug('M3U8 ' + req.params.sessionId);
    cache[req.params.sessionId] = new Transcoder(req.params.sessionId, req.url, res);
};

m3u8.serveChunk = function (req, res) {
    debug('Requesting ' + req.params.partId + ' for session ' + req.params.sessionId);
    if ((typeof cache[req.params.sessionId]) != 'undefined' && cache[req.params.sessionId].alive == true) {
        cache[req.params.sessionId].getChunk(req.params.partId, () => {
            debug('Serving ' + req.params.partId + ' for session ' + req.params.sessionId);
            res.sendFile(config.xdg_cache_home + req.query.session + "/" + req.params.partId + ".ts");

            if (cache[req.params.sessionId].timeout != undefined)
                clearTimeout(cache[req.params.sessionId].timeout);
            cache[req.params.sessionId].timeout = setTimeout(() => {
                debug(req.params.sessionId + ' timed out');
                cache[req.params.sessionId].killInstance()
            }, 120)
        })
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }
};

m3u8.serveSubtitles = function (req, res) {
    res.send('Serve VTT')
};

module.exports = m3u8;