# WebRTC Client

demo for webrtc


## directories

```
tree -L 2
.
├── Readme.md
├── meetting     # meeting
└── peer2peer    # peer2peer examples, sharing audio/video/desktop in realtime.
    ├── chrome   # raw html/js example
    └── electron # electron example
```

## how to use

### run SignalingChannel

```
git clone https://github.com/JarvisChu/SignalingChannel.git
cd SignalingChannel
./run.sh
```

### run WebRTCClient

**using peer2peer chome example**

```
cd peer2peer/chrome
open index.html in chrome
```

**using peer2peer electron example**

```
cd peer2peer/electron
cd electron && npm install && npm start
```

**using meeting chome example**

```
cd meeting/chrome
open index.html in chrome
```