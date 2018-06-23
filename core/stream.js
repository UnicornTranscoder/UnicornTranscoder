/**
 * Created by drouar_b on 27/04/2017.
 */

const fs = require('fs');
const debug = require('debug')('Stream');
const Transcoder = require('./transcoder');
const config = require('../config');
const universal = require('./universal');
const utils = require('../utils/utils');

class Stream {
    static serve(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (typeof req.query['X-Plex-Session-Identifier'] !== 'undefined') {
            universal.sessions[req.query['X-Plex-Session-Identifier']] = sessionId;
        }

        if (typeof universal.cache[sessionId] === 'undefined') {
            debug('create session ' + sessionId);
            Stream.createTranscoder(req, res);
        } else {
            transcoder = universal.cache[sessionId];
            debug('session found ' + sessionId);

            if (typeof req.query.offset !== 'undefined') {
                let newOffset = parseInt(req.query.offset);

                if (newOffset < transcoder.streamOffset) {
                    debug('Offset (' + newOffset + ') lower than transcoding (' + transcoder.streamOffset + ') instance, restarting...');
                    transcoder.killInstance();
                    //TODO Wainting instance remove, should create a callback
                    setTimeout(() => {
                        Stream.createTranscoder(req, res);
                    }, 1000);
                } else {
                    debug('Offset found ' + newOffset + ', resuming (transcoder: ' + transcoder.streamOffset + ')');
                    Stream.rangeParser(req);
                    Stream.serveHeader(req, res, transcoder, newOffset - transcoder.streamOffset, false);
                }
            } else {
                debug('Offset not found, resuming from beginning');
                Stream.rangeParser(req);
                Stream.serveHeader(req, res, transcoder, 0, false);
            }
        }
    }

    static createTranscoder(req, res) {
        let sessionId = req.query.session.toString();
        let transcoder = universal.cache[sessionId] = new Transcoder(sessionId, req);
        if (typeof req.query.offset !== 'undefined')
            transcoder.streamOffset = parseInt(req.query.offset);
        else
            transcoder.streamOffset = 0;

        universal.updateTimeout(sessionId);

        Stream.rangeParser(req);
        Stream.serveHeader(req, res, transcoder, 0, false);
    }

    static serveSubtitles(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (typeof universal.cache[req.query.session] === 'undefined') {
            debug(" subtitle session " + sessionId + " not found");
            res.status(404).send("Session not found");
            return;
        }

        debug("serve subtitles " + sessionId);
        transcoder = universal.cache[req.query.session];

        Stream.serveHeader(req, res, transcoder, 0, true);
    }

    static rangeParser(req) {
        let range = req.range(500 * (1024 * 1024 * 1024));

        if (typeof range === "object") {
            if (range.type !== "bytes")
                debug("WARNING range type " + range.type);

            if (range.length > 0) {
                req.parsedRange = range[0];
                req.streamCursor = 0;
                debug('range found ' + req.parsedRange.start + '-' + req.parsedRange.end)
            }
        }
    }

    static serveHeader(req, res, transcoder, offset, isSubtitle) {
        transcoder.getChunk(offset, (chunkId) => {
            switch (chunkId) {
                case -1:
                    Stream.endConnection(req, res, isSubtitle);
                    return;

                case -2:
                    Stream.serveHeader(req, res, transcoder, offset, isSubtitle);
                    return;

                default:
                    Stream.streamBuilder(req, res, isSubtitle, -1, () => {
                        Stream.serveChunk(req, res, transcoder, isSubtitle, offset);
                    });
            }
        }, (isSubtitle ? 'sub' : '0'), true)
    }

    static serveChunk(req, res, transcoder, isSubtitle, chunkId) {
        transcoder.getChunk(chunkId, (chunkId) => {
            switch (chunkId) {
                case -1:
                    Stream.endConnection(req, res, isSubtitle);
                    return;

                case -2:
                    Stream.serveChunk(req, res, transcoder, isSubtitle, chunkId);
                    return;

                default:
                    Stream.streamBuilder(req, res, isSubtitle, chunkId, () => {
                        Stream.serveChunk(req, res, transcoder, isSubtitle, chunkId + 1);
                    });
            }
        }, (isSubtitle ? 'sub' : '0'), true)
    }

    static streamBuilder(req, res, isSubtitle, chunkId, callback) {
        //Build the chunk Path
        let chunkPath = config.xdg_cache_home + req.query.session + "/" + (isSubtitle ? 'sub-' : '') + (chunkId === -1 ? 'header' : 'chunk-' + utils.pad(chunkId, 5));

        //Access the file to get the size
        fs.stat(chunkPath, (err, stats) => {
            if (err) {
                Stream.endConnection(req, res, isSubtitle);
                return;
            }

            let fileStream;
            let sizeToRead;

            //Check if we have to skip some data
            if (typeof req.parsedRange !== "undefined" && typeof req.parsedRange.start === "number" && (req.parsedRange.start - req.streamCursor) > 0) {
                let toSkip = req.parsedRange.start - req.streamCursor;

                //Skip the whole file
                if (toSkip > stats.size) {
                    req.streamCursor += stats.size;
                    callback();
                    return;
                }

                //Skip only n bytes
                fileStream = fs.createReadStream(chunkPath, {
                    start: toSkip
                });
                req.streamCursor += toSkip;
                sizeToRead = stats.size - toSkip;
            } else {
                sizeToRead = stats.size;
                fileStream = fs.createReadStream(chunkPath);
            }

            //Check the end range
            if (typeof req.parsedRange !== "undefined" && typeof req.parsedRange.end === "number" && req.parsedRange.end < (req.streamCursor + sizeToRead)) {
                //Extract data and push it to the stream
                fileStream.on('readable', () => {
                    let buffer;
                    while (null !== (buffer = fileStream.read(req.parsedRange.end - req.streamCursor))) {
                        if (req.connection.destroyed) {
                            fileStream.removeAllListeners('readable');
                            return;
                        }

                        res.write(buffer, 'binary');

                        req.streamCursor += buffer.length;
                        if (req.streamCursor >= req.parsedRange.end) {
                            fileStream.removeAllListeners('readable');
                            Stream.endConnection(req, res, isSubtitle);
                            return;
                        }
                    }
                });
            } else {
                //Send the whole file
                if (!req.connection.destroyed) {
                    fileStream.pipe(res, {end: false});
                    fileStream.on('end', () => {
                        req.streamCursor += sizeToRead;

                        if (typeof req.parsedRange !== "undefined" && typeof req.parsedRange.end === "number" && req.parsedRange.end === req.streamCursor)
                            Stream.endConnection(req, res, isSubtitle);
                        else
                            callback();
                    });
                }
            }
        });
    }

    static endConnection(req, res, isSubtitle) {
        if (!req.connection.destroyed) {
            res.end();
            debug(req.query.session + (isSubtitle ? ' subtitles' : '') + ' end');
        }
    }
}

module.exports = Stream;