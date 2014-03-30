window.onload = function () {
    // constants
    var TILE_W = 32, TILE_H = 32, WIDTH = 19, HEIGHT = 19
        , c_gameWidth = TILE_W * WIDTH, c_gameHeight = TILE_H * HEIGHT
        , tableColor = "#7777FF"
        , maxScore = 0, lastScore = 0
        , assets = null
        , _isPaused = false;

    var message = {
        show: function (msg, opt) {
            var opt = opt || {}
                , fs = opt.font_size || 14
                , w = opt.width || msg.length * fs
                , h = opt.height || fs
                , x = opt.x || (c_gameWidth / 2 - w / 2)
                , y = opt.y || (c_gameHeight / 2 - h / 2)
                , c = opt.color || "#FFFFFF";

            return Crafty.e("2D, DOM, Text, " + opt.id || "message")
                .text(msg)
                .attr({ w: w, h: h, x: x, y: y })
                .css({ "text-align": "center" })
                .textFont({ "size": fs + "px", "family": "Georgia" })
                .textColor(c)
                .unselectable();
        },
        destroy: function (m) {
            if (typeof m === "string") {
                Crafty(m).destroy();
            } else if (m instanceof Crafty) {
                m.destroy();
            }
        }
    };

    var debugMessage = (function () {
        var ele = window.document.getElementById("__DEBUG_MESSAGE");

        return {
            log: function (msg) {
                if (ele) {
                    var date = new Date();
                    ele.innerHTML = "[" + date.toLocaleString() + "]:" + msg;
                }
            }
        };
    })();

    var isPaused = function () {
        return _isPaused;
    };

    var pause = function () {
        var pauseMessageId = "PauseMessage";
        if (!_isPaused) {
            _isPaused = true;
            message.show("Press SPACE to Resume...", { id: pauseMessageId });
        } else {
            _isPaused = false;
            message.destroy(pauseMessageId);
        }
    };

    var gameOver = function () {
        if (lastScore > maxScore) {
            maxScore = lastScore;
        }
        Crafty.scene("GameOver");
    };

    var loadAssets = function () {
        var imgPath = "img/";
        var spriteImage = imgPath + "sprites.png";
        var tileSize = 32;

        Crafty.sprite(tileSize, spriteImage, {
            ball: [0, 0],
            bonus: [0, 1],
            outside: [0, 2],
            bound: [0, 3],
            score: [0, 4]
        });

        // for digit
        var h = 20, w = [15, 12, 15, 14, 14, 14, 14, 15, 14, 15];
        Crafty.sprite(1, spriteImage, {
            digit0: [1, 166, w[0], h],
            digit1: [16, 166, w[1], h],
            digit2: [29, 166, w[2], h],
            digit3: [45, 166, w[3], h],
            digit4: [62, 166, w[4], h],
            digit5: [77, 166, w[5], h],
            digit6: [93, 166, w[6], h],
            digit7: [110, 166, w[7], h],
            digit8: [126, 166, w[8], h],
            digit9: [141, 166, w[9], h]
        });

        assets = {
            load: function (func) {
                Crafty.load([spriteImage], func);
            },
            player: "ball",
            bound: "bound",
            outside: "outside",
            bonus: "bonus",
            createScore: function (num, x, y) {
                function Score(_num, _x, _y) {
                    this._score = _num;
                    this._x = _x;
                    this._y = _y;
                    this._entities = [];
                    this.update();
                };
                Score.prototype.score = function (s) {
                    if (s) {
                        this._score = s;
                        this.update();
                    }
                    return this._score;
                };
                Score.prototype.add = function (s) {
                    return this.score(this._score + s);
                };
                Score.prototype.update = function () {
                    this.destroy();
                    var x = this._x, y = this._y - h / 2, totalw = 0, s = this._score;
                    do {
                        var d = s % 10;
                        s = Math.floor(s / 10);
                        totalw += w[d];
                        this._entities.push(Crafty.e("2D, DOM, Numbers, digit" + d).attr({
                            x: x - totalw,
                            y: y,
                            w: w[d],
                            h: h,
                            visible: false
                        }));
                    } while (s > 0);
                    this._entities.forEach(function (e) {
                        e.attr({
                            x: e.x + totalw / 2,
                            visible: true
                        });
                    });
                };
                Score.prototype.destroy = function () {
                    this._entities.forEach(function (e) {
                        e.destroy();
                    });
                    this._entities = [];
                };

                return new Score(num, x, y);
            }
        };
    };

    var initGame = function () {
        Crafty.init(c_gameWidth, c_gameHeight, "game");

        Crafty.c("CustomControls", {
            _speedx: 0,
            _speedy: 0,
            _speed: 4,
            _started: false,

            getCenterX: function () {
                return this._x + this.w / 2;
            },

            getCenterY: function () {
                return this._y + this.h / 2;
            },

            setStartPos: function (x, y) {
                // x, y is the center pos of entity
                return this.attr({ x: x - this.w / 2, y: y - this.h / 2 });
            },

            calcLongside: function (a, b) {
                return Math.sqrt(a * a + b * b);
            },

            rebound: function (x, y, lost) {
                // rebound with vector(x, y) as the normal direction of the rebounding plane
                // if (x, y) is normalized, the absolute speed will not be changed
                // else the the absolute speed is scaled by the square of the mod of (x, y):
                // |newSpeed| = |oldSpeed| * (x^2 + y^2)
                // lost is the speed cost by the rebound, by default it is 0, or the new speed will be (1 - lost) * old_speed
                var a = y * y - x * x, b = -2 * x * y
                    , sx = (this._speedx * a + this._speedy * b)
                    , sy = (this._speedx * b - this._speedy * a);
                this._speedx = sx;
                this._speedy = sy;
                if (lost && lost > 0) {
                    this._speed = this._speed - lost;
                    this.scaleSpeed();
                    debugMessage.log("sp: " + this._speed + " spx: " + this._speedx + " spy: " + this._speedy + " err: " + (this._speed - this.calcLongside(this._speedx, this._speedy)));
                    if (Math.abs(this._speedy) < 0.2) {
                        gameOver();
                    }
                }
            },

            scaleSpeed: function () {
                var scale = this._speed / this.calcLongside(this._speedx, this._speedy);
                this._speedx = this._speedx * scale;
                this._speedy = this._speedy * scale;
            },

            revertSpeed: function () {
                this._speedx = -this._speedx;
                this._speedy = -this._speedy;
            },

            changeMove: function (x, y) {
                //this._speedx = this._speedy = 0;
                //var portion = this._speed / this.calcLongside(x - TILE_W - this.x / 2, TILE_H - this.y);
                //this._speedx = (x - TILE_W / 2 - this.x) * portion;
                //this._speedy = (TILE_H - this.y) * portion;
                x = this.getCenterX() - x;
                y = this.getCenterY() - y;
                var c = this.calcLongside(x, y);
                if (x === 0 && y === 0) {
                    this.revertSpeed();
                } else if (this._speedx === 0 && this._speedy === 0) {
                    this._speedx = this._speed * x / c;
                    this._speedy = this._speed * y / c;
                    this._started = true;
                } else {
                    this.rebound(x / c, y / c);
                }
            },

            isHitable: function () {
                return this._speedy >= 0 && this.y > TILE_H + 5;
            },

            init: function () {
                this.addComponent("DOM").bind("EnterFrame", function (e) {
                    if (!isPaused()) {
                        if (this._speedx !== 0 || this._speedy !== 0) {
                            this.x += this._speedx;
                            this.y += this._speedy;
                        }
                    }
                }).bind('KeyDown', function (e) {
                    if (e.keyCode === Crafty.keys.SPACE) {
                        pause();
                    }
                });
            }
        });

        loadAssets();
    };

    var generateBonus = function (x, y) {
        var x = x, y = y;
        if (arguments.length < 2) {
            var pos = generateRandomValidPos({ x: c_gameWidth / 3, y: c_gameHeight / 3, w: c_gameWidth / 3, h: c_gameHeight / 3 });
            x = pos.x;
            y = pos.y;
        }
        return Crafty.e(assets.bonus + ", 2D, DOM").attr({ x: x, y: y });
    };

    var generateRandomValidPos = function (range) {
        var range = range || { x: 0, y: 0, w: c_gameWidth, h: c_gameHeight };
        var x = Math.random() * range.w + range.x;
        var y = Math.random() * range.h + range.y;
        return { x: x, y: y };
    };

    var generateWorld = function () {
        for (var y = 0; y < HEIGHT; y++) {
            for (var x = 0; x < WIDTH; x++) {
                var ent = { attr: function (at) { } };
                if (x === 0 || x === WIDTH - 1 || y === HEIGHT - 1) {
                    // create outside
                    ent = Crafty.e("2D, DOM, " + assets.outside);
                } else if (y === 0) {
                    // create bound
                    ent = Crafty.e("2D, DOM, " + assets.bound);
                } else {
                    // create table
                    //entType = assets.table;
                }
                ent.attr({ x: x * TILE_W, y: y * TILE_H });
            }
        }
    };

    var createBackgroundEntity = function () {
        var components = "2D, DOM, Color";
        if (arguments.length > 0) {
            components = [components, Array.prototype.slice.call(arguments, 0)].join(", ");
        }
        return Crafty.e(components)
            .attr({ x: TILE_W, y: TILE_H, w: (WIDTH - 2) * TILE_W, h: (HEIGHT - 2) * TILE_H })
            .color(tableColor);
    }

    Crafty.scene("loading", function () {
        createBackgroundEntity();
        message.show("Loading...");
        //load takes an array of assets and a callback when complete
        assets.load(function () {
            Crafty.scene("main"); //when everything is loaded, run the main scene
        });
    });

    Crafty.scene("main", function () {
        var startx = c_gameWidth / 2, starty = c_gameHeight / 2;
        var scoreCenter = { x: startx, y: c_gameHeight * 2 / 3 };
        var player = null;

        // create background entities
        createBackgroundEntity("Mouse").bind("Click", function (e) {
            if (e.mouseButton === Crafty.mouseButtons.LEFT && !isPaused() && player !== null) {
                //console.log("Clicked!");
                if (player.isHitable()) {
                    player.changeMove(e.x, e.y);
                } else {
                    gameOver();
                }
            }
        });

        generateWorld();

        // show score
        var score = assets.createScore(0, scoreCenter.x, scoreCenter.y);

        generateBonus();

        // create player entity
        player = Crafty.e(assets.player + ", CustomControls, Collision")
            .setStartPos(startx, starty)
            .collision()
            .onHit(assets.outside, function () {
                gameOver();
            })
            .onHit(assets.bound, function () {
                //score and rebound
                lastScore = score.add(1);
                this.shift(-this._speedx, -this._speedy);
                this.rebound(0, 1, 0.3);
            })
            .onHit(assets.bonus, function () {
                // bonus, speed up
                if (this._started) {
                    this._speed += 0.6;
                    this.scaleSpeed();
                    debugMessage.log("sp: " + this._speed + " spx: " + this._speedx + " spy: " + this._speedy + " err: " + (this._speed - this.calcLongside(this._speedx, this._speedy)));
                    // delete old bonus
                    Crafty(assets.bonus).destroy();
                    // generate new one
                    generateBonus();
                }
            });
    });

    Crafty.scene("GameOver", function () {
        createBackgroundEntity();
        generateWorld();
        message.show("Game Over", { y: c_gameHeight / 2 })
            .bind("KeyDown", function (e) {
                if (e.keyCode === Crafty.keys.SPACE) {
                    Crafty.scene("main");
                }
            });
        message.show("Score: " + lastScore, { y: c_gameHeight / 2 + 30 });
        message.show("Best: " + maxScore, { y: c_gameHeight / 2 + 60 });
    });

    initGame();
    Crafty.scene("loading");
};