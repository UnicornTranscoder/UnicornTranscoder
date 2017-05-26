/**
 * Created by drouar_b on 27/04/2017.
 */

let request = require('request');
let config = require('../utils/config');

let download = {};

download.serve = function (req, res) {
    request(config.api_url + config.endpoints.path + req.params.id1 + '/' + req.params.id2 + '/', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            let result = JSON.parse(body);
            if (result.status == 0) {
                res.download(config.mount_point + result.link, path.basename(config.mount_point + result.link))
            } else {
                res.status(404).send('404 file not found in database')
            }
        } else {
            res.status(500).send('500 Internal server error')
        }
    })
};

module.exports = download;