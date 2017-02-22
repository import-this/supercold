/**
 * SUPERCOLD
 * https://import-this.github.io/supercold
 *
 * A simple and crude 2D HTML5 game with the clever mechanics of SUPERHOT.
 * (You can check out SUPERHOT @ http://superhotgame.com/)
 *
 * Copyright (c) 2017, Vasilis Poulimenos
 * Released under the BSD 3-Clause License
 * https://github.com/import-this/supercold/blob/master/LICENSE
 *
 * Supported browsers (as suggested by online references):
 *     IE 9+, FF 4+, Chrome 5+, Opera 11.60+, SF 5+
 *
 * Also, note the Phaser requirements:
 *     https://github.com/photonstorm/phaser#requirements
 * especially the polyfill for IE9:
 *     https://github.com/photonstorm/phaser#ie9
 * (Phaser provides some polyfills, e.g. rAF and Function.prototype.bind.)
 *
 * The code follows the conventions of Google JavaScript Style Guide,
 *     with some alterations. The style guide is described in depth here:
 *     https://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml
 * Comments follow the conventions of JSDoc. Documentation can be found here:
 *     http://usejsdoc.org/
 *
 * Date: 15/2/2017
 * @version: 1.1.0
 * @author Vasilis Poulimenos
 */

/*globals Phaser */
(function(window, Phaser) {

"use strict";

/**
 * Don't forget to set this to false in production!
 * @const
 */
var DEBUG = false;

function noop() {}

/******************************* Basic Logging ********************************/

/** @const */
var log = (function() {
    var console = window.console;

    if (console && console.log) {
        // Don't simply return console.log, because that messes up 'this'.
        return function log(msg) {console.log(msg); };
    }
    return noop;
}());

/******************************* Local Storage ********************************/

/*
 * https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage
 * http://dev.w3.org/html5/webstorage/
 */

/**
 * The version number. Useful for marking changes in the storage format.
 * @const {string}
 */
var VERSION = '1.0.0';

/**
 * Local storage is per origin (per domain and protocol),
 * so use a prefix to avoid collisions with other games.
 * @const {string}
 */
var PREFIX = 'supercold_';

/**
 * Storage keys.
 * @const {object}
 */
var Keys = {
    VERSION: PREFIX + 'version',

    LEVEL: PREFIX + 'level',
    TIMES: PREFIX + 'times',
    MUTATORS: PREFIX + 'mutators',
    RNDSTATE: PREFIX + 'rndstate'
};

/**
 * @const {object}
 */
var MSGS = {
    NAN: 'Argument cannot be interpreted as a number',
    NEG: 'Negative argument'
};

/**
 * A storage manager for the game.
 * Manages local storage.
 *
 * @param {Storage} [localStorage=window.localStorage] - The local storage.
 * @constructor
 */
function GameStorageManager(localStorage) {
    this.localStorage = localStorage || window.localStorage;

    // If the storage uses an old version, erase everything to avoid errors.
    if (this.load(Keys.VERSION) !== VERSION) {
        if (DEBUG) log('Clearing storage...');
        this.clear();
        this.save(Keys.VERSION, VERSION);
    }

    this.saveLevel(this.load(Keys.LEVEL) || 1);
    this.saveTimes(this.load(Keys.TIMES) || 0);
}

/**
 * Clears the local storage.
 */
GameStorageManager.prototype.clear = function() {
    this.localStorage.clear();
};

GameStorageManager.prototype.save = function(key, value) {
    this.localStorage.setItem(key, value);
};
GameStorageManager.prototype.load = function(key) {
    return this.localStorage.getItem(key);
};

/**
 * Sets the last level that the player played.
 *
 * @param {number} level - The new level.
 * @throws {TypeError} if the parameter cannot be interpreted as a number.
 * @throws {RangeError} if the new level is negative.
 */
GameStorageManager.prototype.saveLevel = function(level) {
    level = Number(level);
    if (isNaN(level)) {
        throw new TypeError(MSGS.NAN);
    }
    if (level < 0) {
        throw new RangeError(MSGS.NEG);
    }
    this.save(Keys.LEVEL, level);
};
/**
 * Returns the last level that the player played.
 * @return {number} The level.
 */
GameStorageManager.prototype.loadLevel = function() {
    return Number(this.load(Keys.LEVEL));
};

GameStorageManager.prototype.saveTimes = function(times) {
    this.save(Keys.TIMES, times);
};
GameStorageManager.prototype.loadTimes = function() {
    return Number(this.load(Keys.TIMES));
};

GameStorageManager.prototype.saveMutators = function(mutators) {
    this.save(Keys.MUTATORS, JSON.stringify(mutators));
};
GameStorageManager.prototype.loadMutators = function() {
    return JSON.parse(this.load(Keys.MUTATORS));
};

GameStorageManager.prototype.saveRndState = function(state) {
    this.save(Keys.RNDSTATE, state);
};
GameStorageManager.prototype.loadRndState = function() {
    return this.load(Keys.RNDSTATE);
};

/********************************* Supercold **********************************/

/**
 * Some module-level global settings for our Phaser game.
 * @const
 */
var CLEAR_WORLD = true,
    CLEAR_CACHE = false,
    /**
     * Use the more expensive but powerful P2 physics system. The others don't cut it.
     * Note: When a game object is given a P2 body, it has its anchor set to 0.5.
     */
    PHYSICS_SYSTEM = Phaser.Physics.P2JS,

    /**
     * Constants for the Phaser.Cache.
     */
    CACHE = {
        /**
         * Identifiers for assets in the Phaser.Cache.
         */
        KEY: {
            PLAYER: 'player',
            BOT: 'bot',
            BULLET: 'bullet',
            TRAIL: 'trail',
            BG: 'background',
            FLASH: 'flash',
            OVERLAY_DARK: 'overlay_dark',
            OVERLAY_LIGHT: 'overlay_light'
        }
    },

    DEBUG_POSX = 32;

/*
 * Note: All dimensions/lengths/distances are measured in pixels.
 *       It's probably best to keep all these values round.
 */

/**
 * The screen ratio for most devices is 16/9,
 * so let's pick a corresponding resolution.
 * http://www.w3schools.com/browsers/browsers_display.asp
 * https://www.w3counter.com/globalstats.php
 * @const
 */
var NATIVE_WIDTH = 1366,
    NATIVE_HEIGHT = 768,
    // Enough padding so that the player is always centered.
    PADDING = {
        width: Math.round(NATIVE_WIDTH / 2),
        height: Math.round(NATIVE_HEIGHT / 2)
    },

    CELLDIM = 40,

    FACTOR_SLOW = 10,
    FACTOR_SLOWER = 40,
    FACTOR_FROZEN = 192,

    PLAYER_SPEED = 300,
    BOT_SPEED_NORMAL = PLAYER_SPEED,
    BULLET_SPEED_NORMAL = PLAYER_SPEED * 5;


/**
 * The Supercold namespace.
 * @namespace
 */
var Supercold = {
    /**
     * Cell dimensions (square).
     */
    cell: {
        width: CELLDIM,
        height: CELLDIM
    },
    /**
     * Supercold world size (aspect ratio 4:3).
     */
    world: {
        // Too large, so it takes a bit to load!
        //width: CELLDIM * 64,      // 2560
        //height: CELLDIM * 48      // 1920
        //width: CELLDIM * 60,      // 2400
        //height: CELLDIM * 42      // 1800
        width: CELLDIM * 56,        // 2240
        height: CELLDIM * 42        // 1680
    },

    /**
     * Sprite properties.
     *
     * Note:
     * To avoid single-pixel jitters on mobile devices, it is strongly
     * recommended to use Sprite sizes that are even on both axis.
     */
    player: {
        radius: 25,
        sideLen: 16
    },
    bullet: {
        width: 16,
        height: 8,
        bodyLen: 8,
        tipRadius: 4
    },
    minimap: {
        width: 200,
        height: 150
    },
    bar: {
        width: 200,
        height: 10
    },

    speeds: {
        player: PLAYER_SPEED,
        bot: {
            normal: PLAYER_SPEED,
            slow: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOW),
            slower: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOWER),
            frozen: Math.round(BOT_SPEED_NORMAL / FACTOR_FROZEN)
        },
        bullet: {
            normal: BULLET_SPEED_NORMAL,
            slow: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOW),
            slower: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOWER),
            frozen: Math.round(BULLET_SPEED_NORMAL / FACTOR_FROZEN)
        }
    },

    // 2 times per second
    fireRate: 1 / 2,
    fastFireRate: 1 / 4,

    hotswitchTimeout: 2.5,
    superhotswitchTimeout: 0.5,

    bigheadScale: 1.5,
    chibiScale: 0.667,

    /**
     * Styling options.
     */
    style: {
        stage: {
            backgroundColor: 'rgb(10, 10, 10)'
        },
        background: {
            lightColor: 'rgb(150, 150, 150)',
            darkColor: 'rgb(64, 64, 64)'
        },
        overlay: {
            lightColor: 'rgba(32, 32, 32, 0.475)',
            darkColor: 'rgba(0, 0, 0, 0.675)'
        },
        player: {
            color: 'rgb(34, 34, 34)',
            strokeStyle: 'rgba(44, 44, 44, 0.95)',
            lineWidth: 6,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(242, 238, 238, 0.95)',
            shadowBlur: 12
        },
        bot: {
            color: 'rgb(255, 34, 33)',
            strokeStyle: 'rgba(34, 34, 34, 0.95)',
            lineWidth: 6,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(255, 34, 33, 0.9)',
            shadowBlur: 6
        },
        minimap: {
            background: {
                color: 'rgba(40, 40, 40, 0.5)'
            },
            border: {
                color: 'rgba(64, 64, 64, 0.85)',
                lineWidth: 5
            },
            innerBorder: {
                color: 'rgba(64, 64, 64, 0.75)',
                lineWidth: 2
            },
            player: {
                radius: 4,
                color: 'rgb(34, 34, 34)',
                strokeStyle: 'rgba(44, 44, 44, 0.95)',
                lineWidth: 1.5
            },
            bot: {
                radius: 4,
                color: 'rgb(255, 34, 33)',
                strokeStyle: 'rgba(34, 34, 34, 0.95)',
                lineWidth: 1.5
            }
        },
        bulletBar: {
            color: 'rgba(25, 28, 30, 0.9)'
        },
        hotswitchBar: {
            color: 'rgba(250, 0, 0, 0.9)'
        },
        bullet: {
            color: 'rgb(30, 35, 38)'
        },
        trail: {
            x1: 0,
            y1: 0,
            x2: 400,
            y2: 0,
            colorStops: [
                { stop: 0.0, color: 'rgba(255, 34, 33, 0.00)' },
                { stop: 0.1, color: 'rgba(255, 34, 33, 0.10)' },
                { stop: 0.8, color: 'rgba(255, 34, 33, 0.85)' },
                { stop: 0.9, color: 'rgba(255, 34, 33, 0.95)' },
                { stop: 1.0, color: 'rgba(255, 34, 33, 0.85)' }
            ],
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(255, 34, 33, 0.85)',
            shadowBlur: 5
        },
        grid: {
            color1: 'rgba(255, 245, 245, 0.85)',
            color2: 'rgba(245, 245, 255, 0.85)',
            colorOuter: 'rgba(255, 34, 33, 0.925)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor1: 'rgba(220, 55, 55, 0.15)',
            shadowColor2: 'rgba(240, 240, 255, 0.55)',
            shadowColorOuter: 'rgba(255, 34, 33, 0.925)',
            shadowBlur: 1
        },
        lines: {
            color: 'rgba(42, 65, 71, 0.0975)',
            lineWidth: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(226, 220, 220, 0.75)',
            shadowBlur: 2,
            angle: Math.PI / 4
        },
        /* spots: [{
            colorStops: [
                { stop: 0.00, color: 'rgba(254, 254, 254, 0.90)' },
                { stop: 1.00, color: 'rgba(191, 234, 240, 0.00)' }
            ]
        }, {
            colorStops: [
                { stop: 0.00, color: 'rgba(17, 15, 18, 0.60)' },
                { stop: 0.25, color: 'rgba(33, 60, 71, 0.60)' },
                { stop: 1.00, color: 'rgba(73, 142, 157, 0.05)' },
            ]
        }], */
        flash: {
            colorStops: [
                { stop: 0.0, color: 'rgba(255, 255, 255, 0.3)' },
                { stop: 0.4, color: 'rgba(245, 255, 255, 0.6)' },
                { stop: 0.5, color: 'rgba(240, 251, 255, 0.7)' },
                { stop: 0.6, color: 'rgba(245, 255, 255, 0.8)' },
                { stop: 1.0, color: 'rgba(255, 255, 255, 1.0)' }
            ]
        },
        superhot: {
            font: 'Arial',
            fontSize: '275px',
            fontWeight: 'normal',
            fill: 'rgb(245, 251, 255)',
            boundsAlignH: 'center',
            boundsAlignV: 'middle',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(215, 251, 255, 0.85)',
            shadowBlur: 8
        }
    },
    /**
     * Custom styling options for individual words.
     */
    wordStyles: {
        'SUPER': {
            fontWeight: 'lighter',
            shadowBlur: 18,
            shadowColor: 'rgba(210, 250, 255, 0.9)'
        },
        'HOT': {
            fontWeight: 'bolder',
            shadowColor: 'rgba(215, 251, 255, 0.925)',
            shadowBlur: 20
        },
        'COLD': {
            fontWeight: 'bolder',
            shadowColor: 'rgba(210, 250, 255, 0.95)',
            shadowBlur: 24
        },
        'YOU': {
            fontWeight: 'bold',
            //fill: 'rgb(249, 19, 21)',
            //shadowColor: 'rgba(251, 81, 81, 0.95)'
            fill: 'rgb(34, 34, 34)',
            shadowColor: 'rgba(48, 48, 48, 0.95)',
            shadowBlur: 12
        },
        'LEVEL': {
            fontWeight: 'bold'
        }
    },

    /**
     * Keyboard Controls.
     */
    controls: {
        WASD: {
            'up': Phaser.KeyCode.W,
            'left': Phaser.KeyCode.A,
            'down': Phaser.KeyCode.S,
            'right': Phaser.KeyCode.D
        },
        fireKey: Phaser.KeyCode.SPACEBAR,
        quitKey: Phaser.KeyCode.ESC,
        restartKey: Phaser.KeyCode.BACKSPACE
    },

    texts: {
        SUPERHOT: 'SUPER HOT',
        SUPERCOLD: 'SUPER COLD',
        MECHANICS: 'TIME MOVES WHEN YOU MOVE',
        LEVEL: 'LEVEL'
    }
};


if (DEBUG) {
    // Freeze objects in DEBUG mode to detect erroneous overriding,
    // but leave them open for modification in production code.
    if (Object.freeze) {
        (function recursiveFreeze(obj) {
            var prop;

            for (prop in obj) {
                if (typeof obj[prop] === 'object') {
                    Object.freeze(obj[prop]);
                    recursiveFreeze(obj[prop]);
                }
            }
        }(Supercold));
    }
}


Supercold.GameStorageManager = GameStorageManager;

/******************************* Utilities ********************************/

function makeBitmapData(game, width, height, key, addToCache) {
    if (addToCache === undefined) addToCache = true;

    // Note: To avoid single-pixel jitters on mobile devices, it is strongly
    // recommended to use Sprite sizes that are even on both axis.
    if (DEBUG && (width % 2 === 1 || height % 2 === 1)) {
        log('WARN: Sprite with odd dimension!');
    }
    // 'add.bitmapData' does the same thing as 'make.bitmapData',
    // i.e. it doesn't actually add the bitmapData object to the world.
    // (BitmapData's are Game Objects and don't live on the display list.)
    return game.make.bitmapData(width, height, key, addToCache);
}


function addColorStops(grd, colorStops) {
    var i, colorStop;

    for (i = 0; i < colorStops.length; ++i) {
        colorStop = colorStops[i];
        grd.addColorStop(colorStop.stop, colorStop.color);
    }
    return grd;
}

function createLinearGradient(ctx, x1, y1, x2, y2, colorStops) {
    return addColorStops(
        ctx.createLinearGradient(x1, y1, x2, y2), colorStops);
}

function createRadialGradient(ctx, x1, y1, r1, x2, y2, r2, colorStops) {
    return addColorStops(
        ctx.createRadialGradient(x1, y1, r1, x2, y2, r2), colorStops);
}


/**
 * Sets the scale object specified such that it will fill the screen, but
 * crop some of the top/bottom or left/right sides of the playing field.
 * http://stackoverflow.com/a/33517425/1751037
 *
 * @param {Phaser.Point} scale - the scale object to set
 * @param {number} width - the target width
 * @param {number} height - the target height
 * @param {number} [nativeWidth=NATIVE_WIDTH] - the native width of the game
 * @param {number} [nativeHeight=NATIVE_HEIGHT] - the native height of the game
 */
function scaleToFill(scale, width, height, nativeWidth, nativeHeight) {
    nativeWidth = nativeWidth || NATIVE_WIDTH;
    nativeHeight = nativeHeight || NATIVE_HEIGHT;
    scale.setTo(Math.max(width / nativeWidth, height / nativeHeight));
}

/**
 * Sets the scale object specified such that it will fit the screen,
 * but have some extra space on the top/bottom or left/right sides.
 * http://stackoverflow.com/a/33517425/1751037
 *
 * @param {Phaser.Point} scale - the scale object to set
 * @param {number} width - the target width
 * @param {number} height - the target height
 * @param {number} [nativeWidth=NATIVE_WIDTH] - the native width of the game
 * @param {number} [nativeHeight=NATIVE_HEIGHT] - the native height of the game
 */
function scaleToFit(scale, width, height, nativeWidth, nativeHeight) {
    nativeWidth = nativeWidth || NATIVE_WIDTH;
    nativeHeight = nativeHeight || NATIVE_HEIGHT;
    scale.setTo(Math.min(width / nativeWidth, height / nativeHeight));
}

function scaleTextToFit(game, text) {
    // Force the text to always fit the screen (factor * game.width/height).
    // Use text.texture, since text.width/height takes into account scaling.
    // Notice the factor for text.height. Height measuring for text is not
    // accurate, so Phaser ends up with a height larger than the actual one.
    scaleToFit(text.scale,
               Math.round(0.9 * game.width),
               Math.round(0.9 * game.height),
               text.texture.width,
               Math.round(text.texture.height / 1.4));
    // Undo the camera scaling that will be applied by Phaser.
    text.scale.divide(game.camera.scale.x, game.camera.scale.y);
}

function centerToCamera(game, sprite) {
    sprite.x = game.camera.view.halfWidth;
    sprite.y = game.camera.view.halfHeight;
    // Reset 'fixedToCamera', so as to recalculate 'cameraOffset'.
    sprite.fixedToCamera = true;
    if (DEBUG) log('Centered ' + ((sprite.name) ? sprite.name : 'sprite'));
}


/**
 * An image that is always centered in the camera view.
 */
function CenteredImage(game, key) {
    Phaser.Image.call(this, game, 0, 0, key);

    this.name = 'CenteredImage';
    this.anchor.set(0.5);

    this._resize();
    this.game.scale.onSizeChange.add(this._resize, this);
}

CenteredImage.prototype = Object.create(Phaser.Image.prototype);
CenteredImage.prototype.constructor = CenteredImage;

CenteredImage.prototype._resize = function() {
    centerToCamera(this.game, this);
};

CenteredImage.prototype.destroy = function() {
    this.game.scale.onSizeChange.remove(this._resize, this);
    Phaser.Image.prototype.destroy.call(this);
};

/**
 * Text that is always centered in the camera view.
 */
function CenteredText(game, text, style) {
    Phaser.Text.call(this, game, 0, 0, text, style);

    this.name = '"' + text + '"';
    this.anchor.set(0.5);

    this._resize();
    this.game.scale.onSizeChange.add(this._resize, this);
}

CenteredText.prototype = Object.create(Phaser.Text.prototype);
CenteredText.prototype.constructor = CenteredText;

CenteredText.prototype._resize = function() {
    centerToCamera(this.game, this);
};

CenteredText.prototype.destroy = function() {
    this.game.scale.onSizeChange.remove(this._resize, this);

    Phaser.Text.prototype.destroy.call(this);
};

/**
 * Text that is scaled and always centered in the camera view.
 */
function ScaledCenteredText(game, text, style) {
    CenteredText.call(this, game, text, style);
}

ScaledCenteredText.prototype = Object.create(CenteredText.prototype);
ScaledCenteredText.prototype.constructor = ScaledCenteredText;

ScaledCenteredText.prototype._resize = function() {
    scaleTextToFit(this.game, this);
    CenteredText.prototype._resize.call(this);
};


function getOverlayBitmap(game, color) {
    switch (color) {
        case 'light':
            return game.cache.getBitmapData(CACHE.KEY.OVERLAY_LIGHT);
        case 'dark':
            /* falls through */
        default:
            return game.cache.getBitmapData(CACHE.KEY.OVERLAY_DARK);
    }
}

function newOverlay(game, color) {
    return new CenteredImage(game, getOverlayBitmap(game, color));
}


/**
 * An object that displays messages to the player.
 *
 * @param {Array.<string>} text - The message (word/phrase) to display.
 * @param {object} [options] - A customization object.
 * @param {number} [options.initDelay=0] - How long to wait before starting.
 * @param {number} [options.nextDelay=550] - How long to wait before showing the next word.
 * @param {number} [options.finalDelay=options.nextDelay] - How long to wait before showing the message again.
 * @param {number} [options.duration=450] - How long the animation for each word will last.
 * @param {number} [options.flashOnDuration=25] - How long it will take to turn the flash on.
 * @param {number} [options.flashOffDuration=400] - How long it will take to turn the flash off.
 * @param {number} [options.flashTint=0xFFFFFF] - A tint to change the color of the flash.
 * @param {boolean} [options.repeat=false] - Repeat the announcement forever.
 * @param {boolean} [options.overlay=false] - Add a layer between the game and the text.
 * @param {string}  [options.overlayColor='dark'] - 'light' or 'dark' shade.
 * @param {function} [options.onComplete=noop] - An action to perform after the announcer is done.
 */
function Announcer(game, text, options) {
    this.options = Phaser.Utils.extend({}, Announcer.defaults, options);
    if (this.options.finalDelay === undefined) {
        this.options.finalDelay = this.options.nextDelay;
    }

    if (this.options.overlay) {
        this.overlay = game.add.existing(newOverlay(game, this.options.overlayColor));
        this.overlay.name = 'Announcer overlay';
    } else {
        // Add a null object.
        this.overlay = game.add.image(0, 0, null);
    }

    this.flash = game.add.existing(new CenteredImage(
        game, game.cache.getBitmapData(CACHE.KEY.FLASH)));
    this.flash.name = 'Announcer flash';
    this.flash.alpha = 0;
    this.flash.tint = this.options.flashTint;

    this.textGroup = Announcer._addTextGroup(game, text);

    // Handy references.
    this.game = game;
    this.add = game.add;
    this.time = game.time;
}

Announcer.defaults = {
    initDelay: 0,
    nextDelay: 550,
    //finalDelay: <nextDelay>,
    duration: 450,
    flashOnDuration: 25,
    flashOffDuration: 400,
    flashTint: 0xFFFFFF,
    repeat: false,
    overlay: false,
    overlayColor: 'dark',
    onComplete: noop
};

Announcer.prototype._destroy = function() {
    this.textGroup.destroy();
    this.flash.destroy();
    this.overlay.destroy();
};

/** @const */
var AUTOSTART = true;

Announcer.prototype._flashCamera1 = function() {
    this.add.tween(this.flash).to({
        alpha: 0
    }, this.options.flashOffDuration, Phaser.Easing.Quadratic.Out, AUTOSTART);
};

Announcer.prototype._flashCamera0 = function() {
    this.add.tween(this.flash).to({
        alpha: 1
    }, this.options.flashOnDuration, Phaser.Easing.Quadratic.In, AUTOSTART)
        .onComplete.addOnce(this._flashCamera1, this);
};

Announcer.prototype._next = function() {
    this.textGroup.cursor.kill();
    this.textGroup.next();
    this._announce();
};

Announcer.prototype._repeat = function() {
    if (this.options.repeat) {
        this._next();
    } else {
        this._destroy();
        this.options.onComplete.call(this);
    }
};

Announcer.prototype._announceNext = function() {
    if (this.textGroup.cursorIndex < this.textGroup.length - 1) {
        this.time.events.add(this.options.nextDelay, this._next, this);
    } else {
        this.time.events.add(this.options.finalDelay, this._repeat, this);
    }
};

Announcer.prototype._announce = function() {
    var diff = 0.07, text, tween;

    text = this.textGroup.cursor;
    // Reset scaling from previous operations.
    text.scale.add(diff, diff);
    text.revive();

    tween = this.add.tween(text.scale);
    // DON'T tween the font size, since it will have to redraw the text sprite!
    tween.to({
        x: '-' + diff,
        y: '-' + diff,
    }, this.options.duration, Phaser.Easing.Quadratic.Out);
    tween.onStart.addOnce(this._flashCamera0, this);
    tween.onComplete.addOnce(this._announceNext, this);
    tween.start();
};

Announcer.prototype.announce = function() {
    this.time.events.add(this.options.initDelay, this._announce, this);
};

Announcer._addTextGroup = function(game, words) {
    var defaultStyle = Supercold.style.superhot,
        group, text, i, word, wordStyle, style;

    group = game.add.group();
    group.name = 'Text group: "' + words + '"';
    // Due to the way the 'fixedToCamera' property works, set it for each
    // text object individually (instead of setting it for the group).
    // https://phaser.io/docs/2.6.2/Phaser.Sprite.html#cameraOffset
    for (i = 0; i < words.length; ++i) {
        word = words[i];
        // In case of phrase instead of word, use the first word as index.
        wordStyle = Supercold.wordStyles[word.split(' ')[0]];
        if (wordStyle) {
            style = Phaser.Utils.extend({}, defaultStyle, wordStyle);
        } else {
            style = defaultStyle;
        }

        text = group.add(new ScaledCenteredText(game, word, style));
        text.setShadow(
            style.shadowOffsetX, style.shadowOffsetY,
            style.shadowColor, style.shadowBlur);
        // Initially invisible.
        text.kill();
    }
    return group;
};


/**
 * Shows a tip to the player.
 */
function showTip() {
    var tiplist = document.getElementById('tips'),
        tips = tiplist.querySelectorAll('.tip'),
        tip = tips[Math.floor(Math.random() * tips.length)];

    tip.style.display = 'block';
    tiplist.style.display = 'block';
    document.getElementById('hint').style.display = 'block';
}

/**
 * Shows a tip to the player probabilistically.
 */
function showTipRnd(chance) {
    if (chance === undefined) chance = 0.75;
    if (Math.random() < chance) {
        showTip();
    } else {
        document.getElementById('hint').style.display = 'block';
    }
}

/**
 * Hides any tip previously shown to the player.
 */
function hideTip() {
    var tiplist = document.getElementById('tips');

    tiplist.style.display = 'none';
    Array.prototype.forEach.call(tiplist.querySelectorAll('.tip'), function(tip) {
        tip.style.display = 'none';
    });
    document.getElementById('hint').style.display = 'none';
}

/***************************** Scalable State *****************************/

/**
 * A state that supports a scalable camera.
 */
Supercold._ScalableState = function(game) {
    var width = Supercold.world.width + PADDING.width*2,
        height = Supercold.world.height + PADDING.height*2;

    this.bounds = new Phaser.Rectangle(
        -Math.round(width / 2), -Math.round(height / 2), width, height);
};

/**
 * Sets the world size.
 */
Supercold._ScalableState.prototype._setWorldBounds = function() {
    var width = this.bounds.width, height = this.bounds.height;

    // The world is a large fixed size space with (0, 0) in the center.
    this.world.setBounds(
        -Math.round(width / 2), -Math.round(height / 2), width, height);
    if (DEBUG) log('Set world bounds to: ' + this.world.bounds);
};

/**
 * Sets the camera scale so that the player sees about the same portion of the
 * playing field. The strategy selected scales the game so as to fill the screen,
 * but it will crop some of the top/bottom or left/right sides of the playing field.
 */
Supercold._ScalableState.prototype._setCameraScale = function(width, height) {
    scaleToFill(this.camera.scale, width, height);
    if (DEBUG) log('Set camera scale to: ' + this.camera.scale);
};

/**
 *
 */
Supercold._ScalableState.prototype.setScaling = function() {
    // Note: Don't use Phaser.ScaleManager.onSizeChange, since the callback
    // may be triggered multiple times. Phaser.State.resize works better.
    this._setWorldBounds();
    this._setCameraScale(this.game.width, this.game.height);
    if (DEBUG) log('Set scaling.');
};

/**
 * Since our game is set to Scalemode 'RESIZE', this method will be called to
 * handle resizing. Subclasses of the ScalableState will inherit this method
 * and will, thus, be able to handle resizing.
 *
 * @param {number} width - the new width
 * @param {number} height - the new height
 * @override
 */
Supercold._ScalableState.prototype.resize = function(width, height) {
    this._setCameraScale(width, height);
    if (DEBUG) log('Resized game.');
};

Supercold._ScalableState.prototype.addBackground = function() {
    var background = this.add.image(0, 0, this.cache.getBitmapData(CACHE.KEY.BG));

    background.anchor.set(0.5);
    return background;
};

/**
 * Shows lots of debug info about various Phaser objects on the screen.
 * @param {Phaser.Sprite} [sprite] - An optional sprite to show debug info for.
 */
Supercold._ScalableState.prototype.showDebugInfo = function(sprite) {
    if (sprite) {
        this.game.debug.spriteBounds(sprite);
        this.game.debug.spriteInfo(sprite, DEBUG_POSX, 32);
        this.game.debug.spriteCoords(sprite, DEBUG_POSX, 122);
    }
    this.game.debug.cameraInfo(this.camera, DEBUG_POSX, 200);
    this.game.debug.inputInfo(DEBUG_POSX, 280);
    this.game.debug.pointer(this.input.activePointer);
    this.game.debug.text('DEBUG: ' + DEBUG, DEBUG_POSX, this.game.height-16);
};

/******************************* Boot State *******************************/

/**
 * State used to boot the game.
 * This state is used to perform any operations that should only be
 * executed once for the entire game (e.g. setting game options, etc.).
 */
Supercold.Boot = function(game) {};

Supercold.Boot.prototype.init = function() {
    if (DEBUG) log('Initializing Boot state...');

    // Our game does not need multi-touch support,
    // so it is recommended to set this to 1.
    this.input.maxPointers = 1;
    // Call event.preventDefault for DOM mouse events.
    // NOTE: For some reason, as of February 2017 this doesn't work for right
    // clicks (contextmenu event) at least on Chrome, Opera, FF and IE for Windows.
    // Chrome also demonstrates this even worse behaviour:
    // https://github.com/photonstorm/phaser/issues/2286
    this.input.mouse.capture = true;

    // Let the game continue when the tab loses focus. This prevents cheating.
    this.stage.disableVisibilityChange = !DEBUG;

    this.stage.backgroundColor = Supercold.style.stage.backgroundColor;

    this.scale.scaleMode = Phaser.ScaleManager.RESIZE;

    this.physics.startSystem(PHYSICS_SYSTEM);
    this.physics.p2.setImpactEvents(true);
};

Supercold.Boot.prototype.create = function() {
    if (DEBUG) log('Creating Boot state...');

    this.state.start('Preloader');
};

/***************************** Preloader State ****************************/

function circle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
}

function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

/**
 * State used for loading or creating any assets needed in the game.
 */
Supercold.Preloader = function(game) {
    Supercold._ScalableState.call(this, game);
};

Supercold.Preloader.prototype = Object.create(Supercold._ScalableState.prototype);
Supercold.Preloader.prototype.constructor = Supercold.Preloader;

Supercold.Preloader.prototype._makeLiveEntityBitmap = function(style, key) {
    var player = Supercold.player, width, bmd, ctx;

    // Same width and height.
    width = (player.radius + player.sideLen) * 2;
    bmd = makeBitmapData(this, width, width, key);
    ctx = bmd.ctx;

    ctx.fillStyle = style.color;
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = style.lineWidth;
    ctx.shadowOffsetX = style.shadowOffsetX;
    ctx.shadowOffsetY = style.shadowOffsetY;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the circle.
    ctx.translate(bmd.width / 2, bmd.height / 2);
    ctx.save();
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;
    circle(ctx, 0, 0, player.radius);
    ctx.fill();
    // Draw the outline a little smaller, so as not to cover the shadow.
    circle(ctx, 0, 0, player.radius - (style.lineWidth / 2));
    ctx.stroke();
    ctx.restore();

    // Draw the nozzle outline.
    ctx.translate(player.radius - Math.round(player.sideLen / 1.68), 0);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-player.sideLen, 0);
    ctx.lineTo(0, player.sideLen);
    ctx.lineTo(player.sideLen, 0);
    ctx.stroke();
    // Draw the nozzle.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;
    ctx.fill();
};

Supercold.Preloader.prototype._makePlayerBitmap = function() {
    this._makeLiveEntityBitmap(Supercold.style.player, CACHE.KEY.PLAYER);
};

Supercold.Preloader.prototype._makeBotBitmap = function() {
    this._makeLiveEntityBitmap(Supercold.style.bot, CACHE.KEY.BOT);
};

Supercold.Preloader.prototype._makeBulletBitmap = function() {
    var bullet = Supercold.bullet,
        bmd = makeBitmapData(this, bullet.width, bullet.height, CACHE.KEY.BULLET),
        ctx = bmd.ctx;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = Supercold.style.bullet.color;

    bmd.rect(0, 0, bullet.bodyLen, bullet.height);

    ctx.translate(bullet.bodyLen, bullet.tipRadius);
    // Make the tip pointier.
    ctx.scale(2, 1);
    ctx.beginPath();
    ctx.arc(0, 0, bullet.tipRadius, 3/2 * Math.PI, Math.PI / 2);
    ctx.fill();
};

Supercold.Preloader.prototype._makeTrailBitmap = function() {
    var style = Supercold.style.trail,
        height = Supercold.bullet.height,
        centerY = (height - 1) / 2,
        bmd = makeBitmapData(this, style.x2, height, CACHE.KEY.TRAIL),
        ctx = bmd.ctx;

    ctx.strokeStyle = createLinearGradient(
        ctx, style.x1, style.y1, style.x2, style.y2, style.colorStops);
    // Make it a little thinner.
    ctx.lineWidth = height - 2;
    ctx.lineCap = 'round';
    ctx.shadowOffsetX = style.shadowOffsetX;
    ctx.shadowOffsetY = style.shadowOffsetY;
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;

    // Note the offsets on the x-axis, so as to leave space for the round caps.
    line(ctx, style.x1 + 4, centerY, style.x2 - 4, centerY);
};

Supercold.Preloader.prototype._makeBackgroundBitmap = function() {
    var width = Supercold.world.width,
        height = Supercold.world.height,
        paddedWidth = Supercold.world.width + PADDING.width*2,
        paddedHeight = Supercold.world.height + PADDING.height*2,
        skewFactor = Math.tan(Supercold.style.lines.angle),
        bmd = makeBitmapData(this, paddedWidth, paddedHeight, CACHE.KEY.BG),
        ctx = bmd.ctx, i;

    // Draw background colors. Dark padded area and lighter inside space.
    ctx.fillStyle = Supercold.style.background.darkColor;
    ctx.fillRect(0, 0, paddedWidth, paddedHeight);
    ctx.fillStyle = Supercold.style.background.lightColor;
    ctx.fillRect(PADDING.width, PADDING.height, width, height);

    // Draw blurred lines. (I know you want it. #joke -.-')
    ctx.save();
    ctx.transform(1, 0, -skewFactor, 1, 0, 0);
    ctx.lineWidth = Supercold.style.lines.lineWidth;
    ctx.strokeStyle = Supercold.style.lines.color;
    ctx.shadowOffsetX = Supercold.style.lines.shadowOffsetX;
    ctx.shadowOffsetY = Supercold.style.lines.shadowOffsetY;
    ctx.shadowColor = Supercold.style.lines.shadowColor;
    ctx.shadowBlur = Supercold.style.lines.shadowBlur;
    ctx.beginPath();
    for (i = 0; i <= paddedWidth + (paddedHeight / skewFactor); i += 8) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, paddedHeight);
    }
    ctx.stroke();
    ctx.restore();

    ctx.shadowOffsetX = Supercold.style.grid.shadowOffsetX;
    ctx.shadowOffsetY = Supercold.style.grid.shadowOffsetY;
    ctx.shadowBlur = Supercold.style.grid.shadowBlur;

    // Draw horizontal lines
    ctx.save();
    ctx.translate(0, PADDING.height);
    // inside world
    ctx.strokeStyle = Supercold.style.grid.color1;
    ctx.shadowColor = Supercold.style.grid.shadowColor1;
    ctx.beginPath();
    for (i = 0; i <= height; i += Supercold.cell.height) {
        ctx.moveTo(0, i);
        ctx.lineTo(paddedWidth, i);
    }
    ctx.stroke();
    // in outer area
    ctx.strokeStyle = Supercold.style.grid.colorOuter;
    ctx.shadowColor = Supercold.style.grid.shadowColorOuter;
    ctx.beginPath();
    for (i = 0; i <= PADDING.height; i += Supercold.cell.height) {
        ctx.moveTo(0, -i);
        ctx.lineTo(paddedWidth, -i);
        ctx.moveTo(0, height + i);
        ctx.lineTo(paddedWidth, height + i);
    }
    ctx.stroke();
    ctx.restore();

    // Draw vertical lines
    ctx.save();
    ctx.translate(PADDING.width, 0);
    // inside world
    ctx.strokeStyle = Supercold.style.grid.color2;
    ctx.shadowColor = Supercold.style.grid.shadowColor2;
    ctx.beginPath();
    for (i = 0; i <= width; i += Supercold.cell.width) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, paddedHeight);
    }
    ctx.stroke();
    // in outer area
    ctx.strokeStyle = Supercold.style.grid.colorOuter;
    ctx.shadowColor = Supercold.style.grid.shadowColorOuter;
    ctx.beginPath();
    for (i = 0; i <= PADDING.width; i += Supercold.cell.width) {
        ctx.moveTo(-i, 0);
        ctx.lineTo(-i, paddedHeight);
        ctx.moveTo(width + i, 0);
        ctx.lineTo(width + i, paddedHeight);
    }
    ctx.stroke();
    ctx.restore();
};

Supercold.Preloader.prototype._makeFlashBitmap = function() {
    var centerX = (NATIVE_WIDTH - 1) / 2,
        centerY = (NATIVE_HEIGHT - 1) / 2,
        radius = Math.min(centerX, centerY),
        bmd = makeBitmapData(this, NATIVE_WIDTH, NATIVE_HEIGHT, CACHE.KEY.FLASH),
        ctx = bmd.ctx;

    // Create an oval flash.
    ctx.translate(centerX, 0);
    ctx.scale(2, 1);

    ctx.translate(-centerX, 0);
    ctx.fillStyle = createRadialGradient(
        ctx, centerX, centerY, 0, centerX, centerY, radius,
        Supercold.style.flash.colorStops);
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
};

Supercold.Preloader.prototype._makeOverlayBitmaps = function() {
    var bmd;

    bmd = makeBitmapData(this, NATIVE_WIDTH, NATIVE_HEIGHT, CACHE.KEY.OVERLAY_DARK);
    bmd.rect(0, 0, bmd.width, bmd.height, Supercold.style.overlay.darkColor);
    bmd = makeBitmapData(this, NATIVE_WIDTH, NATIVE_HEIGHT, CACHE.KEY.OVERLAY_LIGHT);
    bmd.rect(0, 0, bmd.width, bmd.height, Supercold.style.overlay.lightColor);
};


Supercold.Preloader.prototype.preload = function() {
    if (DEBUG) {
        this.load.onFileComplete.add(function(progress, key, success, totalLF, totalF) {
            log(((success) ? 'Loaded ' : 'Failed to load ') + key);
            log('Progress: ' + progress + ', Total loaded files: ' + totalLF +
                ', Total files: ' + totalF);
        }, this);
        this.load.onLoadComplete.add(function() {
            log('Asset loading completed');
        }, this);
    }
    this.load.audio('superhot', ['audio/superhot.mp3', 'audio/superhot.ogg']);
};

Supercold.Preloader.prototype.create = function() {
    if (DEBUG) log('Creating Preloader state...');

    // Scaling should be specified first.
    this.setScaling();

    this._makePlayerBitmap();
    this._makeBotBitmap();
    this._makeBulletBitmap();
    this._makeTrailBitmap();
    this._makeBackgroundBitmap();
    this._makeFlashBitmap();
    this._makeOverlayBitmaps();
};

Supercold.Preloader.prototype.update = function() {
    // No actual need to wait for asset loading.
    this.state.start('MainMenu');
};

/***************************** Main Menu State ****************************/

Supercold.MainMenu = function(game) {
    Supercold._ScalableState.call(this, game);
};

Supercold.MainMenu.prototype = Object.create(Supercold._ScalableState.prototype);
Supercold.MainMenu.prototype.constructor = Supercold.MainMenu;

Supercold.MainMenu.prototype.create = function() {
    if (DEBUG) log('Creating MainMenu state...');

    // Scaling should be specified first.
    this.setScaling();

    // Disable bounds checking for the camera, since it messes up centering.
    this.camera.bounds = null;
    this.camera.follow(this.world);

    new Announcer(this.game, Supercold.texts.SUPERCOLD.split(' '), {
        initDelay: 750,
        nextDelay: 1200,
        flashTint: 0x151515,
        repeat: true
    }).announce();

    this.game.supercold.onMainMenuOpen();
    // We will transition to the next state through the DOM menu!
};

/**
 * Used here for debugging purposes.
 */
Supercold.MainMenu.prototype.render = function() {
    if (DEBUG) {
        this.showDebugInfo();
    }
};

/******************************* Intro State ******************************/

Supercold.Intro = function(game) {
    Supercold._ScalableState.call(this, game);
};

Supercold.Intro.prototype = Object.create(Supercold._ScalableState.prototype);
Supercold.Intro.prototype.constructor = Supercold.Intro;

Supercold.Intro.prototype.create = function() {
    if (DEBUG) log('Creating Intro state...');

    // Scaling should be specified first.
    this.setScaling();

    // Disable bounds checking for the camera, since it messes up centering.
    this.camera.bounds = null;
    this.camera.follow(this.addBackground());

    new Announcer(this.game, Supercold.texts.SUPERCOLD.split(' '), {
        initDelay: 600,
        nextDelay: 700,
        overlay: true,
        onComplete: (function startLevel() {
            // Start at the last level that the player was in or the first one.
            this.state.start('Game', CLEAR_WORLD, CLEAR_CACHE, {
                level: Supercold.storage.loadLevel()
            });
        }).bind(this)
    }).announce();
};

/**
 * Used here for debugging purposes.
 */
Supercold.Intro.prototype.render = function() {
    if (DEBUG) {
        this.showDebugInfo();
    }
};

/******************************* Game State *******************************/

/***** Sprites and Groups *****/

/*
 * IMPORTANT: Don't enable physics in the sprite constructor, since this slows
 * creation down significantly for some reason! Enable it in the group instead.
 */

/**
 * One of the game's live entities, i.e. the player or a bot.
 */
function LiveSprite(game, x, y, key, _frame) {
    Phaser.Sprite.call(this, game, x, y, key, _frame);

    // Time until the next bullet can be fired.
    this.remainingTime = 0;
}

LiveSprite.prototype = Object.create(Phaser.Sprite.prototype);
LiveSprite.prototype.constructor = LiveSprite;

/**
 * The player.
 */
function Player(game, x, y, scale) {
    scale = scale || 1;
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.PLAYER));

    this.name = 'Player';
    this.scale.set(scale);
    this.game.add.existing(this);

    // No group for Player, so enable physics here.
    this.game.physics.enable(this, PHYSICS_SYSTEM, DEBUG);
    this.body.setCircle(Supercold.player.radius * scale);
}

Player.prototype = Object.create(LiveSprite.prototype);
Player.prototype.constructor = Player;

Player.prototype.kill = function() {
    // TODO: Add fancy kill effect.
    LiveSprite.prototype.kill.call(this);
};

/**
 * A bot.
 */
function Bot(game, x, y, _key, _frame) {
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.BOT));

    this.name = 'Bot ' + Bot.count++;
    /**
     * Tells if the bot is currently dodging a bullet.
     */
    this.dodging = false;
    /**
     * The direction in which it is dodging.
     */
    this.direction = null;
    /**
     * How long it will dodge.
     */
    this.duration = 0;
}

Bot.count = 0;

Bot.prototype = Object.create(LiveSprite.prototype);
Bot.prototype.constructor = Bot;

Bot.prototype.kill = function() {
    // TODO: Add fancy kill effect.
    LiveSprite.prototype.kill.call(this);
};

/**
 * A bullet fired from a LiveSprite.
 */
function Bullet(game, x, y, _key, _frame) {
    Phaser.Sprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.BULLET));

    /**
     * Who shot the bullet.
     */
    this.owner = null;

    this.name = 'Bullet ' + Bullet.count++;
    // Using these properties does NOT work, because when checking the world
    // bounds in the preUpdate method, the world scale is not taken into account!
    // THIS TOOK ME A LONG TIME TO FIND OUT. -.-'
    //this.checkWorldBounds = true;
    //this.outOfBoundsKill = true;
}

Bullet.count = 0;

Bullet.prototype = Object.create(Phaser.Sprite.prototype);
Bullet.prototype.constructor = Bullet;

/**
 * Cached variable for the scaled world bounds.
 */
Bullet._worldBounds = new Phaser.Rectangle();

/**
 * Overriden preUpdate method to handle world scaling and outOfBounds correctly.
 * TODO: Find a better way to do this!
 */
Bullet.prototype.preUpdate = function() {
    var camera = this.game.camera, scale = camera.scale;

    if (!Phaser.Sprite.prototype.preUpdate.call(this)) return false;
    if (!this.alive) return false;

    // Scale the world bounds.
    Bullet._worldBounds.copyFrom(this.game.world.bounds);
    Bullet._worldBounds.x *= scale.x;
    Bullet._worldBounds.y *= scale.y;
    Bullet._worldBounds.x -= camera.view.x;
    Bullet._worldBounds.y -= camera.view.y;
    Bullet._worldBounds.width *= scale.x;
    Bullet._worldBounds.height *= scale.y;
    if (!Bullet._worldBounds.intersects(this.getBounds())) {
        this.kill();
        return false;
    }
    return true;
};

Bullet.prototype.kill = function() {
    // TODO: Add fancy kill effect.
    Phaser.Sprite.prototype.kill.call(this);
};

/**
 * The trail that a bullet leaves behind.
 */
function BulletTrail(game, x, y, _key, _frame) {
    Phaser.Image.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.TRAIL));

    /**
     * The bullet that this trail belongs to.
     * May be null if the bullet was destroyed recently.
     */
    this.bullet = null;
    /**
     * Reference point for this trail (where it starts or stops).
     */
    this.refX = 0;
    this.refY = 0;

    this.name = 'Trail ' + BulletTrail.count++;
    this.anchor.x = 1;
    this.anchor.y = 0.5;
}

BulletTrail.count = 0;

BulletTrail.prototype = Object.create(Phaser.Image.prototype);
BulletTrail.prototype.constructor = BulletTrail;


function extendName(sprite, group) {
    sprite.name += ', ' + (group.length-1) + ' in ' + group.name;
}


/**
 * A group of 'Bot's with enabled physics.
 */
function BotGroup(game, scale, name, _parent) {
    name = name || 'Bots';
    Phaser.Group.call(this, game, _parent, name, false, true, PHYSICS_SYSTEM);

    this._scale = scale;
    this.classType = Bot;

    // Bots receive input (for hotswitching).
    this.inputEnableChildren = true;
}

BotGroup.prototype = Object.create(Phaser.Group.prototype);
BotGroup.prototype.constructor = BotGroup;

BotGroup.prototype.create = function(x, y) {
    var bot = Phaser.Group.prototype.create.call(this, x, y, null, null);

    if (DEBUG) extendName(bot, this);
    bot.scale.set(this._scale);
    bot.body.setCircle(Supercold.player.radius * this._scale);
    bot.body.debug = DEBUG;

    // Players may click near the bot to shoot.
    bot.input.pixelPerfectClick = true;
    // Used for accurately using the hand cursor.
    bot.input.pixelPerfectOver = true;
    bot.input.useHandCursor = true;

    return bot;
};

/**
 * A group of 'Bullet's with enabled physics.
 */
function BulletGroup(game, name, _parent) {
    name = name || 'Bullets';
    Phaser.Group.call(this, game, _parent, name, false, true, PHYSICS_SYSTEM);

    this.classType = Bullet;
}

BulletGroup.prototype = Object.create(Phaser.Group.prototype);
BulletGroup.prototype.constructor = BulletGroup;

BulletGroup.prototype.create = function() {
    var bullet = Phaser.Group.prototype.create.call(this, 0, 0, null, null, false),
        specs = Supercold.bullet,
        offsetX = (specs.width - specs.bodyLen) / 2;

    if (DEBUG) extendName(bullet, this);
    // Set two shapes to closely resemble the shape of the bullet.
    bullet.body.setRectangle(specs.bodyLen, specs.height, -offsetX);
    bullet.body.addCircle(specs.tipRadius, offsetX);
    // Do NOT produce contact forces, so that bullets do not
    // change direction when colliding with other sprites.
    // We need to access the P2JS internals for this.
    // Note that making the bodies kinematic would not be enough,
    // since they would still produce collisions with the sprites
    // (which are not kinematic and would, thus, move backwards).
    bullet.body.data.collisionResponse = false;
    // Let the bullets leave the world.
    bullet.body.collideWorldBounds = false;
    bullet.body.debug = DEBUG;

    return bullet;
};

/**
 * A group of 'BulletTrail's.
 */
function BulletTrailGroup(game, _name, _parent) {
    Phaser.Group.call(this, game, _parent, 'BulletTrails');
    this.classType = BulletTrail;
}

BulletTrailGroup.prototype = Object.create(Phaser.Group.prototype);
BulletTrailGroup.prototype.constructor = BulletTrailGroup;

BulletTrailGroup.prototype.create = function() {
    var trail = Phaser.Group.prototype.create.call(this, 0, 0, null, null, false);

    if (DEBUG) extendName(trail, this);
    return trail;
};


function BulletTrailPainter(game) {
    this.math = game.math;

    this._liveTrails = {};
    this._deadTrails = {};
    this._trailGroup = new BulletTrailGroup(game);
}

BulletTrailPainter.prototype._getLength = function(bullet, trail) {
    return Math.min(
        this.math.distance(bullet.x, bullet.y, trail.refX, trail.refY),
        trail.texture.width);
};

BulletTrailPainter.prototype.addTrail = function(bullet) {
    var trail = this._trailGroup.getFirstDead(true);

    trail.rotation = bullet.body.rotation;
    trail.bullet = bullet;
    trail.refX = bullet.x;
    trail.refY = bullet.y;
    trail.width = 0;
    trail.revive();
    this._liveTrails[bullet.name] = trail;
};

BulletTrailPainter.prototype.stopTrail = function(bullet) {
    var trail = this._liveTrails[bullet.name];

    // Check if the trail exists, since the handler may be called more than once!
    if (trail) {
        trail.refX = bullet.x;
        trail.refY = bullet.y;
        this._deadTrails[trail.name] = trail;
        delete this._liveTrails[bullet.name];
    }
};

BulletTrailPainter.prototype.updateTrails = function(elapsedTime) {
    var name, trail;

    for (name in this._liveTrails) {
        if (!this._liveTrails.hasOwnProperty(name))
            continue;
        trail = this._liveTrails[name];

        // Don't round this value, since it causes jitter.
        trail.width = this._getLength(trail.bullet, trail);
        trail.x = trail.bullet.x;
        trail.y = trail.bullet.y;
    }
    for (name in this._deadTrails) {
        if (!this._deadTrails.hasOwnProperty(name))
            continue;
        trail = this._deadTrails[name];

        // Don't round this value, since it causes jitter.
        trail.width -= Supercold.speeds.bullet.normal * elapsedTime;
        if (trail.width < 0) {
            trail.kill();
            delete this._deadTrails[name];
        }
    }
};


/**
 * Abstract base class for heads-up displays.
 */
function HUD(game, options) {
    this.hud = makeBitmapData(
        game, options.width, options.height, options.key, true);
    this.hudImage = this.hud.addToWorld(
        game.camera.width - (options.x + options.width)*game.camera.scale.x,
        game.camera.height - options.y*game.camera.scale.y,
        0, 1);

    this.hudImage.fixedToCamera = true;
    game.scale.onSizeChange.add(function resize() {
        this.hudImage.x = game.camera.width -
            (options.x + this.hud.width)*game.camera.scale.x;
        this.hudImage.y = game.camera.height - options.y*game.camera.scale.y;
        this.hudImage.cameraOffset.set(this.hudImage.x, this.hudImage.y);
    }, this);
}

HUD.prototype.update = function() {
    throw new Error('Abstract base class');
};


function Minimap(game) {
    HUD.call(this, game, {
        x: Minimap.x,
        y: Minimap.y,
        width: Supercold.minimap.width,
        height: Supercold.minimap.height,
        key: 'Minimap'
    });

    this._ratio = {
        x: Supercold.minimap.width / game.world.bounds.width,
        y: Supercold.minimap.height / game.world.bounds.height
    };
}

/**
 * Coordinates for the bottom-right corner.
 */
Minimap.x = 10;
Minimap.y = 10;

Minimap.prototype = Object.create(HUD.prototype);
Minimap.prototype.constructor = Minimap;

Minimap.prototype._markEntity = function(entity, style) {
    var ctx = this.hud.ctx;

    ctx.fillStyle = style.color;
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = style.lineWidth;
    // Just draw a circle.
    circle(ctx, entity.x * this._ratio.x, entity.y * this._ratio.y, style.radius);
    ctx.fill();
    ctx.stroke();
};

Minimap.prototype._markPlayer = function(player) {
    this._markEntity(player, Supercold.style.minimap.player);
};

Minimap.prototype._markBot = function(bot) {
    this._markEntity(bot, Supercold.style.minimap.bot);
};

Minimap.prototype.update = function(player, bots) {
    var map = this.hud, ctx = map.ctx,
        padX = PADDING.width * this._ratio.x,
        padY = PADDING.height * this._ratio.y;

    ctx.clearRect(0, 0, map.width, map.height);
    ctx.fillStyle = Supercold.style.minimap.background.color;
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.strokeStyle = Supercold.style.minimap.border.color;
    ctx.lineWidth = Supercold.style.minimap.border.lineWidth;
    ctx.strokeRect(0, 0, map.width, map.height);

    ctx.strokeStyle = Supercold.style.minimap.innerBorder.color;
    ctx.lineWidth = Supercold.style.minimap.innerBorder.lineWidth;
    ctx.strokeRect(padX, padY, map.width - 2*padX, map.height - 2*padY);
    ctx.restore();

    ctx.save();
    // The (0, 0) coordinates of our world are in the center!
    ctx.translate(map.width / 2, map.height / 2);
    bots.forEachAlive(this._markBot, this);
    this._markPlayer(player);
    ctx.restore();
    map.dirty = true;
};


function ReloadBar(game, x, y, key, fillStyle) {
    HUD.call(this, game, {
        x: x,
        y: y,
        width: Supercold.bar.width,
        height: Supercold.bar.height,
        key: key
    });
    this.hud.rect(0, 0, this.hud.width, this.hud.height, fillStyle);
}

ReloadBar.prototype = Object.create(HUD.prototype);
ReloadBar.prototype.constructor = ReloadBar;

ReloadBar.prototype.update = function(percentage) {
    this.hudImage.width = this.hudImage.texture.width * percentage;
};

function HotswitchBar(game) {
    ReloadBar.call(this, game, HotswitchBar.x, HotswitchBar.y, 'HotswitchBar',
                   Supercold.style.hotswitchBar.color);
}

/**
 * Coordinates for the bottom-right corner.
 */
HotswitchBar.x = 10;
HotswitchBar.y = Minimap.y + Supercold.minimap.height + 2;

HotswitchBar.prototype = Object.create(ReloadBar.prototype);
HotswitchBar.prototype.constructor = HotswitchBar;

function BulletBar(game) {
    ReloadBar.call(this, game, BulletBar.x, BulletBar.y, 'BulletBar',
                   Supercold.style.bulletBar.color);
}

/**
 * Coordinates for the bottom-right corner.
 */
BulletBar.x = 10;
BulletBar.y = HotswitchBar.y + Supercold.bar.height + 2;

BulletBar.prototype = Object.create(ReloadBar.prototype);
BulletBar.prototype.constructor = BulletBar;


Supercold.Game = function(game) {
    Supercold._ScalableState.call(this, game);

    this._sprites = {
        bounds: null,
        player: null
    };
    this._colGroups = {         // Collision groups
        player: null,
        bots: null,
        playerBullets: null,
        botBullets: null
    };
    this._groups = {
        bots: null,
        playerBullets: null,
        botBullets: null
    };
    this._controls = {
        cursors: null,
        wasd: null,
        fireKey: null
    };
    this._mutators = null;
    this._bulletTrailPainter = null;
    this._huds = {
        minimap: null,
        bulletBar: null,
        hotswitchBar: null
    };

    // These will be set in init.
    this.level = -1;
    this._totalBotCount = -1;

    this._fireRate = 0;
    // Time remaining since next bot spawn.
    this._nextBotTime = 0;
    // Time remaining since next hotswitch.
    this._nextHotSwitch = 0;
    this._hotswitching = false;

    this._superhotFx = null;

    // Internal cached objects.
    this._cached = {
        verVec: {x: 0, y: 0},
        horVec: {x: 0, y: 0}
    };
};

Supercold.Game.prototype = Object.create(Supercold._ScalableState.prototype);
Supercold.Game.prototype.constructor = Supercold.Game;


Object.defineProperty(Supercold.Game.prototype, 'superhot', {
    get: function() {
        return (this._totalBotCount === 0 && this._groups.bots.countLiving() === 0);
    }
});

Object.defineProperty(Supercold.Game.prototype, '_hotswitchTimeout', {
    get: function() {
        return (this._mutators.superhotswitch) ?
            Supercold.superhotswitchTimeout : Supercold.hotswitchTimeout;
    }
});

Object.defineProperty(Supercold.Game.prototype, '_spriteScale', {
    get: function() {
        if (this._mutators.bighead && this._mutators.chibi) return 1;
        if (this._mutators.bighead) return Supercold.bigheadScale;
        if (this._mutators.chibi) return Supercold.chibiScale;
        return 1;
    }
});


Supercold.Game.prototype.init = function(options) {
    this.level = options.level;
    this._totalBotCount = 4 + Math.floor(this.level * 0.75);
    this._mutators = Supercold.storage.loadMutators();
};


function bulletHandler(myBullet, otherBullet) {
   myBullet.sprite.kill();
   // The other bullet will be killed by the other handler call.
   // TODO: Add fancy effects.
}

Supercold.Game.prototype._addTrail = function(bullet) {
    this._bulletTrailPainter.addTrail(bullet);
};
Supercold.Game.prototype._stopTrail = function(bullet) {
    this._bulletTrailPainter.stopTrail(bullet);
};

Supercold.Game.prototype._createBullet = function(group, myColGroup) {
    var bullet = group.create();

    bullet.events.onRevived.add(this._addTrail, this);
    bullet.events.onKilled.add(this._stopTrail, this);
    bullet.body.setCollisionGroup(myColGroup);
    // All bullets collide with all other bullets and all live entities.
    bullet.body.collides([this._colGroups.player, this._colGroups.bots]);
    bullet.body.collides([this._colGroups.playerBullets, this._colGroups.botBullets],
                         bulletHandler, this);
    return bullet;
};

Supercold.Game.prototype._createPlayerBullet = function() {
    return this._createBullet(this._groups.playerBullets, this._colGroups.playerBullets);
};
Supercold.Game.prototype._createBotBullet = function() {
    return this._createBullet(this._groups.botBullets, this._colGroups.botBullets);
};

Supercold.Game.prototype._createPlayerBound = function(rect, i, collisionGroup) {
    var bound = this._sprites.bounds.create(rect.x, rect.y, null);

    bound.name = 'Bound ' + i;
    bound.body.static = true;
    bound.body.setRectangle(
        rect.width, rect.height, rect.halfWidth, rect.halfHeight);
    bound.body.setCollisionGroup(collisionGroup);
    // The bounds collide with the player.
    if (!DEBUG) {
        bound.body.collides(this._colGroups.player);
    }
    bound.body.debug = DEBUG;
};

/**
 * Creates boundaries around the world that restrict the player's movement.
 */
Supercold.Game.prototype._addPlayerBounds = function(collisionGroup) {
    var bounds = this.bounds;

    this._sprites.bounds = this.add.physicsGroup(PHYSICS_SYSTEM);
    this._sprites.bounds.name = 'Player Bounds';
    // Note that all invisible walls have double the width or height in order to
    // prevent the player from getting out of the world bounds when hotswitching.
    [new Phaser.Rectangle(
        // Top
        bounds.left - PADDING.width,        // x
        bounds.top - PADDING.height,        // y
        bounds.width + PADDING.width*2,     // width
        PADDING.height * 2                  // height
    ), new Phaser.Rectangle(
        // Bottom
        bounds.left - PADDING.width,
        bounds.bottom - PADDING.height,
        bounds.width + PADDING.width*2,
        PADDING.height * 2
    ), new Phaser.Rectangle(
        // Left
        bounds.left - PADDING.width,
        bounds.top - PADDING.height,
        PADDING.width * 2,
        bounds.height + PADDING.height*2
    ), new Phaser.Rectangle(
        // Right
        bounds.right - PADDING.width,
        bounds.top - PADDING.height,
        PADDING.width * 2,
        bounds.height + PADDING.height*2
    )].forEach(function(rect, index) {
        this._createPlayerBound(rect, index, collisionGroup);
    }, this);
};

Supercold.Game.prototype._superhot = function() {
    var DELAY = 100, newLevel = this.level + 1;

    this._sprites.player.body.setZeroVelocity();

    // TODO: Add fancy effect.
    Supercold.storage.saveLevel(newLevel);
    this.time.events.add(DELAY, function superhot() {
        var superhot = Supercold.texts.SUPERHOT.split(' '),
            announcer = new Announcer(this.game, superhot, {
                nextDelay: 650,
                finalDelay: 400,
                repeat: true,
                overlay: true,
                overlayColor: 'light'
            }),
            superDuration = announcer.options.nextDelay + announcer.options.duration,
            hotDuration = announcer.options.finalDelay + announcer.options.duration,
            duration = superDuration + hotDuration,
            times = 4, delay = times * duration, i;

        for (i = 0; i < times; ++i) {
            this.time.events.add(i*duration, function saySuper() {
                this._superhotFx.play('super');
            }, this);
            this.time.events.add(i*duration + superDuration, function sayHot() {
                this._superhotFx.play('hot');
            }, this);
        }
        announcer.announce();

        this.time.events.add(delay, function nextLevel() {
            this.state.start('Game', CLEAR_WORLD, CLEAR_CACHE, {
                level: newLevel
            });
        }, this);
    }, this);
};

Supercold.Game.prototype._botKillHandler = function(bot, bullet, _botS, _bulletS) {
    bot.sprite.kill();
    bullet.sprite.kill();
    if (this.superhot) {
        this._superhot();       // SUPERHOT!
    }
};

Supercold.Game.prototype._spawnBot = function() {
    var view = this.camera.view, colGroups = this._colGroups,
        offset = (Supercold.player.radius * this._spriteScale) * 2 * 1.2,
        baseX, baseY, bot;

    baseX = ((this.rnd.between(0, 1)) ? view.left : view.right) * 1.2;
    baseY = ((this.rnd.between(0, 1)) ? view.top : view.bottom) * 1.2;

    bot = this._groups.bots.getFirstDead(
        true,
        this.rnd.between(baseX, baseX + offset),
        this.rnd.between(baseY, baseY + offset));
    bot.alpha = 0.1;
    this.add.tween(bot).to({
        alpha: 1
    }, 800, Phaser.Easing.Linear.None, AUTOSTART);
    bot.body.setCollisionGroup(colGroups.bots);
    // Bots collide against themselves, the player and all bullets.
    bot.body.collides([colGroups.bots, colGroups.player]);
    bot.body.collides(
        [colGroups.botBullets, colGroups.playerBullets], this._botKillHandler, this);
};


Supercold.Game.prototype.restart = function restart() {
    hideTip();
    this.state.restart(CLEAR_WORLD, CLEAR_CACHE, {level: this.level});
};

Supercold.Game.prototype.quit = function quit() {
    hideTip();
    this.state.start('MainMenu');
};

Supercold.Game.prototype.create = function() {
    var radius = Supercold.player.radius * this._spriteScale, player, boundsColGroup;

    if (DEBUG) log('Creating Game state: Level ' + this.level + '...');

    // Scaling should be specified first.
    this.setScaling();

    this.addBackground();

    this._superhotFx = this.add.audio('superhot');
    this._superhotFx.addMarker('super', 0, 0.825);
    this._superhotFx.addMarker('hot', 0.825, 0.775);

    // Collision groups for the player, the bots, the bullets and the bounds.
    this._colGroups.player = this.physics.p2.createCollisionGroup();
    this._colGroups.bots = this.physics.p2.createCollisionGroup();
    this._colGroups.playerBullets = this.physics.p2.createCollisionGroup();
    this._colGroups.botBullets = this.physics.p2.createCollisionGroup();
    boundsColGroup = this.physics.p2.createCollisionGroup();

    this.physics.p2.updateBoundsCollisionGroup();

    this._bulletTrailPainter = new BulletTrailPainter(this.game);
    // Create the bullet groups first, so that they are rendered under the bots.
    this._groups.playerBullets = new BulletGroup(this.game, 'Player Bullets');
    this._groups.botBullets = new BulletGroup(this.game, 'Bot Bullets');

    this._addPlayerBounds(boundsColGroup);

    // The player is positioned in a semi-random location inside their bounds.
    this._sprites.player = player = new Player(
        this.game,
        this.rnd.sign() * this.rnd.between(
            radius, this.bounds.right - PADDING.width - radius),
        this.rnd.sign() * this.rnd.between(
            radius, this.bounds.bottom - PADDING.height - radius));

    player.body.setCollisionGroup(this._colGroups.player);
    // The player collides with the bounds, the bots and the bullets.
    player.body.collides([boundsColGroup, this._colGroups.bots]);
    player.body.collides([this._colGroups.playerBullets, this._colGroups.botBullets],
        function lose(player, bullet) {
            var duration = 1500, overlay;

            // The collision handler may be called more than once!
            if (!player.sprite.alive) {
                return;
            }

            bullet.sprite.kill();
            if (this._mutators.godmode) {
                return;
            }

            overlay = this.add.existing(newOverlay(this.game));
            overlay.name = 'lose screen overlay';
            overlay.alpha = 0;
            this.add.tween(overlay).to({
                alpha: 1
            }, duration, Phaser.Easing.Linear.None, AUTOSTART)
                .onComplete.addOnce(function restart() {
                    this.time.events.add(Phaser.Timer.SECOND * 1.5, this.restart, this);
                    this.time.events.add(Phaser.Timer.SECOND * 1.5, hideTip, this);
                }, this);

            player.sprite.kill();
            // TODO: Add fancy effects.
            this.camera.shake(0.00086, 1200, true, Phaser.Camera.SHAKE_HORIZONTAL, false);
            showTipRnd();
        }, this);

    // The player is always in the center of the screen.
    this.camera.follow(player);

    this._groups.bots = new BotGroup(this.game, this._spriteScale);
    this._groups.bots.onChildInputDown.add(function hotswitch(bot, pointer) {
        var properties = {
            alpha: 0
        }, duration = 400, playerTween, botTweeen;

        if (DEBUG) log('Clicked on bot.');
        // Hotswitch may not be ready yet or we may be in the middle of it.
        if (this._nextHotSwitch > 0 || this._hotswitching) {
            return;
        }
        // Don't use Ctrl + left lick since it is a simulated right click!
        if ((pointer.leftButton.isDown && pointer.leftButton.shiftKey) ||
                pointer.rightButton.isDown) {
            if (DEBUG) log('Hotswitching...');
            this._hotswitching = true;
            // Fade out.
            playerTween = this.add.tween(player).to(
                properties, duration, Phaser.Easing.Linear.None, AUTOSTART);
            botTweeen = this.add.tween(bot).to(
                properties, duration, Phaser.Easing.Linear.None, AUTOSTART);
            botTweeen.onComplete.addOnce(function swap() {
                var temp;

                // Make the camera move more smoothly for the hotswitch.
                this.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON, 0.2, 0.2);

                temp = player.body.x;
                player.body.x = bot.body.x;
                bot.body.x = temp;
                temp = player.body.y;
                player.body.y = bot.body.y;
                bot.body.y = temp;

                this.camera.flash(0xEEEAE0, 250);

                // Fade in.
                properties.alpha = 1;
                playerTween.to(properties, duration, Phaser.Easing.Linear.None, AUTOSTART);
                botTweeen.to(properties, duration, Phaser.Easing.Linear.None, AUTOSTART);
                this._nextHotSwitch = this._hotswitchTimeout;
                botTweeen.onComplete.addOnce(function() {
                    // Reset the camera to its default behaviour.
                    this.camera.follow(player);
                    this._hotswitching = false;
                    if (DEBUG) log('Hotswitched.');
                }, this);
            }, this);
        }
    }, this);

    this._huds.minimap = new Minimap(this.game);
    this._huds.bulletBar = new BulletBar(this.game);
    this._huds.hotswitchBar = new HotswitchBar(this.game);

    // Create controls.
    this._controls.cursors = this.input.keyboard.createCursorKeys();
    this._controls.wasd = this.input.keyboard.addKeys(Supercold.controls.WASD);
    this._controls.fireKey = this.input.keyboard.addKey(Supercold.controls.fireKey);
    this.input.keyboard.addKey(Supercold.controls.quitKey)
        .onDown.addOnce(this.quit, this);
    this.input.keyboard.addKey(Supercold.controls.restartKey)
        .onDown.addOnce(this.restart, this);

    // The player should render above all other game entities (except text).
    player.bringToTop();
    // Calling bringToTop after enabling debugging hides the debug body.
    // http://phaser.io/docs/2.6.2/Phaser.Physics.P2.BodyDebug.html
    if (DEBUG) this.world.bringToTop(player.body.debugBody);

    if (this.level === 1) {
        // If the player just started playing, explain the game mechanics.
        new Announcer(this.game, Supercold.texts.MECHANICS.split(' '), {
            initDelay: 800,
            duration: 250,
            nextDelay: 250,
            flashTint: 0x4A4A4A,
            flashOffDuration: 475
        }).announce();
    } else {
        // Otherwise, simply tell in which level they are in.
        new Announcer(this.game, [Supercold.texts.LEVEL + ' ' + this.level], {
            initDelay: 800,
            duration: 500,
            nextDelay: 250,
            flashTint: 0x4A4A4A,
            flashOffDuration: 800
        }).announce();
    }

    // Decide when to spawn the first bot.
    this._nextBotTime = this.rnd.realInRange(0.04, 0.06);
    this._nextHotSwitch = this._hotswitchTimeout;
    this._hotswitching = false;
    this._fireRate = (this._mutators.fastgun) ? Supercold.fastFireRate : Supercold.fireRate;
};


/***** AI *****/

/**
 * p2.body.moveForward does not work in our case, so I rolled my own.
 */
function moveForward(body, rotation, speed) {
    // Note that Phaser.Physics.Arcade.html#velocityFromRotation won't work,
    // due to the Phaser.Physics.P2.InversePointProxy body.velocity instance.
    body.velocity.x = speed * Math.cos(rotation);
    body.velocity.y = speed * Math.sin(rotation);
}

Supercold.Game.prototype._getSpeed = function(playerAlive, playerMoved, playerRotated, speeds) {
    if (!playerAlive) return speeds.slow;
    if (playerMoved) return speeds.normal;
    if (this._mutators.fasttime) return speeds.slow;
    if (playerRotated) return speeds.slower;
    return speeds.frozen;
};

Supercold.Game.prototype._getBotSpeed = function(playerAlive, playerMoved, playerRotated) {
    return this._getSpeed(playerAlive, playerMoved, playerRotated, Supercold.speeds.bot);
};

Supercold.Game.prototype._getBulletSpeed = function(playerAlive, playerMoved, playerRotated) {
    return this._getSpeed(playerAlive, playerMoved, playerRotated, Supercold.speeds.bullet);
};

Supercold.Game.prototype._resetBullet = function(bullet, sprite) {
    // Place the bullet in front of the sprite, so that it doesn't kill it instantly.
    var offset = Supercold.player.radius*this._spriteScale +
            Math.round(3/4 * Supercold.bullet.width);

    // Set the position of the bullet almost in front of the sprite.
    bullet.reset(
        sprite.x + offset*Math.cos(sprite.body.rotation),
        sprite.y + offset*Math.sin(sprite.body.rotation));
    bullet.body.rotation = sprite.body.rotation;
    // Dispatch the onRevived signal after setting rotation.
    bullet.revive();
};

Supercold.Game.prototype._fireBullet = function(bullet, sprite, fireRate) {
    this._resetBullet(bullet, sprite);
    bullet.owner = sprite;
    sprite.remainingTime = fireRate;
};

Supercold.Game.prototype._firePlayerBullet = function() {
    var player = this._sprites.player;

    // Not ready to fire yet.
    if (player.remainingTime > 0)
        return false;
    if (DEBUG) log('Player bullet exists: ' + (this._groups.playerBullets.getFirstExists(false) !== null));
    this._fireBullet(
        this._groups.playerBullets.getFirstExists(false) || this._createPlayerBullet(),
        player, this._fireRate);
    return true;
};

Supercold.Game.prototype._fireBotBullet = function(bot) {
    // Not ready to fire yet.
    if (bot.remainingTime > 0)
        return;
    // Wait sometimes before firing to make things a bit more unpredictable.
    if (this.rnd.frac() <= 1/3) {
        bot.remainingTime = this.rnd.between(
            0, Math.max(Supercold.fireRate * (1 - this.level/100), 0));
        return;
    }
    if (DEBUG) log('Bot bullet exists: ' + (this._groups.botBullets.getFirstExists(false) !== null));
    this._fireBullet(
        this._groups.botBullets.getFirstExists(false) || this._createBotBullet(),
        bot, Supercold.fireRate);
};

Supercold.Game.prototype._advanceBullet = function(bullet, speed) {
    moveForward(bullet.body, bullet.body.rotation, speed);
};

Supercold.Game.prototype._advanceBot = function(
        bot, speed, playerFired, elapsedTime) {
    var player = this._sprites.player, range = Math.PI/2.25, direction, angleDiff;

    bot.remainingTime -= elapsedTime;

    // Even though we use P2 physics, this function should work just fine.
    bot.body.rotation = this.physics.arcade.angleBetween(bot, player);
    // bot.body.rotation = Math.atan2(player.y - bot.y, player.x - bot.x);

    // Only shoot if the bot is somewhat close to the player.
    if (this.physics.arcade.distanceBetween(bot, player) <
            Math.min(this.game.width, this.game.height)) {
        this._fireBotBullet(bot);
    }

    if (bot.dodging) {
        direction = ((bot.direction === 'left') ? 1 : -1) * Math.PI/2;
        moveForward(bot.body, bot.body.rotation + direction, speed);
        bot.duration -= elapsedTime;
        if (bot.duration <= 0) {
            bot.dodging = false;
        }
        return;
    }

    // TODO: Consider more complicated movement patterns.
    moveForward(bot.body, bot.body.rotation, speed);

    // If the player fired and we are not already dodging, try to dodge.
    if (playerFired) {
        // Dodge only when the player is facing us, so it doesn't look stupid.
        angleDiff = this.math.reverseAngle(player.body.rotation) -
            this.math.normalizeAngle(bot.body.rotation);
        if (!(angleDiff < range && angleDiff > -range))
            return;
        // Dodge sometimes (chance in range [1/3,3/4]).
        if (this.rnd.frac() <= 1/3 + Math.min(5/12, 5/12 * this.level/100)) {
            bot.dodging = true;
            bot.duration = 0.25 + 0.005*this.level;   // secs
            bot.direction = (this.rnd.between(0, 1)) ? 'left' : 'right';
        }
    }
};

/** @const */
var USE_WORLD_COORDS = true;

Supercold.Game.prototype._rotatePlayer = function() {
    var player = this._sprites.player, playerRotated, newRotation;

    // Even though we use P2 physics, this function should work just fine.
    // Calculate the angle using World coords, because scaling messes it up.
    newRotation = this.physics.arcade.angleToPointer(
        player, undefined, USE_WORLD_COORDS);
    playerRotated = (player.body.rotation !== newRotation);
    player.body.rotation = newRotation;
    return playerRotated;
};

Supercold.Game.prototype.update = function() {
    var player = this._sprites.player,
        wasd = this._controls.wasd,
        cursors = this._controls.cursors,
        fireKey = this._controls.fireKey,
        verVec = this._cached.verVec,
        horVec = this._cached.horVec,
        playerFired = false,
        playerMoved, playerRotated, newDirection,
        bulletSpeed, botSpeed, elapsedTime;

    if (this.superhot) {
        return;
    }

    // Angular velocity may change due to collisions, so set it to zero.
    player.body.setZeroRotation();

    // Process movement controls.
    // Find where the player is heading, by calculating the
    // angle between the horizontal and the vertical vector.
    verVec.y = horVec.x = 0;        // The other axes are never changed.
    if (wasd.up.isDown || cursors.up.isDown) {
        verVec.y = 1;
    } else if (wasd.down.isDown || cursors.down.isDown) {
        verVec.y = -1;
    }
    if (wasd.left.isDown || cursors.left.isDown) {
        horVec.x = -1;
    } else if (wasd.right.isDown || cursors.right.isDown) {
        horVec.x = 1;
    }
    playerMoved = (verVec.y !== 0 || horVec.x !== 0);
    playerRotated = this._rotatePlayer() && !this._mutators.freelook;

    if (player.alive) {
        // Process firing controls.
        if ((this.input.activePointer.leftButton.isDown &&
                    !this.input.activePointer.leftButton.shiftKey) ||
                fireKey.isDown) {
            playerFired = this._firePlayerBullet();
        }

        if (playerMoved) {
            newDirection = this.physics.arcade.angleBetween(verVec, horVec);
            moveForward(player.body, newDirection, Supercold.speeds.player);
        } else {
            player.body.setZeroVelocity();
        }
    }

    bulletSpeed = this._getBulletSpeed(player.alive, playerMoved, playerRotated);
    botSpeed = this._getBotSpeed(player.alive, playerMoved, playerRotated);

    // When time slows down, distort the elapsed time proportionally.
    elapsedTime = this.time.physicsElapsed *
        (bulletSpeed / Supercold.speeds.bullet.normal);
    player.remainingTime -= elapsedTime;

    if (!this._hotswitching) {
        this._nextHotSwitch -= elapsedTime;
    }
    // Check if there are any more bots to spawn.
    if (this._totalBotCount > 0) {
        this._nextBotTime -= elapsedTime;
        if (this._nextBotTime <= 0) {
            --this._totalBotCount;
            this._spawnBot();
            this._nextBotTime = this.rnd.realInRange(
                Math.max(1.4 - 0.01*this.level, 0),
                Math.max(2.8 - 0.02*this.level, 0));
        }
    }

    // Update bots.
    this._groups.bots.forEachAlive(
        this._advanceBot, this, botSpeed, playerFired, elapsedTime);
    // Update bullets.
    this._groups.playerBullets.forEachAlive(
        this._advanceBullet, this, bulletSpeed);
    this._groups.botBullets.forEachAlive(
        this._advanceBullet, this, bulletSpeed);
    this._bulletTrailPainter.updateTrails(elapsedTime);
    // Update the minimap.
    this._huds.minimap.update(player, this._groups.bots);
    if (player.alive) {
        this._huds.bulletBar.update(
            Math.min(1, 1 - player.remainingTime / this._fireRate));
        this._huds.hotswitchBar.update(
            Math.min(1, 1 - this._nextHotSwitch/this._hotswitchTimeout));
    }
};


/**
 * Performs final cleanup.
 */
Supercold.Game.prototype.shutdown = function() {
    /*
     * Reminder:
     * Because BitmapData's are now Game Objects themselves, and don't live on
     * the display list, they are NOT automatically cleared when we change
     * State. Therefore we must call BitmapData.destroy in our State's
     * shutdown method if we wish to free-up the resources they use.
     * Note that BitmapData objects added to the cache will be destroyed for us.
     */
};


/**
 * Used here for debugging purposes.
 */
Supercold.Game.prototype.render = function() {
    if (DEBUG) {
        this.showDebugInfo(this._sprites.player);
    }
};

/****************************** Setup and Expose ******************************/

function emptyClassName(selector) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(el) {
        el.className = '';
    });
}

Supercold.play = function play(parent, config) {
    // Tell Phaser to cover the entire window and use the best renderer.
    var game = new Phaser.Game('100', '100', Phaser.AUTO, parent),
        unlockLevels = [10, 20, 30, 40, 50, 75, 100],
        mutators, mutator, level, i;

    /**
     * The single instance of data storage for our game.
     */
    Supercold.storage = new Supercold.GameStorageManager();

    mutators = Supercold.storage.loadMutators();
    if (mutators === null) {
        Supercold.storage.saveMutators({
            freelook: false,
            fasttime: false,
            fastgun: false,
            bighead: false,
            chibi: false,
            superhotswitch: false,
            lmtdbullets: false,
            doge: false,
            godmode: false
        });
    }
    for (mutator in mutators) {
        if (mutators.hasOwnProperty(mutator)) {
            document.getElementById(mutator).checked = mutators[mutator];
        }
    }

    level = Supercold.storage.loadLevel();
    for (i = 0; i < unlockLevels.length; ++i) {
        if (unlockLevels[i] <= level) {
            emptyClassName('.locked' + unlockLevels[i]);
        } else {
            break;
        }
    }

    Array.prototype.forEach.call(document.querySelectorAll('#mutators input'), function(input) {
        input.addEventListener('change', function(event) {
            var mutators = Supercold.storage.loadMutators();

            mutators[this.id] = this.checked;
            Supercold.storage.saveMutators(mutators);
        }, false);
    });

    // Global per-instance options. Use a namespace to avoid name clashes.
    game.supercold = Phaser.Utils.extend({
        onMainMenuOpen: noop
    }, config);

    game.state.add('Boot', Supercold.Boot);
    game.state.add('Preloader', Supercold.Preloader);
    game.state.add('MainMenu', Supercold.MainMenu);
    game.state.add('Intro', Supercold.Intro);
    game.state.add('Game', Supercold.Game);

    game.state.start('Boot');

    return game;
};

window.Supercold = Supercold;

}(window, Phaser));
