/**
 * Created by drouar_b on 27/04/2017.
 */

let m3u8 = {};

m3u8.serve = function (req, res) {
    res.send('Serve m3u8')
};

m3u8.serveParts = function (req, res) {
    res.send('Serve vtt|ts')
};

module.exports = m3u8;