#!/usr/bin/env node

const express = require('express');
const morgan = require('morgan');
const corsMiddleware = require('./core/corsMiddleware');
const CommsWebsocket = require('./core/websocket');
const routes = require('./routes/routes');
const loadConfig = require('./utils/config');

(async() => {
    const config = await loadConfig();
    const app = express();
    const websocket = new CommsWebsocket(config);
    
    app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));
    app.use(corsMiddleware);
    app.use('/', routes(config, websocket));
    
    app.listen(config.server.port,
        () => console.log(`Listening on port ${config.server.port}`));
})();
