/**
 * Created by drouar_b on 27/04/2017.
 */

let process = require('child_process');
let request = require('request');
let config = require('../utils/config');
let redis = require('../utils/redis');
let utils = require('../utils/utils');

class Transcoder {
    constructor(sessionId, url) {
        this.transcoding = true;
        this.sessionId = sessionId;
        this.redisClient = redis.getClient();

        this.timeout = setTimeout(this.PMSTimeout.bind(this), 10000);

        this.redisClient.on("message", this.transcoderStarted.bind(this));
        this.redisClient.subscribe("__keyspace@" + config.redis_db + "__:" + sessionId);

        request(config.plex_url + url)
    }

    transcoderStarted(args) {
        clearTimeout(this.timeout);
        this.timeout = undefined;
        this.redisClient.quit();

        let env = Object.create(process.env);
        env.LD_LIBRARY_PATH = config.ld_library_path;
        env.FFMPEG_EXTERNAL_LIBS = config.ffmpeg_external_libs;
        env.XDG_CACHE_HOME = config.xdg_cache_home;
        env.XDG_DATA_HOME = config.xdg_data_home;
        env.EAE_ROOT = config.eae_root;

        this.ffmpeg = process.spawn(config.transcoder_path, args, {env: env, cwd: config.xdg_cache_home + this.sessionId + "/"});
        this.ffmpeg.on("exit", this.transcoderExited)
    }

    transcoderExited() {
        this.transcoding = false
    }

    PMSTimeout() {
        this.timeout = undefined;
        this.res.status(500).send('No response from PMS');
        this.killInstance()
    }

    killInstance() {
        if (this.timeout != undefined) {
            clearTimeout(this.timeout)
        }
        this.redisClient.quit()
    }

    isAlive() {
        return this.transcoding
    }

    getChunk(chunkId, callback) {
        let rc = redis.getClient();
        let transcoding = this.transcoding;

        rc.get(this.sessionId + ":" + utils.pad(chunkId, 5), function (chunk) {
            if (chunk == null) {
                if (transcoding) {
                    rc.on("message", function () {
                        rc.quit();
                        callback(chunkId)
                    });
                    rc.subscribe("__keyspace@" + config.redis_db + "__:" + this.sessionId + ":" + utils.pad(chunkId, 5))
                } else {
                    callback(-1)
                }
            } else {
                callback(chunkId)
            }
        })
    }

    static chunkProcessCallback(req, res) {
        let rc = redis.getClient();

        req.body.split(/\r?\n/).forEach(function (itm) {
            itm = itm.split(',');
            let chk = itm.shift();

            if (chk.startsWith("chunk")) {
                rc.set(req.params.sessionId + ":" + chk.split('-')[1], itm.toString())
            }
        });
        res.end()
    }
}

module.exports = Transcoder;