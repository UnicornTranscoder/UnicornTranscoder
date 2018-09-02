const httpProxy = require('http-proxy');

module.exports = config => {
    const proxy = httpProxy.createProxyServer({
        target: config.plex_url
    });
    proxy.on('error', error => console.log(error));
    return proxy.web.bind(proxy);
};
