/**
 * Created by drouar_b on 27/04/2017.
 */

var httpProxy = require('http-proxy');
var config = require('../utils/config');

var proxy = httpProxy.createProxyServer({
    target: config.plex_url
});

module.exports = function (req, res) {
    proxy.web(req, res);
};