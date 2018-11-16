const rp = require('request-promise-native');
const debug = require('debug')('UnicornTranscoder:progress');
const config = require('../config');

class Progress {
    static progress(req, res) {
        rp({
            method: req.method,
            url: `${config.loadbalancer_address}${req.url}`,
            headers: req.headers
        })
            .then(() => {
                if (!req.connection.destroyed)
                    res.send('');
            })
            .catch((err) => {
                debug(err);
                if (!req.connection.destroyed)
                    res.send('');
            });
    }
}

module.exports = Progress;