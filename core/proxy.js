/**
 * Created by drouar_b on 27/04/2017.
 */

const httpProxy = require('http-proxy');
const config = require('../config');

let proxy = httpProxy.createProxyServer({
    target: config.plex_url
});

proxy.on( 'error', function( error ){
    console.log( error );
});

module.exports = function (req, res) {
    proxy.web(req, res)
};