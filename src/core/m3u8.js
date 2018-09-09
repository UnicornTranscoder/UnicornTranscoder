const path = require('path');
const { fileExists } = require('../utils/files');
const Transcoder = require('./transcoder');
const sleep = require('../utils/sleep');

class M3U8 {
    constructor(config, websocket, universal) {
        this._config = config;
        this._ws = websocket;
        this._universal = universal;
        this._plexCachePath = path.join(this._config.plex.transcoder, 'Cache');
        this._plexResourcesPath = path.join(this._config.plex.transcoder, 'Resources');
    }

    async serve(req) {
        console.log(`M3U8 ${req.params.sessionId}`);
        await this._universal.forceNewTranscoder(req.params.sessionId,
            new Transcoder(this._config, this._ws, this._universal, req.params.sessionId, req));
    }

    async serveChunk(req, res) {
        return await this._serveCommon(req, res);
    }

    async serveSubtitles(req, res) {
        return await this._serveCommon(req, res, 'sub');
    }

    async _serveCommon(req, res, type = void(0)) {
        const sessionId = req.params.sessionId;
        const logType = type === 'sub' ? 'subtitles' : 'stream';
        const extension = type === 'sub' ? 'vtt' : 'ts';
        console.log(`Requesting ${logType} ${req.params.partId} for session ${sessionId}`);

        const tr = this._universal.getCache(sessionId);
        if (tr === void (0) || tr.alive === false) {
            console.log(`M3U8 ${sessionId} not found`);
            this._universal.forceNewTranscoder(sessionId, new Transcoder(this._config, this._ws, this._universal, sessionId));
            await sleep(10000);
            res.status(404).send('Restarting session');
            return;
        }

        const chunkId = await tr.getChunk(req.params.partId, type);
        const file = path.join(this._plexCachePath, sessionId, `media-${req.params.partId}.${extension}`);
        if (chunkId == -2) {
            if (!res.headersSent) {
                res.status(404).send(`Callback ${chunkId}`);
            }
            else {
                res.status(200);
            }
        }
        else if (chunkId == -1 && !(await fileExists(file))) {
            console.log(`Serving fake ${logType} ${req.params.partId} for session ${sessionId}`);
            res.sendFile(path.join(this._plexResourcesPath, 'Resources', `empty.${extension}`));
        }
        else {
            console.log(`Serving ${logType} ${req.params.partId} for session ${sessionId}`);
            res.sendFile(file);
        }
        await this._universal.updateTimeout(sessionId);
    }

    saveSession(req) {
        this._universal.updatePlexSessionId(req.query['X-Plex-Session-Identifier'], req.query.session);
    }
}

module.exports = M3U8;