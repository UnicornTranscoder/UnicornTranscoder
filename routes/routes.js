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
const optimizer = require('../core/optimizer');
const SessionManager = require('../core/session-manager');

// Legacy DASH routes
 router.get('/:formatType/:/transcode/universal/start.mpd', dash.serve);
 router.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', dash.serveInit);
 router.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', dash.serveChunk);

// New DASH mode
router.get('/unicorn/dash/:sessionId/start', dash.start);
router.get('/unicorn/dash/:sessionId/:streamId/initial.mp4', dash.serveInit);
router.get('/unicorn/dash/:sessionId/:streamId/:partId.m4s', dash.serveChunk);


// LEGACY m3u8 mode
router.get('/:formatType/:/transcode/universal/session/:sessionId/base/index.m3u8', m3u8.serve);
router.get('/:formatType/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', m3u8.serve);
router.get('/:formatType/:/transcode/universal/session/:sessionId/base/header', m3u8.serveHeader);
router.get('/:formatType/:/transcode/universal/session/:sessionId/vtt-base/index.m3u8', proxy);
router.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', m3u8.serveChunk);
router.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', m3u8.serveSubtitles);

// New m3u8 mode
router.get('/unicorn/hls/:sessionId/start', m3u8.start);
//router.get('/unicorn/hls/:sessionId/base/index.m3u8', m3u8.serve);
//router.get('/unicorn/hls/:sessionId/base-x-mc/index.m3u8', m3u8.serve);
router.get('/unicorn/hls/:sessionId/header', m3u8.serveHeader);
//router.get('/unicorn/hls/:sessionId/vtt-base/index.m3u8', proxy);
router.get('/unicorn/hls/:sessionId/:partId.ts', m3u8.serveChunk);
router.get('/unicorn/hls/:sessionId/:partId.vtt', m3u8.serveSubtitles);



//Stream mode
router.get('/:formatType/:/transcode/universal/start', stream.serve);
router.get('/:formatType/:/transcode/universal/subtitles', stream.serveSubtitles);

// Download files
router.get('/library/parts/:id1/:id2/file.*', download.serve);

//Transcoder progression
router.post('/:formatType/:/transcode/session/:sessionId/:uuid/seglist', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.seglistParser);
router.post('/:formatType/:/transcode/session/:sessionId/:uuid/manifest', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.manifestParser);

//UnicornTranscoder API
router.get('/api/sessions', SessionManager.stats.bind(SessionManager));
router.get('/api/resolve', SessionManager.resolve.bind(SessionManager));
router.get('/api/stop', SessionManager.stopTranscoder.bind(SessionManager));
router.get('/api/ping', SessionManager.ping.bind(SessionManager));

//Plex Progress URL
router.all('/:formatType/:/transcode/session/:sessionId/:uuid/progress', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.progress);
router.all('/:formatType/:/transcode/session/:sessionId/:uuid/progress/*', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.progress);
router.all('/log', bodyParser.text({ type: () => {return true}, limit: '50mb' }), progress.log);

// Optimization
router.post('/api/optimize', bodyParser.json(), optimizer.start);
router.get('/api/optimize/:session/:filename', optimizer.download);
router.delete('/api/optimize/:session', optimizer.stop);

module.exports = router;
