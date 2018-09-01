const xml2js = require('xml2js');
const redis = require('../utils/redis');
const pad = require('../utils/pad');
const LeakyBucket = require('leaky-bucket');

let buckets = {};

class FFMPEG {
    static seglistParser(req, res) {
        if (typeof buckets[req.params.sessionId] === "undefined")
            buckets[req.params.sessionId] = new LeakyBucket(1, 1, 1);

        buckets[req.params.sessionId].reAdd(1, (err) => {
            if (err) {
                res.end();
                return;
            }

            let last = -1;
            let rc = redis.getClient();

            rc.keys(req.params.sessionId + ":*", (err, savedChunks) => {
                req.body.split(/\r?\n/).forEach((itm) => {
                    itm = itm.split(',');
                    let chk = itm.shift();

                    //Long polling
                    if (chk.match(/^chunk-[0-9]{5}/)) {
                        let chunkId = chk.replace(/chunk-([0-9]{5})/, '$1');

                        if (savedChunks.indexOf(req.params.sessionId + ":0:" + chunkId) === -1) {
                            rc.set(req.params.sessionId + ":0:" + chunkId, itm.toString());

                            let beginning = Math.ceil(parseFloat(itm[0]));
                            let end = Math.floor(parseFloat(itm[1]));

                            if (beginning < end - 10)
                                beginning = end - 10;
                            
                            for (let i = beginning; i < end + 1; i++)
                                rc.set(req.params.sessionId + ":timecode:" + i, chunkId);
                        }
                        last = parseInt(chunkId);
                    }
                    if (chk.match(/^sub-chunk-[0-9]{5}/)) {
                        let chunkId = chk.replace(/sub-chunk-([0-9]{5})/, '$1');

                        if (savedChunks.indexOf(req.params.sessionId + ":sub:" + chunkId) === -1)
                            rc.set(req.params.sessionId + ":sub:" + chunkId, itm.toString())
                    }

                    //M3U8
                    if (chk.match(/^media-[0-9]{5}\.ts/)) {
                        let chunkId = chk.replace(/media-([0-9]{5})\.ts/, '$1');

                        if (savedChunks.indexOf(req.params.sessionId + ":0:" + chunkId) === -1)
                            rc.set(req.params.sessionId + ":0:" + chunkId, itm.toString());
                        last = parseInt(chunkId);
                    }
                    if (chk.match(/^media-[0-9]{5}\.vtt/)) {
                        let chunkId = chk.replace(/media-([0-9]{5})\.vtt/, '$1');

                        if (savedChunks.indexOf(req.params.sessionId + ":sub:" + chunkId) === -1)
                            rc.set(req.params.sessionId + ":sub:" + chunkId, itm.toString())
                    }
                });

                if (last !== -1) {
                    rc.set(req.params.sessionId + ":last", last);
                }

                rc.quit();
                res.end();
            });
        });
    }

    static manifestParser(req, res) {
        if (typeof buckets[req.params.sessionId] === "undefined")
            buckets[req.params.sessionId] = new LeakyBucket(1, 1, 1);

        buckets[req.params.sessionId].reAdd(1, (err) => {
            if (err) {
                res.end();
                return;
            }

            let rc = redis.getClient();

            rc.get(req.params.sessionId, (err, reply) => {
                if (typeof reply == 'undefined') {
                    rc.quit();
                    res.end();
                    return;
                }

                let parsed = JSON.parse(reply);
                if (parsed == null) {
                    rc.quit();
                    res.end();
                    return;
                }

                let prev = null;
                let segmentTime = 5;
                for (let i = 0; i < parsed.args.length; i++) {
                    if (prev == "-min_seg_duration") {
                        segmentTime = parsed.args[i] / 1000000;
                        break;
                    }
                    prev = parsed.args[i];
                }


                rc.keys(req.params.sessionId + ":[0-9]:*", (err, savedChunks) => {
                    xml2js.parseString(req.body, (err, mpd) => {
                        if (err)
                            return;

                        try {
                            let last = -1;

                            let offset = 1;
                            mpd.MPD.Period[0].AdaptationSet.forEach((adaptationSet) => {
                                let c = 0;
                                let i = 0;
                                let streamId = adaptationSet.Representation[0]["$"].id;
                                let timeScale = adaptationSet.Representation[0].SegmentTemplate[0]["$"].timescale;

                                adaptationSet.Representation[0].SegmentTemplate[0].SegmentTimeline[0].S.forEach((s) => {
                                    if (typeof s["$"].t != 'undefined' && streamId == 0) {
                                        offset = Math.round((s["$"].t / timeScale) / segmentTime);
                                    }

                                    for (i = c; i < c + (typeof s["$"].r != 'undefined' ? parseInt(s["$"].r) + 1 : 1); i++) {

                                        if (savedChunks.indexOf(req.params.sessionId + ":" + streamId + ":" + pad(i + offset, 5)) == -1)
                                        rc.set(req.params.sessionId + ":" + streamId + ":" + pad(i + offset, 5), s["$"].d);

                                        if (i + offset > last)
                                            last = i + offset;
                                    }
                                    c = i;
                                });

                                if (last != -1) {
                                    rc.set(req.params.sessionId + ":" + streamId + ":00000", 0);
                                    if (streamId == 0) {
                                        rc.set(req.params.sessionId + ":last", last);
                                    }
                                }
                            });

                            rc.quit();
                        } catch (e) {
                            rc.quit();
                        }
                        res.end();
                    });
                });
            });
        });
    }
}

module.exports = FFMPEG;