# UnicornTranscoder 
### A Complete Walkthrough of the UnicornSuite

#### Use cases
On-Demand Transcoding is a particularly CPU intensive process. For lackluster rigs, Plex struggles when the number of on-demand transcodes increases. One solution is to use a GPU, which are much more efficient than CPUs for transcoding. For some, a GPU is too loud, hot, power-hungry, expensive, or all of these things. Instead, you might have several small devices or older devices that are under-utilized or not even used at all because they are old and outdated. For example, you might have several raspberry pi boxes around the house for home automation. There's usually a lot of left over resources on those little machines. Or you might have some old laptops with bad screens, broken keyboards, etc. These laptops, although not crazy powerful, still have some computing power left in them. 

Where UnicornTranscoder shines is the ability to harness these devices' computing resources for on-demand transcoding. 

The UnicornSuite consists of 3 tools:
1. A load balancer, which handles the transcode requests
2. A replacement binary for the Plex Transcode binary to gather the transcode arguments.
3. The transcoder itself.

#### How it works
1. The user send a request to the Plex server
2. The request is caught by the UnicornLoadBalancer
3. The UnicornLoadBalancer answers with an HTTP 302 with the URL of the UnicornTranscoder
4. The transcoder will send a request to the Plex Media Server
5. The Plex Server will launch the Plex Transcoder binary which is replaced by UnicornFFMPEG
6. UnicornFFMPEG sends the arguments to the UnicornLoadBalancer
7. UnicornTranscoder pulls the FFMPEG arguments from UnicornLoadBalancer
8. UnicornTranscoder launches FFMPEG and serves the request for the stream directly to the client.

As you can see, there is no limit to the amount of "nodes" you can add to the transcoding cluster. The loadbalancer distributes the transcoding jobs across all of the nodes seamlessly. Another benefit is the stream itself is served from the node itself (UnicornTranscoder). So you can even use nodes to distribute your plex traffic and take the load off your home network bandwidth. 

#### Assumptions
1. You have working linux Plex Server or can set up one quickly with no further instruction. In this guide, we'll be covering PMS deployed in a container. 
2. You have a working reverse proxy with SSL. In this guide, we'll be using nginx.
3. All nodes (UnicornTranscoders) have access to the source media files. This can be accomplish several different ways. Most people will use NFS, SMB, iSCSI, or some other network filesystem protocol tool (such as rclone). 
4. All nodes need to have the media located in the same location. If your files are located at `/home/user/media/`, plex must have the source files at that location as well. The nodes must also have the files in `/home/user/media`. This is explained later in the tutorial. 

Let's get to it.

-----

#### Plex Configuration
If you're running plex in a container, you have the config library mounted to host filesystem. In this example, this path is: `/root/docker/plexv2/config/`. In this folder is Library folder used for Plex configuration and operation. Take note of this path.
Your media folder needs to be mounted into the container using the host path. For example 
```
- /home/user/media:/media
```
will not work. When Plex looks up a media file, it will look for `/media/file.mp4`. This file does not exist on the host, which is the perspective of the loadbalancer and transcoder. So, you'll need to mount the host file into plex like this:
```
- /home/user/media:/home/user/media
```
The next step is to add a media library (or edit if you've already configured libraries using the old `/media` path). Once the library is refreshed and the media is available in Plex, we can move on to the next step. 

-----

#### Configure UnicornLoadBalancer
In this guide, we'll be installing all unicorn products into `/opt`. We'll also be running commands as root, but as a best practice, don't run as root in production. Using root allows us to learn the process. Once a full knowledge of the suite is achieved, go back and run unicorn with the least amount of privileges. 
Required Software:
* NPM/Nodejs
* git
You can run Unicorn with Redis, but for a small plex setup with a handful of user/shared accounts, using the built-in sqlite.db will suffice.

If you do not have NPM/Nodejs, follow this guide: https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-debian-10

To install and configure UnicornLoadBalancer, do the following:
1. `cd /opt`
2. `git clone https://github.com/UnicornTranscoder/UnicornLoadBalancer.git`
3. `cd UnicornLoadBalancer`
4. `npm install`

At this point, it's important to note that UnicornLoadBalancer is configured with Environment Variables. You can either set those variables globally, or you can specify them when you run npm. This guide will show you how to run the UnicornSuite as systemd services, which will run in the background on boot. Here are the required variables and their explanation:

| Name | Description | Type | Default |
| ----------------- | ------------------------------------------------------------ | ------| ------- |
| **SERVER_PORT** | Port used by the *UnicornLoadBalancer* | `int` | `3001` |
| **SERVER_PUBLIC** | Public url where the *UnicornLoadBalancer* can be called, **with** a slash at the end. If using transcoders not on the same subnet (i.e.. in a different location), use an FQDN with SSL. | `string` | `https://UnicornLoadBalancer.example.com/` |
| **PLEX_HOST** | Host to access to Plex. It is strongly recommended that you install the LoadBalencer on the same host as Plex. | `string` | `127.0.0.1` | 
| **PLEX_PORT** | Port used by Plex | `int` | `32400` | 
| **PLEX_PATH_USR** | The Plex binaries path. Most mainstream plex containers use `/usr/lib/plexmediaserver/` | `string` | `/usr/lib/plexmediaserver/` | 
| **PLEX_PATH_SESSIONS** | The host path where Plex store sessions (to grab external subtitles). Reference the path noted earlier in the tutorial | `string` | `/root/docker/plexv2/config/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions` | 
| **DATABASE_MODE** | Kind of database to use with Plex, can be `sqlite` or `postgresql` | `string` | `sqlite` |
| **DATABASE_SQLITE_PATH** | The path of the Plex database | `string` | `/root/docker/plexv2/config/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db` |
| **CUSTOM_SCORES_TIMEOUT** | Seconds to consider a not-pinged server as unavailable | `int` | `10` | 
| **CUSTOM_DOWNLOAD_FORWARD** | Enable or disable 302 for download links and direct play, if enabled, transcoders need to have access to media files. Consider changing to true for your needs. | `bool` | `false` | 

A proper environment variable list would look like this:
```
SERVER_PORT=3001
SERVER_PUBLIC=https://UnicornLoadBalancer.example.com/
PLEX_HOST=127.0.0.1
PLEX_PORT=32400
PLEX_PATH_USR=/root/docker/plexv2/config
"PLEX_PATH_SESSIONS=/root/docker/plexv2/config/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions"
"DATABASE_SQLITE_PATH=/root/docker/plexv2/config/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db"
DATABASE_MODE=sqlite
CUSTOM_SCORES_TIMEOUT=10
CUSTOM_DOWNLOAD_FORWARD=false
```
To run this configured LoadBalencer, let's create a service. On Debian, that's systemd:
1. `nano /etc/systemd/system/UnicornLoadBalancer.service`
2. Past the following into the nano editor. When finished, save and close it (ctrl-o and ctrl-x)
```
[Unit]
Description=UnicornLoadBalancer
Documentation=https://github.com/UnicornTranscoder/UnicornLoadBalancer
After=network.target

[Service]
Restart=on-abnormal
Type=simple

User=root
Group=root

Environment=SERVER_PORT=3001
Environment=SERVER_PUBLIC=https://UnicornLoadBalancer.example.com/
Environment=PLEX_HOST=127.0.0.1
Environment=PLEX_PORT=32400
Environment=PLEX_PATH_USR=/root/docker/plexv2/config
Environment="PLEX_PATH_SESSIONS=/root/docker/plexv2/config/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions"
Environment="DATABASE_SQLITE_PATH=/root/docker/plexv2/config/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db"
Environment=DATABASE_MODE=sqlite
Environment=CUSTOM_SCORES_TIMEOUT=10
Environment=CUSTOM_DOWNLOAD_FORWARD=false

WorkingDirectory=/opt/UnicornLoadBalancer/
ExecStart=/usr/bin/npm start

KillMode=mixed
KillSignal=SIGQUIT
TimeoutStopSec=5s

LimitNOFILE=1048576
LimitNPROC=512

NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```
3. Enable the service on boot: `systemctl enable UnicornLoadBalancer.service`
4. Start the service: `systemctl start UnicornLoadBalancer.service`
5. Check if the service is running properly: `systemctl status UnicornLoadBalancer.service`. You should see output similar to this:
```
● UnicornLoadBalancer.service - UnicornLoadBalancer
   Loaded: loaded (/etc/systemd/system/UnicornLoadBalancer.service; enabled; vendor preset: enabled)
   Active: active (running) since Mon 2020-08-03 15:09:13 CDT; 1h 33min ago
     Docs: https://github.com/UnicornTranscoder/UnicornLoadBalancer
 Main PID: 11001 (node)
    Tasks: 30 (limit: 4915)
   Memory: 72.4M
   CGroup: /system.slice/UnicornLoadBalancer.service
           ├─11001 npm
           ├─11012 sh -c cross-env DEBUG=* node index.js
           ├─11013 node /opt/UnicornLoadBalancer/node_modules/.bin/cross-env DEBUG=* node index.js
           └─11020 node index.js
```
6. Quickly test that the loadbalancer is up by navigating to the ip:port (127.0.0.1:3001). It should present you with the standard plex media page. 
7. Configure Nginx to reverse proxy the loadbalancer FQDN. You can find examples of an Nginx configuration here: https://github.com/UnicornTranscoder/Nginx
8. Configure Plex Media Server access address
    * Under Settings -> Server -> Network
    * Set Custom server access URLs to the address to access the UnicornLoadBalancer (ie. https://unicornloadbalancer.example.com)
9. Disable the Plex Relay option
    * Under Settings -> Server -> Network
10. Disable outside access to the plex port
    * All requests to the Plex Media Server should pass through the UnicornLoadBalancer.
    * If a user reaches the server directly, the user will not be able to start a stream, since the FFMPEG transcoder built-in to Plex will eventually be replaced by Unicorn's Transcoder. 
    * To ensure users always hit the loadbalancer, configure IPTables to drop traffic destined to 32400 from outside your plex machine (drop traffic coming in through the physical nic). You'll need to install iptables-persistent, a package that persists ip tables across reboots, and then set your iptables rule. You must specify your interface, or else 32400 will be dropped completely, even for localhost access, and the loadbalancer will not work. 
        * `apt-get install -y iptables-persistent`
        * `iptables -A INPUT -p tcp --dport 32400 -i [your-network-interface] -j DROP`

-----

#### Configure UnicornFFMPEG
UnicornFFMPEG will replace the Plex built-in transcoder. To build UnicornFFMPEG, complete the following steps:
1. `cd /opt`
2. `git clone https://github.com/UnicornTranscoder/UnicornFFMPEG.git`
3. `cd UnicornFFMPEG`
4. `npm install`
5. `LB_URL=UnicornLoadBalancer.example.com npm start`
    * This will override the default localhost:port option with the FQDN of the loadbalancer. This environment variable is required for a working setup. 
    * After this npm command finishes, a new Plex Transcoder binary will be saved to the ./bin folder of the repository. Copy the linux binary to your plex docker folder (or anywhere you want). In this example we're copying it to `/root/docker/plexv2/binaries/Plex Transcoder-linux`.

In order to replace the built-in transcoder with this new one, we need to mount it into our plex container. Simply add the following mount to your plex container:
```
- "/root/docker/plexv2/binaries/Plex Transcoder-linux:/usr/lib/plexmediaserver/Plex Transcoder"
```
where `/usr/lib/plexmediaserver` is the binary location. Most mainstream plex containers use this path, such as the container released by LinuxServier.io. 

With that new volume/file mount, restart plex to replace the built-in transcoder with the "fake" transcoder that interprets the transcode arguments.

-----

#### Configure UnicornTranscoder
The UnicornTranscoder is where the actual magic of transcoding and serving a stream happens. This is the portion of software that you'll replicate on multiple nodes to distribute the transcoding jobs. Each node, or unicorntranscoder, will "check in" with the loadbalancer. The loadbalancer will then distribute the transcode, sessions, and downloads accordingly. 

To install UnicornTranscoder, we will again configure it with envrionment variables. Since our example uses systemd service, we won't set them as global variables. The default variables are set in the `config.js` file. We'll override a few of them with our systemd Environment variables. 

So, to install and configure UnicornTranscoder, complete the following steps:
1. `cd /opt`
2. `git clone https://github.com/UnicornTranscoder/UnicornTranscoder.git`
3. `cd UnicornTranscoder`
4. `npm install`
5. `npm run install`

The transcoder is now ready to run. Just like the loadbalancer, we're going to run this as a service. Be sure to substitute the envrionment variables for your own setup/FQDN:
1. `nano /etc/systemd/system/unicorntranscoder.service`
```
[Unit]
Description=UnicornTranscoder
Documentation=https://github.com/UnicornTranscoder/UnicornTranscoder
After=network.target

[Service]
Restart=on-abnormal
Type=simple

User=root
Group=root

Environment=TRANSCODER_DEBUG=true
Environment=DEBUG=UnicornTranscoder*
Environment=LOADBALANCER_ADDRESS=https://unicornloadbalancer.example.com
Environment=INSTANCE_ADDRESS=https://unicorntranscoder.example.com

WorkingDirectory=/opt/UnicornTranscoder/
ExecStart=/usr/bin/npm start

KillMode=mixed
KillSignal=SIGQUIT
TimeoutStopSec=5s

LimitNOFILE=1048576
LimitNPROC=512

NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```
\* This assumes you accept all other default variables in `config.js`. Look them over to make sure they are correct for your loadbalancer/transcoder settings. For example, make sure the ports match your earlier config of the loadbalancer. Be sure to set the number of max sessions, transcodes, and downloads. For lower spec machines, running the default 10 transcodes is not realistic, so set the number either in `config.js` or in your service file.

2. `systemctl enable unicorntranscoder.service`
3. `systemctl start unicorntranscoder.service`
4. `systemctl status unicorntranscoder.service`

If the output of of the status command shows active, the next step is to set up nginx for the transcoder. You can find examples of an Nginx configuration here: https://github.com/UnicornTranscoder/Nginx. 

\* Note:
If you want to adjust the envrionment variables in `config.js`, make sure you re-run the npm build with `npm install` & `npm run install`. If you opt to override these variables in the service (like we did above), edit the service file. If you edit a service after it has already been loaded, you need to reload the daemon with `systemctl daemon-reload` & `systemctl restart unicorntranscoder.service`. As a rule of thumb, if you use service environment variables, don't edit the config.js variables (or vice versa). Keep all your variable definitions in the same place. 

Once the FQDN is up and active with working SSL, point your browser to it. It will look something like this:
![](/images/UnicornTranscoder.png?raw=true)

If everything is configured properly, you should now be able to navigate to your loadbalancer address and test a video transcode. If it is successful, test next with an official plex app. If that works, try testing both off network and see if your network settings are correct. 

And that's it! A full walkthrough of how it install Unicorn Transcoder. You can now deploy UnicornTranscoder on as many nodes as you have available. You only need to do the Transcoder (and not the FFMPEG/LoadBalancer) for additional nodes, so deployment will be very quick!
