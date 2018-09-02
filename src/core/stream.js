const fs = require('fs');
const path = require('path');
const Transcoder = require('./transcoder');
const pad = require('../utils/pad');

class Stream {
    constructor(websocket, config, universal) {
        this._ws = websocket;
        this._config = config;
        this._universal = universal;
    }

    async serve(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (req.query['X-Plex-Session-Identifier'] !== void (0)) {
            this._universal.sessions[req.query['X-Plex-Session-Identifier']] = sessionId;
        }

        if (this._universal.cache[sessionId] === void (0)) {
            console.log('create session ' + sessionId + ' ' + req.query.offset);
            this.createTranscoder(req, res);
        } else {
            transcoder = this._universal.cache[sessionId];
            console.log('session found ' + sessionId);

            if (req.query.offset !== void (0)) {
                let newOffset = parseInt(req.query.offset);

                if (newOffset < transcoder.streamOffset) {
                    console.log('Offset (' + newOffset + ') lower than transcoding (' + transcoder.streamOffset + ') instance, restarting...');
                    await transcoder.killInstance(false);
                    this.createTranscoder(req, res, newOffset);
                } else {
                    this.chunkRetriever(req, res, transcoder, newOffset);
                }
            } else {
                console.log('Offset not found, resuming from beginning');
                this.rangeParser(req);
                this.serveHeader(req, res, transcoder, 0, false);
            }
        }
    }

    async createTranscoder(req, res, streamOffset) {
        let sessionId = req.query.session.toString();
        let transcoder = this._universal.cache[sessionId] = new Transcoder(this._config, this._ws, this._universal, sessionId, req, streamOffset);
        if (req.query.offset !== void (0)) {
            transcoder.streamOffset = parseInt(req.query.offset);
        }
        else {
            transcoder.streamOffset = 0;
        }
        await this._universal.updateTimeout(sessionId);

        this.rangeParser(req);
        this.serveHeader(req, res, transcoder, 0, false);
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
            this.rangeParser(req);
            this.serveHeader(req, res, transcoder, chunkId, false);
        }
        catch (e) {
            console.log('Offset not found, restarting...');
            await transcoder.killInstance(false);
            this.createTranscoder(req, res, newOffset);
        }
    }

    serveSubtitles(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (this._universal.cache[req.query.session] === void (0)) {
            console.log(" subtitle session " + sessionId + " not found");
            res.status(404).send("Session not found");
            return;
        }

        console.log("serve subtitles " + sessionId);
        transcoder = this._universal.cache[req.query.session];

        this.serveHeader(req, res, transcoder, 0, true);
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
                    this.endConnection(req, res, isSubtitle);
                    return;

                case -2:
                    this.serveHeader(req, res, transcoder, offset, isSubtitle);
                    return;

                default:
                    this.streamBuilder(req, res, isSubtitle, -1, () => {
                        this.serveChunk(req, res, transcoder, isSubtitle, offset);
                    });
            }
        }, (isSubtitle ? 'sub' : '0'), true)
    }

    async serveChunk(req, res, transcoder, isSubtitle, chunkId) {
        if (req.connection.destroyed) {
            this.endConnection(req, res, isSubtitle);
            return;
        }

        await this._universal.updateTimeout(req.query.session);

        transcoder.getChunk(chunkId, (chunkId) => {
            switch (chunkId) {
                case -1:
                    this.endConnection(req, res, isSubtitle);
                    return;

                case -2:
                    this.serveChunk(req, res, transcoder, isSubtitle, chunkId);
                    return;

                default:
                    this.streamBuilder(req, res, isSubtitle, chunkId, () => {
                        this.serveChunk(req, res, transcoder, isSubtitle, chunkId + 1);
                    });
            }
        }, (isSubtitle ? 'sub' : '0'), true)
    }

    streamBuilder(req, res, isSubtitle, chunkId, callback) {
        //Build the chunk Path
        const chunkPath = path.join(this._config.plex.transcoder, "Cache", req.query.session,
            (isSubtitle ? 'sub-' : '') + (chunkId === -1 ? 'header' : 'chunk-' + pad(chunkId, 5)));

        //Access the file to get the size
        fs.stat(chunkPath, (err, stats) => {
            if (err) {
                this.endConnection(req, res, isSubtitle);
                return;
            }

            let fileStream;
            let sizeToRead;

            //Check if we have to skip some data
            if (req.parsedRange !== void (0) && typeof req.parsedRange.start === "number" && (req.parsedRange.start - req.streamCursor) > 0) {
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
            if (req.parsedRange !== void (0) && typeof req.parsedRange.end === "number" && req.parsedRange.end < (req.streamCursor + sizeToRead)) {
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
                            this.endConnection(req, res, isSubtitle);
                            return;
                        }
                    }
                });
            } else {
                //Send the whole file
                if (!req.connection.destroyed) {
                    fileStream.pipe(res, { end: false });
                    fileStream.on('end', () => {
                        req.streamCursor += sizeToRead;

                        if (req.parsedRange !== void (0) && typeof req.parsedRange.end === "number" && req.parsedRange.end === req.streamCursor) {
                            this.endConnection(req, res, isSubtitle);
                        }
                        else {
                            callback();
                        }
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