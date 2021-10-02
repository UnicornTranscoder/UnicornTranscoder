/**
 * Created by drouar_b on 27/04/2017.
 */

const child_process = require('child_process');
const debug = require('debug')('UnicornTranscoder:Transcoder');
const fs = require('fs');
const rp = require('request-promise-native');
const uuid = require('uuid/v4');
const config = require('../config');
const ChunkStore = require('../utils/chunkStore');
const rmfr = require('rmfr');
const PlexDirectories = require('../utils/plex-directories');
const utils = require('../utils/utils');

class Transcoder {
    constructor(sessionId, req, res, streamOffset) {
        this.uuid = uuid();
        this.alive = true;
        this.ffmpeg = null;
        this.transcoding = true;
        this.streamOffset = streamOffset;
        this.chunkStore = new ChunkStore();
        this.sessionId = sessionId = sessionId.replace('/', '-');
        debug('Create transcoder ' + this.sessionId);

        Promise.all([
            //Proxy the request if not restarting
            (typeof req !== 'undefined' && typeof streamOffset === 'undefined' ?
                rp(`${config.loadbalancer_address}/api/plex${req.url}`)
                    .then((body) => {
                        if (body !== null && typeof res !== 'undefined')
                            res.send(body)
                    }) : Promise.resolve(null)
            ),
            //Get args
            rp({ uri: ${config.loadbalancer_address}/api/plex${req.url}, timeout: 20000 })
                .then((body) => {
                    return JSON.parse(body)
                })
                .then((parsed) => {
                    this.transcoderArgs = parsed.args.map((arg) => {
                        // Hack to replace aac_lc by aac because FFMPEG don't recognise the codec aac_lc
                        if (arg === 'aac_lc')
                            return 'aac';
                        arg = utils.replaceAll(arg, '{INTERNAL_PLEX_SETUP}', PlexDirectories.getPlexFolder());
                        return arg
                            .replace('{INTERNAL_TRANSCODER}', "http://127.0.0.1:" + config.port + '/')
                            .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/seglist/, this.uuid + '/seglist')
                            .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/manifest/, this.uuid + '/manifest')
                    });

                    if (config.transcoder.debug) {
                        this.transcoderArgs.splice(this.transcoderArgs.indexOf('-loglevel'), 2); // Enable logs
                        debug(this.transcoderArgs)
                    }

                    if (typeof this.chunkOffset !== 'undefined' || typeof this.streamOffset !== 'undefined')
                        this.patchArgs(this.chunkOffset);

                    this.transcoderEnv = Object.create(process.env);
                    this.transcoderEnv.LD_LIBRARY_PATH = PlexDirectories.getPlexLibraryFolder();
                    this.transcoderEnv.FFMPEG_EXTERNAL_LIBS = PlexDirectories.getCodecFolder();
                    this.transcoderEnv.XDG_CACHE_HOME = PlexDirectories.getTemp();
                    this.transcoderEnv.XDG_DATA_HOME = PlexDirectories.getPlexResources();
                    this.transcoderEnv.EAE_ROOT = PlexDirectories.getTemp();
                    this.transcoderEnv.X_PLEX_TOKEN = parsed.env.X_PLEX_TOKEN;
                })
                .then(() => {
                    return rmfr(`${config.transcoder.temp_folder}/${sessionId}`)
                })
                .then(() => {
                    return new Promise((resolve, reject) => {
                        fs.mkdir(`${config.transcoder.temp_folder}/${sessionId}`, (err) => {
                            if (err)
                                return reject(err);
                            resolve();
                        })
                    })
                })
                .then(() => {
                    this.startFFMPEG();
                })
        ]).then(() => {
            debug(`session ${sessionId} started`)
        }).catch((e) => {
            debug(`Failed to start ${sessionId}: ${e.toString()}`);
            if (typeof this.sessionManager !== 'undefined') {
                this.sessionManager.killSession(this.sessionId)
            } else {
                this.killInstance();
            }
        });
    }

    startFFMPEG() {
        debug('Spawn ' + this.sessionId);
        this.transcoding = true;
        this.ffmpeg = child_process.spawn(
            PlexDirectories.getPlexTranscoderPath(),
            this.transcoderArgs,
            {
                env: this.transcoderEnv,
                cwd: `${config.transcoder.temp_folder}/${this.sessionId}`
            });
        this.ffmpeg.on("exit", (code, sig) => {
            debug('FFMPEG stopped ' + this.sessionId + ' ' + code + ' ' + sig);
            this.transcoding = false
        });

        if (config.transcoder.debug) {
            this.ffmpeg.stdout.on('data', (data) => { debug('FFMPEG(stdout): ' + data.toString()); }); // Send logs to stdout
            this.ffmpeg.stderr.on('data', (data) => { debug('FFMPEG(stderr): ' + data.toString()); }); // Send logs to stderr
        }

        this.updateLastChunk();
    }

    killInstance(callback = () => {
    }) {
        debug('Killing ' + this.sessionId);
        this.alive = false;

        if (this.ffmpeg != null) {
            this.ffmpeg.kill('SIGKILL');
        }

        this.chunkStore.destroy();

        rmfr(`${config.transcoder.temp_folder}/${this.sessionId}`)
            .then(() => {
                callback();
            })
            .catch(() => {
                debug(`Failed to remove ${this.sessionId}`);
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
            if (prev === "-seg_duration") {
                segmentDuration = this.transcoderArgs[i];
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
                this.patchArgs(chunkId);
                this.ffmpeg.on("exit", this.startFFMPEG.bind(this));
                this.ffmpeg.kill('SIGKILL');

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
