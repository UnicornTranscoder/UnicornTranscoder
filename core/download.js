/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('UnicornTranscoder:Download');
const path = require('path');
const request = require('request');
const config = require('../config');
const SessionManager = require('./session-manager');

class Download {
    static serve(req, res) {
        request(config.loadbalancer_address + '/unicorn/api/' + req.params.fileId + '/fileinfo', (error, response, body) => {
            if (!error && response.statusCode === 200) {
                let result = JSON.parse(body);
                if (typeof result.file === "undefined")
                    return res.status(404).send('404 File not found');
                debug(result.file);
                SessionManager.startDownload(result.file);
                res.download(result.file, path.basename(result.file), () => {
                    SessionManager.stopDownload(result.file);
                })
            } else {
                res.status(404).send('404 File not found')
            }
        })
    }
}

module.exports = Download;