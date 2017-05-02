/**
 * Created by drouar_b on 27/04/2017.
 */

var Transcoder = require('./transcoder');
var cluster = require('cluster');

var stream = module.exports = {};

var transcoderCache = require('cluster-node-cache')(cluster, {
    stdTTL: 0, checkperiod: 0
});

stream.serve = function(req, res) {
    var t = new Transcoder();
    transcoderCache.set(req.query.session, new Transcoder(req, res));

    req.connection.on("closed", transcoderCache.get(req.query.session).killInstance);
};

stream.connectionClosed = function () {
    var Transcoder = transcoderCache.get(req.query.session);
    Transcoder.killInstance();
};

stream.serveSubtitles = function (req, res) {
    res.send('Serve sub');
};