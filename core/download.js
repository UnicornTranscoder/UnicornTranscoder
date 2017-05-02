/**
 * Created by drouar_b on 27/04/2017.
 */

var request = require('request');
var config = require('../utils/config');

var download = module.exports = {};

download.serve = function (req, res) {
    request(config.api_url + config.endpoints.path + req.params.id1 + '/' + req.params.id2 + '/', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            if (result.status == 0) {
                res.download(config.mount_point + result.link, path.basename(config.mount_point + result.link));
            } else {
                res.status(404).send('404 file not found in database');
            }
        } else {
            res.status(500).send('500 Internal server error');
        }
    });
};