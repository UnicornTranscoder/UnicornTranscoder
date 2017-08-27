/**
 * Created by drouar_b on 27/04/2017.
 */

const httpProxy = require('http-proxy');
const config = require('../utils/config');

let proxy = httpProxy.createProxyServer({
    target: config.plex_url
});

module.exports = function (req, res) {
    req.removeAllListeners('data');
    req.removeAllListeners('end');

    process.nextTick(function () {
        if(req.body) {
            req.emit('data', JSON.stringify(req.body));
        }
        req.emit('end');
    });
    
    proxy.web(req, res)
};