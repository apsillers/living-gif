console.log("hello", process.env['DISPLAY']);
const https = require("https");
const fs = require("fs");
const cp = require("child_process");
const express = require("express");
const GIFEncoder = require("gifencoder");
const { loadImage, createCanvas } = require('canvas');
const app = express();
const EventEmitter = require("events");

var dims = [400, 250];

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

// take screenshots every .25 secs
setInterval(function() {
        // `P` must be configed as print-screen button in Doom
        cp.exec("xdotool key p;");
}, 250)

// try pushing latest screenshot to all GIF streams
setInterval(function() {
    loadImage("/home/doom/DOOM00.png").then(function(image) {
        canvas.getContext("2d").drawImage(image, 0, 0, dims[0], dims[1]);
        redrawEmitter.emit("redraw");
        cp.exec("rm /home/doom/DOOM*.png;");
    }).catch(function(){});
}, 100)

// what keys can be passed to xdotools
var keys = ["Up", "Down", "Left", "Right", "Escape", "space", "Ctrl", "Return",>
// what keys are currenly being held down (for toggling state)
var downKeys = [];


app.get('/tap/:key', function(req, res) {
    var key = req.params.key;
    if(keys.includes(key)) {
        cp.execSync("xdotool key " + key);
        console.log("pressed " + key);
        downKeys = downKeys.filter(k=> k != key);
    }
    res.redirect("https://archiveofourown.org/works/31295183#game");
});

app.get('/toggle/:key', function(req, res) {
    var key = req.params.key;
    if(keys.includes(key)) {
        if(downKeys.includes(key)) {
            cp.execSync("xdotool keyup " + key);
            downKeys = downKeys.filter(k=> k != key);
        } else {
            cp.execSync("xdotool keydown " + key);
            downKeys.push(key);
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
