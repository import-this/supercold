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
 * Date: 7/5/2017
 * @version: 1.3.0
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
 * Creating the shortcuts is unfortunately tricky, because of diffs in browsers:
 *      https://github.com/whatwg/console/issues/3
 * @const
 */
var log = function log() {
        Function.prototype.apply.call(console.log, console, arguments);
    },
    warn = function warn() {
        Function.prototype.apply.call(console.warn, console, arguments);
    },
    error = function error() {
        Function.prototype.apply.call(console.error, console, arguments);
    },
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

if (String.prototype.startsWith === undefined) {
    warn('Undefined "String.prototype.startsWith". Using really bad polyfill...');

    // http://stackoverflow.com/a/4579228/1751037
    String.prototype.startsWith = function startsWith(prefix) {
        return this.lastIndexOf(prefix, 0) === 0;
    };
}

if (Object.freeze === undefined) {
    warn('Undefined "Object.freeze". Using noop polyfill...');

    // https://github.com/es-shims/es5-shim/blob/master/es5-sham.js#L477
    Object.freeze = function freeze(object) {
        return object;
    };
}

/******************************* Local Storage ********************************/

/*
 * https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Storage
 * http://dev.w3.org/html5/webstorage/
 */

/**
 * The version number.
 * Useful for marking incompatible changes in the storage format.
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
    GUNS: PREFIX + 'guns',
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

GameStorageManager.prototype.saveGuns = function(guns) {
    this.save(Keys.GUNS, JSON.stringify(guns));
};
GameStorageManager.prototype.loadGuns = function() {
    return JSON.parse(this.load(Keys.GUNS));
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
var VERSION = '1.3.0';

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
    ADD_TO_STAGE = true,
    AUTOSTART = true,
    EXISTS = true,
    CREATE_IF_NULL = true,
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
            THROWABLE: 'throwable',
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
    FACTOR_SLOWEST = 192,

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
    throwable: {
        radius: 12
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
    bulletCount: {
        x: 10,
        y: 10
    },

    speeds: {
        player: PLAYER_SPEED,
        dodge: PLAYER_SPEED * 2,
        bot: {
            normal: PLAYER_SPEED,
            slow: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOW),
            slower: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOWER),
            slowest: Math.round(BOT_SPEED_NORMAL / FACTOR_SLOWEST)
        },
        bullet: {
            normal: BULLET_SPEED_NORMAL,
            slow: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOW),
            slower: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOWER),
            slowest: Math.round(BULLET_SPEED_NORMAL / FACTOR_SLOWEST)
        }
    },

    baseFireRate: 1 / 2,            // 2 times / sec
    fastFireFactor: 1 / 2,          // Twice as fast
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
            },
            throwable: {
                radius: 2,
                color: 'rgb(30, 35, 38)'
            }
        },
        bulletBar: {
            color: 'rgba(25, 28, 30, 0.9)'
        },
        hotswitchBar: {
            color: 'rgba(250, 0, 0, 0.9)'
        },
        throwable: {
            color: 'rgb(30, 35, 38)'
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
        },
        'BULLETS': {
            font: 'Arial',
            fontWeight: 'normal',
            fontSize: 18,
            fill: 'rgb(245, 251, 255)',
            stroke: 'rgba(245, 251, 255, 0.5)',
            strokeThickness: 1,
            boundsAlignH: 'center',
            boundsAlignV: 'middle'
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
        dodgeKey: Phaser.KeyCode.SHIFT,
        quitKey: Phaser.KeyCode.ESC,
        restartKey: Phaser.KeyCode.T
    },

    texts: {
        SUPERHOT: 'SUPER HOT'.split(' '),
        SUPERCOLD: 'SUPER COLD'.split(' '),
        MECHANICS: 'TIME MOVES WHEN YOU MOVE'.split(' '),
        // These are special cases!
        LEVEL: 'LEVEL',
        BULLETS: 'Bullets: '
    }
};

// Freeze objects to detect erroneous overriding.
(function recursiveFreeze(obj) {
    var prop;

    for (prop in obj) {
        if (typeof obj[prop] === 'object') {
            Object.freeze(obj[prop]);
            recursiveFreeze(obj[prop]);
        }
    }
}(Supercold));


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
 * Puts the given sprite in the center of the camera view/screen.
 * If the sprite is fixed to camera, it sets the camera offset, too.
 * @param {Phaser.Camera} camera - A reference to the game camera.
 * @param {Phaser.Sprite} sprite - The sprite to center.
 */
function centerToCamera(camera, sprite) {
    sprite.centerX = camera.view.halfWidth;
    sprite.centerY = camera.view.halfHeight;
    if (sprite.fixedToCamera) {
        sprite.cameraOffset.set(sprite.x, sprite.y);
    }
    if (DEBUG) {
        log('Centered to camera', (sprite.name) ? sprite.name : 'sprite');
    }
}


function _resize() {
    /*jshint validthis: true */
    centerToCamera(this.game.camera, this);
}

/**
 * An image that is always centered in the camera view.
 * @constructor
 */
function CenteredImage(game, key) {
    Phaser.Image.call(this, game, 0, 0, key);

    this.name = 'CenteredImage';
    this.anchor.set(0.5);

    // Center it.
    this.resize();
}

CenteredImage.prototype = Object.create(Phaser.Image.prototype);
CenteredImage.prototype.constructor = CenteredImage;

CenteredImage.prototype.resize = _resize;

/**
 * Text that is always centered in the camera view.
 * @constructor
 */
function CenteredText(game, text, style) {
    Phaser.Text.call(this, game, 0, 0, text, style);

    this.name = '"' + text + '"';
    this.anchor.set(0.5);

    // Center it.
    this.resize();
}

CenteredText.prototype = Object.create(Phaser.Text.prototype);
CenteredText.prototype.constructor = CenteredText;

CenteredText.prototype.resize = _resize;

/**
 * Text that is scaled and always centered in the camera view.
 * @constructor
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
    centerToCamera(this.game.camera, this);
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
 * @param {Phaser.Group} [options.group=Game.World] -
 *      The group in which to add the announcer's objects.
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
 * @constructor
 */
function Announcer(game, text, options) {
    var group = options.group || game.world;

    this.options = Phaser.Utils.extend({}, Announcer.defaults, options);
    if (this.options.finalDelay === undefined) {
        this.options.finalDelay = this.options.nextDelay;
    }

    if (this.options.overlay) {
        this._overlay = group.add(
            newOverlay(game, this.options.overlayColor));
        this._overlay.name = 'Announcer overlay';
    } else {
        // Add a null object.
        this._overlay = new CenteredImage(game);
        this._overlay.name = 'Announcer null overlay';
    }

    this._flash = group.add(new CenteredImage(
        game, game.cache.getBitmapData(CACHE.KEY.FLASH)));
    this._flash.name = 'Announcer flash';
    this._flash.alpha = 0;
    this._flash.tint = this.options.flashTint;

    this._textGroup = Announcer._addTextGroup(game, group, text);

    this._inWorldGroup = (group === game.world);

    this._textTween = null;
    this._timer = null;

    // Handy references.
    this.camera = game.camera;
    this.add = game.add;
    this.time = game.time;

    // Objects in the game world are subject to camera positioning and scaling.
    if (this._inWorldGroup) {
        this._overlay.fixedToCamera = true;
        this._flash.fixedToCamera = true;
        this._textGroup.forEach(function(text) {
            text.fixedToCamera = true;
        });
        this.resize();
    }
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
    var scale = this.camera.scale;

    // Do nothing if the announcer has finished.
    if (this._flash === null) return;

    if (this._inWorldGroup) {
        // Account for camera scaling.
        // Note: World and camera scaling is the same in Phaser.
        this._overlay.scale.set(1 / scale.x, 1 / scale.y);
        this._flash.scale.set(1 / scale.x, 1 / scale.y);
    }
    this._overlay.resize();
    this._flash.resize();

    this._textGroup.forEach(function resize(text) {
        text.resize();
        if (this._inWorldGroup) {
            // Undo the world/camera scaling that will be applied by Phaser.
            // Note: World and camera scaling values are the same in Phaser.
            Phaser.Point.divide(text.scale, scale, text.scale);
        }
    }, this);
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

Announcer._addTextGroup = function(game, parent, words) {
    var scale = game.camera.scale,
        group, text, i, word, style;

    group = game.add.group(parent, 'Text group: "' + words + '"');
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
 * @constructor
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
 * @constructor
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
    ctx.lineJoin = 'round';

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

Supercold._BaseState.prototype._makeThrowableBitmap = function() {
    var radius = Supercold.throwable.radius,
        scale = this.world.scale,
        width, bmd, ctx;

    width = even(2*radius * scale.x);
    bmd = this.getBitmapData(width, width, CACHE.KEY.THROWABLE);
    ctx = bmd.ctx;

    ctx.fillStyle = Supercold.style.throwable.color;
    ctx.translate(bmd.width / 2, bmd.height / 2);
    ctx.scale(scale.x, scale.y);
    circle(ctx, 0, 0, radius);
    ctx.fill();
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
    // CAUTION: In certain resolutions, this causes some thin lines to disappear!
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
    this._makeThrowableBitmap();
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

Supercold._BaseState.prototype.getHudFontSize = function(baseSize) {
    return Math.max(14, Math.round(baseSize * this.camera.scale.x));
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
 * @constructor
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
 * @constructor
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

/**
 * @constructor
 */
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
    // No need for the camera to focus on anything here!

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

/**
 * @constructor
 */
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

var ANGLE_1DEG = 1 * Math.PI/180;       // 1 degree

/***** Sprites and Groups *****/

/*
 * IMPORTANT: Don't enable physics in the sprite constructor, since this slows
 * creation down significantly for some reason! Enable it in the group instead.
 */

/**
 * A generic sprite for our game.
 * It provides useful methods for handling the Phaser World scaling.
 * @constructor
 */
function Sprite(game, x, y, key, _frame) {
    Phaser.Sprite.call(this, game, x, y, key, _frame);
    this.name = 'Supercold Sprite';
}

Sprite.prototype = Object.create(Phaser.Sprite.prototype);
Sprite.prototype.constructor = Sprite;

/**
 * Moves the sprite forward, based on the given rotation and speed.
 * The sprite must have a P2 body for this method to work correctly.
 * (p2.body.moveForward does not work in our case, so I rolled my own.)
 */
Sprite.prototype.moveForward = function(rotation, speed) {
    var velocity = this.body.velocity;

    // Note that Phaser.Physics.Arcade.html#velocityFromRotation won't work,
    // due to the Phaser.Physics.P2.InversePointProxy body.velocity instance.
    velocity.x = speed * Math.cos(rotation);
    velocity.y = speed * Math.sin(rotation);
};

/**
 * One of the game's live entities, i.e. the player or a bot.
 * @constructor
 * @abstract
 */
function LiveSprite(game, x, y, key, _frame) {
    Sprite.call(this, game, x, y, key, _frame);

    this.name = 'LiveSprite';
    /**
     * Time until the next bullet can be fired.
     */
    this.remainingTime = 0;
    /**
     * A Weapon to shoot with.
     */
    this.weapon = null;

    /**
     * Tells if the sprite is currently dodging a bullet.
     */
    this.dodging = false;
    /**
     * The direction in which it is dodging.
     */
    this._direction = 0;
    /**
     * How long it will dodge.
     */
    this._duration = 0;
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
    this.weapon = null;

    this.dodging = false;
    this._direction = 0;
    this._duration = 0;
};

/**
 * Fires the weapon that the entity holds.
 */
LiveSprite.prototype.fire = function() {
    if (DEBUG) log('Bullet exists:', !!this.weapon.bullets.getFirstExists(!EXISTS));
    this.weapon.fire(this);
    this.remainingTime = this.weapon.fireRate;
};

/**
 * The player.
 * @constructor
 */
function Player(game, x, y, scale) {
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.PLAYER));

    this.name = 'Player';
    this.baseScale = scale || 1;
    this.radius = Supercold.player.radius * this.baseScale;
    this._dodgeRemainingTime = Player.DODGE_RELOAD_TIME;

    this.game.add.existing(this);

    // No group for Player, so enable physics here.
    this.game.physics.enable(this, PHYSICS_SYSTEM, DEBUG);
    this.body.setCircle(Supercold.player.radius * this.baseScale);

    // Account for world scaling.
    this.resize(this.game.world.scale);
}

Player.DODGE_RELOAD_TIME = 0.075;

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

/**
 * Rotates the player so as to point to the active pointer.
 * @return {boolean} - true, if the rotation changed.
 */
Player.prototype.rotate = function() {
    var playerRotated, newRotation;

    // Even though we use P2 physics, this function should work just fine.
    // Calculate the angle using World coords, because scaling messes it up.
    newRotation = this.game.physics.arcade.angleToPointer(
        this, undefined, USE_WORLD_COORDS);
    playerRotated = (this.body.rotation !== newRotation);
    this.body.rotation = newRotation;
    return playerRotated;
};

/**
 * Makes the player dodge in the direction specified.
 * @param {number} direction - The direction in which it will dodge.
 */
Player.prototype.dodge = function(direction) {
    if (!this.dodging && this._dodgeRemainingTime <= 0) {
        this.dodging = true;
        this._duration = 0.075;     // secs
        this._direction = direction;
    }
};

/**
 * Advances the player, based on their state and the state of the game.
 * NOTE: This doesn't check if the player is alive or not!
 */
Player.prototype.advance = function(moved, direction, elapsedTime) {
    this.remainingTime -= elapsedTime;
    this._dodgeRemainingTime -= elapsedTime;

    if (this.dodging) {
        this.moveForward(this._direction, Supercold.speeds.dodge);
        this._duration -= elapsedTime;
        if (this._duration <= 0) {
            this.dodging = false;
            this._dodgeRemainingTime = Player.DODGE_RELOAD_TIME;
        }
        return;
    }

    if (moved) {
        this.moveForward(direction, Supercold.speeds.player);
    } else {
        this.body.setZeroVelocity();
    }
};


/**
 * Returns a function that produces the regular movement for the bot.
 * @return {function} - The mover.
 */
function newForwardMover() {
    return function moveForward(sprite, speed, _player) {
        sprite.moveForward(sprite.body.rotation, speed);
    };
}

/**
 * Returns a function that makes the bot not get too close to the player.
 * @param {number} distance - The distance that the bot will keep.
 * @return {function} - The mover.
 */
function newDistantMover(distance) {
    return function moveDistant(sprite, speed, player) {
        if (sprite.game.physics.arcade.distanceBetween(sprite, player) < distance) {
            speed = 0;
        }
        sprite.moveForward(sprite.body.rotation, speed);
    };
}

/**
 * Returns a function that always strafes the bot once it gets close to the player.
 * @param {number} distance - The distance that the bot will keep.
 * @param {number} direction - The direction in which it will strafe.
 * @return {function} - The mover.
 */
function newStrafingMover(distance, direction) {
    return function moveStrafing(sprite, speed, player) {
        if (sprite.game.physics.arcade.distanceBetween(sprite, player) < distance) {
            sprite.moveForward(sprite.body.rotation + direction*0.8, speed);
        } else {
            sprite.moveForward(sprite.body.rotation, speed);
        }
    };
}

/**
 * Returns a function that always strafes the bot once it gets close
 * to the player, but also doesn't let it get too close to them.
 * @param {number} distance - The distance that the bot will keep.
 * @param {number} direction - The direction in which it will strafe.
 * @return {function} - The mover.
 */
function newStrafingDistantMover(distance, direction) {
    return function moveStrafingDistant(sprite, speed, player) {
        if (sprite.game.physics.arcade.distanceBetween(sprite, player) < distance) {
            sprite.moveForward(sprite.body.rotation + direction, speed);
        } else {
            sprite.moveForward(sprite.body.rotation, speed);
        }
    };
}


/**
 * A bot.
 * @constructor
 */
function Bot(game, x, y, _key, _frame) {
    LiveSprite.call(this, game, x, y, game.cache.getBitmapData(CACHE.KEY.BOT));

    this.name = 'Bot ' + Bot.count++;

    // Don't fire immediately!
    this.remainingTime = Supercold.initFireDelay;

    this.radius = -1;

    /**
     * A function that encapsulates the movement logic of the bot.
     */
    this.move = newForwardMover();
}

Bot.count = 0;

Bot.VIEW_ANGLE = Math.PI / 2.25;

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
};

/**
 * Fires the weapon that the entity holds.
 */
Bot.prototype.fire = function() {
    var body = this.body, rotation = body.rotation, angle = 2 * ANGLE_1DEG;

    // Introduce some randomness in the aim.
    body.rotation = rotation + this.game.rnd.realInRange(-angle, angle);
    LiveSprite.prototype.fire.call(this);
    body.rotation = rotation;
};

Bot.prototype._fire = function(level) {
    var game = this.game;

    // Wait sometimes before firing to make things a bit more unpredictable.
    if (game.rnd.frac() <= 1/5) {
        this.remainingTime = game.rnd.between(
            0, Math.max(this.weapon.fireRate * (1 - level/100), 0));
        return;
    }
    this.fire();
};

Bot.prototype._dodge = function(durationFix) {
    var game = this.game;

    this.dodging = true;
    this._duration = 0.25 + durationFix;        // secs
    this._direction = ((game.rnd.between(0, 1)) ? 1 : -1) * Math.PI/2;
};

/**
 * Advances the bot, based on its state and the state of the game.
 * Basically, this is the AI for the bot.
 */
Bot.prototype.advance = function(elapsedTime, speed, level, player, playerFired) {
    var game = this.game, angleDiff, slowFactor;

    this.remainingTime -= elapsedTime;

    // Even though we use P2 physics, this function should work just fine.
    this.body.rotation = game.physics.arcade.angleBetween(this, player);
    // this.body.rotation = Math.atan2(player.y - this.y, player.x - this.x);

    // Only try to shoot if the bot is somewhat close to the player
    if (game.physics.arcade.distanceBetween(this, player) <
            (NATIVE_WIDTH + NATIVE_HEIGHT) / 2) {
        // and if it is ready to fire.
        if (this.remainingTime <= 0) {
            this._fire(level);
        }
    }

    if (this.dodging) {
        this.moveForward(this.body.rotation + this._direction, speed);
        this._duration -= elapsedTime;
        if (this._duration <= 0) {
            this.dodging = false;
        }
        return;
    }

    this.move(this, speed, player);

    // Dodge sometimes (chance: 1 / (60fps * x sec * slowFactor)).
    slowFactor = game.time.physicsElapsed / elapsedTime;
    if (game.rnd.frac() <= 1 / (game.time.desiredFps * 1.2 * slowFactor)) {
        this._dodge(0.004 * level);
    }

    // If the player fired and we are not already dodging, try to dodge.
    if (playerFired) {
        // Dodge only when the player is facing us, so it doesn't look stupid.
        angleDiff = game.math.reverseAngle(player.body.rotation) -
            game.math.normalizeAngle(this.body.rotation);
        if (angleDiff < Bot.VIEW_ANGLE && angleDiff > -Bot.VIEW_ANGLE) {
            // Dodge sometimes (chance in range [1/4,3/4]).
            if (game.rnd.frac() <= 1/4 + Math.min(2/4, 2/4 * level/100)) {
                this._dodge(0.005 * level);
            }
        }
    }
};


/**
 * A weapon. Abstract base class.
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 * @abstract
 */
function Weapon(bullets, fireFactor) {
    this.bullets = bullets;
    this.fireRate = Supercold.baseFireRate * fireFactor;
}

/**
 * Fires bullets.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 * @override
 */
Weapon.prototype.fire = function(entity) {
    throw new Error('Abstract base class');
};

/**
 * A pistol. Fires one bullet at a time. The simplest gun.
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function Pistol(bullets, fireFactor) {
    Weapon.call(this, bullets, fireFactor);
}

Pistol.prototype = Object.create(Weapon.prototype);
Pistol.prototype.constructor = Pistol;

/**
 * Fires a bullet.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
Pistol.prototype.fire = function(entity) {
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL)
        .fire(entity, entity.body.rotation);
};

/**
 * A gun that fires two bullets at once. Accurate!
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function Burst(bullets, fireFactor) {
    Weapon.call(this, bullets, fireFactor);
}

Burst.prototype = Object.create(Weapon.prototype);
Burst.prototype.constructor = Burst;

Burst.OFFSET = 16;             // Space units

/**
 * Fires an array of bullets.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
Burst.prototype.fire = function(entity) {
    var x = entity.x, y = entity.y, rotation = entity.body.rotation,
        offsetX = Burst.OFFSET * Math.cos(rotation + Math.PI/2) / 2,
        offsetY = Burst.OFFSET * Math.sin(rotation + Math.PI/2) / 2;

    // Move the entity to adjust the position of the bullet to be fired.
    // Upper
    entity.x = x + offsetX;
    entity.y = y + offsetY;
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL).fire(entity, rotation);
    // Lower
    entity.x = x - offsetX;
    entity.y = y - offsetY;
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL).fire(entity, rotation);
    // Put it back in place.
    entity.x = x;
    entity.y = y;
};

/**
 * A gun that fires three bullets at once. Accurate!
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function Burst3(bullets, fireFactor) {
    Weapon.call(this, bullets, fireFactor);

    this.fireRate *= 1.111;
}

Burst3.prototype = Object.create(Weapon.prototype);
Burst3.prototype.constructor = Burst3;

Burst3.OFFSET = 16;

/**
 * Fires an array of bullets.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
Burst3.prototype.fire = function(entity) {
    var x = entity.x, y = entity.y, rotation = entity.body.rotation,
        offsetX = Burst3.OFFSET * Math.cos(rotation + Math.PI/2),
        offsetY = Burst3.OFFSET * Math.sin(rotation + Math.PI/2);

    // Move the entity to adjust the position of the bullet to be fired.
    // Upper
    entity.x = x + offsetX;
    entity.y = y + offsetY;
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL).fire(entity, rotation);
    // Lower
    entity.x = x - offsetX;
    entity.y = y - offsetY;
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL).fire(entity, rotation);
    // Middle
    entity.x = x;
    entity.y = y;
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL).fire(entity, rotation);
};

/**
 * A blunderbuss. Fires many bullets at once, but inaccurately.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function Blunderbuss(game, bullets, fireFactor) {
    Weapon.call(this, bullets, fireFactor);
    this.game = game;

    this.fireRate *= 1.2;
}

Blunderbuss.prototype = Object.create(Weapon.prototype);
Blunderbuss.prototype.constructor = Blunderbuss;

Blunderbuss.ANGLE = 13 * ANGLE_1DEG;
Blunderbuss.ANGLE_DIFF = 2 * ANGLE_1DEG;
Blunderbuss.OFFSET = 5;

/**
 * Fires multiple bullets.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
Blunderbuss.prototype.fire = function(entity) {
    var angle = Blunderbuss.ANGLE, diff = Blunderbuss.ANGLE_DIFF,
        x = entity.x, y = entity.y, rotation = entity.body.rotation,
        offsetX = Blunderbuss.OFFSET * Math.cos(rotation + Math.PI/2),
        offsetY = Blunderbuss.OFFSET * Math.sin(rotation + Math.PI/2),
        factor = -3/2, rnd = this.game.rnd, i;

    // Move the entity to adjust the position of the bullet to be fired.
    entity.x = x + factor*offsetX;
    entity.y = y + factor*offsetY;
    for (i = 1; i <= 4; ++i) {
        this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL)
            .fire(entity, rotation + factor*angle + rnd.realInRange(-diff, diff));
        entity.x += offsetX;
        entity.y += offsetY;
        ++factor;
    }
    // Put it back in place.
    entity.x = x;
    entity.y = y;
};

/**
 * A shotgun. Fires many bullets at once, but a somewhat inaccurately.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function Shotgun(game, bullets, fireFactor) {
    Weapon.call(this, bullets, fireFactor);
    this.game = game;

    this.fireRate *= 1.111;
}

Shotgun.prototype = Object.create(Weapon.prototype);
Shotgun.prototype.constructor = Shotgun;

Shotgun.ANGLE = 20 * ANGLE_1DEG;
Shotgun.ANGLE_DIFF = 2 * ANGLE_1DEG;

/**
 * Fires multiple bullets.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
Shotgun.prototype.fire = function(entity) {
    var angle = Shotgun.ANGLE, diff = Shotgun.ANGLE_DIFF,
        rotation = entity.body.rotation, rnd = this.game.rnd;

    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL)
        .fire(entity, rotation - angle + rnd.realInRange(-3*diff, diff));
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL)
        .fire(entity, rotation + rnd.realInRange(-diff, diff));
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL)
        .fire(entity, rotation + angle + rnd.realInRange(-diff, 3*diff));
};

/**
 * Double-barreled shotgun. Fires even more bullets at once more accurately.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function DbShotgun(game, bullets, fireFactor) {
    Weapon.call(this, bullets, fireFactor);
    this.game = game;
}

DbShotgun.ANGLE = 10 * ANGLE_1DEG;
DbShotgun.ANGLE_DIFF = 2 * ANGLE_1DEG;
DbShotgun.OFFSET = 6;

DbShotgun.prototype = Object.create(Weapon.prototype);
DbShotgun.prototype.constructor = DbShotgun;

/**
 * Fires multiple bullets.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
DbShotgun.prototype.fire = function(entity) {
    var angle = DbShotgun.ANGLE, diff = DbShotgun.ANGLE_DIFF,
        x = entity.x, y = entity.y, rotation = entity.body.rotation,
        offsetX = DbShotgun.OFFSET * Math.cos(rotation + Math.PI/2),
        offsetY = DbShotgun.OFFSET * Math.sin(rotation + Math.PI/2),
        rnd = this.game.rnd, i;

    for (i = -2; i <= 2; ++i) {
        // Move the entity to adjust the position of the bullet to be fired.
        entity.x = x + i*offsetX;
        entity.y = y + i*offsetY;
        this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL)
            .fire(entity, rotation + i*angle + rnd.realInRange(-diff, diff));
    }
    // Put it back in place.
    entity.x = x;
    entity.y = y;
};

/**
 * A rifle. Fires bullets fast, but a little inaccurately.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {BulletGroup} bullets - A group of bullets.
 * @param {number} fireFactor - A factor for the firing rate.
 * @constructor
 */
function Rifle(game, bullets, fireFactor) {
    Weapon.call(this, bullets, 1);
    this.game = game;
    this.fireFactor = fireFactor;

    this._bulletCount = Rifle.BULLET_COUNT;

    this.fireRate = Rifle.FIRE_RATE * this.fireFactor;
}

Rifle.BULLET_COUNT = 10;
Rifle.FIRE_RATE = Supercold.baseFireRate / 4;
Rifle.OFFSET = 16;

Rifle.prototype = Object.create(Weapon.prototype);
Rifle.prototype.constructor = Rifle;

/**
 * Fires a bullet.
 * @param {LiveSprite} entity - The entity that holds the weapon.
 */
Rifle.prototype.fire = function(entity) {
    var rnd = this.game.rnd, rotation = entity.body.rotation,
        offset = rnd.between(-Rifle.OFFSET, Rifle.OFFSET),
        offsetX = offset * Math.cos(rotation + Math.PI/2),
        offsetY = offset * Math.sin(rotation + Math.PI/2);

    // Move the entity to adjust the position of the bullet to be fired.
    entity.x += offsetX;
    entity.y += offsetY;
    this.bullets.getFirstExists(!EXISTS, CREATE_IF_NULL).fire(entity, rotation);
    // Put it back in place.
    entity.x -= offsetX;
    entity.y -= offsetY;
    // Rifles have a variable fire rate.
    if (--this._bulletCount > 0) {
        this.fireRate = Rifle.FIRE_RATE * this.fireFactor * rnd.realInRange(0.9, 1.4);
    } else {
        this._bulletCount = Rifle.BULLET_COUNT;
        this.fireRate = Rifle.FIRE_RATE * this.fireFactor * 3.5;
    }
};


/**
 * A bullet fired from a Weapon.
 * @constructor
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
 * Moves the bullet forward, based on the given speed.
 */
Bullet.prototype.move = function(speed) {
    Sprite.prototype.moveForward.call(this, this.body.rotation, speed);
};

/**
 * Positions the bullet in front of the entity specified.
 * @param {LiveSprite} entity - The entity that fired the bullet.
 * @param {number} rotation - The rotation of the bullet (in radians).
 */
Bullet.prototype.fire = function(entity, rotation) {
    // Place the bullet in front of the sprite, so that they don't collide!
    var offset = entity.radius + Math.round(3/4 * Supercold.bullet.width);

    this.reset(
        entity.x + offset*Math.cos(rotation),
        entity.y + offset*Math.sin(rotation));
    this.owner = entity;
    this.body.rotation = rotation;
    // Dispatch the onRevived signal after setting rotation.
    this.revive();
};

/**
 * The trail that a bullet leaves behind.
 * @constructor
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
 * @constructor
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
 * @constructor
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
    bot.radius = Supercold.player.radius * this.baseScale;
    bot.scale.copyFrom(this.finalScale);
    bot.body.setCircle(bot.radius);
    bot.body.debug = DEBUG;

    // Players may click near the bot to shoot.
    bot.input.pixelPerfectClick = true;
    // Used for accurately using the hand cursor.
    bot.input.pixelPerfectOver = true;
    bot.input.useHandCursor = true;

    return bot;
};

/**
 * Advances all alive bots in this group.
 */
BotGroup.prototype.advance = function(
        elapsedTime, speed, level, player, playerFired) {
    var length = this.children.length, bot, i;

    for (i = 0; i < length; ++i) {
        bot = this.children[i];
        if (bot.alive) {
            bot.advance(elapsedTime, speed, level, player, playerFired);
        }
    }
};

/**
 * A group of 'Bullet's with enabled physics.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {number} [scale=1] - The base scale for this group.
 * @param {function(Bullet)} customizer - A function that customizes a bullet.
 * @constructor
 */
function BulletGroup(game, scale, customizer, name) {
    Group.call(this, game, scale, name || 'Bullets');
    this.classType = Bullet;
    this.customizer = customizer;
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

    this.customizer(bullet);

    return bullet;
};

/**
 * Moves all alive bullets in this group forward, based on the given speed.
 */
BulletGroup.prototype.advance = function(speed) {
    var length = this.children.length, bullet, i;

    for (i = 0; i < length; ++i) {
        bullet = this.children[i];
        if (bullet.alive) {
            bullet.move(speed);
        }
    }
};

/**
 * A group of 'BulletTrail's.
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @constructor
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
 * @constructor
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
    var trail = this.trails.getFirstDead(CREATE_IF_NULL, bullet.x, bullet.y);

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
 * @param {Phaser.Group} group - The group in which to add the HUD.
 * @param {number} x - The x-coordinate of the top-left corner of the HUD.
 * @param {number} y - The y-coordinate of the top-left corner of the HUD.
 * @param {number} width - The width of the HUD.
 * @param {number} height - The height of the HUD.
 * @param {string} key - A key for the Phaser chache.
 * @constructor
 * @abstract
 */
function HUD(game, group, x, y, width, height, key) {
    var scale = game.camera.scale,
        // Round, don't ceil!
        scaledWidth = Math.round(width * scale.x),
        scaledHeight = Math.round(height * scale.y);

    this.game = game;

    this.width = width;
    this.height = height;

    this.hud = game.make.bitmapData(scaledWidth, scaledHeight, key, true);
    this.hudImage = game.add.image(x, y, this.hud, null, group);

    this.hudImage.name = key;
    // HUDs will be added in an unscaled group, so no need to account for scaling.
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
};

HUD.prototype.update = function() {
    throw new Error('Abstract base class');
};


/**
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {Phaser.Group} group - The group in which to add the HUD.
 * @param {number} x - The x-coordinate of the top-left corner of the minimap.
 * @param {number} y - The y-coordinate of the top-left corner of the minimap.
 * @param {number} width - The width of the minimap.
 * @param {number} height - The height of the minimap.
 * @constructor
 */
function Minimap(game, group, x, y, width, height) {
    HUD.call(this, game, group, x, y, width, height, 'Minimap');

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

Minimap.prototype._markThrowable = function(throwable) {
    var ctx = this.hud.ctx;

    // Just draw a circle.
    circle(ctx, throwable.x * this._ratio.x, throwable.y * this._ratio.y,
           Supercold.style.minimap.throwable.radius);
    ctx.fill();
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

/**
 *
 * @param {Phaser.Sprite} player - The player.
 * @param {Phaser.Group} bots - The bots.
 * @param {Phaser.Group} throwables - A group of throwable objects.
 */
Minimap.prototype.update = function(player, bots, throwables) {
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

        ctx.fillStyle = Supercold.style.minimap.throwable.color;
        //throwables.forEachAlive(this._markThrowable, this);

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
 * @param {Phaser.Group} group - The group in which to add the HUD.
 * @param {number} x - The x-coordinate of the top-left corner of the reload bar.
 * @param {number} y - The y-coordinate of the top-left corner of the reload bar.
 * @param {number} width - The width of the reload bar.
 * @param {number} height - The height of the reload bar.
 * @param {string} key - A key for the Phaser chache.
 * @constructor
 */
function ReloadBar(game, group, x, y, width, height, key, fillStyle) {
    HUD.call(this, game, group, x, y, Supercold.bar.width, Supercold.bar.height, key);

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
    this.hudImage.scale.x = progress / 1;
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
 * @param {Phaser.Group} group - The group in which to add the HUD.
 * @param {number} x - The x-coordinate of the top-left corner of the hotswitch bar.
 * @param {number} y - The y-coordinate of the top-left corner of the hotswitch bar.
 * @param {number} width - The width of the hotswitch bar.
 * @param {number} height - The height of the hotswitch bar.
 * @constructor
 */
function HotswitchBar(game, group, x, y, width, height) {
    ReloadBar.call(this, game, group, x, y, width, height, 'HotswitchBar',
                   Supercold.style.hotswitchBar.color);
}

HotswitchBar.prototype = Object.create(ReloadBar.prototype);
HotswitchBar.prototype.constructor = HotswitchBar;

/**
 * @param {Phaser.Game} game - A reference to the currently running Game.
 * @param {Phaser.Group} group - The group in which to add the HUD.
 * @param {number} x - The x-coordinate of the top-left corner of the bullet bar.
 * @param {number} y - The y-coordinate of the top-left corner of the bullet bar.
 * @param {number} width - The width of the bullet bar.
 * @param {number} height - The height of the bullet bar.
 * @constructor
 */
function BulletBar(game, group, x, y, width, height) {
    ReloadBar.call(this, game, group, x, y, width, height, 'BulletBar',
                   Supercold.style.bulletBar.color);
}

BulletBar.prototype = Object.create(ReloadBar.prototype);
BulletBar.prototype.constructor = BulletBar;


/***** The core of the game *****/

/**
 * @constructor
 */
Supercold.Game = function(game) {
    Supercold._BaseState.call(this, game);

    this._sprites = {
        player: null,
        background: null
    };
    this._groups = {
        bounds: null,
        bots: null,
        playerBullets: null,
        botBullets: null,
        throwables: null,
        ui: null
    };
    this._colGroups = {             // Collision groups
        player: null,
        bots: null,
        playerBullets: null,
        botBullets: null,
        throwables: null
    };
    this._controls = {
        cursors: null,
        wasd: null,
        fireKey: null,
        dodgeKey: null
    };
    this._huds = {                  // Heads-up displays.
        minimap: null,
        bulletBar: null,
        hotswitchBar: null,
        bulletCount: null
    };
    this._weapons = {
        pistol: null,
        burst: null,
        burst3: null,
        blunderbuss: null,
        shotgun: null,
        dbshotgun: null,
        rifle: null
    };
    this._counts = {
        // These will be set in init.
        bots: -1,
        bullets: -1
    };
    this._next = {                  //
        // Time remaining since next bot spawn.
        botTime: 0,
        // Time remaining since next hotswitch.
        hotSwitch: 0
    };
    this._cached = {                // Internal cached objects.
        verVec: {x: 0, y: 0},
        horVec: {x: 0, y: 0}
    };

    this._mutators = null;
    this._bulletTrailPainter = null;
    this._announcer = null;
    this._overlay = null;
    this._superhotFx = null;

    // This will be set in init.
    this.level = -1;

    this._elapsedTime = 0;
    this._hotswitching = false;
};

Supercold.Game.prototype = Object.create(Supercold._BaseState.prototype);
Supercold.Game.prototype.constructor = Supercold.Game;

Object.defineProperty(Supercold.Game.prototype, 'superhot', {
    get: function() {
        return (this._counts.bots === 0 && this._groups.bots.countLiving() === 0);
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
    this._mutators = Supercold.storage.loadMutators();
    switch (this.level) {
        // More bots for boss levels!
        case 9:
        case 19:
        case 29:
        case 39:
        case 49:
        case 74:
            this._counts.bots = 6 + this.level;
            break;
        default:
            if (this.level % 10 === 0) {
                this._counts.bots = this.level;
            } else {
                this._counts.bots = 5 + Math.floor(this.level * 0.666);
            }
            break;
    }
    this._counts.bullets = (this._mutators.lmtdbull) ? this._counts.bots*3 : -1;
};


function bulletHandler(myBullet, otherBullet) {
   myBullet.sprite.kill();
   // The other bullet will be killed by the other handler call.
}

function startTrail(bullet) {
    /*jshint validthis: true */
    this._bulletTrailPainter.startTrail(bullet);
}
function stopTrail(bullet) {
    /*jshint validthis: true */
    this._bulletTrailPainter.stopTrail(bullet);
}

Supercold.Game.prototype._addBulletGroups = function() {
    var self = this;

    function customizeBullet(bullet, myColGroup) {
        bullet.events.onRevived.add(startTrail, self);
        bullet.events.onKilled.add(stopTrail, self);
        bullet.body.setCollisionGroup(myColGroup);
        // All bullets collide with all other bullets and all live entities.
        bullet.body.collides([self._colGroups.player, self._colGroups.bots]);
        bullet.body.collides([self._colGroups.playerBullets, self._colGroups.botBullets],
                             bulletHandler, self);
    }

    function customizePlayerBullet(bullet) {
        customizeBullet(bullet, self._colGroups.playerBullets);
    }
    function customizeBotBullet(bullet) {
        customizeBullet(bullet, self._colGroups.botBullets);
    }

    this._groups.playerBullets = new BulletGroup(
        this.game, 1, customizePlayerBullet, 'Player Bullets');
    this._groups.botBullets = new BulletGroup(
        this.game, 1, customizeBotBullet, 'Bot Bullets');
};

Supercold.Game.prototype._addPlayerBound = function(rect, i, collisionGroup) {
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
        this._addPlayerBound(rect, index, collisionGroup);
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
        if (this._next.hotSwitch > 0) {
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
            this._next.hotSwitch = this._hotswitchTimeout;
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

    hud.right = camera.width - Math.round(Supercold.minimap.x * scale.x);
    hud.bottom = camera.height - Math.round(Supercold.minimap.y * scale.y);

    // At least 2 units on the y-axis so that bars do not touch on small screens!
    refHud = hud;
    hud = this._huds.hotswitchBar.hudImage;
    hud.alignTo(refHud, Phaser.TOP_LEFT, 0, Math.round(2 * scale.y));
    refHud = hud;
    hud = this._huds.bulletBar.hudImage;
    hud.alignTo(refHud, Phaser.TOP_LEFT, 0, Math.round(2 * scale.y));

    if (this._huds.bulletCount) {
        hud = this._huds.bulletCount;
        hud.right = camera.width - Math.round(Supercold.bulletCount.x * scale.x);
        hud.top = Math.round(Supercold.bulletCount.y * scale.y);
    }
};

Supercold.Game.prototype._lose = function(player, bullet, _playerS, _bulletS) {
    var duration = 1500;

    // The collision handler may be called more than once due to bullet shapes!
    if (!bullet.sprite.alive) {
        return;
    }
    bullet.sprite.kill();
    // More than one bullet may collide with the player at once!
    if (!player.sprite.alive) {
        return;
    }
    // If the player gets a second chance to live, don't lose!
    if (this._mutators.secondchance) {
        this._mutators.secondchance = false;
        return;
    }
    // If we have already won or we are in godmode, don't lose!
    if (this.superhot || this._mutators.godmode) {
        return;
    }

    this._overlay = this._groups.ui.add(newOverlay(this.game));
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
    var DELAY = 50, newLevel = this.level + 1, announcer;

    this._sprites.player.body.setZeroVelocity();

    // TODO: Add fancy effect.
    Supercold.storage.saveLevel(newLevel);
    // Create the announcer here to avoid lag and desync with the sound fx.
    announcer = new Announcer(this.game, Supercold.texts.SUPERHOT, {
        group: this._groups.ui,
        nextDelay: 650,
        finalDelay: 400,
        repeat: true,
        overlay: true,
        overlayColor: 'light'
    });
    this.time.events.add(DELAY, function superhot() {
        var superDuration = announcer.options.nextDelay + announcer.options.duration,
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
    // The collision handler may be called more than once due to bullet shapes!
    if (!bot.sprite.alive) {
        return;
    }

    bot.sprite.kill();
    bullet.sprite.kill();
    if (this.superhot) {
        this._superhot();       // SUPER HOT!
    }
};

/**
 * Creates some reusable weapons for the bots.
 */
Supercold.Game.prototype._createBotWeapons = function() {
    var bullets = this._groups.botBullets, weapons = this._weapons, weapon;

    weapons.pistol = new Pistol(bullets, 1);
    weapons.burst = new Burst(bullets, 1);
    weapons.burst3 = new Burst3(bullets, 1);
    weapons.blunderbuss = new Blunderbuss(this.game, bullets, 1);
    weapons.shotgun = new Shotgun(this.game, bullets, 1);
    weapons.dbshotgun = new DbShotgun(this.game, bullets, 1);
    weapons.rifle = new Rifle(this.game, bullets, 1);

    if (DEBUG) {
        // Make sure we created all the weapons.
        for (weapon in weapons) {
            if (weapons.hasOwnProperty(weapon)) {
                assert(weapon !== undefined);
            }
        }
    }
};

/**
 * @return {Weapon} - A weapon for the player.
 */
Supercold.Game.prototype._createPlayerWeapon = function() {
    var fireFactor = (this._mutators.fastgun) ? Supercold.fastFireFactor : 1,
        bullets = this._groups.playerBullets,
        guns = Supercold.storage.loadGuns();

    if (guns.rifle) {
        return new Rifle(this.game, bullets, fireFactor);
    } else if (guns.dbshotgun) {
        return new DbShotgun(this.game, bullets, fireFactor);
    } else if (guns.shotgun) {
        return new Shotgun(this.game, bullets, fireFactor);
    } else if (guns.blunderbuss) {
        return new Blunderbuss(this.game, bullets, fireFactor);
    } else if (guns.burst3) {
        return new Burst3(bullets, fireFactor);
    } else if (guns.burst) {
        return new Burst(bullets, fireFactor);
    } else if (guns.pistol) {
        return new Pistol(bullets, fireFactor);
    } else {
        if (DEBUG) {
            assert(false);
        } else {
            return new Pistol(bullets, fireFactor);
        }
    }
};

Supercold.Game.prototype._assignBotWeapon = function(bot) {
    // All bots share the same weapons. Assign one randomly.
    var chance = this.rnd.frac() * Math.max(0.2, 1 - (this.level - 1)/100);

    switch (this.level) {
        // Boss battle for the level before unlocking a weapon!
        case 9:
            bot.weapon = this._weapons.burst;
            return;
        case 19:
            bot.weapon = this._weapons.blunderbuss;
            return;
        case 29:
            bot.weapon = this._weapons.shotgun;
            return;
        case 39:
            bot.weapon = this._weapons.burst3;
            return;
        case 49:
            bot.weapon = this._weapons.dbshotgun;
            return;
        case 74:
            bot.weapon = this._weapons.rifle;
            return;
        // Regular levels.
        default:
            if (chance < 0.02) {
                bot.weapon = this._weapons.rifle;
            } else if (chance < 0.05) {
                bot.weapon = this._weapons.dbshotgun;
            } else if (chance < 0.20) {
                bot.weapon = this._weapons.shotgun;
            } else if (chance < 0.25) {
                bot.weapon = this._weapons.blunderbuss;
            } else if (chance < 0.42) {
                bot.weapon = this._weapons.burst3;
            } else if (chance < 0.66) {
                bot.weapon = this._weapons.burst;
            } else {
                bot.weapon = this._weapons.pistol;
            }
            return;
    }
};

Supercold.Game.prototype._setBotMovement = function(bot) {
    var distance = 300, chance = this.rnd.frac();

    if (this.level >= 20) {
        if (chance < 2/10) {
            bot.move = newStrafingMover(
                this.rnd.between(distance, distance + 100),
                this.rnd.sign() * Math.PI/2);
        } else if (chance < 4/10) {
            bot.move = newStrafingDistantMover(
                this.rnd.between(distance, distance + 100),
                this.rnd.sign() * Math.PI/2);
        } else if (chance < 7/10) {
            bot.move = newDistantMover(
                this.rnd.between(distance, distance + 100));
        } else {
            bot.move = newForwardMover();
        }
    } else {
        if (chance < 1/5) {
            bot.move = newStrafingDistantMover(
                this.rnd.between(distance, distance + 150),
                this.rnd.sign() * Math.PI/2);
        } else if (chance < 3/5) {
            bot.move = newDistantMover(
                this.rnd.between(distance, distance + 150));
        } else {
            bot.move = newForwardMover();
        }
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

    --this._counts.bots;

    bot = this._groups.bots.getFirstDead(CREATE_IF_NULL, x, y);
    this._assignBotWeapon(bot);
    this._setBotMovement(bot);

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
            group: this._groups.ui,
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
            group: this._groups.ui,
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
    var radius = Supercold.player.radius * this._spriteScale,
        player, boundsColGroup;

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
    this._addBulletGroups();
    // Reusable weapons for the bots.
    this._createBotWeapons();

    this._addPlayerBounds(boundsColGroup);

    // The player is positioned in a semi-random location inside their bounds.
    this._sprites.player = player = new Player(
        this.game,
        this.rnd.sign() * this.rnd.between(
            0, this.world.bounds.right - PADDING.width - radius),
        this.rnd.sign() * this.rnd.between(
            0, this.world.bounds.bottom - PADDING.height - radius));
    player.weapon = this._createPlayerWeapon();
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
    this._groups.ui = this.add.group(undefined, 'UI group', ADD_TO_STAGE);
    this._huds.minimap = new Minimap(
        this.game, this._groups.ui, 0, 0,
        Supercold.minimap.width, Supercold.minimap.height);
    this._huds.hotswitchBar = new HotswitchBar(
        this.game, this._groups.ui, 0, 0,
        Supercold.bar.width, Supercold.bar.height);
    this._huds.bulletBar = new BulletBar(
        this.game, this._groups.ui, 0, 0,
        Supercold.bar.width, Supercold.bar.height);
    if (this._mutators.lmtdbull) {
        this._huds.bulletCount = this.add.text(0, 0,
            Supercold.texts.BULLETS + this._counts.bullets,
            Supercold.wordStyles.BULLETS, this._groups.ui);
        this._huds.bulletCount.fontSize =
            this.getHudFontSize(Supercold.wordStyles.BULLETS.fontSize);
    }
    // and fix their position on the screen.
    this._positionHuds();

    // Add controls.
    this._controls.cursors = this.input.keyboard.createCursorKeys();
    this._controls.wasd = this.input.keyboard.addKeys(Supercold.controls.WASD);
    this._controls.fireKey = this.input.keyboard.addKey(Supercold.controls.fireKey);
    this._controls.dodgeKey = this.input.keyboard.addKey(Supercold.controls.dodgeKey);
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
    this._next.botTime = this.rnd.realInRange(0.05, 0.10);
    this._next.hotSwitch = this._hotswitchTimeout;
    this._hotswitching = false;

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


Supercold.Game.prototype._getSpeed = function(
        playerAlive, playerMoved, playerRotated, speeds) {
    if (!playerAlive) return speeds.slow;
    if (playerMoved) return speeds.normal;
    if (this._mutators.freezetime) return 0;
    if (this._mutators.fasttime) return speeds.slow;
    if (playerRotated) return speeds.slower;
    return speeds.slowest;
};

Supercold.Game.prototype._firePlayerBullet = function() {
    var player = this._sprites.player;

    // Not ready to fire yet or no bullets left.
    if (player.remainingTime > 0 || this._counts.bullets === 0) {
        return false;
    }
    player.fire();
    --this._counts.bullets;
    if (this._huds.bulletCount) {
        this._huds.bulletCount.text =
            Supercold.texts.BULLETS + this._counts.bullets;
    }
    return true;
};


Supercold.Game.prototype.update = function() {
    var player = this._sprites.player,
        wasd = this._controls.wasd,
        cursors = this._controls.cursors,
        fireKey = this._controls.fireKey,
        dodgeKey = this._controls.dodgeKey,
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
    playerMoved = (verVec.y !== 0 || horVec.x !== 0) || player.dodging;
    playerRotated = player.rotate() && !this._mutators.freelook;

    bulletSpeed = this._getSpeed(
        player.alive, playerMoved, playerRotated, Supercold.speeds.bullet);
    botSpeed = this._getSpeed(
        player.alive, playerMoved, playerRotated, Supercold.speeds.bot);

    // When time slows down, distort the elapsed time proportionally.
    elapsedTime = this._elapsedTime = this.time.physicsElapsed *
        (bulletSpeed / Supercold.speeds.bullet.normal);

    if (player.alive) {
        // Process firing controls (check that we are not trying to hotswitch).
        if ((fireButton.isDown && !fireButton.shiftKey) || fireKey.isDown) {
            playerFired = this._firePlayerBullet();
        }
        newDirection = this.physics.arcade.angleBetween(verVec, horVec);
        if (playerMoved && this._mutators.dodge && dodgeKey.isDown) {
            player.dodge(newDirection);
        }
        player.advance(playerMoved, newDirection, elapsedTime);
    }

    if (!this._hotswitching) {
        this._next.hotSwitch -= elapsedTime;
    }
    // Check if there are any more bots to spawn.
    if (this._counts.bots > 0) {
        this._next.botTime -= elapsedTime;
        if (this._next.botTime <= 0) {
            this._spawnBot();
            this._next.botTime = this.rnd.realInRange(
                Math.max(1.2 - 0.010*this.level, 0.5),
                Math.max(1.8 - 0.015*this.level, 0.5));
        }
    }

    // Update bots.
    this._groups.bots.advance(
        elapsedTime, botSpeed, this.level, player, playerFired);
    // Update bullets.
    this._groups.playerBullets.advance(bulletSpeed);
    this._groups.botBullets.advance(bulletSpeed);
    // Update HUDs (except minimap).
    if (player.alive) {
        this._huds.bulletBar.update(
            Math.min(1, 1 - player.remainingTime / player.weapon.fireRate));
        this._huds.hotswitchBar.update(
            Math.min(1, 1 - this._next.hotSwitch/this._hotswitchTimeout));
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
    if (this._huds.bulletCount) {
        this._huds.bulletCount.fontSize =
            this.getHudFontSize(Supercold.wordStyles.BULLETS.fontSize);
    }
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

    // The UI group is added directly to the stage and needs manual removal.
    this.stage.removeChild(this._groups.ui);

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

/**
 * Marks the checked property of the each input
 * according to the properties of the given object.
 */
function checkInputs(inputs) {
    var input, element;

    for (input in inputs) {
        if (inputs.hasOwnProperty(input)) {
            element = document.getElementById(input);
            // Guard against old properties from previous versions!
            if (element) {
                element.checked = inputs[input];
            }
        }
    }
}

function unlock(level) {
    Array.prototype.forEach.call(
            document.querySelectorAll('.locked' + level), function(el) {
        el.className = '';
        el.previousElementSibling.removeAttribute('disabled');
    });
    Array.prototype.forEach.call(
            document.querySelectorAll('.disabled' + level), function(el) {
        el.previousElementSibling.removeAttribute('disabled');
    });
}

function showUnlocked(unlockLevels, what) {
    var level = Supercold.storage.loadHighestLevel(), i;

    for (i = 0; i < unlockLevels.length; ++i) {
        if (unlockLevels[i] <= level) {
            unlock(unlockLevels[i]);
        } else {
            break;
        }
    }
    if (level >= unlockLevels[unlockLevels.length-1]) {
        document.getElementById(what + '-hint').style.display = 'none';
    } else {
        document.getElementById(what + '-hint-level').textContent = unlockLevels[i];
    }
}

function showUnlockedMutators() {
    showUnlocked([20, 30, 40, 50, 70, 80, 90, 100, 128], 'mutator');
}

function showUnlockedGuns() {
    showUnlocked([10, 20, 30, 40, 50, 75], 'gun');
}

Supercold.play = function play(parent) {
    // Tell Phaser to cover the entire window and use the CANVAS renderer.
    // Note that WebGL has issues on some platforms, so we go for plain canvas!
    var game = new Phaser.Game('100', '100', Phaser.CANVAS, parent),
        mutators, guns, previous;

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
            bighead: false,
            chibi: false,
            doge: false,
            dodge: false,
            lmtdbull: false,
            superhotswitch: false,
            secondchance: false,
            freezetime: false,
            godmode: false
        });
    }
    checkInputs(mutators);

    // We handle gun storage the same way as mutator storage, even though they
    // work differently in the game. It may help with changes in the future.
    guns = Supercold.storage.loadGuns();
    if (guns === null) {
        // Default gun (pistol)
        Supercold.storage.saveGuns({
            pistol: true,
            burst: false,
            burst3: false,
            blunderbuss: false,
            shotgun: false,
            dbshotgun: false,
            rifle: false
        });
    }
    checkInputs(guns);
    previous = document.querySelector('#guns input:checked').id;

    showUnlockedMutators();
    showUnlockedGuns();

    // Handle mutator modifications.
    Array.prototype.forEach.call(
            document.querySelectorAll('#mutators input'), function(input) {
        input.addEventListener('change', function(event) {
            var mutators = Supercold.storage.loadMutators();

            mutators[this.id] = this.checked;
            Supercold.storage.saveMutators(mutators);
        }, false);
    });
    // Handle gun modifications.
    Array.prototype.forEach.call(
            document.querySelectorAll('#guns input'), function(input) {
        input.addEventListener('change', function(event) {
            var guns = Supercold.storage.loadGuns();

            // Disable previously selected weapon.
            guns[previous] = false;
            guns[this.id] = this.checked;
            Supercold.storage.saveGuns(guns);
            previous = this.id;
        }, false);
    });

    // Global per-instance options. Use a namespace to avoid name clashes.
    game.supercold = {
        onMainMenuOpen: function() {
            loadLevelInfo();
            showUnlockedMutators();
            showUnlockedGuns();
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
