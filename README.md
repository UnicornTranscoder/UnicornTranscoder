## RhinoTranscoder

This is a transcoding node for Plex, used by the [RhinoLoadBalancer](https://github.com/mrkno/RhinoLoadBalancer). It is able to handle all the requests from a `Plex Client` to transcode and serve a stream.

This is a __heavily modified__ fork the of [UnicornTranscoder](https://github.com/UnicornTranscoder/UnicornTranscoder), with the aim of improving its dynamic scaling abilities.

## Dependencies

* Plex Media Server
* NodeJS (with yarn or npm)
* A FUSE with your library or all your library replicated to the transcoder server
* A [RhinoLoadBalancer](https://github.com/mrkno/RhinoLoadBalancer).

## Setup

1. Clone this repository
2. Install with `yarn` or `npm install`
3. Install the Plex Dependencies
  * Run `./setup_transcoder.sh <download_url_of_your_plex_server_version>` It will install FFMPEG and the FFMPEG libraries
  * Copy all the codecs for FFMPEG from your `Plex Media Server` to a directory
  * Copy `EasyAudioEncoder` to a directory
4. Run EasyAudioEncoder
  * It could be a daemon an example systemd configuration is available in the repository
  * **Note:** Easy Audio Encoder will work in the directory it was run
5. Configure the transcoder in `config.json`. See `config.example.json` for variables that can be changed.


| Variable               | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| port                   | The port the UnicornTranscoder will listen                   |
| mount_point            | The path to to your library root                             |
| transcoder_decay_time  | The time to wait in second before an unactive session is killed |
| plex_url               | A direct URL to your Plex Media Server (not going through UnicornLoadBalancer) |
| base_url               | URL to your UnicornLoadBalancer                              |
| video_content_type     | Content Type for video (do not modify)                       |
| subtitles_content_type | Content Type for subtitles (do not modify)                   |

6. Run the transcoder
