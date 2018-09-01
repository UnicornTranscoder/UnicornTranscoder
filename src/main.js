#!/usr/bin/env node

const express = require('express');
const corsMiddleware = require('./core/corsMiddleware');
const routes = require('./routes/routes');
const loadConfig = require('./utils/config');

const config = loadConfig();
const app = express();

app.use(corsMiddleware);
app.use('/', routes);

app.listen(config.port,
    () => console.log(`Listening on port ${config.loadBalancer.port}`));
