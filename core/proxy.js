/**
 * Created by drouar_b on 27/04/2017.
 */

const httpProxy = require('http-proxy');
const config = require('../utils/config');

let proxy = httpProxy.createProxyServer({
    target: config.plex_url
});

module.exports = function (req, res) {
    proxy.on('proxyReq', function(proxyReq, req, res, options) {
        if(req.method=="POST" && req.body && !req.connection.destroyed){
            proxyReq.setHeader('Content-Length', Buffer.byteLength(req.body));
            proxyReq.write(req.body);
            proxyReq.end();
        }
    });

    proxy.web(req, res)
};