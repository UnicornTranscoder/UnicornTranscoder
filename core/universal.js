/**
 * Created by drouar_b on 15/08/2017.
 */

const debug = require('debug')('universal');

let universal = {};
universal.cache = {};

universal.stopTranscoder = function (req, res) {
    if (typeof cache[req.query.session] != 'undefined') {
        debug('Stop ' + req.query.session);
        universal.cache[req.query.session].killInstance();
    }
    res.send('');
};

module.exports = universal;