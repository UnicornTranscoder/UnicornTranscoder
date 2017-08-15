/**
 * Created by drouar_b on 27/04/2017.
 */

const child_process = require('child_process');
const debug = require('debug')('transcoder');
const fs = require('fs');
const rimraf = require('rimraf');
const request = require('request');
const config = require('../utils/config');
const redis = require('../utils/redis');
const utils = require('../utils/utils');

class Transcoder {
    constructor(sessionId, url, res) {
        this.alive = true;
        this.ffmpeg = null;
        this.transcoding = true;
        this.sessionId = sessionId;
        this.redisClient = redis.getClient();

        debug('Create session ' + this.sessionId);
        this.timeout = setTimeout(this.PMSTimeout.bind(this), 20000);

        this.redisClient.on("message", () => {
            debug('Callback ' + this.sessionId);
            clearTimeout(this.timeout);
            this.timeout = undefined;

            this.redisClient.unsubscribe("__keyspace@" + config.redis_db + "__:" + this.sessionId);
            this.redisClient.get(this.sessionId, this.transcoderStarter.bind(this));
        });

        this.redisClient.subscribe("__keyspace@" + config.redis_db + "__:" + sessionId);

        request(config.plex_url + url, (error, response, body) => {
            if (res) {
                res.send(body)
            }
        })
    }

    transcoderStarter(err, reply) {
        if (err)
            return;

        rimraf.sync(config.xdg_cache_home + this.sessionId);
        fs.mkdirSync(config.xdg_cache_home + this.sessionId);

        let args = JSON.parse(reply);
        args = args.map((arg) => {
            return arg
                .replace('{URL}', "http://127.0.0.1:" + config.port)
                .replace('{PATH}', config.mount_point)
                .replace('{SRTSRV}', config.srt_url)
                .replace(/\{USRPLEX\}/g, config.plex_ressources)
        });

        let env = Object.create(process.env);
        env.LD_LIBRARY_PATH = config.ld_library_path;
        env.FFMPEG_EXTERNAL_LIBS = config.ffmpeg_external_libs;
        env.XDG_CACHE_HOME = config.xdg_cache_home;
        env.XDG_DATA_HOME = config.xdg_data_home;
        env.EAE_ROOT = config.eae_root;

        debug('Spawn ' + this.sessionId);
        this.ffmpeg = child_process.spawn(config.transcoder_path, args, {env: env, cwd: config.xdg_cache_home + this.sessionId + "/"});
        this.ffmpeg.on("exit", () => {
            debug('FFMPEG stopped ' + this.sessionId);
            this.transcoding = false
        });
    }

    PMSTimeout() {
        //TODO 500
        debug('Timeout ' + this.sessionId);
        this.timeout = undefined;
        this.killInstance();
    }

    killInstance() {
        debug('Killing ' + this.sessionId);
        this.redisClient.quit();
        this.alive = false;

        if (this.timeout != undefined) {
            clearTimeout(this.timeout)
        }

        if (this.ffmpeg != null && this.transcoding) {
            this.ffmpeg.kill('SIGKILL');
        }

        let cleaner = redis.getClient();
        cleaner.keys(this.sessionId + '*', (err, keys) => {
            if ((typeof keys != 'undefined') && keys.length > 0)
                cleaner.del(keys);
            cleaner.quit();
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