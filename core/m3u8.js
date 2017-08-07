/**
 * Created by drouar_b on 27/04/2017.
 */

let fs = require('fs');
let Transcoder = require('./transcoder');
let config = require('../utils/config');
let utils = require('../utils/utils');

let m3u8 = {};
let cache = {};

m3u8.serve = function (req, res) {
    cache[req.params.sessionId] = new Transcoder(req.params.sessionId, req.url, res);
};

m3u8.serveChunk = function (req, res) {
    if ((typeof cache[req.params.sessionId]) != undefined) {
        cache[req.params.sessionId].getChunk(req.params.partId, () => {
            res.sendFile(config.xdg_cache_home + req.query.session + "/" + req.params.partId + ".ts");
        })
    } else {
        res.status(404).send('Session not found');
    }
};

m3u8.serveSubtitles = function (req, res) {
    res.send('Serve VTT')
};

module.exports = m3u8;