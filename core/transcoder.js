/**
 * Created by drouar_b on 27/04/2017.
 */

let child_process = require('child_process');
let fs = require('fs');
let rimraf = require('rimraf');
let request = require('request');
let config = require('../utils/config');
let redis = require('../utils/redis');
let utils = require('../utils/utils');

class Transcoder {
    constructor(sessionId, url) {
        this.ffmpeg = null;
        this.transcoding = true;
        this.sessionId = sessionId;
        this.redisClient = redis.getClient();

        this.timeout = setTimeout(this.PMSTimeout.bind(this), 20000);

        this.redisClient.on("message", () => {
            clearTimeout(this.timeout);
            this.timeout = undefined;

            this.redisClient.unsubscribe("__keyspace@" + config.redis_db + "__:" + this.sessionId);
            this.redisClient.get(this.sessionId, this.transcoderStarter.bind(this));
        });

        this.redisClient.subscribe("__keyspace@" + config.redis_db + "__:" + sessionId);

        request(config.plex_url + url)
    }

    transcoderStarter(err, reply) {
        //TODO 500
        if (err)
            return;

        rimraf.sync(config.xdg_cache_home + this.sessionId);
        fs.mkdirSync(config.xdg_cache_home + this.sessionId);

        let args = JSON.parse(reply);
        let env = Object.create(process.env);
        env.LD_LIBRARY_PATH = config.ld_library_path;
        env.FFMPEG_EXTERNAL_LIBS = config.ffmpeg_external_libs;
        env.XDG_CACHE_HOME = config.xdg_cache_home;
        env.XDG_DATA_HOME = config.xdg_data_home;
        env.EAE_ROOT = config.eae_root;

        this.ffmpeg = child_process.spawn(config.transcoder_path, args, {env: env, cwd: config.xdg_cache_home + this.sessionId + "/"});
        this.ffmpeg.on("exit", () => { this.transcoding = false });
    }

    PMSTimeout() {
        //TODO 500
        this.timeout = undefined;
        this.killInstance();
    }

    killInstance() {
        if (this.timeout != undefined) {
            clearTimeout(this.timeout)
        }

        if (this.ffmpeg != null && this.transcoding) {
            this.ffmpeg.kill('SIGKILL');
        }

        this.redisClient.keys(this.sessionId + '*', (err, keys) => {
            this.redisClient.del(keys);
        });
    }

    getChunk(chunkId, callback) {
        let rc = redis.getClient();

        rc.get(this.sessionId + ":" + utils.pad(chunkId, 5), (err, chunk) => {
            if (chunk == null) {
                if (this.transcoding) {
                    rc.on("message", () => {
                        callback(chunkId);
                        rc.quit();
                    });
                    rc.subscribe("__keyspace@" + config.redis_db + "__:" + this.sessionId + ":" + utils.pad(chunkId, 5))
                } else {
                    callback(-1)
                }
            } else {
                callback(chunkId)
            }
        });
    }

    static chunkProcessCallback(req, res) {
        let rc = redis.getClient();

        req.body.split(/\r?\n/).forEach((itm) => {
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