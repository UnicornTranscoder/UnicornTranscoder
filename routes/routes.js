/**
 * Created by drouar_b on 27/04/2017.
 */

const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const dash = require('../core/dash');
const m3u8 = require('../core/m3u8');
const stream = require('../core/stream');
const download = require('../core/download');
const ffmpeg = require('../core/ffmpeg');
const proxy = require('../core/proxy');
const progress = require('../core/progress');
const SessionManager = require('../core/session-manager');

//Dash routes
router.get('/video/:/transcode/universal/start.mpd', dash.serve);
router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', dash.serveInit);
router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', dash.serveChunk);

//m3u8 mode
router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', m3u8.serve);
router.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', m3u8.serve);
router.get('/video/:/transcode/universal/session/:sessionId/vtt-base/index.m3u8', proxy);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', m3u8.serveChunk);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', m3u8.serveSubtitles);

//Stream mode
router.get('/video/:/transcode/universal/start', stream.serve);
router.get('/video/:/transcode/universal/subtitles', stream.serveSubtitles);

// Download files
router.get('/library/parts/:id1/:id2/file.*', download.serve);

//Transcoder progression
router.post('/video/:/transcode/session/:sessionId/:uuid/seglist', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.seglistParser);
router.post('/video/:/transcode/session/:sessionId/:uuid/manifest', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.manifestParser);

//UnicornTranscoder API
router.get('/api/sessions', SessionManager.stats.bind(SessionManager));
router.get('/api/resolve', SessionManager.resolve.bind(SessionManager));
router.get('/api/stop', SessionManager.stopTranscoder.bind(SessionManager));
router.get('/api/ping', SessionManager.ping.bind(SessionManager));

//Plex Progress URL
router.all('/video/:/transcode/session/:sessionId/:uuid/progress', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.progress);
router.all('/video/:/transcode/session/:sessionId/:uuid/progress/*', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.progress);
router.all('/log', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.log);

module.exports = router;
