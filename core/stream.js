/**
 * Created by drouar_b on 27/04/2017.
 */

let Transcoder = require('./transcoder');
let cluster = require('cluster');

let stream = {};

stream.serve = function(req, res) {
    new Transcoder(req, res);
    req.connection.on("closed", stream.connectionClosed);
};

stream.connectionClosed = function () {
};

stream.serveSubtitles = function (req, res) {
    res.send('Serve sub');
};

module.exports = stream;