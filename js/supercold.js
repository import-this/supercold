/**
 * SUPERCOLD
 * https://import-this.github.io/supercold
 *
 * A simple and crude 2D HTML5 game with the clever mechanics of SUPERHOT.
 * (You can check out SUPERHOT @ http://superhotgame.com/)
 *
 * Copyright (c) 2016, Vasilis Poulimenos
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
 * Date: 31/7/2016
 * @version: 1.0.0
 * @author Vasilis Poulimenos
 */

/*globals Phaser */
(function(window, Phaser) {

"use strict";

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
 * A storage manager for the game.
 * Manages local storage.
 *
 * @param {Storage} [localStorage=window.localStorage] - The local storage.
 * @constructor
 */
function GameStorageManager(localStorage) {
    var levelKey = GameStorageManager._LEVEL_KEY,
        timesKey = GameStorageManager._TIMES_PLAYED_KEY;

    this._local = localStorage || window.localStorage;
    this._local.setItem(levelKey, this._local.getItem(levelKey) || 1);
    this._local.setItem(timesKey, this._local.getItem(timesKey) || 0);
}

/**
 * Local storage is per origin (per domain and protocol),
 * so use a prefix to avoid collisions with other games.
 * @const {string}
 */
GameStorageManager.PREFIX = 'supercold_';
/** @const {string} */
GameStorageManager._LEVEL_KEY = GameStorageManager.PREFIX + 'level';
/** @const {string} */
GameStorageManager._TIMES_PLAYED_KEY = GameStorageManager.PREFIX + 'timesPlayed';
/** @const {string} */
GameStorageManager._RND_STATE_KEY = GameStorageManager.PREFIX + 'rndState';

/** @const {string} */
GameStorageManager._LEVEL_TYPE_MSG = 'Level cannot be interpreted as a number';
/** @const {string} */
GameStorageManager._NEG_LEVEL_MSG = 'Negative level';

/**
 * Clears the local storage.
 * @return {GameStorageManager} this
 */
GameStorageManager.prototype._clearLocal = function() {
    this._local.clear();
    return this;
};

/**
 * Clears the storage.
 * @return {GameStorageManager} this
 */
GameStorageManager.prototype.clear = function() {
    return this._clearLocal();
};

/**
 * Returns the last level that the player played.
 * @return {number} The last level.
 */
GameStorageManager.prototype.getLevel = function() {
    return Number(this._local.getItem(GameStorageManager._LEVEL_KEY));
};

/**
 * Sets the last level that the player played.
 *
 * @param {number} level - The new level.
 * @throws {TypeError} if the parameter cannot be interpreted as a number.
 * @throws {RangeError} if the new level is negative.
 */
GameStorageManager.prototype.setLevel = function(level) {
    level = Number(level);
    if (isNaN(level)) {
        throw new TypeError(GameStorageManager._LEVEL_TYPE_MSG);
    }
    if (level < 0) {
        throw new RangeError(GameStorageManager._NEG_LEVEL_MSG);
    }
    this._local.setItem(GameStorageManager._LEVEL_KEY, level);
};

/**
 * Erases the last level.
 */
GameStorageManager.prototype.resetLevel = function() {
    this._local.setItem(GameStorageManager._LEVEL_KEY, 0);
};

/**
 *
 * @return {object}
 */
GameStorageManager.prototype.getRndState = function() {
    return this._local.getItem(GameStorageManager._RND_STATE_KEY);
};

/**
 *
 */
GameStorageManager.prototype.setRndState = function(state) {
    this._local.setItem(GameStorageManager._RND_STATE_KEY, state);
};

/********************************* Supercold **********************************/

/**
 * Don't forget to set this to false in production!
 * @const
 */
var DEBUG = !true;

/**
 * Some module global settings for our Phaser game.
 * @const
 */
var CLEAR_WORLD = true,
    CLEAR_CACHE = false,
    /**
     * Arcade physics support AABB (but not BB) vs Circle collision detection
     * since version 2.6.0 (released 8/7/2016), but there seems to be a bug as
     * of version 2.6.1 that causes such collision detection to fail at times.
     * So let's use the more expensive but powerful P2 physics system.
     *
     * Note: When a game object is given a P2 body, it has its anchor set to 0.5.
     */
    PHYSICS_SYSTEM = Phaser.Physics.P2JS,

    /**
     * Cache keys.
     */
    CACHE_KEY_PLAYER = 'player',
    CACHE_KEY_BOT = 'bot',
    CACHE_KEY_BULLET = 'bullet',
    CACHE_KEY_TRAIL = 'trail',
    CACHE_KEY_BG = 'background',
    CACHE_KEY_FLASH = 'flash',
    CACHE_KEY_OVERLAY_DARK = 'overlay_dark',
    CACHE_KEY_OVERLAY_LIGHT = 'overlay_light',

    DEBUG_POSX = 32;

/*
 * Note: All dimensions/lengths/distances are measured in pixels.
 *       It's best to keep all values round.
 */

/**
 *
 * The screen ratio for most devices is 16/9,
 * so we pick a corresponding resolution.
 * http://www.w3schools.com/browsers/browsers_display.asp
 * https://www.w3counter.com/globalstats.php
 *
 * @const
 */
var NATIVE_WIDTH = 1366,
    NATIVE_HEIGHT = 768,
    // Enough padding so that the player is always centered.
    PADDING = {
        width: Math.round(NATIVE_WIDTH / 2),
        height: Math.round(NATIVE_HEIGHT / 2)
    },

    FACTOR_SLOW = 10,
    FACTOR_SLOWER = 50,
    FACTOR_FROZEN = 200,

    // Idea: 4 seconds for the player to move from one end to the other.
    // Even though with P2 this is not actually the end result (check p2.pxm).
    PLAYER_SPEED = Math.round(NATIVE_WIDTH / 4),
    BOT_SPEED_NORMAL = PLAYER_SPEED,
    BULLET_SPEED_NORMAL = PLAYER_SPEED * 5;


/**
 * The Supercold namespace.
 * @namespace
 */
var Supercold = {
    /**
     * Supercold world size (in pixels). Let it be a power of 2.
     */
    world: {
        width: 2048,
        height: 2048
    },

    /**
     * Sprite properties.
     *
     * Note:
     * To avoid single-pixel jitters on mobile devices, it is strongly
     * recommended to use Sprite sizes that are even on both axis.
     */
    player: {
        radius: 30,
        sideLen: 20
    },
    bullet: {
        width: 16,
        height: 8,
        bodyLen: 8,
        tipRadius: 4
    },

    speeds: {
        player: PLAYER_SPEED,
        bot: {
            normal: PLAYER_SPEED,
            slower: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOWER),
            frozen: Math.round(BOT_SPEED_NORMAL / FACTOR_FROZEN),
            slow: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOW)
        },
        bullet: {
            normal: BULLET_SPEED_NORMAL,
            slower: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOWER),
            frozen: Math.round(BULLET_SPEED_NORMAL / FACTOR_FROZEN),
            slow: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOW)
        }
    },

    // 2 times per second
    fireRate: 1 / 2,

    /**
     * Styling options.
     */
    style: {
        stage: {
            backgroundColor: 'rgb(10, 10, 10)'
        },
        background: {
            lightColor: 'rgb(152, 152, 152)',
            darkColor: 'rgb(64, 64, 64)'
        },
        overlay: {
            lightColor: 'rgba(32, 32, 32, 0.375)',
            darkColor: 'rgba(0, 0, 0, 0.675)'
        },
        player: {
            color: 'rgb(34, 34, 34)',
            strokeStyle: 'rgba(44, 44, 44, 0.95)',
            lineWidth: 6,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(238, 238, 238, 0.95)',
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
        bullet: {
            color: 'rgb(30, 35, 38)'
        },
        trail: {
            x1: 0,
            y1: 0,
            x2: 400,
            y2: 0,
            colorStops: [
                {stop: 0.0, color: 'rgba(255, 34, 33, 0.00)'},
                {stop: 0.1, color: 'rgba(255, 34, 33, 0.10)'},
                {stop: 0.8, color: 'rgba(255, 34, 33, 0.85)'},
                {stop: 0.9, color: 'rgba(255, 34, 33, 0.95)'},
                {stop: 1.0, color: 'rgba(255, 34, 33, 0.85)'}
            ],
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(255, 34, 33, 0.85)',
            shadowBlur: 5
        },
        grid: {
            color: 'rgb(245, 250, 255)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgb(240, 251, 255)',
            shadowBlur: 2
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
                {stop: 0.00, color: 'rgba(254, 254, 254, 0.90)'},
                {stop: 1.00, color: 'rgba(191, 234, 240, 0.00)'}
            ]
        }, {
            colorStops: [
                {stop: 0.00, color: 'rgba(17, 15, 18, 0.60)'},
                {stop: 0.25, color: 'rgba(33, 60, 71, 0.60)'},
                {stop: 1.00, color: 'rgba(73, 142, 157, 0.05)'},
            ]
        }], */
        flash: {
            colorStops: [
                {stop: 0.0, color: 'rgba(255, 255, 255, 0.3)'},
                {stop: 0.4, color: 'rgba(245, 255, 255, 0.6)'},
                {stop: 0.5, color: 'rgba(240, 251, 255, 0.7)'},
                {stop: 0.6, color: 'rgba(245, 255, 255, 0.8)'},
                {stop: 1.0, color: 'rgba(255, 255, 255, 1.0)'}
            ]
        },
        superhot: {
            font: 'Arial',
            fontSize: '300px',
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


// Make sure these dimensions divide the world dimensions evenly.
Supercold.cell = {
    width: Supercold.world.width / 32,
    height: Supercold.world.height / 32
};


if (DEBUG) {
    (function check() {
        var x = Supercold.world.width / Supercold.cell.width,
            y = Supercold.world.width / Supercold.cell.height;

        if (x !== Math.round(x) || y !== Math.round(y)) {
            log('WARN: Cells do not divide the world evenly!');
        }
    }());

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
            return game.cache.getBitmapData(CACHE_KEY_OVERLAY_LIGHT);
        case 'dark':
            /* falls through */
        default:
            return game.cache.getBitmapData(CACHE_KEY_OVERLAY_DARK);
    }
}

function newOverlay(game, color) {
    return new CenteredImage(game, getOverlayBitmap(game, color));
}


/**
 * An object that displays messages to the player.
 *
 * @param {Array.<string>} text - The word/phrase to display.
 * @param {object} [options] - A customization object.
 * @param {number} [options.initDelay=0] - How long to wait before starting.
 * @param {number} [options.nextDelay=500] - How long to wait before showing next word.
 * @param {number} [options.duration=500] - .
 * @param {number} [options.flashOnDuration=50] - How long it will take to turn the flash on.
 * @param {number} [options.flashOffDuration=250] - How long it will take to turn the flash off.
 * @param {number} [options.flashTint=0xFFFFFF] - A tint to change the color of the flash.
 * @param {boolean} [options.repeat=false] - Repeat the announcement forever.
 * @param {boolean} [options.overlay=false] - .
 * @param {string}  [options.overlayColor='dark'] - 'light' or 'dark' shade.
 * @param {function} [options.onComplete=noop] - An action to perform after the announcer is done.
 */
function Announcer(game, text, options) {
    this.options = Phaser.Utils.extend({}, Announcer.defaults, options);

    if (this.options.overlay) {
        this.overlay = game.add.existing(newOverlay(game, this.options.overlayColor));
        this.overlay.name = 'Announcer overlay';
    } else {
        // Add a null object.
        this.overlay = game.add.image(0, 0, null);
    }

    this.flash = game.add.existing(new CenteredImage(
        game, game.cache.getBitmapData(CACHE_KEY_FLASH)));
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

Announcer.prototype._next2 = function() {
    this.textGroup.cursor.kill();
    this.textGroup.next();
    if (this.options.repeat || this.textGroup.cursorIndex !== 0) {
        this._announce();
    } else {
        this._destroy();
        this.options.onComplete.call(this);
    }
};

Announcer.prototype._next = function() {
    this.time.events.add(this.options.nextDelay, this._next2, this);
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
    tween.onComplete.addOnce(this._next, this);
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
    // Due to the way 'fixedToCamera' works (see 'cameraOffset'), set it for
    // each text object individually (instead of setting it for the group).
    // Check ./src/gameobjects/components/FixedToCamera.js
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
    var scale = this.camera.scale,
        // Account for camera scaling (only when expansion is needed).
        width = this.bounds.width * Math.max(1, scale.x),
        height = this.bounds.height * Math.max(1, scale.y);

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
    // Set scaling first, since the scale factor will be used next.
    this._setCameraScale(width, height);
    // Reset the world size, because resizing messes it up.
    this._setWorldBounds();
    if (DEBUG) log('Resized game.');
};

Supercold._ScalableState.prototype.addBackground = function() {
    var background = this.add.image(0, 0, this.cache.getBitmapData(CACHE_KEY_BG));

    background.anchor.set(0.5);
    return background;
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
Supercold.Preloader = function(game) {};

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

    ctx.translate(player.radius - Math.round(player.sideLen / 1.7), 0);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-player.sideLen, 0);
    ctx.lineTo(0, player.sideLen);
    ctx.lineTo(player.sideLen, 0);
    ctx.stroke();

    ctx.globalCompositeOperation = 'destination-over';
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = style.shadowBlur;
    ctx.fill();
};

Supercold.Preloader.prototype._makePlayerBitmap = function() {
    this._makeLiveEntityBitmap(Supercold.style.player, CACHE_KEY_PLAYER);
};

Supercold.Preloader.prototype._makeBotBitmap = function() {
    this._makeLiveEntityBitmap(Supercold.style.bot, CACHE_KEY_BOT);
};

Supercold.Preloader.prototype._makeBulletBitmap = function() {
    var bullet = Supercold.bullet,
        bmd = makeBitmapData(this, bullet.width, bullet.height, CACHE_KEY_BULLET),
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
        bmd = makeBitmapData(this, style.x2, height, CACHE_KEY_TRAIL),
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
        bmd = makeBitmapData(this, paddedWidth, paddedHeight, CACHE_KEY_BG),
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
    ctx.strokeStyle = Supercold.style.grid.color;
    ctx.shadowColor = Supercold.style.grid.shadowColor;
    ctx.shadowBlur = Supercold.style.grid.shadowBlur;

    ctx.beginPath();
    // Draw horizontal lines
    ctx.save();
    ctx.translate(0, PADDING.height);
    // inside world
    for (i = 0; i <= height; i += Supercold.cell.height) {
        ctx.moveTo(0, i);
        ctx.lineTo(paddedWidth, i);
    }
    // in padded area
    for (i = 0; i <= PADDING.height; i += Supercold.cell.height) {
        ctx.moveTo(0, -i);
        ctx.lineTo(paddedWidth, -i);
        ctx.moveTo(0, height + i);
        ctx.lineTo(paddedWidth, height + i);
    }
    ctx.restore();
    // Draw vertical lines
    ctx.save();
    ctx.translate(PADDING.width, 0);
    // inside world
    for (i = 0; i <= width; i += Supercold.cell.width) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, paddedHeight);
    }
    // in padded area
    for (i = 0; i <= PADDING.width; i += Supercold.cell.width) {
        ctx.moveTo(-i, 0);
        ctx.lineTo(-i, paddedHeight);
        ctx.moveTo(width + i, 0);
        ctx.lineTo(width + i, paddedHeight);
    }
    ctx.restore();
    ctx.stroke();
};

Supercold.Preloader.prototype._makeFlashBitmap = function() {
    var centerX = (NATIVE_WIDTH - 1) / 2,
        centerY = (NATIVE_HEIGHT - 1) / 2,
        radius = Math.min(centerX, centerY),
        bmd = makeBitmapData(this, NATIVE_WIDTH, NATIVE_HEIGHT, CACHE_KEY_FLASH),
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

    bmd = makeBitmapData(this, NATIVE_WIDTH, NATIVE_HEIGHT, CACHE_KEY_OVERLAY_DARK);
    bmd.rect(0, 0, bmd.width, bmd.height, Supercold.style.overlay.darkColor);
    bmd = makeBitmapData(this, NATIVE_WIDTH, NATIVE_HEIGHT, CACHE_KEY_OVERLAY_LIGHT);
    bmd.rect(0, 0, bmd.width, bmd.height, Supercold.style.overlay.lightColor);
};


Supercold.Preloader.prototype.preload = function() {};

Supercold.Preloader.prototype.create = function() {
    if (DEBUG) log('Creating Preloader state...');

    this._makePlayerBitmap();
    this._makeBotBitmap();
    this._makeBulletBitmap();
    this._makeTrailBitmap();
    this._makeBackgroundBitmap();
    this._makeFlashBitmap();
    this._makeOverlayBitmaps();
};

Supercold.Preloader.prototype.update = function() {
    // No actual wait for asset loading, so go to the next state immediately.
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
        this.game.debug.cameraInfo(this.camera, DEBUG_POSX, 128);
        this.game.debug.inputInfo(DEBUG_POSX, 128+64+32);
        this.game.debug.pointer(this.input.activePointer);
        this.game.debug.text('DEBUG: ' + DEBUG, DEBUG_POSX, this.game.height-16);
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
                level: Supercold.storage.getLevel()
            });
        }).bind(this)
    }).announce();
};

/******************************* Game State *******************************/

function BulletTrailManager(game) {
    this.camera = game.camera;
    this.math = game.math;

    this._liveTrails = {};
    this._deadTrails = {};
    this._trailBmd = game.cache.getBitmapData(CACHE_KEY_TRAIL);
    this._bmd = game.make.bitmapData(game.world.width, game.world.height);

    this._bmd.addToWorld(0, 0, 0.5, 0.5);
    // Take into account where the world (0, 0) coords are.
    this._bmd.ctx.translate(-game.world.bounds.x, -game.world.bounds.y);
}

BulletTrailManager.prototype.destroy = function() {
    this._bmd.destroy();
};

BulletTrailManager.prototype._getLength = function(bullet, trail) {
    return Math.min(
        this.math.distance(bullet.x, bullet.y, trail.startX, trail.startY),
        this._trailBmd.width);
};

BulletTrailManager.prototype.addTrail = function(bullet) {
    this._liveTrails[bullet.name] = {
        bullet: bullet,
        startX: bullet.x,
        startY: bullet.y
    };
};

BulletTrailManager.prototype.stopTrail = function(bullet) {
    var trail = this._liveTrails[bullet.name];

    // Check if the trail exists, because the col. handler may be called twice!
    if (trail) {
        this._deadTrails[bullet.name] = {
            rotation: bullet.body.rotation,
            stopX: bullet.x,
            stopY: bullet.y,
            offsetX: bullet.offsetX,
            offsetY: bullet.offsetY,
            curLength: this._getLength(bullet, trail)
        };
        delete this._liveTrails[bullet.name];
    }
};

BulletTrailManager.prototype._destroyTrail = function(bullet) {
    delete this._liveTrails[bullet.name];
};

BulletTrailManager.prototype._drawTrail = function(
        bulletX, bulletY, bulletRotation, trailLength, offsetX, offsetY) {
    var ctx = this._bmd.ctx;

    ctx.save();
    // Move (0, 0) to the bullet coords,
    ctx.translate(bulletX, bulletY);
    // rotate the canvas as much as the bullet is rotated,
    ctx.rotate(bulletRotation);
    // move behind the bullet as needed (+ 4 for hiding the round cap),
    ctx.translate(-trailLength - offsetX + 4, -offsetY);
    // squeeze the trail on the x-axis,
    ctx.scale(trailLength / this._trailBmd.width, 1);
    // and draw it, at last.
    ctx.drawImage(this._trailBmd.canvas, 0, 0);
    ctx.restore();

    this._bmd.dirty = true;
};

BulletTrailManager.prototype.updateTrails = function(elapsedTime) {
    var view = this.camera.view, scale = this.camera.scale, slack = 1.1,
        name, trail, bullet, length;

    // Clear the camera view only. We need to take scaling into account.
    this._bmd.clear(
        // Adjust the x/y coords (move to the left/top, accordingly).
        // Note the slack value fix when we are in a negative quadrant.
        Math.floor((view.x / scale.x) / ((view.x > 0) ? slack : 1/slack)),
        Math.floor((view.y / scale.y) / ((view.y > 0) ? slack : 1/slack)),
        // Adjust the view dimensions (double the slack due to the x/y fix).
        Math.ceil((view.width / scale.x) * (2 * slack)),
        Math.ceil((view.height / scale.y) * (2 * slack)));

    for (name in this._liveTrails) {
        if (!this._liveTrails.hasOwnProperty(name))
            continue;
        trail = this._liveTrails[name];

        bullet = trail.bullet;
        // Don't round this value, since it causes jitter.
        length = this._getLength(bullet, trail);

        this._drawTrail(bullet.x, bullet.y, bullet.rotation,
                        length, bullet.offsetX, bullet.offsetY);
    }
    for (name in this._deadTrails) {
        if (!this._deadTrails.hasOwnProperty(name))
            continue;
        trail = this._deadTrails[name];

        // Don't round this value, since it causes jitter.
        trail.curLength -= Supercold.speeds.bullet.normal * elapsedTime;
        if (trail.curLength < 0) {
            this._destroyTrail(trail);
            continue;                   // No trail to draw.
        }

        this._drawTrail(trail.stopX, trail.stopY, trail.rotation,
                        trail.curLength, trail.offsetX, trail.offsetY);
    }
};


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

    // Elapsed time since last bullet was fired.
    this.elapsedTime = Supercold.fireRate;
}

LiveSprite.prototype = Object.create(Phaser.Sprite.prototype);
LiveSprite.prototype.constructor = LiveSprite;

/**
 * The player.
 */
function Player(game, x, y, _key, _frame) {
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE_KEY_PLAYER));

    this.name = 'Player';
    this.game.add.existing(this);

    // No group for Player, so enable physics here.
    this.game.physics.enable(this, PHYSICS_SYSTEM, DEBUG);
    this.body.setCircle(Supercold.player.radius);
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
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE_KEY_BOT));

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
    Phaser.Sprite.call(this, game, x, y, game.cache.getBitmapData(CACHE_KEY_BULLET));

    /**
     * Who shot the bullet.
     */
    this.owner = null;

    this.name = 'Bullet ' + Bullet.count++;
    this.checkWorldBounds = true;
    this.outOfBoundsKill = true;
}

Bullet.count = 0;

Bullet.prototype = Object.create(Phaser.Sprite.prototype);
Bullet.prototype.constructor = Bullet;

Bullet.prototype.kill = function() {
    // TODO: Add fancy kill effect.
    Phaser.Sprite.prototype.kill.call(this);
};


function extendName(sprite, group) {
    sprite.name += ', ' + (group.length-1) + ' in ' + group.name;
}

/**
 * A group of 'Bot's with enabled physics.
 */
function BotGroup(game, name, parent) {
    name = name || 'Bots';
    Phaser.Group.call(this, game, parent, name, false, true, PHYSICS_SYSTEM);

    this.classType = Bot;
}

BotGroup.prototype = Object.create(Phaser.Group.prototype);
BotGroup.prototype.constructor = BotGroup;

BotGroup.prototype.create = function(x, y) {
    var bot = Phaser.Group.prototype.create.call(this, x, y, null, null);

    extendName(bot, this);
    bot.body.setCircle(Supercold.player.radius);
    bot.body.debug = DEBUG;

    return bot;
};

/**
 * A group of 'Bullet's with enabled physics.
 */
function BulletGroup(game, name, parent) {
    name = name || 'Bullets';
    Phaser.Group.call(this, game, parent, name, false, true, PHYSICS_SYSTEM);

    this.classType = Bullet;
}

BulletGroup.prototype = Object.create(Phaser.Group.prototype);
BulletGroup.prototype.constructor = BulletGroup;

BulletGroup.prototype.create = function() {
    var bullet = Phaser.Group.prototype.create.call(this, 0, 0, null, null, false),
        specs = Supercold.bullet,
        offsetX = (specs.width - specs.bodyLen) / 2;

    extendName(bullet, this);
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
    this._trailManager = null;

    // These will be set in init.
    this.level = -1;
    this._totalBotCount = -1;

    // Time remaining since next bot spawn.
    this._nextBotTime = 0;

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


Supercold.Game.prototype.init = function(options) {
    this.level = options.level;
    this._totalBotCount = 4 + Math.floor(this.level * 0.75);
};


Supercold.Game.prototype._addBullets = function() {
    function addTrail(bullet) {
        /*jshint validthis: true */
        this._trailManager.addTrail(bullet);
    }
    function stopTrail(bullet) {
        /*jshint validthis: true */
        this._trailManager.stopTrail(bullet);
    }

    function bulletHandler(myBullet, otherBullet) {
       myBullet.sprite.kill();
       // The other bullet will be killed by the other handler call.
       // TODO: Add fancy effects.
    }

    function createBullets(context, group, quantity, colGroups) {
        var i, child;

        for (i = 0; i < quantity; ++i) {
            child = group.create();
            child.events.onRevived.add(addTrail, context);
            child.events.onKilled.add(stopTrail, context);
            child.body.setCollisionGroup(colGroups.mine);
            child.body.collides(colGroups.other);
            child.body.collides(colGroups.bullets, bulletHandler, context);
        }
    }

    var playerBulletCount = 12, botsBulletCount = 4 * this._totalBotCount;

    this._groups.playerBullets = new BulletGroup(this.game, 'Player Bullets');
    // The bullets of the player collide with the bots and their bullets.
    createBullets(this, this._groups.playerBullets, playerBulletCount, {
        mine: this._colGroups.playerBullets,
        other: this._colGroups.bots,
        bullets: this._colGroups.botBullets
    });
    this._groups.botBullets = new BulletGroup(this.game, 'Bot Bullets');
    // The bullets of the bots collide with all bullets and all live entities.
    createBullets(this, this._groups.botBullets, botsBulletCount, {
        mine: this._colGroups.botBullets,
        other: [this._colGroups.player, this._colGroups.bots],
        bullets: [this._colGroups.playerBullets, this._colGroups.botBullets]
    });
};

Supercold.Game.prototype._createPlayerBound = function(rect, i, collisionGroup) {
    var bound = this._sprites.bounds.create(rect.x, rect.y, null);

    bound.name = 'Bound ' + i;
    bound.body.static = true;
    bound.body.setRectangle(
        rect.width, rect.height, rect.halfWidth, rect.halfHeight);
    bound.body.setCollisionGroup(collisionGroup);
    // The bounds collide with the player.
    bound.body.collides(this._colGroups.player);
    bound.body.debug = DEBUG;
};

/**
 * Create boundaries around the world that restrict the player's movement.
 */
Supercold.Game.prototype._addPlayerBounds = function(collisionGroup) {
    var bounds = this.bounds;

    this._sprites.bounds = this.add.physicsGroup(PHYSICS_SYSTEM);
    this._sprites.bounds.name = 'Player Bounds';
    [new Phaser.Rectangle(
        // Top
        bounds.left,                        // x
        bounds.top,                         // y
        bounds.width,                       // width
        PADDING.height                      // height
    ), new Phaser.Rectangle(
        // Bottom
        bounds.left,
        bounds.bottom - PADDING.height,
        bounds.width,
        PADDING.height
    ), new Phaser.Rectangle(
        // Left
        bounds.left,
        bounds.top,
        PADDING.width,
        bounds.height
    ), new Phaser.Rectangle(
        // Right
        bounds.right - PADDING.width,
        bounds.top,
        PADDING.width,
        bounds.height
    )].forEach(function(rect, index) {
        this._createPlayerBound(rect, index, collisionGroup);
    }, this);
};

Supercold.Game.prototype._superhot = function() {
    var DELAY = 100, newLevel = this.level + 1;

    this._sprites.player.body.setZeroVelocity();

    // TODO: Add fancy effect.
    Supercold.storage.setLevel(newLevel);
    this.time.events.add(DELAY, function superhot() {
        var superhot = Supercold.texts.SUPERHOT.split(' '),
            announcer = new Announcer(this.game, superhot, {
                repeat: true,
                overlay: true,
                overlayColor: 'light'
            }),
            duration = announcer.options.nextDelay + announcer.options.duration,
            delay = 3 * (superhot.length * duration);

        announcer.announce();
        this.time.events.add(delay, function nextLevel() {
            this.state.start('Game', CLEAR_WORLD, CLEAR_CACHE, {
                level: newLevel
            });
        }, this);
    }, this);
};

Supercold.Game.prototype._spawnBot = function() {
    function botKillHandler(bot, bullet, botShape, bulletShape) {
        /*jshint validthis: true */

        // Don't let a bot be killed by its own bullet!
        if (bullet.sprite.owner === bot.sprite)
            return;
        bot.sprite.kill();
        bullet.sprite.kill();
        if (this.superhot) {
            this._superhot();       // SUPERHOT!
        }
    }

    var bounds = this.bounds, colGroups = this._colGroups, bot;

    bot = this._groups.bots.create(
        this.rnd.sign() * this.rnd.between(bounds.left, bounds.left + PADDING.width),
        this.rnd.sign() * this.rnd.between(bounds.top, bounds.top + PADDING.height));
    bot.body.setCollisionGroup(colGroups.bots);
    // Bots collide against themselves, the player and all bullets.
    bot.body.collides([colGroups.bots, colGroups.player]);
    bot.body.collides(
        [colGroups.botBullets, colGroups.playerBullets], botKillHandler, this);
};


Supercold.Game.prototype.restart = function restart() {
    this.state.restart(CLEAR_WORLD, CLEAR_CACHE, {level: this.level});
};

Supercold.Game.prototype.quit = function quit() {
    this.state.start('MainMenu');
};


Supercold.Game.prototype.create = function() {
    var radius = Supercold.player.radius, player, boundsColGroup;

    if (DEBUG) log('Creating Game state: Level ' + this.level + '...');

    // Scaling should be specified first.
    this.setScaling();

    this.addBackground();

    // Collision groups for the player, the bots, the bullets and the bounds.
    this._colGroups.player = this.physics.p2.createCollisionGroup();
    this._colGroups.bots = this.physics.p2.createCollisionGroup();
    this._colGroups.playerBullets = this.physics.p2.createCollisionGroup();
    this._colGroups.botBullets = this.physics.p2.createCollisionGroup();
    boundsColGroup = this.physics.p2.createCollisionGroup();

    this.physics.p2.updateBoundsCollisionGroup();

    this._trailManager = new BulletTrailManager(this);
    // Create the bullet groups first, so that they are rendered under the bots.
    this._addBullets();

    this._groups.bots = new BotGroup(this.game);

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
    player.body.collides(this._colGroups.botBullets, function lose(player, bullet) {
        var overlay = this.add.existing(newOverlay(this.game)), duration = 1000;

        overlay.name = 'lose screen overlay';
        overlay.alpha = 0;
        this.add.tween(overlay).to({
            alpha: 1
        }, duration, Phaser.Easing.Linear.None, AUTOSTART)
            .onComplete.addOnce(function restart() {
                this.time.events.add(Phaser.Timer.SECOND, this.restart, this);
            }, this);

        player.sprite.kill();
        bullet.sprite.kill();
        // TODO: Add fancy effects.
    }, this);

    // The player is always in the center of the screen.
    this.camera.follow(player);

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
    this._nextBotTime = this.rnd.realInRange(0.05, 0.25);
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

function getSpeed(playerAlive, playerMoved, playerRotated, speeds) {
    if (!playerAlive) return speeds.slow;
    if (playerMoved) return speeds.normal;
    if (playerRotated) return speeds.slower;
    return speeds.frozen;
}

function getBotSpeed(playerAlive, playerMoved, playerRotated) {
    return getSpeed(playerAlive, playerMoved, playerRotated, Supercold.speeds.bot);
}

function getBulletSpeed(playerAlive, playerMoved, playerRotated) {
    return getSpeed(playerAlive, playerMoved, playerRotated, Supercold.speeds.bullet);
}

function resetBullet(bullet, sprite) {
    var offset = Supercold.player.radius - Math.round(Supercold.bullet.width/2);

    // Set the position of the bullet almost in front of the sprite.
    bullet.reset(
        sprite.x + offset*Math.cos(sprite.body.rotation),
        sprite.y + offset*Math.sin(sprite.body.rotation));
    bullet.body.rotation = sprite.body.rotation;
    // Dispatch the onRevived signal after setting rotation.
    bullet.revive();
}

function fireBullet(sprite, bulletGroup) {
    var bullet = bulletGroup.getFirstExists(false);

    if (bullet) {
        resetBullet(bullet, sprite);
        bullet.owner = sprite;
        sprite.elapsedTime = 0;
        return true;
    }
    return false;
}

Supercold.Game.prototype._firePlayerBullet = function() {
    // Not ready to fire yet.
    if (this._sprites.player.elapsedTime < Supercold.fireRate)
        return false;
    return fireBullet(this._sprites.player, this._groups.playerBullets);
};

Supercold.Game.prototype._fireBotBullet = function(bot) {
    // Not ready to fire yet.
    if (bot.elapsedTime < Supercold.fireRate)
        return;
    // Wait sometimes before firing to make things a bit more unpredictable.
    if (this.rnd.frac() <= 1/3) {
        bot.elapsedTime = this.rnd.between(
            0, Math.max(Supercold.fireRate * (1 - this.level/100), 0));
        return;
    }
    fireBullet(bot, this._groups.botBullets);
};

Supercold.Game.prototype._advanceBullet = function(bullet, speed) {
    moveForward(bullet.body, bullet.body.rotation, speed);
};

Supercold.Game.prototype._advanceBot = function(
        bot, speed, playerFired, elapsedTime) {
    var player = this._sprites.player, range = Math.PI/2.2, direction, angleDiff;

    bot.elapsedTime += elapsedTime;

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
        // Dodge sometimes.
        if (this.rnd.frac() <= 1/3 + (2/3 * this.level/100)) {
            bot.dodging = true;
            bot.duration = 0.5;   // secs
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
    playerRotated = this._rotatePlayer();

    if (player.alive) {
        // Process firing controls.
        if (this.input.activePointer.leftButton.isDown || fireKey.isDown) {
            playerFired = this._firePlayerBullet();
        }

        if (playerMoved) {
            newDirection = this.physics.arcade.angleBetween(verVec, horVec);
            moveForward(player.body, newDirection, Supercold.speeds.player);
        } else {
            player.body.setZeroVelocity();
        }
    }

    bulletSpeed = getBulletSpeed(player.alive, playerMoved, playerRotated);
    botSpeed = getBotSpeed(player.alive, playerMoved, playerRotated);

    // When time slows down, distort the elapsed time proportionally.
    elapsedTime = this.time.physicsElapsed *
        (bulletSpeed / Supercold.speeds.bullet.normal);
    player.elapsedTime += elapsedTime;

    // Update bots.
    this._groups.bots.forEachAlive(
        this._advanceBot, this, botSpeed, playerFired, elapsedTime);
    // Update bullets.
    this._groups.playerBullets.forEachAlive(
        this._advanceBullet, this, bulletSpeed);
    this._groups.botBullets.forEachAlive(
        this._advanceBullet, this, bulletSpeed);
    this._trailManager.updateTrails(elapsedTime);

    // Check if there are any more bots to spawn.
    if (this._totalBotCount > 0) {
        this._nextBotTime -= elapsedTime;
        if (this._nextBotTime <= 0) {
            --this._totalBotCount;
            this._spawnBot();
            this._nextBotTime = this.rnd.realInRange(
                Math.max(1 - 0.01*this.level, 0),
                Math.max(3 - 0.02*this.level, 0));
        }
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
     this._trailManager.destroy();
};


/**
 * Used here for debugging purposes.
 */
Supercold.Game.prototype.render = function() {
    if (DEBUG) {
        this.game.debug.spriteInfo(this._sprites.player, DEBUG_POSX, 32);
        this.game.debug.cameraInfo(this.camera, DEBUG_POSX, 128);
        this.game.debug.inputInfo(DEBUG_POSX, 128+64+32);
        this.game.debug.pointer(this.input.activePointer);
        this.game.debug.text('DEBUG: ' + DEBUG, DEBUG_POSX, this.game.height-16);
    }
};

/****************************** Setup and Expose ******************************/

Supercold.play = function play(parent, config) {
    // Tell Phaser to cover the entire window and use the best renderer.
    var game = new Phaser.Game('100', '100', Phaser.AUTO, parent);

    /**
     * The single instance of data storage for our game.
     */
    Supercold.storage = new Supercold.GameStorageManager();

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
