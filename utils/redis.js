/**
 * Created by drouar_b on 23/05/2017.
 */

const redis = require('redis');
const config = require('../config');

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