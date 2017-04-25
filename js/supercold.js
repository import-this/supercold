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
 * @version: 1.2.0
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

/**
 * Handy shortcuts.
 * @const
 */
var log = console.log,
    warn = console.warn,
    error = console.error,
    // Use assert only in DEBUG mode!
    assert = function assert(assertion) {
        console.assert.apply(console, arguments);
        // console.assert does not throw in browsers!
        // https://developer.mozilla.org/en-US/docs/Web/API/console/assert
        if (!assertion) {
            throw 'AssertionError';
        }
    };

/********************************* Polyfills **********************************/

// No polyfills needed (yet).

/******************************* Local Storage ********************************/

/*
 * https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage
 * http://dev.w3.org/html5/webstorage/
 */

/**
 * The version number. Useful for marking incompatible changes in the storage format.
 * @const {string}
 */
var STORAGE_VERSION = '1.0.1';

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

    // The highest level that the player has reached.
    HIGHEST_LEVEL: PREFIX + 'highest_level',
    // The last level that the player played.
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
    if (this.load(Keys.VERSION) !== STORAGE_VERSION) {
        if (DEBUG) log('Clearing storage...');
        this.clear();
        this.save(Keys.VERSION, STORAGE_VERSION);
    }

    this.saveLevel(this.load(Keys.LEVEL) || 1);
    this.saveTimes(this.load(Keys.TIMES) || 0);
    this.save(Keys.HIGHEST_LEVEL,
        this.load(Keys.HIGHEST_LEVEL) || this.load(Keys.LEVEL));
}

/**
 * Clears the local storage.
 */
GameStorageManager.prototype.clear = function() {
    var localStorage = window.localStorage, keys = [], i, key;

    // Iterate over the local storage keys and remove the ones with our prefix.
    // https://html.spec.whatwg.org/multipage/webstorage.html#dom-storage-key
    for (i = 0; i < localStorage.length; ++i) {
        key = localStorage.key(i);
        if (key.startsWith(PREFIX)) {
            keys.push(key);
        }
    }
    keys.forEach(function(key, i) {
        localStorage.removeItem(key);
    });
};

GameStorageManager.prototype.save = function(key, value) {
    this.localStorage.setItem(key, value);
};
GameStorageManager.prototype.load = function(key) {
    return this.localStorage.getItem(key);
};

/**
 * Returns the highest level that the player has reached.
 * @return {number} The highest level.
 */
GameStorageManager.prototype.loadHighestLevel = function() {
    return Number(this.load(Keys.HIGHEST_LEVEL));
};

/**
 * Sets the last level that the player played.
 * This will also increase the highest level reached if necessary.
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
    if (level > Number(this.load(Keys.HIGHEST_LEVEL))) {
        this.save(Keys.HIGHEST_LEVEL, level);
    }
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
 * The game version. Not really used for anything right now.
 * @const
 */
var VERSION = '1.2.0';

log('%c\n' +
    '      _____________ __________________________________  _________  ________  .____     ________              \n' +
    '     /   _____/    |   \\______   \\_   _____/\\______   \\ \\_   ___ \\ \\_____  \\ |    |    \\______ \\   \n' +
    '     \\_____  \\|    |   /|     ___/|    __)_  |       _/ /    \\  \\/  /   |   \\|    |     |    |  \\      \n' +
    '     /        \\    |  / |    |    |        \\ |    |   \\ \\     \\____/    |    \\    |___  |    `   \\    \n' +
    '    /_______  /______/  |____|   /_______  / |____|_  /  \\______  /\\_______  /_______ \\/_______  /        \n' +
    '            \\/                           \\/         \\/          \\/         \\/        \\/        \\/     \n\n',
    'font-family: monospace');
log('Version:', VERSION);
log('Welcome to SUPERCOLD! Hope you enjoy! :)\n\n');

if (DEBUG) {
    warn('Running in DEBUG mode! Do not forget to disable in production!\n\n');
}

/**
 * Some module-level global settings/constants for our Phaser game.
 * @const
 */
var CLEAR_WORLD = true,
    CLEAR_CACHE = true,
    ADD_TO_CACHE = true,
    AUTOSTART = true,
    USE_WORLD_COORDS = true,
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

    FACTOR_SLOW = 16,
    FACTOR_SLOWER = 42,
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
        width: CELLDIM
        // Same width and height.
    },
    /**
     * Supercold world size (aspect ratio 4:3).
     */
    world: {
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
        radius: 25
    },
    bullet: {
        width: 16,
        height: 8,
        bodyLen: 8
    },
    minimap: {
        x: 10,          // The x-coordinate of the right of the minimap.
        y: 10,          // The y-coordinate of the bottom of the minimap.
        width: 200,
        height: 150
    },
    bar: {
        x: 10,          // The x-coordinate of the right of the bar.
        // y relative to minimap!
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

    fireRate: 1 / 2,            // 2 times per second
    fastFireRate: 1 / 4,        // 4 times per second
    initFireDelay: 1 / 8,

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
            strokeStyle: 'rgb(50, 48, 48)',
            lineWidth: 6,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(242, 238, 238, 0.95)',
            shadowBlur: 12
        },
        bot: {
            color: 'rgb(255, 34, 33)',
            strokeStyle: 'rgb(44, 34, 34)',
            lineWidth: 6,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(255, 34, 33, 0.95)',
            shadowBlur: 8
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
                lineWidth: 2.5
            },
            player: {
                radius: 4,
                color: 'rgb(34, 34, 34)',
                strokeStyle: 'rgba(48, 48, 48, 0.95)',
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
            color: 'rgb(30, 35, 38)',
            markColor: 'rgba(140, 140, 140, 0.95)'
        },
        trail: {
            x1: 0,
            y1: 0,
            x2: 500,
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
            shadowBlur: 2
        },
        grid: {
            color1: 'rgba(250, 240, 230, 1)',
            color2: 'rgba(230, 240, 250, 1)',
            colorOuter: 'rgba(240, 35, 34, 1)',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor1: 'rgba(240, 240, 255, 0.5)',
            shadowColor2: 'rgba(240, 240, 255, 0.5)',
            shadowColorOuter: 'rgba(255, 34, 33, 1)',
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
            fontWeight: 'normal',
            fill: 'rgb(245, 251, 255)',
            stroke: 'rgba(245, 251, 255, 0.5)',
            strokeThickness: 1,
            boundsAlignH: 'center',
            boundsAlignV: 'middle',
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            shadowColor: 'rgba(215, 251, 255, 0.85)',
            shadowBlur: 16
        }
    },
    /**
     * Custom styling options for individual words.
     */
    wordStyles: {
        'SUPER': {
            fontWeight: 'lighter',
            shadowBlur: 24,
            shadowColor: 'rgba(210, 250, 255, 0.9)'
        },
        'HOT': {
            fontWeight: 'bolder',
            shadowColor: 'rgba(215, 251, 255, 0.925)',
            shadowBlur: 28
        },
        'COLD': {
            fontWeight: 'bolder',
            shadowColor: 'rgba(210, 250, 255, 0.95)',
            shadowBlur: 32
        },
        'YOU': {
            fontWeight: 'bold',
            //fill: 'rgb(249, 19, 21)',
            //shadowColor: 'rgba(251, 81, 81, 0.95)'
            fill: 'rgb(34, 34, 34)',
            stroke: 'rgba(34, 34, 34, 0.5)',
            shadowColor: 'rgba(48, 48, 48, 0.95)',
            shadowBlur: 24
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
        restartKey: Phaser.KeyCode.T
    },

    texts: {
        SUPERHOT: 'SUPER HOT'.split(' '),
        SUPERCOLD: 'SUPER COLD'.split(' '),
        MECHANICS: 'TIME MOVES WHEN YOU MOVE'.split(' '),
        // This is a special case!
        LEVEL: 'LEVEL'
    }
};

// Freeze objects to detect erroneous overriding.
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


Supercold.GameStorageManager = GameStorageManager;

/******************************* Utilities ********************************/

function getWordStyle(word) {
    var defaultStyle = Supercold.style.superhot,
        // In case of phrase instead of word, use the first word as index.
        wordStyle = Supercold.wordStyles[word.split(' ')[0]];

    if (wordStyle) {
        return Phaser.Utils.extend({}, defaultStyle, wordStyle);
    } else {
        return defaultStyle;
    }
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

/**
 * Puts the given *fixed to camera* sprite in the center of the camera view.
 * @param {Phaser.Camera} camera - A reference to the game camera.
 * @param {Phaser.Sprite} sprite - The sprite to center.
 */
function centerFixedToCamera(camera, sprite) {
    if (DEBUG) assert(sprite.fixedToCamera);
    sprite.centerX = camera.view.halfWidth;
    sprite.centerY = camera.view.halfHeight;
    sprite.cameraOffset.set(sprite.x, sprite.y);
    if (DEBUG) {
        log('Centered fixed to camera', (sprite.name) ? sprite.name : 'sprite');
    }
}


function _resize() {
    /*jshint validthis: true */
    var camera = this.game.camera, scale = camera.scale;

    // Account for camera scaling.
    // Note: World and camera scaling is the same in Phaser.
    this.scale.set(1 / scale.x, 1 / scale.y);
    centerFixedToCamera(camera, this);
}

/**
 * An image that is always centered in the camera view.
 */
function CenteredImage(game, key) {
    Phaser.Image.call(this, game, 0, 0, key);

    this.name = 'CenteredImage';
    this.anchor.set(0.5);
    this.fixedToCamera = true;

    // Center it.
    this.resize();
}

CenteredImage.prototype = Object.create(Phaser.Image.prototype);
CenteredImage.prototype.constructor = CenteredImage;

CenteredImage.prototype.resize = _resize;

/**
 * Text that is always centered in the camera view.
 */
function CenteredText(game, text, style) {
    Phaser.Text.call(this, game, 0, 0, text, style);

    this.name = '"' + text + '"';
    this.anchor.set(0.5);
    this.fixedToCamera = true;

    // Center it.
    this.resize();
}

CenteredText.prototype = Object.create(Phaser.Text.prototype);
CenteredText.prototype.constructor = CenteredText;

CenteredText.prototype.resize = _resize;

/**
 * Text that is scaled and always centered in the camera view.
 */
function ScaledCenteredText(game, text, style) {
    style = Phaser.Utils.extend({}, style);
    style.fontSize = this._getFontSize(game, text);
    CenteredText.call(this, game, text, style);
}

ScaledCenteredText.prototype = Object.create(CenteredText.prototype);
ScaledCenteredText.prototype.constructor = ScaledCenteredText;

/**
 * Returns an appropriate font size, based on the game width and the text length.
 */
ScaledCenteredText.prototype._getFontSize = function(game, text) {
    // The font size specifies height for a character, so approximate the width.
    // fontSize = charHeight ~ charWidth * 4/3 ~ game.width / textWidth * 4/3
    return (game.width / text.length * 4/3) + 'px';
};

ScaledCenteredText.prototype._scaleTextToFit = function() {
    // Force the text to always fit the screen (factor * game.width/height).
    // Use text.texture, since text.width/height takes into account scaling.
    // Notice the factor for text.height. Height measuring for text is not
    // accurate, so Phaser ends up with a height larger than the actual one.
    scaleToFit(this.scale,
               Math.round(0.9 * this.game.width),
               Math.round(0.9 * this.game.height),
               this.texture.width,
               Math.round(this.texture.height / 1.4));
    // Undo the world/camera scaling that will be applied by Phaser.
    // Note: World and camera scaling values are the same in Phaser.
    Phaser.Point.divide(this.scale, this.game.camera.scale, this.scale);
};

ScaledCenteredText.prototype.resize = function() {
    var style = getWordStyle(this.text),
        scale = this.game.camera.scale;

    this.fontSize = this._getFontSize(this.game, this.text);
    // shadowOffsetX/Y is NOT affected by the current transformation matrix!
    // shadowBlur does NOT correspond to a number of pixels and is NOT affected
    // by the current transformation matrix! Use world.scale as an approximation.
    this.setShadow(
            style.shadowOffsetX * scale.x, style.shadowOffsetY * scale.y,
            style.shadowColor, style.shadowBlur * scale.x);
    this._scaleTextToFit();
    centerFixedToCamera(this.game.camera, this);
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
 * @param {number} [options.initDelay=0] -
 *      How long to wait before starting.
 * @param {number} [options.nextDelay=550] -
 *      How long to wait before showing the next word.
 * @param {number} [options.finalDelay=options.nextDelay] -
 *      How long to wait before showing the message again.
 * @param {number} [options.duration=450] -
 *      How long the animation for each word will last.
 * @param {number} [options.flashOnDuration=25] -
 *      How long it will take to turn the flash on.
 * @param {number} [options.flashOffDuration=400] -
 *      How long it will take to turn the flash off.
 * @param {number} [options.flashTint=0xFFFFFF] -
 *      A tint to change the color of the flash.
 * @param {boolean} [options.repeat=false] -
 *      If true, repeat the message forever.
 * @param {boolean} [options.overlay=false] -
 *      Add a layer between the game and the text.
 * @param {string} [options.overlayColor='dark'] -
 *      Specify a 'light' or 'dark' shade for the overlay.
 * @param {function} [options.onComplete=noop] -
 *      A function to call once the announcer is done.
 */
function Announcer(game, text, options) {
    this.options = Phaser.Utils.extend({}, Announcer.defaults, options);
    if (this.options.finalDelay === undefined) {
        this.options.finalDelay = this.options.nextDelay;
    }

    if (this.options.overlay) {
        this._overlay = game.add.existing(
            newOverlay(game, this.options.overlayColor));
        this._overlay.name = 'Announcer overlay';
    } else {
        // Add a null object.
        this._overlay = new CenteredImage(game);
        this._overlay.name = 'Announcer null overlay';
    }

    this._flash = game.add.existing(new CenteredImage(
        game, game.cache.getBitmapData(CACHE.KEY.FLASH)));
    this._flash.name = 'Announcer flash';
    this._flash.alpha = 0;
    this._flash.tint = this.options.flashTint;

    this._textGroup = Announcer._addTextGroup(game, text);

    this._textTween = null;
    this._timer = null;

    // Handy references.
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

Announcer.scaleFactor = 1.06;

Announcer.prototype.resize = function() {
    // Do nothing if the announcer has finished.
    if (this._flash === null) return;

    this._overlay.resize();
    this._flash.resize();
    this._textGroup.forEach(function resize(text) {
        text.resize();
    });
    if (DEBUG) log('Resized announcer.');
};

/**
 * Stops the announcer and destroys all its components.
 */
Announcer.prototype.stop = function() {
    this.time.events.remove(this._timer);   // May be null.
    this._textTween.stop();

    // Tweens are removed from sprites/images automatically.
    this._textGroup.destroy();
    this._flash.destroy();
    this._overlay.destroy();

    this._textGroup = null;
    this._flash = null;
    this._overlay = null;
};

Announcer.prototype._flashCamera1 = function() {
    this.add.tween(this._flash).to({
        alpha: 0
    }, this.options.flashOffDuration, Phaser.Easing.Quadratic.Out, AUTOSTART);
};

Announcer.prototype._flashCamera0 = function() {
    this.add.tween(this._flash).to({
        alpha: 1
    }, this.options.flashOnDuration, Phaser.Easing.Quadratic.In, AUTOSTART)
        .onComplete.addOnce(this._flashCamera1, this);
};

Announcer.prototype._next = function() {
    this._textGroup.cursor.kill();
    this._textGroup.next();
    this._announce();
};

Announcer.prototype._repeat = function() {
    if (this.options.repeat) {
        this._next();
    } else {
        this.stop();
        this.options.onComplete.call(this);
    }
};

Announcer.prototype._announceNext = function() {
    if (this._textGroup.cursorIndex < this._textGroup.length - 1) {
        this._timer = this.time.events.add(this.options.nextDelay, this._next, this);
    } else {
        this._timer = this.time.events.add(this.options.finalDelay, this._repeat, this);
    }
};

Announcer.prototype._announce = function() {
    var text = this._textGroup.cursor,
        oldScaleX = text.scale.x,
        oldScaleY = text.scale.y;

    // Set the new scale that will be undone by the tween.
    text.scale.multiply(Announcer.scaleFactor, Announcer.scaleFactor);
    text.revive();

    // DON'T tween the font size, since it will have to redraw the text sprite!
    this._textTween = this.add.tween(text.scale).to({
        x: oldScaleX,
        y: oldScaleY,
    }, this.options.duration, Phaser.Easing.Quadratic.Out, !AUTOSTART);
    this._textTween.onStart.addOnce(this._flashCamera0, this);
    this._textTween.onComplete.addOnce(this._announceNext, this);
    this._textTween.start();
};

/**
 * Displays the message to the player.
 * @return {Announcer} this announcer, for possible method chaining.
 */
Announcer.prototype.announce = function() {
    // NOTE: Use a timer to delay the first tween (instead of the tween delay arg)!
    // This will make sure that the first word will be displayed even when lagging.
    this._timer = this.time.events.add(this.options.initDelay, this._announce, this);
    return this;
};

Announcer._addTextGroup = function(game, words) {
    var scale = game.camera.scale,
        group, text, i, word, style;

    group = game.add.group();
    group.name = 'Text group: "' + words + '"';
    // Due to the way the 'fixedToCamera' property works, set it for each
    // text object individually (instead of setting it for the group).
    // https://phaser.io/docs/2.6.2/Phaser.Sprite.html#cameraOffset
    for (i = 0; i < words.length; ++i) {
        word = words[i];
        style = getWordStyle(word);

        text = group.add(new ScaledCenteredText(game, word, style));
        // shadowOffsetX/Y is NOT affected by the current transformation matrix!
        // shadowBlur does NOT correspond to a number of pixels and is NOT affected
        // by the current transformation matrix! Use world.scale as an approximation.
        text.setShadow(
            style.shadowOffsetX * scale.x, style.shadowOffsetY * scale.y,
            style.shadowColor, style.shadowBlur * scale.x);
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
 * A state that supports a scalable viewport.
 * The currect scale factor is the same as world.scale
 * (which in turn is the same as camera.scale in Phaser).
 */
Supercold._ScalableState = function(game) {};

/**
 * Sets the world size.
 */
Supercold._ScalableState.prototype._setWorldBounds = function() {
    var width = Supercold.world.width + 2*PADDING.width,
        height = Supercold.world.height + 2*PADDING.height;

    // The world is a large fixed size space with (0, 0) in the center.
    this.world.setBounds(
        -Math.round(width / 2), -Math.round(height / 2), width, height);
    if (DEBUG) log('Set world bounds to', this.world.bounds);
};

/**
 * Sets the world scale so that the player sees about the same portion of the
 * playing field. The strategy selected scales the game so as to fill the screen,
 * but it will crop some of the top/bottom or left/right sides of the playing field.
 * Note: World and Camera scaling values are the same in Phaser!
 */
Supercold._ScalableState.prototype._setWorldScale = function(width, height) {
    scaleToFill(this.world.scale, width, height);
    if (DEBUG) log('Set world scale to', this.world.scale);
};

/**
 * Sets all the necessary sizes and scale factors for our world.
 */
Supercold._ScalableState.prototype.setScaling = function() {
    // Note: Don't use Phaser.ScaleManager.onSizeChange, since the callback
    // may be triggered multiple times. Phaser.State.resize works better.
    // https://phaser.io/docs/2.6.2/Phaser.ScaleManager.html#onSizeChange
    this._setWorldBounds();
    this._setWorldScale(this.game.width, this.game.height);
    if (DEBUG) log('Set scaling.');
};

/**
 * Since our game is set to Scalemode 'RESIZE', this method will be called
 * automatically to handle resizing. Since subclasses of the ScalableState
 * inherit this method, they are able to handle resizing, too.
 *
 * @param {number} width - the new width
 * @param {number} height - the new height
 * @override
 */
Supercold._ScalableState.prototype.resize = function(width, height) {
    this._setWorldScale(width, height);
    if (DEBUG) log('Resized game.');
};

/**
 * Rescales the sprite given to account for the scale of the world.
 */
Supercold._ScalableState.prototype.rescale = function(sprite) {
    sprite.scale.set(1 / this.world.scale.x, 1 / this.world.scale.y);
};

/******************************* Base State *******************************/

/**
 * State used as a base class for almost all other game states.
 * Provides methods for scaling the game, handling drawing of all sprites
 * and redrawing when resizing, debugging and other common functionality.
 */
Supercold._BaseState = function(game) {
    Supercold._ScalableState.call(this, game);
};

Supercold._BaseState.prototype = Object.create(Supercold._ScalableState.prototype);
Supercold._BaseState.prototype.constructor = Supercold._BaseState;

/**
 * Returns the smallest even integer greater than or equal to the number.
 */
function even(n) {
    n = Math.ceil(n);
    return n + n%2;
}

/**
 * Draws a circle in the context specified.
 */
function circle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.closePath();
}

/**
 * Draws a line in the context specified.
 */
function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
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
 * Returns a new Phaser.BitmapData object or an existing one from cache.
 * If a new Phaser.BitmapData object is created, it is added to the cache.
 * @param {number} width - The (new) width of the BitmapData object.
 * @param {number} height - The (new) height of the BitmapData object.
 * @param {string} key - The asset key for searching or adding it in the cache.
 * @param {boolean} [even=true] - If true, warns if the dimensions are not even.
 * @return {Phaser.BitmapData} - The (old or new) Phaser.BitmapData object.
 */
Supercold._BaseState.prototype.getBitmapData = function(width, height, key, even) {
    var bmd;

    if (even === undefined) even = true;

    // NOTE: When bound to a Sprite, to avoid single-pixel jitters on mobile
    // devices, it is strongly recommended to use Sprite sizes that are even
    // on both axis, so warn if they are not!
    // https://phaser.io/docs/2.6.2/Phaser.Physics.P2.Body.html
    if (DEBUG && even && (width % 2 === 1 || height % 2 === 1)) {
        warn('Sprite with odd dimension!');
    }

    // Resizing or creating from scratch?
    if (this.cache.checkBitmapDataKey(key)) {
        bmd = this.cache.getBitmapData(key);
        // Due to the way we scale bitmaps, it is possible for the same width
        // and height to be requested (especially when multiple resize events
        // fire in rapid succesion), so the bitmap state will not be cleared!
        // github.com/photonstorm/phaser/blob/v2.6.2/src/gameobjects/BitmapData.js#L552
        // Set the width of the underlying canvas manually to clear its state.
        if (bmd.width === width && bmd.height === height) {
            bmd.canvas.width = width;
        } else {
            bmd.resize(width, height);
        }
    } else {
        // 'add.bitmapData' does the same thing as 'make.bitmapData',
        // i.e. it doesn't actually add the bitmapData object to the world.
        // (BitmapData's are Game Objects and don't live on the display list.)
        bmd = this.make.bitmapData(width, height, key, ADD_TO_CACHE);
    }
    return bmd;
};

/**
 * Returns a new Phaser.BitmapData object or an existing one from cache.
 * If a new Phaser.BitmapData object is created, it is added to the cache.
 * @param {number} width - The (new) width of the BitmapData object.
 * @param {number} height - The (new) height of the BitmapData object.
 * @param {string} key - The asset key for searching or adding it in the cache.
 * @return {Phaser.BitmapData} - The (old or new) Phaser.BitmapData object.
 */
Supercold._BaseState.prototype.getBitmapData2 = function(width, height, key) {
    return this.getBitmapData(width, height, key, false);
};


Supercold._BaseState.prototype._makeLiveEntityBitmap = function(style, key) {
    var player = Supercold.player, width, bmd, ctx;

    function drawNozzle(ctx) {
        // Note the fix values.
        ctx.translate(-(style.lineWidth/2 + 0.13), -(style.lineWidth/2 + 0.12));
        ctx.beginPath();
        ctx.moveTo(0, player.radius);
        ctx.lineTo(player.radius, player.radius);
        ctx.lineTo(player.radius, 0);
    }

    // Same width and height.
    // Note the slack value to account for the shadow blur.
    width = 2*player.radius + (2/3 * player.radius) + 1.5*style.shadowBlur;
    width = even(width * this.world.scale.x);
    bmd = this.getBitmapData(width, width, key);
    ctx = bmd.ctx;

    ctx.fillStyle = style.color;
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = style.lineWidth;
    // shadowOffsetX/Y is NOT affected by the current transformation matrix!
    ctx.shadowOffsetX = style.shadowOffsetX * this.world.scale.x;
    ctx.shadowOffsetY = style.shadowOffsetY * this.world.scale.y;
    // shadowBlur does NOT correspond to a number of pixels and
    // is NOT affected by the current transformation matrix!
    // Use world.scale as an approximation for the effect.
    ctx.shadowBlur = style.shadowBlur * this.world.scale.x;
    ctx.lineCap = ctx.lineJoin = 'round';

    // Start from the center.
    ctx.translate(bmd.width / 2, bmd.height / 2);
    // Rotate so that the entity will point to the right.
    ctx.rotate(-Math.PI / 4);
    ctx.scale(this.world.scale.x, this.world.scale.y);

    ctx.save();
        ctx.shadowColor = style.shadowColor;
        ctx.save();
            // Draw the nozzle.
            drawNozzle(ctx);
            ctx.fill();
            // Draw the nozzle outline (twice to make the shadow stronger).
            ctx.stroke();
            ctx.stroke();
        ctx.restore();
        // Draw the body (twice to make the shadow stronger).
        circle(ctx, 0, 0, player.radius);
        ctx.fill();
        ctx.fill();
        // Draw the outline a little smaller to account for the line width.
        circle(ctx, 0, 0, player.radius - (style.lineWidth / 2));
        ctx.stroke();
    ctx.restore();
    // Draw the nozzle one last time to cover the shadow in the joint areas.
    drawNozzle(ctx);
    ctx.stroke();
};

Supercold._BaseState.prototype._makePlayerBitmap = function() {
    this._makeLiveEntityBitmap(Supercold.style.player, CACHE.KEY.PLAYER);
};

Supercold._BaseState.prototype._makeBotBitmap = function() {
    this._makeLiveEntityBitmap(Supercold.style.bot, CACHE.KEY.BOT);
};

Supercold._BaseState.prototype._makeBulletBitmap = function() {
    var scale = this.world.scale,
        bullet = Supercold.bullet,
        scaledWidth = bullet.width * scale.x,
        scaledHeight = bullet.height * scale.y,
        evenedWidth = even(scaledWidth),
        evenedHeight = even(scaledHeight),
        bmd = this.getBitmapData(evenedWidth, evenedHeight, CACHE.KEY.BULLET),
        ctx = bmd.ctx;

    // In contrast to the other bitmaps, we don't keep the bullet perfectly
    // proportional to the world scale. This helped with some centering issues.

    ctx.fillStyle = Supercold.style.bullet.color;
    ctx.lineCap = ctx.lineJoin = 'round';

    // Draw the body.
    bmd.rect(0, 0, bullet.bodyLen * scale.x, evenedHeight);
    // Draw the tip.
    // For some reason, this needs to be shifted left by 1 pixel.
    ctx.translate((bullet.bodyLen - 1) * scale.x, 0);
    ctx.save();
        ctx.translate(0, evenedHeight / 2);
        // Make the tip pointier.
        ctx.scale(2, 1);
        ctx.beginPath();
        ctx.arc(0, 0, evenedHeight / 2, 3 * Math.PI/2, Math.PI/2);
        ctx.fill();
    ctx.restore();
    // Draw the mark.
    ctx.fillStyle = Supercold.style.bullet.markColor;
    bmd.rect(0, 0, 1 * scale.x, evenedHeight);
};

Supercold._BaseState.prototype._makeBulletTrailBitmap = function() {
    var scale = this.world.scale,
        style = Supercold.style.trail,
        scaledWidth = style.x2 * scale.x,
        scaledheight = Supercold.bullet.height * scale.y,
        ceiledWidth = Math.ceil(scaledWidth),
        ceiledHeight = Math.ceil(scaledheight),
        bmd = this.getBitmapData2(ceiledWidth, ceiledHeight, CACHE.KEY.TRAIL),
        ctx = bmd.ctx;

    // Shift the trail to account for rounding up and center it vertically.
    ctx.translate((ceiledWidth - scaledWidth) / 2, ceiledHeight / 2);

    ctx.scale(scale.x, scale.y);
    ctx.strokeStyle = createLinearGradient(
        ctx, style.x1, style.y1, style.x2, style.y2, style.colorStops);
    // Make it a little thinner. 2 space units seem best.
    ctx.lineWidth = Supercold.bullet.height - 2;
    ctx.lineCap = 'round';
    ctx.shadowOffsetX = style.shadowOffsetX * scale.x;
    ctx.shadowOffsetY = style.shadowOffsetY * scale.y;
    ctx.shadowBlur = style.shadowBlur * scale.x;
    ctx.shadowColor = style.shadowColor;

    // Note the offsets on the x-axis, so as to leave space for the round caps.
    line(ctx, style.x1 + 2, 0, style.x2 - 4, 0);
};

Supercold._BaseState.prototype._makeBackgroundBitmap = function() {
    var scale = this.world.scale,
        style = Supercold.style, cellDim = Supercold.cell.width,
        // Even cell count for centering and +2 cells for tile scrolling.
        width = (even(NATIVE_WIDTH / cellDim) + 2) * cellDim,
        height = (even(NATIVE_HEIGHT / cellDim) + 2) * cellDim,
        padWidth = Math.ceil(PADDING.width / cellDim) * cellDim,
        padHeight = Math.ceil(PADDING.height / cellDim) * cellDim,
        scaledPaddedWidth = Math.ceil((width + 2*padWidth) * scale.x),
        scaledPaddedHeight = Math.ceil((height + 2*padHeight) * scale.y),
        scaledCellWidth = Math.ceil(cellDim * scale.x),
        scaledCellHeight = Math.ceil(cellDim * scale.y),
        bmd, cellbmd;

    function drawCell(bgColor, color1, shadowColor1, color2, shadowColor2) {
        var skewFactor = Math.tan(style.lines.angle),
            cellDim = Supercold.cell.width,
            ctx = cellbmd.ctx, i;

        // Clear everything from previous operations.
        ctx.clearRect(0, 0, cellbmd.width, cellbmd.height);
        ctx.save();
            // Draw background color.
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, cellbmd.width, cellbmd.height);

            // Draw blurred lines. (I know you want it. #joke -.-')
            ctx.save();
                ctx.scale(scale.x, scale.y);
                ctx.transform(1, 0, -skewFactor, 1, 0, 0);
                ctx.lineWidth = style.lines.lineWidth;
                ctx.strokeStyle = style.lines.color;
                ctx.shadowOffsetX = style.lines.shadowOffsetX * scale.x;
                ctx.shadowOffsetY = style.lines.shadowOffsetY * scale.y;
                ctx.shadowBlur = style.lines.shadowBlur * scale.x;
                ctx.shadowColor = style.lines.shadowColor;
                ctx.beginPath();
                for (i = 0; i <= cellDim + (cellDim / skewFactor); i += 8) {
                    ctx.moveTo(i, 0);
                    ctx.lineTo(i, cellDim);
                }
                ctx.stroke();
            ctx.restore();

            ctx.shadowOffsetX = style.grid.shadowOffsetX * scale.x;
            ctx.shadowOffsetY = style.grid.shadowOffsetY * scale.y;
            ctx.shadowBlur = style.grid.shadowBlur * scale.x;

            // Draw horizontal lines.
            ctx.fillStyle = color1;
            ctx.shadowColor = shadowColor1;
            ctx.fillRect(0, 0, cellbmd.width, 1 * scale.y);
            //ctx.fillRect(0, cellbmd.height, cellbmd.width, 1 * scale.y);

            // Draw vertical lines.
            ctx.fillStyle = color2;
            ctx.shadowColor = shadowColor2;
            ctx.fillRect(0, 0, 1 * scale.x, cellbmd.height);
            //ctx.fillRect(cellbmd.width, 0, 1 * scale.x, cellbmd.height);
        ctx.restore();
    }

    function drawCells(x, y, width, height) {
        var ctx = bmd.ctx;

        ctx.save();
            ctx.beginPath();
            ctx.fillStyle = ctx.createPattern(cellbmd.canvas, 'repeat');
            ctx.rect(x, y, width, height);
            // Scale to account for ceiling.
            ctx.scale((cellDim * scale.x) / scaledCellWidth,
                      (cellDim * scale.y) / scaledCellHeight);
            ctx.fill();
        ctx.restore();
    }

    bmd = this.getBitmapData2(scaledPaddedWidth, scaledPaddedHeight, CACHE.KEY.BG);
    cellbmd = this.make.bitmapData(scaledCellWidth, scaledCellHeight);

    // Disable image smoothing to keep the cells drawn with createPattern crisp!
    // Unfortunately, this feature is not supported that well. It's something...
    // developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled
    Phaser.Canvas.setSmoothingEnabled(bmd.ctx, false);

    // Draw dark cells everywhere.
    drawCell(style.background.darkColor,
        style.grid.colorOuter, style.grid.shadowColorOuter,
        style.grid.colorOuter, style.grid.shadowColorOuter);
    drawCells(0, 0, scaledPaddedWidth, scaledPaddedHeight);

    // Draw light cells over dark cells.
    drawCell(style.background.lightColor,
        style.grid.color1, style.grid.shadowColor1,
        style.grid.color2, style.grid.shadowColor2);
    // +/-1 for the red border
    drawCells((padWidth + 1) * scale.x, (padHeight + 1) * scale.y,
              (width - 1) * scale.x, (height - 1) * scale.y);

    // The cell bitmap is not needed anymore.
    cellbmd.destroy();
};

Supercold._BaseState.prototype._makeFlashBitmap = function() {
    var width = Math.ceil(NATIVE_WIDTH * this.world.scale.x),
        height = Math.ceil(NATIVE_HEIGHT * this.world.scale.y),
        centerX = width / 2, centerY = height / 2,
        radius = Math.min(centerX, centerY),
        bmd = this.getBitmapData2(width, height, CACHE.KEY.FLASH),
        ctx = bmd.ctx;

    // Create an oval flash.
    ctx.translate(centerX, 0);
    ctx.scale(2, 1);
    ctx.translate(-centerX, 0);

    ctx.fillStyle = createRadialGradient(
        ctx, centerX, centerY, 0, centerX, centerY, radius,
        Supercold.style.flash.colorStops);
    ctx.fillRect(0, 0, width, height);
};

Supercold._BaseState.prototype._makeOverlayBitmaps = function() {
    var width = Math.ceil(NATIVE_WIDTH * this.world.scale.x),
        height = Math.ceil(NATIVE_HEIGHT * this.world.scale.y),
        bmd;

    bmd = this.getBitmapData2(width, height, CACHE.KEY.OVERLAY_DARK);
    bmd.rect(0, 0, width, height, Supercold.style.overlay.darkColor);
    bmd = this.getBitmapData2(width, height, CACHE.KEY.OVERLAY_LIGHT);
    bmd.rect(0, 0, width, height, Supercold.style.overlay.lightColor);
};

Supercold._BaseState.prototype.makeBitmaps = function() {
    this._makePlayerBitmap();
    this._makeBotBitmap();
    this._makeBulletBitmap();
    this._makeBulletTrailBitmap();
    this._makeBackgroundBitmap();
    this._makeFlashBitmap();
    this._makeOverlayBitmaps();
};


Supercold._BaseState.prototype.addBackground = function() {
    var background = this.add.image(0, 0, this.cache.getBitmapData(CACHE.KEY.BG));
    background.anchor.set(0.5);
    background.scale.set(1 / this.world.scale.x, 1 / this.world.scale.y);
    return background;
};

/**
 * Shows lots of debug info about various Phaser objects on the screen.
 * @param {Phaser.Sprite} [sprite] - An optional sprite to show debug info for.
 */
Supercold._BaseState.prototype.showDebugInfo = function(sprite) {
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


/**
 * Since our game is set to Scalemode 'RESIZE', this method will be called
 * automatically to handle resizing. Since subclasses of the BaseState
 * inherit this method, they are able to handle resizing, too.
 *
 * @param {number} width - the new width
 * @param {number} height - the new height
 * @override
 */
Supercold._BaseState.prototype.resize = function(width, height) {
    Supercold._ScalableState.prototype.resize.call(this, width, height);
    // Create new bitmaps for our new resolution. This will keep them sharp!
    this.makeBitmaps();
    if (DEBUG) log('Resized bitmaps.');
};

/**
 * Used here for debugging purposes.
 * Subclasses may override this to render more info.
 */
Supercold._BaseState.prototype.render = function() {
    if (DEBUG) {
        this.showDebugInfo();
    }
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

    // Let the camera view bounds be non-integer. This makes the motion smooth!
    // https://phaser.io/docs/2.6.2/Phaser.Camera.html#roundPx
    // https://phaser.io/docs/2.6.2/Phaser.Camera.html#follow
    this.camera.roundPx = false;

    this.physics.startSystem(PHYSICS_SYSTEM);
    this.physics.p2.setImpactEvents(true);
};

Supercold.Boot.prototype.create = function() {
    if (DEBUG) log('Creating Boot state...');

    this.state.start('Preloader');
};

/***************************** Preloader State ****************************/

/**
 * State used for loading or creating any assets needed in the game.
 */
Supercold.Preloader = function(game) {
    Supercold._BaseState.call(this, game);
};

Supercold.Preloader.prototype = Object.create(Supercold._BaseState.prototype);
Supercold.Preloader.prototype.constructor = Supercold.Preloader;

Supercold.Preloader.prototype.preload = function() {
    if (DEBUG) {
        this.load.onFileComplete.add(function(progress, key, success, totalLF, totalF) {
            log(((success) ? 'Loaded' : 'Failed to load'), key, 'asset');
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
    this.makeBitmaps();
};

Supercold.Preloader.prototype.update = function() {
    // No actual need to wait for asset loading.
    this.state.start('MainMenu');
};

/***************************** Main Menu State ****************************/

Supercold.MainMenu = function(game) {
    Supercold._BaseState.call(this, game);

    this._announcer = null;
};

Supercold.MainMenu.prototype = Object.create(Supercold._BaseState.prototype);
Supercold.MainMenu.prototype.constructor = Supercold.MainMenu;

Supercold.MainMenu.prototype.create = function() {
    if (DEBUG) log('Creating MainMenu state...');

    // Scaling should be specified first.
    this.setScaling();

    // Disable bounds checking for the camera, since it messes up centering.
    this.camera.bounds = null;
    this.camera.focusOn(this.world);

    this._announcer = new Announcer(this.game, Supercold.texts.SUPERCOLD, {
        initDelay: 750,
        nextDelay: 1200,
        flashTint: 0x151515,
        repeat: true
    }).announce();

    this.game.supercold.onMainMenuOpen();
    // We will transition to the next state through the DOM menu!
};

Supercold.MainMenu.prototype.resize = function(width, height) {
    Supercold._BaseState.prototype.resize.call(this, width, height);
    this._announcer.resize();
};

/******************************* Intro State ******************************/

Supercold.Intro = function(game) {
    Supercold._BaseState.call(this, game);

    this._background = null;
    this._announcer = null;
};

Supercold.Intro.prototype = Object.create(Supercold._BaseState.prototype);
Supercold.Intro.prototype.constructor = Supercold.Intro;

Supercold.Intro.prototype.create = function() {
    if (DEBUG) log('Creating Intro state...');

    // Scaling should be specified first.
    this.setScaling();

    this._background = this.addBackground();

    // Disable bounds checking for the camera, since it messes up centering.
    this.camera.bounds = null;
    this.camera.follow(this._background);

    this._announcer = new Announcer(this.game, Supercold.texts.SUPERCOLD, {
        initDelay: 600,
        nextDelay: 700,
        overlay: true,
        onComplete: (function startLevel() {
            // Start at the last level that the player was in or the first one.
            this.state.start('Game', CLEAR_WORLD, !CLEAR_CACHE, {
                level: Supercold.storage.loadLevel()
            });
        }).bind(this)
    }).announce();
};

Supercold.Intro.prototype.resize = function(width, height) {
    Supercold._BaseState.prototype.resize.call(this, width, height);
    this.rescale(this._background);
    this._announcer.resize();
};

/******************************* Game State *******************************/

/***** Sprites and Groups *****/

/*
 * IMPORTANT: Don't enable physics in the sprite constructor, since this slows
 * creation down significantly for some reason! Enable it in the group instead.
 */

/**
 * A generic sprite for our game.
 * It provides useful methods for handling the Phaser World scaling.
 */
function Sprite(game, x, y, key, _frame) {
    Phaser.Sprite.call(this, game, x, y, key, _frame);
    this.name = 'Supercold Sprite';
}

Sprite.prototype = Object.create(Phaser.Sprite.prototype);
Sprite.prototype.constructor = Sprite;

/**
 * One of the game's live entities, i.e. the player or a bot.
 * @abstract
 */
function LiveSprite(game, x, y, key, _frame) {
    Sprite.call(this, game, x, y, key, _frame);

    this.name = 'LiveSprite';
    // Time until the next bullet can be fired.
    this.remainingTime = 0;
}

LiveSprite.prototype = Object.create(Sprite.prototype);
LiveSprite.prototype.constructor = LiveSprite;

/**
 * Resets the LiveSprite.
 * LiveSprite's may be recycled in a group, so override this method in
 * derived objects if necessary to reset any extra state they introduce.
 */
LiveSprite.prototype.reset = function(x, y, _health) {
    Sprite.prototype.reset.call(this, x, y, _health);
    this.remainingTime = 0;
};

/**
 * The player.
 */
function Player(game, x, y, scale) {
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.PLAYER));

    this.name = 'Player';
    this.baseScale = scale || 1;

    this.game.add.existing(this);

    // No group for Player, so enable physics here.
    this.game.physics.enable(this, PHYSICS_SYSTEM, DEBUG);
    this.body.setCircle(Supercold.player.radius * this.baseScale);

    // Account for world scaling.
    this.resize(this.game.world.scale);
}

Player.prototype = Object.create(LiveSprite.prototype);
Player.prototype.constructor = Player;

Player.prototype.kill = function() {
    LiveSprite.prototype.kill.call(this);
    // TODO: Add fancy kill effect.
};

/**
 * Handles resizing of the player.
 * Useful when the game world is rescaled.
 * @param {Phaser.Point} worldScale - The scale of the world.
 */
Player.prototype.resize = function(worldScale) {
    this.scale.set(this.baseScale / worldScale.x, this.baseScale / worldScale.y);
};

Player.prototype.move = function() {

};

Player.prototype.rotate = function() {

};

Player.prototype.fire = function() {

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

    // Don't fire immediately!
    this.remainingTime = Supercold.initFireDelay;
}

Bot.count = 0;

Bot.prototype = Object.create(LiveSprite.prototype);
Bot.prototype.constructor = Bot;

Bot.prototype.kill = function() {
    LiveSprite.prototype.kill.call(this);
    // TODO: Add fancy kill effect.
};

/**
 * Resets the Bot.
 * Bot's are recycled in their group, so we override
 * this method to reset the extra state they introduce.
 */
Bot.prototype.reset = function(x, y, _health) {
    LiveSprite.prototype.reset.call(this, x, y, _health);
    this.remainingTime = Supercold.initFireDelay;
    this.dodging = false;
    this.direction = null;
    this.duration = 0;
};

Bot.prototype.fire = function() {

};

Bot.prototype.advance = function() {

};

/**
 * A bullet fired from a LiveSprite.
 */
function Bullet(game, x, y, _key, _frame) {
    Sprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.BULLET));

    this.name = 'Bullet ' + Bullet.count++;
    /**
     * Who shot the bullet.
     */
    this.owner = null;

    // Using these properties does NOT work, because when checking the world
    // bounds in the preUpdate method, the world scale is not taken into account!
    // THIS TOOK ME A LONG TIME TO FIND OUT. -.-'
    //this.checkWorldBounds = true;
    //this.outOfBoundsKill = true;
}

Bullet.count = 0;

Bullet.prototype = Object.create(Sprite.prototype);
Bullet.prototype.constructor = Bullet;

Bullet.prototype.kill = function() {
    Sprite.prototype.kill.call(this);
    // TODO: Add fancy kill effect.
};

/**
 * Resets the Bullet.
 * Bullet's are recycled in their group, so we override
 * this method to reset the extra state they introduce.
 */
Bullet.prototype.reset = function(x, y, _health) {
    Sprite.prototype.reset.call(this, x, y, _health);
    this.owner = null;
};

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

    //
    if (!Sprite.prototype.preUpdate.call(this) || !this.alive) {
        return false;
    }

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

/**
 * The trail that a bullet leaves behind.
 */
function BulletTrail(game, x, y, _key, _frame) {
    Phaser.Image.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.TRAIL));

    this.name = 'Trail ' + BulletTrail.count++;
    this.anchor.x = 1;
    this.anchor.y = 0.5;

    /**
     * The bullet that this trail belongs to.
     * Will be null if the bullet was destroyed.
     */
    this.bullet = null;
    /**
     * Reference point for this trail (where it starts or stops).
     */
    this.refX = 0;
    this.refY = 0;
}

BulletTrail.count = 0;

BulletTrail.prototype = Object.create(Phaser.Image.prototype);
BulletTrail.prototype.constructor = BulletTrail;

/**
 * Resets the BulletTrail.
 * BulletTrail's are recycled in their group, so we override
 * this method to reset the extra state they introduce.
 */
BulletTrail.prototype.reset = function(x, y, _health) {
    Phaser.Image.prototype.reset.call(this, x, y, _health);
    this.refX = 0;
    this.refY = 0;
};

/**
 * Starts the trail.
 * The trail starts moving and expanding behind the given bullet.
 * @param {Bullet} bullet - The bullet for this trail.
 */
BulletTrail.prototype.start = function(bullet) {
    this.rotation = bullet.body.rotation;
    this.bullet = bullet;
    this.refX = bullet.x;
    this.refY = bullet.y;
    this.width = 0;
};

/**
 * Stops the trail.
 * The trail stops moving and expanding, and becomes stray.
 */
BulletTrail.prototype.stop = function() {
    this.refX = this.bullet.x;
    this.refY = this.bullet.y;
    this.bullet = null;
};


/**
 * A generic group for our game.
 * It provides useful methods for handling the Phaser world scale.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} [scale=1] - The base scale for this group.
 * @param {string} [name='group'] - A name for this group.
 */
function Group(game, scale, name, _parent) {
    Phaser.Group.call(this, game, _parent, name, false, true, PHYSICS_SYSTEM);

    /**
     * The base scaling values that are used to calculate the final ones.
     * Useful for storing scaling values to implement mutators.
     */
    this.baseScale = scale || 1;
    /**
     * The actual scaling values that are applied to the sprites of the group.
     * This takes the world scale into account.
     */
    this.finalScale = new Phaser.Point(
        this.baseScale / game.world.scale.x, this.baseScale / game.world.scale.y);
}

Group.prototype = Object.create(Phaser.Group.prototype);
Group.prototype.constructor = Group;

/**
 * Appends info about this group to the name of the child specified.
 */
Group.prototype.extendChildName = function(child) {
    child.name += ', ' + this.getChildIndex(child) + ' in ' + this.name;
};

/**
 * Sets the scaling values for all the children of the group.
 * @param {Phaser.Point} worldScale - The scale of the world.
 */
Group.prototype.resize = function(worldScale) {
    var length = this.children.length, i;

    this.finalScale.set(
        this.baseScale / worldScale.x, this.baseScale / worldScale.y);
    for (i = 0; i < length; ++i) {
        this.children[i].scale.copyFrom(this.finalScale);
    }
};

/**
 * A group of 'Bot's with enabled physics.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} [scale=1] - The base scale for this group.
 */
function BotGroup(game, scale) {
    Group.call(this, game, scale, 'Bots');

    this.classType = Bot;

    // Bots receive input (for hotswitching).
    this.inputEnableChildren = true;
}

BotGroup.prototype = Object.create(Group.prototype);
BotGroup.prototype.constructor = BotGroup;

/**
 * Creates a new Bot object and adds it to the top of this group.
 */
BotGroup.prototype.create = function(x, y, _key, _frame) {
    var bot = Group.prototype.create.call(this, x, y, null, null);

    if (DEBUG) this.extendChildName(bot);
    bot.scale.copyFrom(this.finalScale);
    bot.body.setCircle(Supercold.player.radius * this.baseScale);
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
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} [scale=1] - The base scale for this group.
 */
function BulletGroup(game, scale, name) {
    Group.call(this, game, scale, name || 'Bullets');
    this.classType = Bullet;
}

BulletGroup.prototype = Object.create(Group.prototype);
BulletGroup.prototype.constructor = BulletGroup;

/**
 * Creates a new Bullet object and adds it to the top of this group.
 * All arguments given to this method are ignored.
 */
BulletGroup.prototype.create = function(_x, _y, _key, _frame) {
    var bullet = Group.prototype.create.call(this, 0, 0, null, null, false),
        specs = Supercold.bullet,
        offsetX = (specs.width - specs.bodyLen) / 2;

    if (DEBUG) this.extendChildName(bullet);
    bullet.scale.copyFrom(this.finalScale);
    // Set two shapes to closely resemble the shape of the bullet.
    bullet.body.setRectangle(specs.bodyLen, specs.height, -offsetX);
    bullet.body.addCircle(specs.bodyLen / 2, offsetX);
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
 * @param {Phaser.Game} game - A reference to the currently running Game.
 */
function BulletTrailGroup(game, _name) {
    Group.call(this, game, 1, 'BulletTrails');
    this.classType = BulletTrail;
}

BulletTrailGroup.prototype = Object.create(Group.prototype);
BulletTrailGroup.prototype.constructor = BulletTrailGroup;

/**
 * Creates a new BulletTrail object and adds it to the top of this group.
 * Only the 'x', 'y' arguments given to this method are taken into account.
 */
BulletTrailGroup.prototype.create = function(x, y, _key, _frame, _exists) {
    var trail = Group.prototype.create.call(this, x, y, null, null, true);

    if (DEBUG) this.extendChildName(trail);
    trail.scale.copyFrom(this.finalScale);
    return trail;
};

/**
 * Sets the scaling values for all the children of the group.
 * @param {Phaser.Point} worldScale - The scale of the world.
 */
BulletTrailGroup.prototype.resize = function(worldScale) {
    var oldWorldScaleX = 1 / this.finalScale.x,
        oldWorldScaleY = 1 / this.finalScale.y,
        newScale = new Phaser.Point(1, 1),
        length = this.children.length, trail, i;

    this.finalScale.set(1 / worldScale.x, 1 / worldScale.y);
    for (i = 0; i < length; ++i) {
        trail = this.children[i];
        // scale * oldWorldScale = (1/oldWorldScale * factor) * oldWorldScale = factor
        newScale.set(trail.scale.x*oldWorldScaleX / worldScale.x,
                     trail.scale.y*oldWorldScaleY / worldScale.y);
        trail.scale.copyFrom(newScale);
    }
};


/***** Objects for graphics or UI *****/

/**
 * An object that draws trails behind bullets.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 */
function BulletTrailPainter(game) {
    this.game = game;
    this.trails = new BulletTrailGroup(game);

    // Dictionary for fast lookups.
    this._liveTrails = {};
}

/**
 * Handles resizing of all bullet trails.
 * Useful when the game world is rescaled.
 */
BulletTrailPainter.prototype.resize = function() {
    this.trails.resize(this.game.world.scale);
};

BulletTrailPainter.prototype.startTrail = function(bullet) {
    var trail = this.trails.getFirstDead(true, bullet.x, bullet.y);

    trail.start(bullet);
    this._liveTrails[bullet.name] = trail;
};

BulletTrailPainter.prototype.stopTrail = function(bullet) {
    var trail = this._liveTrails[bullet.name];

    // Check if the trail exists, since the handler may be called more than once!
    if (trail) {
        trail.stop();
        delete this._liveTrails[bullet.name];
    }
};

BulletTrailPainter.prototype._getTrailLength = function(trail) {
    var bullet = trail.bullet;
    // Note that we account for world scaling.
    return Math.min(
        this.game.math.distance(bullet.x, bullet.y, trail.refX, trail.refY),
        trail.texture.width / this.game.world.scale.x);
};

BulletTrailPainter.prototype.updateTrails = function(elapsedTime) {
    var trails = this.trails.children, trail, i;

    for (i = 0; i < trails.length; ++i) {
        trail = trails[i];
        if (!trail.alive) continue;

        if (trail.bullet !== null) {    // Live
            // Don't round this value, since it causes jitter.
            trail.width = this._getTrailLength(trail);
            trail.x = trail.bullet.x;
            trail.y = trail.bullet.y;
        } else {                        // Stray
            // Don't round this value, since it causes jitter.
            trail.width -= (Supercold.speeds.bullet.normal * elapsedTime);
            if (trail.width <= 0) {
                trail.kill();
            }
        }
    }
};


/**
 * Abstract base class for heads-up displays.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} x - The x-coordinate of the top-left corner of the HUD.
 * @param {number} y - The y-coordinate of the top-left corner of the HUD.
 * @param {number} width - The width of the HUD.
 * @param {number} height - The height of the HUD.
 * @param {string} key - A key for the Phaser chache.
 * @abstract
 */
function HUD(game, x, y, width, height, key) {
    var scale = game.camera.scale,
        // Round, don't ceil!
        scaledWidth = Math.round(width * scale.x),
        scaledHeight = Math.round(height * scale.y);

    this.game = game;

    this.width = width;
    this.height = height;

    this.hud = game.make.bitmapData(scaledWidth, scaledHeight, key, true);
    this.hudImage = this.hud.addToWorld(x, y);

    this.hudImage.name = key;
    this.hudImage.fixedToCamera = true;
    // Account for camera scaling.
    this.hudImage.scale.set(1 / scale.x, 1 / scale.y);
}

/**
 * Handles resizing of the HUD.
 * Useful when the camera scale changes.
 * @param {number} x - The x-coordinate of the top-left corner of the HUD.
 * @param {number} y - The y-coordinate of the top-left corner of the HUD.
 */
HUD.prototype.resize = function(x, y) {
    var scale = this.game.camera.scale,
        // Round, don't ceil!
        scaledWidth = Math.round(this.width * scale.x),
        scaledHeight = Math.round(this.height * scale.y);

    this.hud.resize(scaledWidth, scaledHeight);
    this.hudImage.x = x;
    this.hudImage.y = y;
    this.hudImage.cameraOffset.set(x, y);
    // Account for camera scaling.
    this.hudImage.scale.set(1 / scale.x, 1 / scale.y);
};

HUD.prototype.update = function() {
    throw new Error('Abstract base class');
};


/**
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} x - The x-coordinate of the top-left corner of the minimap.
 * @param {number} y - The y-coordinate of the top-left corner of the minimap.
 * @param {number} width - The width of the minimap.
 * @param {number} height - The height of the minimap.
 */
function Minimap(game, x, y, width, height) {
    HUD.call(this, game, x, y, width, height, 'Minimap');

    this._ratio = {
        x: Supercold.minimap.width / game.world.bounds.width,
        y: Supercold.minimap.height / game.world.bounds.height
    };

    this.hud.ctx.fillStyle = Supercold.style.minimap.background.color;
    this.hud.ctx.strokeStyle = Supercold.style.minimap.border.color;
    this.hud.ctx.lineWidth = Supercold.style.minimap.border.lineWidth;
    this.hud.ctx.lineJoin = 'round';
}

Minimap.prototype = Object.create(HUD.prototype);
Minimap.prototype.constructor = Minimap;

/**
 * Handles resizing of the minimap.
 * Useful when the camera scale changes.
 * @param {number} x - The x-coordinate of the top-left corner of the minimap.
 * @param {number} y - The y-coordinate of the top-left corner of the minimap.
 */
Minimap.prototype.resize = function(x, y) {
    HUD.prototype.resize.call(this, x, y);
    // Resizing may cause the canvas state to reset!
    this.hud.ctx.fillStyle = Supercold.style.minimap.background.color;
    this.hud.ctx.strokeStyle = Supercold.style.minimap.border.color;
    this.hud.ctx.lineWidth = Supercold.style.minimap.border.lineWidth;
};

Minimap.prototype._markEntity = function(entity, radius) {
    var ctx = this.hud.ctx;

    // Just draw a circle.
    circle(ctx, entity.x * this._ratio.x, entity.y * this._ratio.y, radius);
    ctx.fill();
    ctx.stroke();
};

Minimap.prototype._markPlayer = function(player) {
    this._markEntity(player, Supercold.style.minimap.player.radius);
};
Minimap.prototype._markBot = function(bot) {
    this._markEntity(bot, Supercold.style.minimap.bot.radius);
};

Minimap.prototype.update = function(player, bots) {
    var padX = Math.round(PADDING.width * this._ratio.x),
        padY = Math.round(PADDING.height * this._ratio.y),
        ctx = this.hud.ctx, style;

    ctx.save();
        ctx.scale(this.game.camera.scale.x, this.game.camera.scale.y);

        // Clear the map. Necessary since background is semi-transparent.
        ctx.clearRect(0, 0, this.width, this.height);
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.strokeRect(0, 0, this.width, this.height);

        ctx.strokeStyle = Supercold.style.minimap.innerBorder.color;
        ctx.lineWidth = Supercold.style.minimap.innerBorder.lineWidth;
        ctx.strokeRect(padX, padY, this.width - 2*padX, this.height - 2*padY);

        // The (0, 0) point of our world is in the center!
        ctx.translate(this.width / 2, this.height / 2);

        style = Supercold.style.minimap.bot;
        ctx.fillStyle = style.color;
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        bots.forEachAlive(this._markBot, this);

        style = Supercold.style.minimap.player;
        ctx.fillStyle = style.color;
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        this._markPlayer(player);
    ctx.restore();
    // Re-render!
    this.hud.dirty = true;
};


/**
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} x - The x-coordinate of the top-left corner of the reload bar.
 * @param {number} y - The y-coordinate of the top-left corner of the reload bar.
 * @param {number} width - The width of the reload bar.
 * @param {number} height - The height of the reload bar.
 * @param {string} key - A key for the Phaser chache.
 */
function ReloadBar(game, x, y, width, height, key, fillStyle) {
    HUD.call(this, game, x, y, Supercold.bar.width, Supercold.bar.height, key);

    this._fillStyle = fillStyle;
    this._tween = null;

    this._fill();
}

ReloadBar.prototype = Object.create(HUD.prototype);
ReloadBar.prototype.constructor = ReloadBar;

ReloadBar.prototype._fill = function() {
    this.hud.rect(0, 0, this.hud.width, this.hud.height, this._fillStyle);
};

/**
 * Handles resizing of the reload bar.
 * Useful when the camera scale changes.
 * @param {number} x - The x-coordinate of the top-left corner of the reload bar.
 * @param {number} y - The y-coordinate of the top-left corner of the reload bar.
 */
ReloadBar.prototype.resize = function(x, y) {
    HUD.prototype.resize.call(this, x, y);
    // Resizing clears the canvas!
    this._fill();
};

/**
 * @param {number} progress - A value in the range [0, 1].
 */
ReloadBar.prototype.update = function(progress) {
    this.hudImage.scale.x = progress / this.game.camera.scale.x;
    this.hudImage.alpha = (progress === 1) ? 1 : 0.75;
};

ReloadBar.prototype._removeTween = function() {
    this._tween = null;
};

ReloadBar.prototype.shake = function() {
    var duration = this.game.time.physicsElapsedMS;

    // Already shaking!
    if (this._tween) return;

    // The element is fixed to camera, so use the cameraOffset property.
    this._tween = this.game.add.tween(this.hudImage.cameraOffset).to({
        x: '-1'
    }, duration, Phaser.Easing.Linear.None);
    this._tween.to({
        x: '+2'
    }, duration, Phaser.Easing.Linear.None, !AUTOSTART, 0, 15, true);
    this._tween.to({
        x: '-1'
    }, duration, Phaser.Easing.Linear.None);
    this._tween.onComplete.add(this._removeTween, this);
    this._tween.start();
};

/**
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} x - The x-coordinate of the top-left corner of the hotswitch bar.
 * @param {number} y - The y-coordinate of the top-left corner of the hotswitch bar.
 * @param {number} width - The width of the hotswitch bar.
 * @param {number} height - The height of the hotswitch bar.
 */
function HotswitchBar(game, x, y, width, height) {
    ReloadBar.call(this, game, x, y, width, height, 'HotswitchBar',
                   Supercold.style.hotswitchBar.color);
}

HotswitchBar.prototype = Object.create(ReloadBar.prototype);
HotswitchBar.prototype.constructor = HotswitchBar;

/**
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} x - The x-coordinate of the top-left corner of the bullet bar.
 * @param {number} y - The y-coordinate of the top-left corner of the bullet bar.
 * @param {number} width - The width of the bullet bar.
 * @param {number} height - The height of the bullet bar.
 */
function BulletBar(game, x, y, width, height) {
    ReloadBar.call(this, game, x, y, width, height, 'BulletBar',
                   Supercold.style.bulletBar.color);
}

BulletBar.prototype = Object.create(ReloadBar.prototype);
BulletBar.prototype.constructor = BulletBar;


/***** The core of the game *****/

Supercold.Game = function(game) {
    Supercold._BaseState.call(this, game);

    this._sprites = {
        player: null,
        background: null
    };
    this._colGroups = {         // Collision groups
        player: null,
        bots: null,
        playerBullets: null,
        botBullets: null
    };
    this._groups = {
        bounds: null,
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

    this._announcer = null;
    this._overlay = null;
    this._superhotFx = null;

    // These will be set in init.
    this.level = -1;
    this._totalBotCount = -1;
    this._bulletCount = -1;

    this._fireRate = 0;
    // Time remaining since next bot spawn.
    this._nextBotTime = 0;
    // Time remaining since next hotswitch.
    this._nextHotSwitch = 0;
    this._hotswitching = false;

    this._elapsedTime = 0;

    // Internal cached objects.
    this._cached = {
        verVec: {x: 0, y: 0},
        horVec: {x: 0, y: 0}
    };
};

Supercold.Game.prototype = Object.create(Supercold._BaseState.prototype);
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
    this._totalBotCount = 4 + Math.floor(this.level * 0.6);
    this._mutators = Supercold.storage.loadMutators();
    this._bulletCount = (this._mutators.lmtdbull) ? this._totalBotCount*3 : -1;
};


function bulletHandler(myBullet, otherBullet) {
   myBullet.sprite.kill();
   // The other bullet will be killed by the other handler call.
}

Supercold.Game.prototype._startTrail = function(bullet) {
    this._bulletTrailPainter.startTrail(bullet);
};
Supercold.Game.prototype._stopTrail = function(bullet) {
    this._bulletTrailPainter.stopTrail(bullet);
};

Supercold.Game.prototype._createBullet = function(group, myColGroup) {
    var bullet = group.create();

    bullet.events.onRevived.add(this._startTrail, this);
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
    var bound = this._groups.bounds.create(rect.x, rect.y, null);

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
    var bounds = this.world.bounds;

    this._groups.bounds = this.add.physicsGroup(PHYSICS_SYSTEM);
    this._groups.bounds.name = 'Player Bounds';
    // Note that all invisible walls have double the width or height in order to
    // prevent the player from getting out of the world bounds when hotswitching.
    [new Phaser.Rectangle(
        // Top
        bounds.left - PADDING.width,        // x
        bounds.top - PADDING.height,        // y
        bounds.width + 2*PADDING.width,     // width
        PADDING.height * 2                  // height
    ), new Phaser.Rectangle(
        // Bottom
        bounds.left - PADDING.width,
        bounds.bottom - PADDING.height,
        bounds.width + 2*PADDING.width,
        PADDING.height * 2
    ), new Phaser.Rectangle(
        // Left
        bounds.left - PADDING.width,
        bounds.top - PADDING.height,
        PADDING.width * 2,
        bounds.height + 2*PADDING.height
    ), new Phaser.Rectangle(
        // Right
        bounds.right - PADDING.width,
        bounds.top - PADDING.height,
        PADDING.width * 2,
        bounds.height + 2*PADDING.height
    )].forEach(function(rect, index) {
        this._createPlayerBound(rect, index, collisionGroup);
    }, this);
};

Supercold.Game.prototype._addBotInputHandler = function() {
    var properties0 = {
        alpha: 0
    }, properties1 = {
        alpha: 1
    };

    this._groups.bots.onChildInputDown.add(function hotswitch(bot, pointer) {
        var duration1 = 250, duration2 = 200,
            player = this._sprites.player,
            playerTween, botTweeen;

        if (DEBUG) log('Clicked on bot');
        // NOTE: Don't use Ctrl + left lick since it is a simulated right click!
        // Check for the appropriate controls.
        if (!((pointer.leftButton.isDown && pointer.leftButton.shiftKey) ||
                pointer.rightButton.isDown)) {
            return;
        }
        // The hotswitch may not be ready yet
        if (this._nextHotSwitch > 0) {
            this._huds.hotswitchBar.shake();
            return;
        }
        // or we may be in the middle of it.
        if (this._hotswitching) {
            return;
        }

        if (DEBUG) log('Hotswitching...');
        this._hotswitching = true;
        // Fade out.
        playerTween = this.add.tween(player).to(
            properties0, duration1, Phaser.Easing.Linear.None, AUTOSTART);
        botTweeen = this.add.tween(bot).to(
            properties0, duration1, Phaser.Easing.Linear.None, AUTOSTART);
        botTweeen.onComplete.addOnce(function swap() {
            var player = this._sprites.player, temp;

            // Make the camera move more smoothly for the hotswitch.
            this.camera.follow(player, Phaser.Camera.FOLLOW_LOCKON, 0.2, 0.2);

            temp = player.body.x;
            player.body.x = bot.body.x;
            bot.body.x = temp;
            temp = player.body.y;
            player.body.y = bot.body.y;
            bot.body.y = temp;

            this.camera.flash(0xEEEAE0, 300);

            // Fade in.
            playerTween.to(
                properties1, duration2, Phaser.Easing.Quadratic.Out, AUTOSTART);
            botTweeen.to(
                properties1, duration2, Phaser.Easing.Quadratic.Out, AUTOSTART);
            this._nextHotSwitch = this._hotswitchTimeout;
            botTweeen.onComplete.addOnce(function endHotswitch() {
                // Reset the camera to its default behaviour.
                this.camera.follow(player);
                this._hotswitching = false;
                if (DEBUG) log('Hotswitched!');
            }, this);
        }, this);
    }, this);
};

/**
 * Returns an appropriate offset value for a background scrolling effect.
 * Our background sprite contains an additional row/column on each side
 * of the inner region (light cells) to allow for the scrolling effect.
 * @param {number} playerDistance - The distance of the player from the center.
 * @param {number} bgMaxDistance - The max distance that the background will travel.
 * @return {number} - The background offset.
 */
function bgOffset(playerDistance, bgMaxDistance) {
    var CELLDIM = Supercold.cell.width;
    // Bound the value.
    return CELLDIM * Math.min(
        Math.floor(bgMaxDistance / CELLDIM) - 1,
        Math.floor(playerDistance / CELLDIM));
}

/**
 * Places the background in a position such that it looks likes it is scrolled.
 * Our background sprite contains an additional row/column on each side
 * of the inner region (light cells) to allow for the scrolling effect.
 */
Supercold.Game.prototype._scrollBackground = function() {
    var player = this._sprites.player, background = this._sprites.background;

    background.x = (player.x > 0) ?
         bgOffset( player.x, Supercold.world.width/2 - PADDING.width) :
        -bgOffset(-player.x, Supercold.world.width/2 - PADDING.width);
    background.y = (player.y > 0) ?
         bgOffset( player.y, Supercold.world.height/2 - PADDING.height) :
        -bgOffset(-player.y, Supercold.world.height/2 - PADDING.height);
};

Supercold.Game.prototype._positionHuds = function() {
    var camera = this.camera, scale = camera.scale,
        hud = this._huds.minimap.hudImage, refHud;

    // NOTE: Do not set anchor.x to 1, because this makes reload bars
    // reload right to left! Let's handle anchoring ourselves instead.

    // Reset scale to compute correct sizes and offsets.
    // TODO: Find a clean way to do the positioning!
    hud.scale.set(1);
    hud.right = camera.width - Math.round(Supercold.minimap.x * scale.x);
    hud.bottom = camera.height - Math.round(Supercold.minimap.y * scale.y);
    hud.scale.set(1 / scale.x, 1 / scale.y);
    hud.cameraOffset.set(hud.x, hud.y);

    // At least 2 units on the y-axis so that bars do not touch on small screens!
    refHud = hud;
    hud = this._huds.hotswitchBar.hudImage;
    hud.scale.set(1);
    hud.alignTo(refHud, Phaser.TOP_LEFT, 0, 2 * scale.y);
    hud.scale.set(1 / scale.x, 1 / scale.y);
    hud.cameraOffset.set(hud.x, hud.y);
    refHud = hud;
    hud = this._huds.bulletBar.hudImage;
    hud.scale.set(1);
    hud.alignTo(refHud, Phaser.TOP_LEFT, 0, 2 * scale.y);
    hud.scale.set(1 / scale.x, 1 / scale.y);
    hud.cameraOffset.set(hud.x, hud.y);
};

Supercold.Game.prototype._lose = function(player, bullet) {
    var duration = 1500;

    bullet.sprite.kill();
    // The collision handler may be called more than once due to shapes!
    if (!player.sprite.alive) {
        return;
    }
    // If we have already won or we are in godmode, don't lose!
    if (this.superhot || this._mutators.godmode) {
        return;
    }

    this._overlay = this.add.existing(newOverlay(this.game));
    this._overlay.name = 'lose screen overlay';
    this._overlay.alpha = 0;
    this.add.tween(this._overlay).to({
        alpha: 1
    }, duration, Phaser.Easing.Linear.None, AUTOSTART)
        .onComplete.addOnce(function restart() {
            this.time.events.add(Phaser.Timer.SECOND * 1.5, this.restart, this);
            this.time.events.add(Phaser.Timer.SECOND * 1.5, hideTip, this);
        }, this);

    // Can't hotswitch when dead.
    this._groups.bots.onChildInputDown.removeAll();
    player.removeCollisionGroup(
        [this._colGroups.playerBullets, this._colGroups.botBullets]);
    if (DEBUG) log('Removed input and collision handlers.');
    player.sprite.kill();
    // TODO: Add fancy effects.
    this.camera.shake(0.00086, 1200, true, Phaser.Camera.SHAKE_HORIZONTAL, false);
    showTipRnd();
};

Supercold.Game.prototype._superhot = function() {
    var DELAY = 100, newLevel = this.level + 1;

    this._sprites.player.body.setZeroVelocity();

    // TODO: Add fancy effect.
    Supercold.storage.saveLevel(newLevel);
    this.time.events.add(DELAY, function superhot() {
        var announcer = new Announcer(this.game, Supercold.texts.SUPERHOT, {
                nextDelay: 650,
                finalDelay: 400,
                repeat: true,
                overlay: true,
                overlayColor: 'light'
            }),
            superDuration = announcer.options.nextDelay + announcer.options.duration,
            hotDuration = announcer.options.finalDelay + announcer.options.duration,
            duration = superDuration + hotDuration,
            times = 3, delay = times * duration, i;

        for (i = 0; i < times; ++i) {
            this.time.events.add(i*duration, function saySuper() {
                this._superhotFx.play('super');
            }, this);
            this.time.events.add(i*duration + superDuration, function sayHot() {
                this._superhotFx.play('hot');
            }, this);
        }
        this._announcer = announcer.announce();

        this.time.events.add(delay, function nextLevel() {
            this.state.start('Game', CLEAR_WORLD, !CLEAR_CACHE, {
                level: newLevel
            });
        }, this);
    }, this);
};

Supercold.Game.prototype._botKillHandler = function(bot, bullet, _botS, _bulletS) {
    bot.sprite.kill();
    bullet.sprite.kill();
    if (this.superhot) {
        this._superhot();       // SUPER HOT!
    }
};

/**
 * Spawns the next bot.
 * @param {boolean} [closer=false] - If true, spawns the bot closer to the player.
 */
Supercold.Game.prototype._spawnBot = function(closer) {
    var player = this._sprites.player, colGroups = this._colGroups,
        radius = ((NATIVE_WIDTH + NATIVE_HEIGHT) / 2) / 2,
        angle, x, y, bot;

    if (closer) {
        radius -= (2 * Supercold.player.radius) * 2;
    }
    angle = this.rnd.realInRange(0, 2 * Math.PI);
    x = player.x + (radius * Math.cos(angle));
    y = player.y + (radius * Math.sin(angle));

    // If out of bounds, bring it back in.
    if (x < 0) {
        x = Math.max(x, this.world.bounds.left);
    } else {
        x = Math.min(x, this.world.bounds.right);
    }
    if (y < 0) {
        y = Math.max(y, this.world.bounds.top);
    } else {
        y = Math.min(y, this.world.bounds.bottom);
    }

    --this._totalBotCount;

    bot = this._groups.bots.getFirstDead(true, x, y);
    // Fade into existence.
    bot.alpha = 0.1;
    this.add.tween(bot).to({
        alpha: 1
    }, 750, Phaser.Easing.Linear.None, AUTOSTART);

    bot.body.setCollisionGroup(colGroups.bots);
    // Bots collide against themselves, the player and all bullets.
    bot.body.collides([colGroups.bots, colGroups.player]);
    bot.body.collides([colGroups.botBullets, colGroups.playerBullets],
                      this._botKillHandler, this);
};

Supercold.Game.prototype._announce = function() {
    var levelText;

    if (this.level === 1) {
        // If the player just started playing, explain the game mechanics.
        this._announcer = new Announcer(this.game, Supercold.texts.MECHANICS, {
            initDelay: 750,
            duration: 250,
            nextDelay: 250,
            flashTint: 0x4A4A4A,
            flashOffDuration: 475
        }).announce();
    } else {
        // Otherwise, simply tell in which level they are in.
        levelText = Supercold.texts.LEVEL + ' ' + this.level;
        this._announcer = new Announcer(this.game, [levelText], {
            initDelay: 750,
            duration: 500,
            finalDelay: 250,
            flashTint: 0x4A4A4A,
            flashOffDuration: 800
        }).announce();
    }
};


Supercold.Game.prototype.restart = function restart() {
    hideTip();
    this.state.restart(CLEAR_WORLD, !CLEAR_CACHE, {level: this.level});
};

Supercold.Game.prototype.quit = function quit() {
    hideTip();
    log('\nThank you for playing! :)');
    this.state.start('MainMenu');
};


Supercold.Game.prototype.create = function() {
    var radius = Supercold.player.radius * this._spriteScale, player, boundsColGroup;

    if (DEBUG) log('Creating Game state: Level ' + this.level + '...');

    // Scaling should be specified first.
    this.setScaling();

    this._sprites.background = this.addBackground();

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
    this._groups.playerBullets = new BulletGroup(this.game, 1, 'Player Bullets');
    this._groups.botBullets = new BulletGroup(this.game, 1, 'Bot Bullets');

    this._addPlayerBounds(boundsColGroup);

    // The player is positioned in a semi-random location inside their bounds.
    this._sprites.player = player = new Player(
        this.game,
        this.rnd.sign() * this.rnd.between(
            radius, this.world.bounds.right - PADDING.width - radius),
        this.rnd.sign() * this.rnd.between(
            radius, this.world.bounds.bottom - PADDING.height - radius));
    player.body.setCollisionGroup(this._colGroups.player);
    // The player collides with the bounds, the bots and the bullets.
    player.body.collides([boundsColGroup, this._colGroups.bots]);
    player.body.collides([this._colGroups.playerBullets, this._colGroups.botBullets],
                         this._lose, this);

    // The player is always in the center of the screen.
    this.camera.follow(player);

    this._groups.bots = new BotGroup(this.game, this._spriteScale);
    this._addBotInputHandler();

    this._scrollBackground();

    // Add HUDs.
    this._huds.minimap = new Minimap(
        this.game, 0, 0, Supercold.minimap.width, Supercold.minimap.height);
    this._huds.hotswitchBar = new HotswitchBar(
        this.game, 0, 0, Supercold.bar.width, Supercold.bar.height);
    this._huds.bulletBar = new BulletBar(
        this.game, 0, 0, Supercold.bar.width, Supercold.bar.height);
    // and fix their position on the screen.
    this._positionHuds();

    // Add controls.
    this._controls.cursors = this.input.keyboard.createCursorKeys();
    this._controls.wasd = this.input.keyboard.addKeys(Supercold.controls.WASD);
    this._controls.fireKey = this.input.keyboard.addKey(Supercold.controls.fireKey);
    this.input.keyboard.addKey(Supercold.controls.quitKey)
        .onDown.addOnce(this.quit, this);
    this.input.keyboard.addKey(Supercold.controls.restartKey)
        .onDown.addOnce(this.restart, this);

    // The player should render above all other game entities (except text and UI).
    player.bringToTop();
    // Calling bringToTop after enabling debugging hides the debug body.
    // http://phaser.io/docs/2.6.2/Phaser.Physics.P2.BodyDebug.html
    if (DEBUG) this.world.bringToTop(player.body.debugBody);

    // Spawn the first bot immediately.
    this._spawnBot(true);
    // Decide when to spawn the 2nd bot. It will be spawned faster than the rest.
    this._nextBotTime = this.rnd.realInRange(0.06, 0.12);
    this._nextHotSwitch = this._hotswitchTimeout;
    this._hotswitching = false;
    this._fireRate =
        (this._mutators.fastgun) ? Supercold.fastFireRate : Supercold.fireRate;

    // We need to handle the shaking of the bullet bar separately to avoid
    // shaking immediately after a bullet is fired and to allow the player
    // to keep the fire control pressed without constanlty shaking the bar.
    function onFireControl(buttonOrKey) {
        /*jshint validthis: true */
        if (!buttonOrKey.shiftKey) {            // not trying to hotswitch
            if (player.remainingTime > 0) {
                this._huds.bulletBar.shake();
            }
        }
    }
    this.input.activePointer.leftButton.onDown.add(onFireControl, this);
    this._controls.fireKey.onDown.add(onFireControl, this);

    this._announce();
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
    bullet.owner = sprite;
    bullet.body.rotation = sprite.body.rotation;
    // Dispatch the onRevived signal after setting rotation.
    bullet.revive();
};

Supercold.Game.prototype._fireBullet = function(bullet, sprite, fireRate) {
    this._resetBullet(bullet, sprite);
    sprite.remainingTime = fireRate;
};

Supercold.Game.prototype._firePlayerBullet = function() {
    var player = this._sprites.player, bullets = this._groups.playerBullets;

    // Not ready to fire yet or no bullets left.
    if (player.remainingTime > 0 || this._bulletCount === 0) {
        return false;
    }
    if (DEBUG) {
        log('Player bullet exists:', bullets.getFirstExists(false) !== null);
    }
    this._fireBullet(bullets.getFirstExists(false) || this._createPlayerBullet(),
                     player, this._fireRate);
    --this._bulletCount;
    return true;
};

Supercold.Game.prototype._fireBotBullet = function(bot) {
    var bullets = this._groups.botBullets;

    // Not ready to fire yet.
    if (bot.remainingTime > 0) {
        return;
    }
    // Wait sometimes before firing to make things a bit more unpredictable.
    if (this.rnd.frac() <= 1/4) {
        bot.remainingTime = this.rnd.between(
            0, Math.max(Supercold.fireRate * (1 - this.level/100), 0));
        return;
    }
    if (DEBUG) {
        log('Bot bullet exists:', bullets.getFirstExists(false) !== null);
    }
    this._fireBullet(bullets.getFirstExists(false) || this._createBotBullet(),
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
            (NATIVE_WIDTH + NATIVE_HEIGHT) / 2) {
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

    // Dodge sometimes (chance: 1 / (60fps * 2sec * slowFactor)).
    if (this.rnd.frac() <= 1 / (this.time.desiredFps * 2 *
            this.time.physicsElapsed/elapsedTime)) {
        bot.dodging = true;
        bot.duration = 0.25 + 0.004*this.level;   // secs
        bot.direction = (this.rnd.between(0, 1)) ? 'left' : 'right';
    }

    // If the player fired and we are not already dodging, try to dodge.
    if (playerFired) {
        // Dodge only when the player is facing us, so it doesn't look stupid.
        angleDiff = this.math.reverseAngle(player.body.rotation) -
            this.math.normalizeAngle(bot.body.rotation);
        if (!(angleDiff < range && angleDiff > -range))
            return;
        // Dodge sometimes (chance in range [1/4,3/4]).
        if (this.rnd.frac() <= 1/4 + Math.min(2/4, 2/4 * this.level/100)) {
            bot.dodging = true;
            bot.duration = 0.25 + 0.005*this.level;   // secs
            bot.direction = (this.rnd.between(0, 1)) ? 'left' : 'right';
        }
    }
};

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
        fireButton = this.input.activePointer.leftButton,
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
        // Process firing controls (check that we are not trying to hotswitch).
        if ((fireButton.isDown && !fireButton.shiftKey) || fireKey.isDown) {
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
    elapsedTime = this._elapsedTime = this.time.physicsElapsed *
        (bulletSpeed / Supercold.speeds.bullet.normal);
    player.remainingTime -= elapsedTime;

    if (!this._hotswitching) {
        this._nextHotSwitch -= elapsedTime;
    }
    // Check if there are any more bots to spawn.
    if (this._totalBotCount > 0) {
        this._nextBotTime -= elapsedTime;
        if (this._nextBotTime <= 0) {
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
    // Update HUDs (except minimap).
    if (player.alive) {
        this._huds.bulletBar.update(
            Math.min(1, 1 - player.remainingTime / this._fireRate));
        this._huds.hotswitchBar.update(
            Math.min(1, 1 - this._nextHotSwitch/this._hotswitchTimeout));
    }
};

/**
 * The preRender method is called after all Game Objects have been updated,
 * but before any rendering takes place. So, use it for calculations that
 * need all physics computations updated.
 */
Supercold.Game.prototype.preRender = function() {
    this._bulletTrailPainter.updateTrails(this._elapsedTime);
    // Update the minimap here, now that bots are updated.
    this._huds.minimap.update(this._sprites.player, this._groups.bots);
    // Scroll the background appropriately.
    this._scrollBackground();
};


/**
 * Handles browser resizing. Called automatically by our Phaser game.
 *
 * @param {number} width - the new width
 * @param {number} height - the new height
 * @override
 */
Supercold.Game.prototype.resize = function(width, height) {
    var scale = this.world.scale;

    Supercold._BaseState.prototype.resize.call(this, width, height);

    // Resize all sprites to account for the new scale of our world.
    this._sprites.player.resize(scale);

    this._groups.bots.resize(scale);
    this._groups.playerBullets.resize(scale);
    this._groups.botBullets.resize(scale);

    this._bulletTrailPainter.resize();

    this._huds.minimap.resize(0, 0);
    this._huds.hotswitchBar.resize(0, 0);
    this._huds.bulletBar.resize(0, 0);
    this._positionHuds();

    this._announcer.resize();

    this.rescale(this._sprites.background);
    if (this._overlay) {
        this.rescale(this._overlay);
    }
};


/**
 * Performs final cleanup. Called automatically by our Phaser game.
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
    if (DEBUG) log('Shutting down Game state...');

    // Captured keys may mess with input on main menu.
    this.input.keyboard.clearCaptures();
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

function hideMenu() {
    document.getElementById('menu').style.display = 'none';
}
function showMenu() {
    document.getElementById('menu').style.display = 'block';
}

function loadLevelInfo() {
    document.getElementById('maxlevel').textContent = Supercold.storage.loadHighestLevel();
    document.getElementById('level').value = Supercold.storage.loadLevel();
}

function emptyClassName(selector) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(el) {
        el.className = '';
    });
}

function showUnlockedMutators() {
    var unlockLevels = [10, 20, 30, 40, 50, 60, 75, 100, 120], level, i;

    level = Supercold.storage.loadHighestLevel();
    for (i = 0; i < unlockLevels.length; ++i) {
        if (unlockLevels[i] <= level) {
            emptyClassName('.locked' + unlockLevels[i]);
        } else {
            break;
        }
    }
    if (level >= unlockLevels[unlockLevels.length-1]) {
        document.getElementById('mutator-hint').style.display = 'none';
    }
}

Supercold.play = function play(parent) {
    // Tell Phaser to cover the entire window and use the CANVAS renderer.
    // Note that WebGL has issues on some platforms, so we go for plain canvas!
    var game = new Phaser.Game('100', '100', Phaser.CANVAS, parent),
        mutators, mutator;

    warn('WebGL has performance issues on some platforms! Using canvas renderer...\n\n');

    /**
     * The single instance of data storage for our game.
     */
    Supercold.storage = new Supercold.GameStorageManager();

    loadLevelInfo();
    document.getElementById('level').addEventListener('change', function(event) {
        var level = Supercold.storage.loadHighestLevel(),
            newLevel = parseInt(this.value, 10);

        this.value = (isNaN(newLevel)) ? level : Math.min(level, Math.max(1, newLevel));
        Supercold.storage.saveLevel(this.value);
    }, false);

    mutators = Supercold.storage.loadMutators();
    if (mutators === null) {
        // Default mutators (all off)
        Supercold.storage.saveMutators({
            freelook: false,
            fasttime: false,
            fastgun: false,
            shotgun: false,
            bighead: false,
            chibi: false,
            dodge: false,
            superhotswitch: false,
            lmtdbull: false,
            doge: false,
            godmode: false
        });
    }
    for (mutator in mutators) {
        if (mutators.hasOwnProperty(mutator)) {
            document.getElementById(mutator).checked = mutators[mutator];
        }
    }

    showUnlockedMutators();

    // Handle mutator modifications.
    Array.prototype.forEach.call(document.querySelectorAll('#mutators input'), function(input) {
        input.addEventListener('change', function(event) {
            var mutators = Supercold.storage.loadMutators();

            mutators[this.id] = this.checked;
            Supercold.storage.saveMutators(mutators);
        }, false);
    });

    // Global per-instance options. Use a namespace to avoid name clashes.
    game.supercold = {
        onMainMenuOpen: function() {
            loadLevelInfo();
            showUnlockedMutators();
            showMenu();
        }
    };

    game.state.add('Boot', Supercold.Boot);
    game.state.add('Preloader', Supercold.Preloader);
    game.state.add('MainMenu', Supercold.MainMenu);
    game.state.add('Intro', Supercold.Intro);
    game.state.add('Game', Supercold.Game);

    game.state.start('Boot');

    document.getElementById('start').addEventListener('click', function(event) {
        hideMenu();
        game.state.start('Intro');
    }, false);
};


window.Supercold = Supercold;

}(window, Phaser));
