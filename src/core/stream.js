const fs = require('fs');
const path = require('path');
const { fileSize } = require('../utils/files');
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

        if (this._universal.getCache(sessionId) === void(0)) {
            console.log('create session ' + sessionId + ' ' + req.query.offset);
            this._createTranscoder(req, res);
        } else {
            transcoder = this._universal.getCache(sessionId);
            console.log('session found ' + sessionId);

            if (req.query.offset !== void (0)) {
                let newOffset = parseInt(req.query.offset);

                if (newOffset < transcoder.streamOffset) {
                    console.log('Offset (' + newOffset + ') lower than transcoding (' + transcoder.streamOffset + ') instance, restarting...');
                    await transcoder.killInstance(false);
                    this._createTranscoder(req, res, newOffset);
                } else {
                    this._chunkRetriever(req, res, transcoder, newOffset);
                }
            } else {
                console.log('Offset not found, resuming from beginning');
                this._rangeParser(req);
                this._serveHeader(req, res, transcoder, 0, false);
            }
        }
    }

    async _createTranscoder(req, res, streamOffset) {
        let sessionId = req.query.session.toString();
        let transcoder = this._universal.putCache(sessionId, new Transcoder(this._config, this._ws, this._universal, sessionId, req, streamOffset));
        if (req.query.offset !== void (0)) {
            transcoder.streamOffset = parseInt(req.query.offset);
        }
        else {
            transcoder.streamOffset = 0;
        }
        await this._universal.updateTimeout(sessionId);

        this._rangeParser(req);
        this._serveHeader(req, res, transcoder, 0, false);
    }

    async _chunkRetriever(req, res, transcoder, newOffset) {
        console.log('Offset found ' + newOffset + ', attempting to resume (transcoder: ' + transcoder.streamOffset + ')');
        try {
            const chunk = await this._ws.getByKey(transcoder.sessionId + ':timecode:' + newOffset);
            if (chunk === null) {
                throw new Error('Chunk cannot be null');
            }
            let chunkId = parseInt(chunk);
            console.log('Chunk ' + chunkId + ' found for offset ' + newOffset);
            this._rangeParser(req);
            this._serveHeader(req, res, transcoder, chunkId, false);
        }
        catch (e) {
            console.log('Offset not found, restarting...');
            await transcoder.killInstance(false);
            this._createTranscoder(req, res, newOffset);
        }
    }

    serveSubtitles(req, res) {
        let transcoder;
        let sessionId = req.query.session.toString();

        if (this._universal.getCache(req.query.session) === void(0)) {
            console.log(" subtitle session " + sessionId + " not found");
            res.status(404).send("Session not found");
            return;
        }

        console.log("serve subtitles " + sessionId);
        transcoder = this._universal.getCache(req.query.session);

        this._serveHeader(req, res, transcoder, 0, true);
    }

    _rangeParser(req) {
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

    _serveHeader(req, res, transcoder, offset, isSubtitle) {
        transcoder.getChunk(offset, async(chunkId) => {
            switch (chunkId) {
                case -1:
                    this._endConnection(req, res, isSubtitle);
                    return;

                case -2:
                    this._serveHeader(req, res, transcoder, offset, isSubtitle);
                    return;

                default:
                    await this._streamBuilder(req, res, isSubtitle, -1);
                    this.serveChunk(req, res, transcoder, isSubtitle, offset);
            }
        }, (isSubtitle ? 'sub' : '0'), true)
    }

    async serveChunk(req, res, transcoder, isSubtitle, chunkId) {
        if (req.connection.destroyed) {
            this._endConnection(req, res, isSubtitle);
            return;
        }

        await this._universal.updateTimeout(req.query.session);

        transcoder.getChunk(chunkId, async(chunkId) => {
            switch (chunkId) {
                case -1:
                    this._endConnection(req, res, isSubtitle);
                    return;

                case -2:
                    this.serveChunk(req, res, transcoder, isSubtitle, chunkId);
                    return;

                default:
                    await this._streamBuilder(req, res, isSubtitle, chunkId);
                    this.serveChunk(req, res, transcoder, isSubtitle, chunkId + 1);
            }
        }, (isSubtitle ? 'sub' : '0'), true)
    }

    async _streamBuilder(req, res, isSubtitle, chunkId) {
        //Build the chunk Path
        const chunkPath = path.join(this._config.plex.transcoder,
            "Cache",
            req.query.session,
            (isSubtitle ? 'sub-' : '') + (chunkId === -1 ? 'header' : 'chunk-' + pad(chunkId, 5)));

        try {
            const size = await fileSize(chunkPath);
            let fileStream;
            let sizeToRead;

            //Check if we have to skip some data
            if (req.parsedRange !== void (0) && typeof(req.parsedRange.start) === "number" && (req.parsedRange.start - req.streamCursor) > 0) {
                let toSkip = req.parsedRange.start - req.streamCursor;

                //Skip the whole file
                if (toSkip > size) {
                    req.streamCursor += size;
                    return;
                }

                //Skip only n bytes
                fileStream = fs.createReadStream(chunkPath, {
                    start: toSkip
                });
                req.streamCursor += toSkip;
                sizeToRead = size - toSkip;
            }
            else {
                sizeToRead = size;
                fileStream = fs.createReadStream(chunkPath);
            }

            let complete = null;
            const completePromise = new Promise(resolve => complete = resolve);
            if (req.parsedRange !== void (0) && typeof(req.parsedRange.end) === "number" && req.parsedRange.end < (req.streamCursor + sizeToRead)) {
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
                            this._endConnection(req, res, isSubtitle);
                            complete();
                            return;
                        }
                    }
                });
            }
            else if (!req.connection.destroyed) {
                //Send the whole file
                fileStream.pipe(res, { end: false });
                fileStream.on('end', () => {
                    req.streamCursor += sizeToRead;
                    if (req.parsedRange !== void (0) && typeof(req.parsedRange.end) === "number" && req.parsedRange.end === req.streamCursor) {
                        this._endConnection(req, res, isSubtitle);
                    }
                    else {
                        complete();
                    }
                });
            }
            else {
                complete();
            }
            await completePromise;
        }
        catch(e) {
            this._endConnection(req, res, isSubtitle);
        }
    }

    _endConnection(req, res, isSubtitle) {
        if (!req.connection.destroyed) {
            res.end();
            console.log(req.query.session + (isSubtitle ? ' subtitles' : '') + ' end');
        }
    }
}

module.exports = Stream;