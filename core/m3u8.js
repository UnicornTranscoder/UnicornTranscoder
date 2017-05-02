/**
 * Created by drouar_b on 27/04/2017.
 */

m3u8 = module.exports = {};

m3u8.serve = function (req, res) {
    res.send('Serve m3u8');
};

m3u8.serveParts = function (req, res) {
    res.send('Serve vtt|ts');
};
