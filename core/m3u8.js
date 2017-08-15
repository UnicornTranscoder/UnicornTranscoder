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
    let sessionId = req.params.sessionId;
    debug('Requesting ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof cache[sessionId]) != 'undefined' && cache[sessionId].alive == true) {
        cache[sessionId].getChunk(req.params.partId, () => {
            debug('Serving ' + req.params.partId + ' for session ' + sessionId);
            res.sendFile(config.xdg_cache_home + sessionId + "/" + req.params.partId + ".ts");

            if (cache[sessionId].timeout != undefined)
                clearTimeout(cache[sessionId].timeout);
            cache[sessionId].timeout = setTimeout(() => {
                debug(sessionId + ' timed out');
                cache[sessionId].killInstance()
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