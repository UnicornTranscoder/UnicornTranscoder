const debug = require('debug')('UnicornTranscoder:progress');

class Progress {
    static progress(req, res) {
        debug(req.url);
        res.send('');
    }
}

module.exports = Progress;