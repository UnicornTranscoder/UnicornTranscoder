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
            this.redisClient.set(this.sessionId + ":last", 0);
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

        let parsed = JSON.parse(reply);
        if (parsed == null) {
            debug(reply);
            return;
        }

        this.transcoderArgs = parsed.args.map((arg) => {
            return arg
                .replace('{URL}', "http://127.0.0.1:" + config.port)
                .replace('{SEGURL}', "http://127.0.0.1:" + config.port)
                .replace('{PROGRESSURL}', config.plex_url)
                .replace('{PATH}', config.mount_point)
                .replace('{SRTSRV}', config.srt_url)
                .replace(/\{USRPLEX\}/g, config.plex_ressources)
        });

        if (typeof this.chunkOffset != 'undefined')
            this.patchArgs(this.chunkOffset);

        this.transcoderEnv = Object.create(process.env);
        this.transcoderEnv.LD_LIBRARY_PATH = config.ld_library_path;
        this.transcoderEnv.FFMPEG_EXTERNAL_LIBS = config.ffmpeg_external_libs;
        this.transcoderEnv.XDG_CACHE_HOME = config.xdg_cache_home;
        this.transcoderEnv.XDG_DATA_HOME = config.xdg_data_home;
        this.transcoderEnv.EAE_ROOT = config.eae_root;
        this.transcoderEnv.X_PLEX_TOKEN = parsed.env.X_PLEX_TOKEN;

        this.startFFMPEG();
    }

    startFFMPEG() {
        debug('Spawn ' + this.sessionId);
        this.transcoding = true;
        this.ffmpeg = child_process.spawn(
            config.transcoder_path,
            this.transcoderArgs,
            {
                env: this.transcoderEnv,
                cwd: config.xdg_cache_home + this.sessionId + "/"
            });

        this.ffmpeg.on("exit", () => {
            debug('FFMPEG stopped ' + this.sessionId);
            this.transcoding = false
        });

        this.updateLastChunk();
    }

    PMSTimeout() {
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

        rimraf(config.xdg_cache_home + this.sessionId, () => {});

        let cleaner = redis.getClient();
        cleaner.keys(this.sessionId + '*', (err, keys) => {
            if ((typeof keys != 'undefined') && keys.length > 0)
                cleaner.del(keys);
            cleaner.del(this.sessionId);
            cleaner.quit();
        });
    }

    updateLastChunk() {
        let last = 0;
        let prev = null;
        let rc = redis.getClient();

        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev == '-segment_start_number' || prev == '-skip_to_segment') {
                last = parseInt(this.transcoderArgs[i]);
                break;
            }
            prev = this.transcoderArgs[i];
        }

        rc.set(this.sessionId + ":last", (last > 0 ? last - 1 : last));
        rc.quit();
    }

    patchArgs(chunkId) {
        debug('jumping to segment ' + chunkId + ' for ' + this.sessionId);

        let prev = '';
        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev == '-segment_start_number' || prev == '-skip_to_segment') {
                this.transcoderArgs[i] = parseInt(chunkId);
                break;
            }
            prev = this.transcoderArgs[i];
        }

        prev = '';
        let offset = 0;
        let segmentDuration = 5;
        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev == '-segment_time') {
                segmentDuration = this.transcoderArgs[i];
                break;
            }
            if (prev == '-min_seg_duration') {
                offset = -1;
                segmentDuration = this.transcoderArgs[i] / 1000000;
                break;
            }
            prev = this.transcoderArgs[i];
        }

        prev = '';
        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev.toString().startsWith('-force_key_frames')) {
                this.transcoderArgs[i] = 'expr:gte(t,' + (parseInt(chunkId) + offset) * segmentDuration + '+n_forced*' + segmentDuration + ')';
            }
            prev = this.transcoderArgs[i];
        }

        if (this.transcoderArgs.indexOf("-vsync") != -1) {
            this.transcoderArgs.splice(this.transcoderArgs.indexOf("-vsync"), 2)
        }

        if (this.transcoderArgs.indexOf("-ss") == -1) {
            this.transcoderArgs.splice(this.transcoderArgs.indexOf("-i"), 0, "-ss", (parseInt(chunkId) + offset) * segmentDuration, "-noaccurate_seek");
        } else {
            prev = '';
            for (let i = 0; i < this.transcoderArgs.length; i++) {
                if (prev == '-ss') {
                    this.transcoderArgs[i] = (parseInt(chunkId) + offset) * segmentDuration;
                    break;
                }
                prev = this.transcoderArgs[i];
            }
        }
    }

    segmentJumper(chunkId, streamId, rc, callback) {
        rc.get(this.sessionId + ":last", (err, last) => {
            if (err || last == null || parseInt(last) > parseInt(chunkId) || parseInt(last) < parseInt(chunkId) - 10) {
                rc.set(this.sessionId + ":last", parseInt(chunkId));

                if (this.ffmpeg != null) {
                    this.ffmpeg.removeAllListeners('exit');
                    this.ffmpeg.kill('SIGKILL');

                    this.patchArgs(chunkId);
                    this.startFFMPEG();
                } else {
                    this.chunkOffset = parseInt(chunkId);
                }
            }
            this.waitChunk(chunkId, streamId, rc, callback)
        });
    }

    getChunk(chunkId, callback, streamId = '0') {
        let rc = redis.getClient();

        rc.get(this.sessionId + ":" + streamId + ":" + (chunkId == 'init' ? chunkId : utils.pad(chunkId, 5)), (err, chunk) => {
            if (chunk == null) {
                if (streamId == '0')
                    this.segmentJumper(chunkId, streamId, rc, callback);
                else
                    this.waitChunk(chunkId, streamId, rc, callback);

            } else {
                callback(chunkId);
                rc.quit();
            }
        });
    }

    waitChunk(chunkId, streamId, rc, callback) {
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
    }
}

module.exports = Transcoder;