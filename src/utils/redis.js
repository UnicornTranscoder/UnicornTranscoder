const redis = require('redis');
const loadConfig = require('../utils/config');

const config = loadConfig();
let redisMiddleware = {};

redisMiddleware.getClient = function () {
    return redis.createClient({
        host:     config.redis_host,
        port:     config.redis_port,
        password: config.redis_pass,
        db:       config.redis_db
    })
};

module.exports = redisMiddleware;