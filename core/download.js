/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('UnicornTranscoder:Download');
const path = require('path');
const request = require('request');
const httpProxy = require('http-proxy');
const config = require('../config');
const SessionManager = require('./session-manager');

class Download {
    static serve(req, res) {
        request(config.loadbalancer_address + '/api/path_v2/' + req.params.id1, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                const file = JSON.parse(body);
                // Local file, serve
                if (file.type === 'LOCAL') {
                    SessionManager.startDownload(file.path);
                    res.download(file.path, path.basename(file.path), () => {
                        SessionManager.stopDownload(file.path);
                    })
                }
                // 302 to download link
                else if (file.type === 'URL' && file.direct) {
                    res.redirect(302, file.path);
                    debug('REDIRECT ' + file.path);
                }
                // Proxy file
                else if (file.type === 'URL' && !file.direct) {
                    const proxy = httpProxy.createProxyServer({
                        target: file.path,
                        ignorePath: true
                    }).on('error', (err) => {
                        return res.status(404).send('404 File not found')
                    })
                    return proxy.web(req, res);
                }
            } else {
                res.status(404).send('404 File not found')
            }
        })
    }
}

module.exports = Download;