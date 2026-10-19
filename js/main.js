/*
 * Math Pixel Quest — walking prototype.
 * One scene, Arcade physics, runtime textures only.
 * Later systems (doors, puzzles, mobs) can hook into GameScene
 * without changing boot, borders, or the camera.
 */
(function () {
  "use strict";

  var MAP_WIDTH = 1600;
  var MAP_HEIGHT = 1200;
  var TILE = 32;
  var SPEED = 180;

  var OUTLINE = 0x141820;
  var SKIN = 0xf2c7a0;
  var HOOD = 0x1d4ed8;
  var HOOD_DARK = 0x172554;
  var ROBE = 0x2563eb;
  var CYAN = 0x3ec6c6;
  var GOLD = 0xe6b84d;
  var BOOT = 0x4a3424;
  var EYE = 0xf8fbff;

  function paintRect(graphics, x, y, w, h, color) {
    graphics.fillStyle(color, 1);
    graphics.fillRect(x, y, w, h);
  }

  function nearest(scene, key) {
    var texture = scene.textures.get(key);
    if (texture) {
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  class GameScene extends Phaser.Scene {
    constructor() {
      super({ key: "GameScene" });
      this.player = null;
      this.keys = null;
      this.injectedKeys = null;
      this.pad = { up: false, down: false, left: false, right: false };
    }

    create() {
      this.generateTextures();
      this.createWorld();
      this.createBorders();
      this.createPlayer();
      this.setupCamera();
      this.createHud();
      this.createTouchPad();
      this.bindControlsProbe();
    }

    /* Texture generation — floor, wall, markings, and the player. */
    generateTextures() {
      this.generateFloorTexture();
      this.generateWallTexture();
      this.generateMarkTexture("mark-plus", function (g) {
        paintRect(g, 7, 2, 2, 12, CYAN);
        paintRect(g, 2, 7, 12, 2, CYAN);
      });
      this.generateMarkTexture("mark-ring", function (g) {
        paintRect(g, 4, 1, 8, 2, GOLD);
        paintRect(g, 4, 13, 8, 2, GOLD);
        paintRect(g, 1, 4, 2, 8, GOLD);
        paintRect(g, 13, 4, 2, 8, GOLD);
        paintRect(g, 3, 2, 2, 2, GOLD);
        paintRect(g, 11, 2, 2, 2, GOLD);
        paintRect(g, 3, 12, 2, 2, GOLD);
        paintRect(g, 11, 12, 2, 2, GOLD);
      });
      this.generateMarkTexture("mark-diamond", function (g) {
        paintRect(g, 7, 1, 2, 2, 0xf8fbff);
        paintRect(g, 5, 3, 2, 2, 0xf8fbff);
        paintRect(g, 9, 3, 2, 2, 0xf8fbff);
        paintRect(g, 3, 5, 2, 2, 0xf8fbff);
        paintRect(g, 11, 5, 2, 2, 0xf8fbff);
        paintRect(g, 3, 9, 2, 2, 0xf8fbff);
        paintRect(g, 11, 9, 2, 2, 0xf8fbff);
        paintRect(g, 5, 11, 2, 2, 0xf8fbff);
        paintRect(g, 9, 11, 2, 2, 0xf8fbff);
        paintRect(g, 7, 13, 2, 2, 0xf8fbff);
        paintRect(g, 7, 7, 2, 2, CYAN);
      });
      this.generatePlayerTexture();
    }

    generateFloorTexture() {
      var g = this.make.graphics({ add: false });
      var s = TILE;
      paintRect(g, 0, 0, s, s, 0x152033);
      paintRect(g, 1, 1, s - 2, s - 2, 0x1c2c4a);
      paintRect(g, 2, 2, s - 4, 1, 0x31486e);
      paintRect(g, 2, 2, 1, s - 4, 0x31486e);
      paintRect(g, 2, s - 3, s - 4, 1, 0x10192b);
      paintRect(g, s - 3, 2, 1, s - 4, 0x10192b);
      paintRect(g, 15, 8, 2, 2, 0x3ec6c6);
      paintRect(g, 13, 10, 2, 2, 0x3ec6c6);
      paintRect(g, 17, 10, 2, 2, 0x3ec6c6);
      paintRect(g, 11, 12, 2, 2, 0x3ec6c6);
      paintRect(g, 19, 12, 2, 2, 0x3ec6c6);
      paintRect(g, 13, 14, 2, 2, 0x3ec6c6);
      paintRect(g, 17, 14, 2, 2, 0x3ec6c6);
      paintRect(g, 15, 16, 2, 2, 0x3ec6c6);
      paintRect(g, 15, 12, 2, 2, 0xe6b84d);
      paintRect(g, 4, 4, 2, 2, 0xe6b84d);
      paintRect(g, 26, 4, 2, 2, 0xe6b84d);
      paintRect(g, 4, 26, 2, 2, 0xe6b84d);
      paintRect(g, 26, 26, 2, 2, 0xe6b84d);
      g.generateTexture("floor", s, s);
      g.destroy();
      nearest(this, "floor");
    }

    generateWallTexture() {
      var g = this.make.graphics({ add: false });
      var s = TILE;
      paintRect(g, 0, 0, s, s, 0x0b1220);
      var row;
      for (row = 0; row < 4; row += 1) {
        var y = row * 8;
        var offset = row % 2 === 0 ? 0 : -8;
        var x;
        for (x = -16; x < s; x += 16) {
          var bx = x + offset;
          paintRect(g, bx + 1, y + 1, 14, 6, 0x24344f);
          paintRect(g, bx + 1, y + 1, 14, 1, 0x3c5278);
          paintRect(g, bx + 1, y + 6, 14, 1, 0x152033);
        }
      }
      g.generateTexture("wall", s, s);
      g.destroy();
      nearest(this, "wall");
    }

    generateMarkTexture(key, draw) {
      var g = this.make.graphics({ add: false });
      draw(g);
      g.generateTexture(key, 16, 16);
      g.destroy();
      nearest(this, key);
    }

    generatePlayerTexture() {
      var g = this.make.graphics({ add: false });
      /* Hood and outline. */
      paintRect(g, 7, 1, 10, 1, OUTLINE);
      paintRect(g, 6, 2, 12, 8, OUTLINE);
      paintRect(g, 7, 2, 10, 7, HOOD);
      paintRect(g, 8, 3, 8, 5, HOOD_DARK);
      /* Face. */
      paintRect(g, 9, 4, 6, 4, SKIN);
      paintRect(g, 9, 5, 2, 2, EYE);
      paintRect(g, 10, 5, 1, 1, OUTLINE);
      paintRect(g, 13, 5, 2, 2, EYE);
      paintRect(g, 14, 5, 1, 1, OUTLINE);
      paintRect(g, 11, 7, 2, 1, 0xd7a882);
      /* Robe, cyan collar, gold plus. */
      paintRect(g, 6, 10, 12, 1, OUTLINE);
      paintRect(g, 5, 11, 14, 8, OUTLINE);
      paintRect(g, 6, 11, 12, 7, ROBE);
      paintRect(g, 7, 11, 10, 1, CYAN);
      paintRect(g, 11, 13, 2, 4, GOLD);
      paintRect(g, 10, 14, 4, 2, GOLD);
      /* Boots. */
      paintRect(g, 7, 18, 4, 4, OUTLINE);
      paintRect(g, 13, 18, 4, 4, OUTLINE);
      paintRect(g, 8, 19, 2, 2, BOOT);
      paintRect(g, 14, 19, 2, 2, BOOT);
      g.generateTexture("player", 24, 24);
      g.destroy();
      nearest(this, "player");
    }

    createWorld() {
      var floor = this.add.tileSprite(
        MAP_WIDTH / 2,
        MAP_HEIGHT / 2,
        MAP_WIDTH,
        MAP_HEIGHT,
        "floor"
      );
      floor.setDepth(0);

      var marks = [
        { x: 620, y: 460, key: "mark-plus", scale: 3 },
        { x: 1040, y: 520, key: "mark-ring", scale: 3 },
        { x: 860, y: 760, key: "mark-diamond", scale: 3 },
        { x: 480, y: 820, key: "mark-plus", scale: 2 },
        { x: 1180, y: 860, key: "mark-ring", scale: 2 },
        { x: 700, y: 300, key: "mark-diamond", scale: 2 },
      ];
      var i;
      for (i = 0; i < marks.length; i += 1) {
        var mark = marks[i];
        this.add
          .image(mark.x, mark.y, mark.key)
          .setScale(mark.scale)
          .setDepth(1)
          .setAlpha(0.95);
      }
    }

    /* Border setup — visible wall tiles plus immovable physics bodies. */
    createBorders() {
      this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

      this.add
        .tileSprite(MAP_WIDTH / 2, TILE / 2, MAP_WIDTH, TILE, "wall")
        .setDepth(2);
      this.add
        .tileSprite(MAP_WIDTH / 2, MAP_HEIGHT - TILE / 2, MAP_WIDTH, TILE, "wall")
        .setDepth(2);
      this.add
        .tileSprite(TILE / 2, MAP_HEIGHT / 2, TILE, MAP_HEIGHT, "wall")
        .setDepth(2);
      this.add
        .tileSprite(MAP_WIDTH - TILE / 2, MAP_HEIGHT / 2, TILE, MAP_HEIGHT, "wall")
        .setDepth(2);

      var seam = this.add.graphics();
      seam.lineStyle(2, CYAN, 1);
      seam.strokeRect(TILE, TILE, MAP_WIDTH - TILE * 2, MAP_HEIGHT - TILE * 2);
      seam.setDepth(3);

      this.borderBodies = this.physics.add.staticGroup();
      this.addBorderBody(MAP_WIDTH / 2, TILE / 2, MAP_WIDTH, TILE);
      this.addBorderBody(MAP_WIDTH / 2, MAP_HEIGHT - TILE / 2, MAP_WIDTH, TILE);
      this.addBorderBody(TILE / 2, MAP_HEIGHT / 2, TILE, MAP_HEIGHT);
      this.addBorderBody(MAP_WIDTH - TILE / 2, MAP_HEIGHT / 2, TILE, MAP_HEIGHT);
    }

    addBorderBody(x, y, w, h) {
      var block = this.borderBodies.create(x, y, "wall");
      block.setVisible(false);
      block.displayWidth = w;
      block.displayHeight = h;
      block.refreshBody();
    }

    createPlayer() {
      this.player = this.physics.add.sprite(MAP_WIDTH / 2, MAP_HEIGHT / 2, "player");
      this.player.setScale(2);
      this.player.setDepth(5);
      this.player.setCollideWorldBounds(true);
      this.player.body.setAllowGravity(false);
      this.player.body.setSize(12, 16);
      this.player.body.setOffset(6, 6);
      this.player.refreshBody();
      this.physics.add.collider(this.player, this.borderBodies);
    }

    /* Camera setup — follow the player, never show past the map. */
    setupCamera() {
      var camera = this.cameras.main;
      camera.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
      camera.startFollow(this.player, true, 0.14, 0.14);
      camera.roundPixels = true;
    }

    createHud() {
      this.add
        .text(16, 14, "WASD to move", {
          fontFamily: "Courier New, Courier, monospace",
          fontSize: "16px",
          color: "#e8f6ff",
          backgroundColor: "#0c1424cc",
          padding: { x: 10, y: 6 },
        })
        .setScrollFactor(0)
        .setDepth(20);
    }

    createTouchPad() {
      var buttons = [
        { x: 104, y: 400, label: "W", set: "up" },
        { x: 48, y: 456, label: "A", set: "left" },
        { x: 160, y: 456, label: "D", set: "right" },
        { x: 104, y: 512, label: "S", set: "down" },
      ];
      var scene = this;
      buttons.forEach(function (spec) {
        var bg = scene.add
          .rectangle(spec.x, spec.y, 52, 52, 0x0c1424, 0.88)
          .setScrollFactor(0)
          .setDepth(20);
        bg.setStrokeStyle(2, CYAN, 1);
        bg.setInteractive();
        scene.add
          .text(spec.x, spec.y, spec.label, {
            fontFamily: "Courier New, Courier, monospace",
            fontSize: "16px",
            color: "#e8f6ff",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(21);
        var press = function () {
          scene.pad[spec.set] = true;
        };
        var release = function () {
          scene.pad[spec.set] = false;
        };
        bg.on("pointerdown", press);
        bg.on("pointerup", release);
        bg.on("pointerout", release);
        bg.on("pointerupoutside", release);
      });
      this.input.addPointer(3);
    }

    bindControlsProbe() {
      var scene = this;
      window.__controlsTest = {
        getX: function () {
          return scene.player.x;
        },
        getY: function () {
          return scene.player.y;
        },
        getSpeed: function () {
          var velocity = scene.player.body.velocity;
          return Math.hypot(velocity.x, velocity.y);
        },
        getVelocity: function () {
          return {
            x: scene.player.body.velocity.x,
            y: scene.player.body.velocity.y,
          };
        },
        setKeys: function (codes) {
          scene.injectedKeys = new Set(codes);
        },
      };
      this.events.once("shutdown", function () {
        scene.pad.up = false;
        scene.pad.down = false;
        scene.pad.left = false;
        scene.pad.right = false;
        if (window.__controlsTest && window.__controlsTest.getX === scene.__probeGetX) {
          window.__controlsTest = undefined;
        }
      });
      this.__probeGetX = window.__controlsTest.getX;
    }

    keyHeld(code, key) {
      if (this.injectedKeys) {
        return this.injectedKeys.has(code);
      }
      return !!(key && key.isDown);
    }

    /* Movement — WASD, optional arrows, normalized diagonals, zero when idle. */
    applyMovement() {
      if (!this.player || !this.keys) {
        return;
      }

      var xAxis = 0;
      var yAxis = 0;
      if (this.keyHeld("KeyA", this.keys.A) || this.keyHeld("ArrowLeft", this.keys.LEFT) || this.pad.left) {
        xAxis -= 1;
      }
      if (this.keyHeld("KeyD", this.keys.D) || this.keyHeld("ArrowRight", this.keys.RIGHT) || this.pad.right) {
        xAxis += 1;
      }
      if (this.keyHeld("KeyW", this.keys.W) || this.keyHeld("ArrowUp", this.keys.UP) || this.pad.up) {
        yAxis -= 1;
      }
      if (this.keyHeld("KeyS", this.keys.S) || this.keyHeld("ArrowDown", this.keys.DOWN) || this.pad.down) {
        yAxis += 1;
      }
      xAxis = Math.max(-1, Math.min(1, xAxis));
      yAxis = Math.max(-1, Math.min(1, yAxis));

      var vx = 0;
      var vy = 0;
      var length = Math.hypot(xAxis, yAxis);
      if (length > 0) {
        vx = (xAxis / length) * SPEED;
        vy = (yAxis / length) * SPEED;
      }
      this.player.setVelocity(vx, vy);
    }

    update() {
      if (!this.keys && this.input.keyboard) {
        this.keys = {
          W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
          A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
          S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
          D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          UP: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
          DOWN: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
          LEFT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
          RIGHT: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        };
        this.input.keyboard.addCapture([
          Phaser.Input.Keyboard.KeyCodes.W,
          Phaser.Input.Keyboard.KeyCodes.A,
          Phaser.Input.Keyboard.KeyCodes.S,
          Phaser.Input.Keyboard.KeyCodes.D,
          Phaser.Input.Keyboard.KeyCodes.UP,
          Phaser.Input.Keyboard.KeyCodes.DOWN,
          Phaser.Input.Keyboard.KeyCodes.LEFT,
          Phaser.Input.Keyboard.KeyCodes.RIGHT,
        ]);
      }
      this.applyMovement();
    }
  }

  function boot() {
    var parent = document.getElementById("game-container");
    if (!parent || typeof Phaser === "undefined") {
      return;
    }
    if (window.__mathPixelQuestGame) {
      window.__mathPixelQuestGame.destroy(true);
      window.__mathPixelQuestGame = null;
    }
    window.__mathPixelQuestGame = new Phaser.Game({
      type: Phaser.AUTO,
      width: 960,
      height: 540,
      parent: "game-container",
      backgroundColor: "#070b14",
      pixelArt: true,
      roundPixels: true,
      render: {
        pixelArt: true,
        roundPixels: true,
        antialias: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960,
        height: 540,
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [GameScene],
    });
  }

  window.__bootMathPixelQuest = boot;

  if (!window.__MPQ_MANUAL_BOOT) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})();
