const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const request = require('request');
const Dash = require('../core/dash');
const M3U8 = require('../core/m3u8');
const Stream = require('../core/stream');
const Universal = require('../core/universal');
const Ffmpeg = require('../core/ffmpeg');
const proxy = require('../core/proxy');

class Routes {
    constructor(config, websocket) {
        this._config = config;
        this._websocket = websocket;
        this._router = express.Router();
        this._dash = new Dash(config);
        this._m3u8 = new M3U8(config);
        this._stream = new Stream(websocket, config);
        this._universal = new Universal(config);
        this._ffmpeg = new Ffmpeg(websocket);
        this._proxy = proxy(config);
        this._setupRoutes();
    }

    _setupRoutes() {
        this._router.get('/video/:/transcode/universal/start.mpd', this._dash.serve.bind(this._dash));
        this._router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', this._dash.serveInit.bind(this._dash));
        this._router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', this._dash.serveChunk.bind(this._dash));

        this._router.get('/video/:/transcode/universal/start.m3u8', this._m3u8.saveSession.bind(this._m3u8));
        this._router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', this._m3u8.serve.bind(this._m3u8));
        this._router.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', this._m3u8.serve.bind(this._m3u8));
        this._router.get('/video/:/transcode/universal/session/:sessionId/vtt-base/index.m3u8', this._proxy);
        this._router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', this._m3u8.serveChunk.bind(this._m3u8));
        this._router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', this._m3u8.serveSubtitles.bind(this._m3u8));

        this._router.get('/video/:/transcode/universal/start', this._stream.serve.bind(this._stream));
        this._router.get('/video/:/transcode/universal/subtitles', this._stream.serveSubtitles.bind(this._stream));

        this._router.get('/video/:/transcode/universal/stop', this._universal.stopTranscoder.bind(this._universal));
        this._router.get('/video/:/transcode/universal/ping', this._universal.ping.bind(this._universal));
        this._router.get('/:/timeline', this._universal.timeline.bind(this._universal));

        this._router.get('/library/parts/:id1/:id2/file.*', (req, res) => {
            request(config.base_url + '/api/pathname/' + req.params.id1 + '/', (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    let result = JSON.parse(body);
                    console.log(result.file);
                    universal.downloads++;
                    res.download(result.file, path.basename(result.file), () => {
                        universal.downloads--;
                    });
                } else {
                    res.status(404).send('404 File not found')
                }
            })
        });

        //Transcoder progression
        const bodyParserText = bodyParser.text({ type: () => true, limit: '50mb' });
        this._router.post('/video/:/transcode/session/:sessionId/seglist', bodyParserText, this._ffmpeg.seglistParser.bind(this._ffmpeg));
        this._router.post('/video/:/transcode/session/:sessionId/*/seglist', bodyParserText, this._ffmpeg.seglistParser.bind(this._ffmpeg));
        this._router.post('/video/:/transcode/session/:sessionId/manifest', bodyParserText, this._ffmpeg.manifestParser.bind(this._ffmpeg));
        this._router.post('/video/:/transcode/session/:sessionId/*/manifest', bodyParserText, this._ffmpeg.manifestParser.bind(this._ffmpeg));

        this._router.get('/api/stats', this._universal.stats.bind(this._universal));
    }

    toRoute() {
        return this._router;
    }
}

module.exports = (config, websocket) => {
    const routes = new Routes(config, websocket);
    return routes.toRoute();
};
