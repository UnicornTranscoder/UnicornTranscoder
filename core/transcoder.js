/**
 * Created by drouar_b on 27/04/2017.
 */

let redis = require('redis');
let request = require('request');
let config = require('../utils/config');

class Transcoder {
    constructor(req, res) {
        this.req = req;
        this.res = res;

        this.redisClient = redis.createClient({
            host:     config.redis_host,
            port:     config.redis_port,
            password: config.redis_pass,
            db:       config.redis_db
        });

        this.timeout = setTimeout(this.transcoderTimeout.bind(this), 10000);

        this.redisClient.on("message", this.transcoderStarted.bind(this));
        this.redisClient.subscribe("__keyspace@" + config.redis_db + "__:" + this.req.query.session);

        request(config.plex_url + req.url);
    }

    transcoderStarted() {
        clearTimeout(this.timeout);
        this.timeout = undefined;

        this.res.send('OK KOOL');
    }

    transcoderTimeout() {
        this.timeout = undefined;
        this.res.status(500).send('No response from PMS');
        this.killInstance();
    }

    killInstance() {
        if (this.timeout != undefined) {
            clearTimeout(this.timeout);
        }
        this.redisClient.quit();
    }
}

module.exports = Transcoder;