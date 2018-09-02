const fs = require('fs');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const pad = require('../utils/pad');

class Stream {
    constructor(websocket, config) {
        this._ws = websocket;
        this._config = config;
    }

    async serve(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (req.query['X-Plex-Session-Identifier'] !== void(0)) {
            universal.sessions[req.query['X-Plex-Session-Identifier']] = sessionId;
        }

        if (universal.cache[sessionId] === void(0)) {
            console.log('create session ' + sessionId + ' ' + req.query.offset);
            Stream.createTranscoder(req, res);
        } else {
            transcoder = universal.cache[sessionId];
            console.log('session found ' + sessionId);

            if (req.query.offset !== void(0)) {
                let newOffset = parseInt(req.query.offset);

                if (newOffset < transcoder.streamOffset) {
                    console.log('Offset (' + newOffset + ') lower than transcoding (' + transcoder.streamOffset + ') instance, restarting...');
                    await transcoder.killInstance(false);
                    Stream.createTranscoder(req, res, newOffset);
                } else {
                    Stream.chunkRetriever(req, res, transcoder, newOffset);
                }
            } else {
                console.log('Offset not found, resuming from beginning');
                Stream.rangeParser(req);
                Stream.serveHeader(req, res, transcoder, 0, false);
            }
        }
    }

    async createTranscoder(req, res, streamOffset) {
        let sessionId = req.query.session.toString();
        let transcoder = universal.cache[sessionId] = new Transcoder(sessionId, req, void(0), streamOffset);
        if (req.query.offset !== void(0)) {
            transcoder.streamOffset = parseInt(req.query.offset);
        }
        else {
            transcoder.streamOffset = 0;
        }
        await universal.updateTimeout(sessionId);

        Stream.rangeParser(req);
        Stream.serveHeader(req, res, transcoder, 0, false);
    }

    async chunkRetriever(req, res, transcoder, newOffset) {
        console.log('Offset found ' + newOffset + ', attempting to resume (transcoder: ' + transcoder.streamOffset + ')');
        try {
            const chunk = await this._ws.getByKey(transcoder.sessionId + ':timecode:' + newOffset);
            if (chunk === null) {
                throw new Error('Chunk cannot be null');
            }
            let chunkId = parseInt(chunk);
            console.log('Chunk ' + chunkId + ' found for offset ' + newOffset);
            Stream.rangeParser(req);
            Stream.serveHeader(req, res, transcoder, chunkId, false);
        }
        catch (e) {
            console.log('Offset not found, restarting...');
            await transcoder.killInstance(false);
            Stream.createTranscoder(req, res, newOffset);
        }
    }

    serveSubtitles(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (universal.cache[req.query.session] === void(0)) {
            console.log(" subtitle session " + sessionId + " not found");
            res.status(404).send("Session not found");
            return;
        }

        console.log("serve subtitles " + sessionId);
        transcoder = universal.cache[req.query.session];

        Stream.serveHeader(req, res, transcoder, 0, true);
    }

    rangeParser(req) {
        let range = req.range(500 * (1024 * 1024 * 1024));

        if (typeof range === "object") {
            if (range.type !== "bytes") {
                console.log("WARNING range type " + range.type);
            }
            if (range.length > 0) {
                req.parsedRange = range[0];
                req.streamCursor = 0;
                console.log('range found ' + req.parsedRange.start + '-' + req.parsedRange.end)
            }
        }
    }

    serveHeader(req, res, transcoder, offset, isSubtitle) {
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

    async serveChunk(req, res, transcoder, isSubtitle, chunkId) {
        if (req.connection.destroyed) {
            Stream.endConnection(req, res, isSubtitle);
            return;
        }

        await universal.updateTimeout(req.query.session);

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

    streamBuilder(req, res, isSubtitle, chunkId, callback) {
        //Build the chunk Path
        let chunkPath = this._config.xdg_cache_home + req.query.session + "/" + (isSubtitle ? 'sub-' : '') + (chunkId === -1 ? 'header' : 'chunk-' + pad(chunkId, 5));

        //Access the file to get the size
        fs.stat(chunkPath, (err, stats) => {
            if (err) {
                Stream.endConnection(req, res, isSubtitle);
                return;
            }

            let fileStream;
            let sizeToRead;

            //Check if we have to skip some data
            if (req.parsedRange !== void(0) && typeof req.parsedRange.start === "number" && (req.parsedRange.start - req.streamCursor) > 0) {
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
            if (req.parsedRange !== void(0) && typeof req.parsedRange.end === "number" && req.parsedRange.end < (req.streamCursor + sizeToRead)) {
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

                        if (req.parsedRange !== void(0) && typeof req.parsedRange.end === "number" && req.parsedRange.end === req.streamCursor)
                            Stream.endConnection(req, res, isSubtitle);
                        else
                            callback();
                    });
                }
            }
        });
    }

    endConnection(req, res, isSubtitle) {
        if (!req.connection.destroyed) {
            res.end();
            console.log(req.query.session + (isSubtitle ? ' subtitles' : '') + ' end');
        }
    }
}

module.exports = Stream;