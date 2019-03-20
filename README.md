## UnicornTranscoder

This software is a remote transcoder for `Plex Media Server`. It is able to handle all the requests from a `Plex Client` to transcode and serve a stream.

## UnicornTranscoder Project

- [UnicornTranscoder](https://github.com/UnicornTranscoder/UnicornTranscoder)
- [UnicornLoadBalancer](https://github.com/UnicornTranscoder/UnicornLoadBalancer)
- [UnicornFFMPEG](https://github.com/UnicornTranscoder/UnicornFFMPEG)

## How does this work

* The user send a request to the Plex server
* The request is caught by `UnicornLoadBalancer`
* The  `UnicornLoadBalancer` answer a HTTP 302 with the URL of the `UnicornTranscoder`
* The transcoder will send a request to the Plex Media Server
* Plex Server will launch `Plex Transcoder` binary which was replaced by `UnicornFFMPEG`
* `UnicornFFMPEG` send the arguments to the `UnicornLoadBalancer`
* `UnicornTranscoder` pull FFMPEG argument from `UnicornLoadBalancer`
* `UnicornTranscoder` launch FFMPEG and starts to serve the request for the stream



## Setup

### 1. Needed Softwares

* Plex Media Server
* NodeJS
* npm

### 2. Pre-required 

* Setup `Plex Media Server`

* Setup [UnicornFFMPEG](https://github.com/UnicornTranscoder/UnicornFFMPEG)
* Setup [UnicornLoadBalancer](https://github.com/UnicornTranscoder/UnicornLoadBalancer)

### 3. Setup UnicornTranscoder

#### 3.1 Configuration

You can either configure a transcoder by modifying config.js or setting environment variables.

`port: env.int('SERVER_PORT', 3000),`

Here is an example of config. To define the config we will call `port`, either edit the value (here it's `3000`) or set the environement variable when launching the transcoder: `SERVER_PORT=3001 npm start`

##### Mandatory configuration

| Variable             | Description                                    |
| -------------------- | ---------------------------------------------- |
| loadbalancer_address | HTTP/HTTPS address of the UnicornLoadBalancer. |
| instance_address     | HTTP/HTTPS address of the UnicornTranscoder.   |

If you setup a Plex Media Server with the domain name `https://my-pms.com`, and you successfully setuped UnicornLoadBalancer, set load balancer_address to this adress.

If the domain name of your transcoder is `https://transcoder1.my-pms.com`, set instance_address to this address.

##### Plex Version configuration

Theses configurations are used to download automatically `Plex Transcoder` and codecs from Plex.

| Variable     | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| plex_arch    | Should not be modified since only ubuntu is supported now.   |
| plex_build   | Full version number of Plex, can be found on download page.  |
| codecs_build | The version of the codecs, you can see it when you started PMS at least once in the Codecs folder of Plex.<br />In `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Codecs` the folder `e7828f1-1324-linux-ubuntu-x86_64` means that the version is `e7828f1-1324` |
| eae_version  | Version of EasyAudioEncoder, can be found in the same folder as the Codecs<br />`EasyAudioEncoder-141-linux-ubuntu-x86_64` => The version is `141` |

##### Performance configuration

In the performance section you cat set some limits that will be sent to the UnicornLoadBalancer. These limits are not hard limits. The UnicornLoadBalancer will be aware that the UnicornTranscoder is overloaded but can still send sessions if there is no other options.

| Variable      | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| maxSessions   | Maximum number of active sessions, it includes all active sessions, even if FFMPEG finished to transcode the file. |
| maxDownloads  | Maximum number of parallel download.                         |
| maxTranscodes | Maximum number of active transcoding session, it includes all pending transcoding jobs. |

#### Routing configuration _(Expert only)_

When a player will start a session, UnicornLoadBalancer will ask UnicornTranscoder where to redirect (302) the query based on the IP address of the client. The routing section allows you for a specific country code to route to a specific domain. For example you have a bad peering with a country, you can route the traffic to this country via CloudFlare and let others go through a direct routing domain.

```js
routing: {
    'US': 'https://cf-transcode1.myplex.com',
    'FR': 'https://transcode1.myplex.com'
},
```

In this sample configuration, every IP with a GeoIP country code `FR` will get a redirection (302) to `https://transcode1.myplex.com`, US IPs will go to `https://cf-transcode1.myplex.com`. All IPs that don't match any rules will use the default route configured with the `instance_address` variable.

##### Other configuration

All these configuration are for advanced users.

| Variable              | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| port                  | The port the UnicornTranscoder will listen                   |
| host                  | The host interface UnicornTranscoder will listen             |
| transcoder_decay_time | If a session isn't requested for this amount of time (in second) the session will be deleted and transcoded files deleted. |
| ping_frequency        | UnicornTranscoder will ping the UnicornLoadBalancer to update stats every `ping_frequency` seconds |

#### 3.2 Installation

* Install node dependencies with `npm install`
* Run `npm run install`, it will:
  * Pull and extract `Plex Media Server` from plex.tv
  * Pull Codecs from plex.tv
  * Build the GeoIP database

## Logging & Debug

To enable logging you have to set an environement variable called DEBUG. There is few scopes to allow a more or less verbose output. This environement variable allows wildcards. If you want a very verbose output you can set `DEBUG=*` and you will also have verbose logging for dependencies. If you want only UnicornTranscoder output, set `DEBUG=UnicornTranscoder*`

If you need to debug FFMPEG, set `TRANSCODER_DEBUG=true`, it will enable FFMPEG output and log transcoding arguments.

## Notes

#### SSL

The trancoder shouldn't serve the request directly, a reverse proxy such as nginx should be setup in front to install a SSL certificate.

#### FFMPEG from Source

You can compile FFMPEG, since the version of FFMPEG used by Plex is slightly different, you can follow this guide:
https://gist.github.com/drouarb/fb082c521d46aa43fdbb8cdc3d61ffbc

This can allow you to run the transcoder on an ARM based server.

Implementation of libx264 on other platform than x86_64 is not well optimized, you can see a performance gap.

### Disclamer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

__Pull Requests are welcome 😉__

