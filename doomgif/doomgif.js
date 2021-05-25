/*
Copyright 2021 Andrew Sillers <apsillers@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
*/

console.log("Interacting with Doom on display ", process.env['DISPLAY']);

const https = require("https");
const fs = require("fs");
const cp = require("child_process");
const express = require("express");
const GIFEncoder = require("gifencoder");
const { loadImage, createCanvas } = require('canvas');
const app = express();
const EventEmitter = require("events");
EventEmitter.defaultMaxListeners = 0;

const HOME = "/home/doom";

//var dims = [282, 200];
var dims = [226, 160];

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

// whenever the user asks for /doom.gif...
app.get("/doom.gif", function(req, res) {
    // a little hack to make the next GIF encoder ahead of time before it's needed
    var encoder = nextEncoder;
    if(!encoder) { encoder = makeEncoder() }
    setTimeout(_=>nextEncoder = makeEncoder(), 0)

    // attach this GIF encoder to this HTTP response
    // so that whenever the encoder has new material it streams it out
    encoder.mystream.pipe(res);

    // whenever the image-reader signals it has a new image, add it to the GIF
    function doRedraw (){
        encoder.addFrame(canvas.getContext("2d"));
    };
    doRedraw();
    redrawEmitter.on("redraw", doRedraw)

    // when the HTTP client disconnnects, clean up that GIF to reduce memory usage
    res.on("close", _=>{
        redrawEmitter.removeListener("redraw", doRedraw);
        encoder.mystream.destroy();
        encoder.finish();
    })
});

// take screenshots by repeatedly pressing P
// `P` must be configed as the print-screen button in Doom
setInterval(function() {
        cp.exec("xdotool key p;");
}, 190);

// try pushing latest screenshot at ~/DOOM00.png to all GIF streams
setInterval(function() {
    loadImage(HOME + "/DOOM00.png").then(function(image) {
        //console.log("loaded", image);
        canvas.getContext("2d").drawImage(image, 0, 0, dims[0], dims[1]);
        redrawEmitter.emit("redraw");
        cp.exec("rm " + HOME + "/DOOM*.png;");
    }).catch(function(){});
}, 100)

// what keys are authorized to be passed to xdotools
var keys = ["Up", "Down", "Left", "Right", "Escape", "space", "Ctrl", "Return", "period", "comma"];
// what keys are currenly being held down (for toggling state)
var downKeys = [];
// whenever this button is pressed, release these other keys
var releaseKeys = {
    "Escape": ["Ctrl", "Up", "Down", "Left", "Right", "period", "comma", "space"],
    "period": ["comma"],
    "comma": ["period"],
    "Left": ["Right"],
    "Right": ["Left"]
}

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
        // key is no longer held down
        downKeys = downKeys.filter(k=> k != key);
    }
    res.redirect("https://archiveofourown.org/works/31295183#game");
});

// release named key in X11 and remove it from our list of pressed keys
function keyUp(key) {
    //console.log("releasing " + key);
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
            // push the key and add it to the list of held-down keys
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
      key: fs.readFileSync('/etc/letsencrypt/live/doomgif.apsillers.com/privkey.pem'),
      cert: fs.readFileSync('/etc/letsencrypt/live/doomgif.apsillers.com/fullchain.pem'),
    },
    app
  )
  .listen(8444, () => {
    console.log('Listening...')
  })

