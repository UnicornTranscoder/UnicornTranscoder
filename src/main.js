#!/usr/bin/env node

const express = require('express');
const corsMiddleware = require('./core/corsMiddleware');
const CommsWebsocket = require('./core/websocket');
const routes = require('./routes/routes');
const loadConfig = require('./utils/config');

(async() => {
    const config = await loadConfig();
    const app = express();
    const websocket = new CommsWebsocket(config);
    
    app.use(corsMiddleware);
    app.use('/', routes(config, websocket));
    
    app.listen(config.server.port,
        () => console.log(`Listening on port ${config.server.port}`));
    
    process.on('unhandledRejection', reason => {
        console.log(reason.stack);
    });
})();
