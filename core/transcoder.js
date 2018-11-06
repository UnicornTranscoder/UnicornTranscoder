/**
 * Created by drouar_b on 27/04/2017.
 */

const child_process = require('child_process');
const debug = require('debug')('transcoder');
const fs = require('fs');
const rimraf = require('rimraf');
const request = require('request');
const uuid = require('uuid/v4');
const universal = require('./universal');
const config = require('../config');
const redis = require('../utils/redis');
const proxy = require('./proxy');
const ChunkStore = require('../utils/chunkStore');

class Transcoder {
    constructor(sessionId, req, res, streamOffset) {
        this.uuid = uuid();
        this.alive = true;
        this.ffmpeg = null;
        this.transcoding = true;
        this.sessionId = sessionId;
        this.chunkStore = new ChunkStore();
        this.redisClient = redis.getClient();

        if (typeof req !== 'undefined' && typeof streamOffset === 'undefined') {
            debug('Create session ' + this.sessionId);
            this.timeout = setTimeout(this.PMSTimeout.bind(this), 20000);

            this.redisClient.on("message", () => {
                debug('Callback ' + this.sessionId);
                clearTimeout(this.timeout);
                this.timeout = undefined;

                this.redisClient.unsubscribe("__keyspace@" + config.redis_db + "__:" + this.sessionId);
                this.chunkStore.setLast('0', 0);
                this.redisClient.get(this.sessionId, this.transcoderStarter.bind(this));
            });

            this.redisClient.subscribe("__keyspace@" + config.redis_db + "__:" + sessionId);

            if (typeof res !== 'undefined') {
                proxy(req, res)
            } else {
                this.plexRequest = request(config.plex_url + req.url).on('error', (err) => { console.log(err) })
            }
        } else {
            debug('Restarting session ' + this.sessionId);

            this.streamOffset = streamOffset;

            this.chunkStore.setLast('0', 0);
            this.redisClient.get(this.sessionId, this.transcoderStarter.bind(this));
        }
    }

    transcoderStarter(err, reply) {
        if (err)
            return;

        this.chunkStore.clean();

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
                .replace('{SRTSRV}', config.base_url + '/api/sessions')
                .replace(/\{USRPLEX\}/g, config.plex_ressources)
                .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/seglist/, this.uuid + '/seglist')
                .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/manifest/, this.uuid + '/manifest')
        });

        debug('FFMPEG UUID: ' + this.uuid);

        if (typeof this.chunkOffset !== 'undefined' || typeof this.streamOffset !== 'undefined')
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
        if (fs.existsSync(config.transcoder_path)) {
            debug('Spawn ' + this.sessionId);
            this.transcoding = true;
            try {
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
            } catch (e) {
                debug('Failed to start FFMPEG for session ' + this.sessionId);
                debug(e.toString());
                this.startFFMPEG();
            }
        } else {
            setTimeout(this.startFFMPEG.bind(this), 1000);
        }
    }

    PMSTimeout() {
        debug('Timeout ' + this.sessionId);
        this.timeout = undefined;
        this.killInstance();
    }

    killInstance(fullClean = false, callback = () => {}) {
        debug('Killing ' + this.sessionId);
        this.redisClient.quit();
        this.alive = false;

        if (typeof this.plexRequest !== 'undefined')
            this.plexRequest.abort();

        if (typeof this.timeout !== 'undefined') {
            clearTimeout(this.timeout)
        }

        if (typeof this.sessionTimeout !== 'undefined') {
            clearTimeout(this.sessionTimeout)
        }

        if (this.ffmpeg != null) {
            this.ffmpeg.kill('SIGKILL');
        }

        rimraf(config.xdg_cache_home + this.sessionId, {}, () => {
            this.chunkStore.destroy();
            delete universal.cache[this.sessionId];
            callback();
        });
    }

    updateLastChunk() {
        let last = 0;
        let prev = null;

        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev === '-segment_start_number' || prev === '-skip_to_segment') {
                last = parseInt(this.transcoderArgs[i]);
                break;
            }
            prev = this.transcoderArgs[i];
        }

        this.chunkStore.setLast('0', (last > 0 ? last - 1 : last));
    }

    patchArgs(chunkId) {
        if (this.transcoderArgs.includes("chunk-%05d")) {
            debug('Patching long polling SS');
            this.patchSS(this.streamOffset);
            return;
        }

        debug('jumping to segment ' + chunkId + ' for ' + this.sessionId);

        let prev = '';
        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev === '-segment_start_number' || prev === '-skip_to_segment') {
                this.transcoderArgs[i] = parseInt(chunkId);
                break;
            }
            prev = this.transcoderArgs[i];
        }

        prev = '';
        let offset = 0;
        let segmentDuration = 5;
        for (let i = 0; i < this.transcoderArgs.length; i++) {
            if (prev === '-segment_time') {
                segmentDuration = this.transcoderArgs[i];
                break;
            }
            if (prev === '-min_seg_duration') {
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

        if (this.transcoderArgs.indexOf("-vsync") !== -1) {
            this.transcoderArgs.splice(this.transcoderArgs.indexOf("-vsync"), 2)
        }

        this.patchSS((parseInt(chunkId) + offset) * segmentDuration);
    }

    patchSS(time, accurate) {
        let prev = '';
        
        if (this.transcoderArgs.indexOf("-ss") === -1) {
            if (accurate)
                this.transcoderArgs.splice(this.transcoderArgs.indexOf("-i"), 0, "-ss", time, "-noaccurate_seek");
            else
                this.transcoderArgs.splice(this.transcoderArgs.indexOf("-i"), 0, "-ss", time);
        } else {
            prev = '';
            for (let i = 0; i < this.transcoderArgs.length; i++) {
                if (prev === '-ss') {
                    this.transcoderArgs[i] = time;
                    break;
                }
                prev = this.transcoderArgs[i];
            }
        }
    }

    segmentJumper(chunkId, streamId, callback) {
        let last = this.chunkStore.getLast('0');

        if (last > parseInt(chunkId) || last < parseInt(chunkId) - 10) {
            this.chunkStore.setLast('0', parseInt(chunkId));

            if (this.ffmpeg != null) {
                this.ffmpeg.removeAllListeners('exit');
                this.ffmpeg.kill('SIGKILL');

                this.patchArgs(chunkId);
                this.startFFMPEG();
            } else {
                this.chunkOffset = parseInt(chunkId);
            }
        }
        this.waitChunk(chunkId, streamId, callback)
    }

    getChunk(chunkId, callback, streamId = '0', noJump = false) {
        if (this.chunkStore.getChunk(streamId, chunkId) !== null) {
            callback(this.alive ? chunkId : -1);
        } else {
            if (streamId === '0' && noJump === false) {
                this.segmentJumper(chunkId, streamId, callback);
            } else {
                this.waitChunk(chunkId, streamId, callback);
            }
        }
    }

    waitChunk(chunkId, streamId, callback) {
        if (this.transcoding) {
            this.chunkStore.getChunk(streamId, chunkId, (res) => {
                if (res === 'timeout' || res === 'destroyed' || res === 'clean') {
                    callback(this.alive ? -2 : -1);
                } else {
                    callback(this.alive ? chunkId : -1);
                }
            });
        } else {
            callback(-1);
        }
    }
}

module.exports = Transcoder;
