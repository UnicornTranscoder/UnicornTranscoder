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
const progress = require('../core/progress');
const optimizer = require('../core/optimizer');
const SessionManager = require('../core/session-manager');

// Download files
router.get('/unicorn/download/:fileId/file.*', download.serve);

// New DASH mode
router.get('/unicorn/dash/:sessionId/start', dash.start);
router.get('/unicorn/dash/:sessionId/:streamId/initial.mp4', dash.serveInit);
router.get('/unicorn/dash/:sessionId/:streamId/:partId.m4s', dash.serveChunk);

// New M3U8 mode
router.get('/unicorn/hls/:sessionId/start', m3u8.start);
router.get('/unicorn/hls/:sessionId/header', m3u8.serveHeader);
router.get('/unicorn/hls/:sessionId/:partId.ts', m3u8.serveChunk);
router.get('/unicorn/hls/:sessionId/:partId.vtt', m3u8.serveSubtitles);

// Stream mode
router.get('/unicorn/polling/:sessionId/start', stream.serve); // ?offset=
router.get('/unicorn/polling/:sessionId/subtitles', stream.serveSubtitles);

// Optimizer
router.post('/unicorn/optimize/:sessionId/start', bodyParser.json(), optimizer.start);
router.delete('/unicorn/optimize/:sessionId/stop', optimizer.stop);
router.get('/unicorn/optimize/:sessionId/download/:filename', optimizer.download);

// Stop and ping endpoints
router.get('/unicorn/api/:sessionId/stop', SessionManager.stopTranscoder.bind(SessionManager));
router.get('/unicorn/api/:sessionId/ping', SessionManager.ping.bind(SessionManager));
router.get('/unicorn/api/:sessionId/resolve', SessionManager.resolve.bind(SessionManager)); // Resolve the right transcoder url based on GeoIP

// Stats endpoints
router.get('/unicorn/stats', SessionManager.stats.bind(SessionManager));

// Transcoder progression
router.post('/:formatType/:/transcode/session/:sessionId/:uuid/seglist', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.seglistParser);
router.post('/:formatType/:/transcode/session/:sessionId/:uuid/manifest', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.manifestParser);

// Plex Progress URL
router.all('/:formatType/:/transcode/session/:sessionId/:uuid/progress', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.progress);
router.all('/:formatType/:/transcode/session/:sessionId/:uuid/progress/*', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.progress);
router.all('/log', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.log);

module.exports = router;
