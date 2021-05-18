console.log("hello", process.env['DISPLAY']);
const https = require("https");
const fs = require("fs");
const cp = require("child_process");
const express = require("express");
const GIFEncoder = require("gifencoder");
const { loadImage, createCanvas } = require('canvas');
const app = express();
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = 0;

var dims = [360, 225];

const redrawEmitter = new EventEmitter();
const canvas = createCanvas(dims[0], dims[1]);

function makeEncoder() {
    const encoder = new GIFEncoder(dims[0], dims[1]);
    encoder.mystream = encoder.createReadStream();
    encoder.start();
    encoder.setRepeat(-1);
    encoder.setDelay(0);
    encoder.setQuality(80);
    return encoder;
}
var nextEncoder = makeEncoder();

app.get("/doom.gif", function(req, res) {
    var encoder = nextEncoder;
    if(!encoder) { encoder = makeEncoder() }
    setTimeout(_=>nextEncoder = makeEncoder(), 0)

    encoder.mystream.pipe(res);

    function doRedraw (){
        encoder.addFrame(canvas.getContext("2d"));
    };

    doRedraw();
    redrawEmitter.on("redraw", doRedraw)

    res.on("close", _=>{
        redrawEmitter.removeListener("redraw", doRedraw);
        encoder.mystream.destroy();
        encoder.finish();
    })
});

// take screenshots every 200ms
setInterval(function() {
        // `P` must be configed as print-screen button in Doom
        cp.exec("xdotool key p;");
}, 200)

// try pushing latest screenshot to all GIF streams every 100ms
setInterval(function() {
    loadImage("/home/doom/DOOM00.png").then(function(image) {
        // draw screenshot to canvas
        canvas.getContext("2d").drawImage(image, 0, 0, dims[0], dims[1]);
        // tell all streams to redraw
        redrawEmitter.emit("redraw");
        // make way for the next screenshot
        cp.exec("rm /home/doom/DOOM*.png;");
    }).catch(function(){});
}, 100)

// what keys can be passed to xdotools
var keys = ["Up", "Down", "Left", "Right", "Escape", "space", "Ctrl", "Return", "period", "comma"];
// what keys are currenly being held down (for toggling state)
var downKeys = [];
// when this button is pressed, release these other keys
var releaseKeys = { "Escape": ["Ctrl", "Up", "Down", "Left", "Right", "period", "comma", "space"], "period":["comma"], "comma":["period"], "Left":["Right"], "Right":["Left"] }

// listen for `/tap/{key}` (nonce is always ignored)
app.get('/tap/:key/:nonce?', function(req, res) {
    var key = req.params.key;
    // only operate on approved keys
    if(keys.includes(key)) {
        // release any keys that should be released before pressing this key
        var keysToRelease = releaseKeys[key] || [];
        keysToRelease.forEach(keyUp);

        // tap the key
        cp.execSync("xdotool key " + key);
        console.log("pressed " + key);
        downKeys = downKeys.filter(k=> k != key);
    }
    res.redirect("https://archiveofourown.org/works/31295183#game");
});

// release named key in X11 and remove it from our list of pressed keys
function keyUp(key) {
    console.log("releasing " + key);
    cp.execSync("xdotool keyup " + key);
    downKeys = downKeys.filter(k=> k != key);
}

// listen for `/tap/{key}` (nonce is always ignored)
app.get('/toggle/:key/:nonce?', function(req, res) {
    var key = req.params.key;
    // only operate on approved keys
    if(keys.includes(key)) {
        if(downKeys.includes(key)) {
            // if the key is down, release it
            keyUp(key);
        } else {
            // going to press the key...
            // first release any keys that should be released before pressing this key
            var keysToRelease = releaseKeys[key] || [];
            keysToRelease.forEach(keyUp);
            // push the key
            downKeys.push(key);
            cp.execSync("xdotool keydown " + key);

        }
        console.log("toggled " + key);
    }
    res.redirect("https://archiveofourown.org/works/31295183#game");
});

app.get('/', function(req, res) {
    res.send("<img src='/doom.gif'>");
});

//app.listen(8080);

https
  .createServer(
    {
      key: fs.readFileSync('privkeyPATH')
      cert: fs.readFileSync('fullchainPATH')
    },
    app
  )
  .listen(8443, () => {
    console.log('Listening...')
  })
