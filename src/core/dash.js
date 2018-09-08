const path = require('path');
const Transcoder = require('./transcoder');
const { fileExists } = require('../utils/files');
const pad = require('../utils/pad');
const sleep = require('../utils/sleep');

class Dash {
    constructor(config, universal, websocket) {
        this._config = config;
        this._universal = universal;
        this._ws = websocket;
        this._plexCachePath = path.join(this._config.plex.transcoder, 'Cache');
    }

    async serve(req, res) {
        console.log(req.query.session);

        if (this._universal.getCache(req.params.sessionId) !== void (0)) {
            await this._universal.getCache(req.params.sessionId).killInstance();
        }
        this._universal.putCache(req.query.session, new Transcoder(this._config, this._ws, this._universal, req.query.session, req));

        if (req.query['X-Plex-Session-Identifier'] !== void (0)) {
            this._universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
        }
        await this._universal.updateTimeout(req.query.session);
        res.status(200).json({success: true});
    }

    async serveInit(req, res) {
        return await this._serveCommon(req, res, 'init');
    }

    async serveChunk(req, res) {
        return await this._serveCommon(req, res, 'chunk');
    }

    async _serveCommon(req, res, type) {
        const sessionId = req.params.sessionId;
        if (this._universal.getCache(sessionId) !== void (0) && this._universal.getCache(sessionId).alive === true) {

            let noJump;
            let startIndex;
            let servedFileName;
            if (type === 'init') {
                noJump = true;
                startIndex = 0;
                servedFileName = `init-stream${req.params.streamId}.m4s`;
            }
            else {
                noJump = false;
                startIndex = parseInt(req.params.partId) + 1;
                servedFileName = `chunk-stream${req.params.streamId}-${pad(startIndex, 5)}.m4s`;
            }

            const chunkId = await this._universal.getCache(sessionId).getChunk(startIndex, req.params.streamId, noJump);
            const file = path.join(this._plexCachePath, sessionId, servedFileName);

            if (chunkId === -2 || (chunkId === -1 && !(await fileExists(file)))) {
                if (!res.headersSent) {
                    res.status(404).send(`Callback ${chunkId}`);
                }
            }
            else if (type === 'chunk' && chunkId === -1 && !(await fileExists(file))) {
                console.log(`Serving fake ${servedFileName} for session ${sessionId}`);
                res.send('');
            }
            else {
                console.log(`Serving ${servedFileName} for session ${sessionId}`);
                res.sendFile(file);
            }
            await this._universal.updateTimeout(sessionId);
        }
        else {
            console.log(`${sessionId} not found`);
            this._universal.putCache(sessionId, new Transcoder(this._config, this._ws, this._universal, sessionId));
            await this._universal.updateTimeout(sessionId);
            await sleep(10000);
            res.status(404).send('Restarting session');
        }
    }
}

module.exports = Dash;
