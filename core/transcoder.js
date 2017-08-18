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
const proxy = require('./proxy');

class Transcoder {
    constructor(sessionId, req, res) {
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

        if (typeof res != 'undefined') {
            proxy(req, res)
        } else {
            request(config.plex_url + req.url)
        }
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
            cleaner.del(this.sessionId);
            cleaner.quit();
        });
    }

    getChunk(chunkId, callback, streamId = '0') {
        let rc = redis.getClient();

        rc.get(this.sessionId + ":" + streamId + ":" + (chunkId == 'init' ? chunkId : utils.pad(chunkId, 5)), (err, chunk) => {
            if (chunk == null) {
                if (this.transcoding) {
                    rc.on("message", () => {
                        callback(chunkId);
                        rc.quit();
                    });
                    rc.subscribe("__keyspace@" + config.redis_db + "__:" + this.sessionId + ":" + streamId + ":" + (chunkId == 'init' ? chunkId : utils.pad(chunkId, 5)))
                } else {
                    callback(-1);
                    rc.quit();
                }
            } else {
                callback(chunkId);
                rc.quit();
            }
        });
    }

    static chunkProcessCallback(req, res) {
        let rc = redis.getClient();

        req.body.split(/\r?\n/).forEach((itm) => {
            itm = itm.split(',');
            let chk = itm.shift();

            //Long polling
            if (chk.match(/chunk-[0-9]{5}/)) {
                rc.set(req.params.sessionId + ":0:" + chk.replace(/chunk-([0-9]{5})/, '$1'), itm.toString())
            }
            if (chk.match(/sub-chunk-[0-9]{5}/)) {
                rc.set(req.params.sessionId + ":sub:" + chk.replace(/sub-chunk-([0-9]{5})/, '$1'), itm.toString())
            }

            //M3U8
            if (chk.match(/media-[0-9]{5}\.ts/)) {
                rc.set(req.params.sessionId + ":0:" + chk.replace(/media-([0-9]{5})\.ts/, '$1'), itm.toString())
            }
            if (chk.match(/media-[0-9]{5}\.vtt/)) {
                rc.set(req.params.sessionId + ":sub:" + chk.replace(/media-([0-9]{5})\.vtt/, '$1'), itm.toString())
            }

            //Dash
            if (chk.match(/init-stream[0-9]\.m4s/)) {
                rc.set(req.params.sessionId + ":" + chk.replace(/init-stream([0-9])\.m4s/, '$1') + ":init", itm.toString())
            }
            if (chk.match(/chunk-stream[0-9]-[0-9]{5}\.m4s/)) {
                rc.set(req.params.sessionId + ":" + chk.replace(/chunk-stream([0-9])-[0-9]{5}\.m4s/, '$1') +
                    ":" + chk.replace(/chunk-stream[0-9]-([0-9]{5})\.m4s/, '$1'), itm.toString())
            }
        });
        res.end();
        rc.quit();
    }
}

module.exports = Transcoder;