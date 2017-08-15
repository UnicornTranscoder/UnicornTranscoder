/**
 * Created by drouar_b on 15/08/2017.
 */

const debug = require('debug')('universal');

let universal = {};
universal.cache = {};

universal.stopTranscoder = function (req, res) {
    if (typeof universal.cache[req.query.session] != 'undefined') {
        debug('Stop ' + req.query.session);
        universal.cache[req.query.session].killInstance();
    }
    res.send('');
};

universal.ping = function (req, res) {
    let sessionId = req.query.session;

    if (typeof universal.cache[sessionId] != 'undefined') {
        debug('Ping ' + sessionId);

        if (universal.cache[sessionId].timeout != undefined)
            clearTimeout(universal.cache[sessionId].timeout);

        universal.cache[sessionId].timeout = setTimeout(() => {
            debug(sessionId + ' timed out (ping)');
            universal.cache[sessionId].killInstance()
        }, 120000)
    }
};

module.exports = universal;