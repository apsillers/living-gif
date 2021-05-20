# Doom GIF server

## What is this?

This is an HTTP server that controls and streams an instance of Doom running concurrently on the same system. (Doom sold seperately.)

## How does it work?

* The HTTP server listens for key commands like `Up`, `Down`, `Ctrl`, `space`, etc. and uses `xdotool` to pass them to the running Doom instance.

* The HTTP server can also stream an incomplete GIF to anyone who asks at `/doom.gif`.

* The server periodically tells Doom to save a screenshot to `~/DOOM00.png`, and then it adds that image to all open GIF streams.

* You can embed the stream with `<img src=https://example.com:8444/doom.gif>` and add link controls like `<a href=https://example.com:8444/toggle/Up>Toggle Forward</a>`

* Tada! You're remotely streaming and controlling Doom!  

## Installation

1. Install these packages (check with your local package manager for avilability):

    * [`chocolate-doom`](https://www.chocolate-doom.org/wiki/index.php/Chocolate_Doom) for a runnable clone of Doom
    * [`freedoom`](https://freedoom.github.io/download.html) for WAD data files.
    * [`xdotool`](https://github.com/jordansissel/xdotool) which can fake keyboard input

2. Configure Doom:

    * to use `P` as the print-screen key, and
    * to capture screenshots as PNGs.
   
    You can do this in `chocolate-setup` or by adding these lines to `~/.local/gmaes/chocolate-doom/chocolate-doom.cfg`:

        key_menu_screenshot           25
        png_screenshots               1

4. If you are running this on a server without X11, you need to install X11 (I used `startxfce`), and probably install a VNC server. I recommend `tigervnc`, because I found that `tightvnc` did not work correctly with `xdotool`.

5. Optionally generate SSL keys (if using HTTPS) and point to them in the code. [`certbot`](https://certbot.eff.org/) is a free option for generating and signing keys.

6. Install `npm install gifencoder`.
 
7. Run `node doomgif.js` and `chocolate-doom -iwad [path to freedoom.wad]`. If you're running this in a non-graphical console, you will need to make sure to set the `DISPLAY=:1` environment variable for each so they share the same X display:

        DISPLAY=:1 chocolate-doom -iwad whatever/freedoom.wad
        
        DISPLAY=:1 node display.js
        # or if you run with sudo, pass through env with -E
        DISPLAY=:1 sudo -E node server.js
        
8. By default, the server runs on port 8444 for HTTPS or 8080 for HTTP, so go to https://127.0.0.1:8444/doom.gif or http://127.0.0.1:8080/doom.gif. You can change the port, or unncommet the plain-HTTP `app.listen(8080)` to use HTTP.
