/**
 * Created by drouar_b on 27/04/2017.
 */

const httpProxy = require('http-proxy');
const config = require('../utils/config');

let proxy = httpProxy.createProxyServer({
    target: config.plex_url
});

module.exports = function (req, res) {
    proxy.web(req, res)
};