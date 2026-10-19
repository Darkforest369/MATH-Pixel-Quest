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
  var FONT_FAMILY = '"Iansui", sans-serif';

  /* Player palette */
  var OUTLINE = 0x0b0f18;
  var SKIN = 0xf6c9a4;
  var SKIN_SHADE = 0xd79c74;
  var CHEEK = 0xf0a08c;
  var MOUTH = 0xb9795a;
  var EYE = 0x11182a;
  var EYE_LIGHT = 0xdff2ff;
  var HAT = 0x2f43b8;
  var HAT_LIGHT = 0x5468e8;
  var HAT_DARK = 0x1d2a7c;
  var ROBE = 0x3a55cf;
  var ROBE_LIGHT = 0x5c78ee;
  var ROBE_DARK = 0x27399c;
  var GOLD = 0xe9c05a;
  var GOLD_LIGHT = 0xf7dd8e;
  var BOOT_LIGHT = 0x9a6b46;
  var BOOT_DARK = 0x6b4630;

  /* HUD palette */
  var KEY_IDLE_FILL = 0x0c1424;
  var KEY_IDLE_BORDER = 0x3ec6c6;
  var KEY_IDLE_TEXT = "#e8f6ff";
  var KEY_ACTIVE_FILL = 0x63e6ff;
  var KEY_ACTIVE_BORDER = 0xffffff;
  var KEY_ACTIVE_TEXT = "#06121c";

  function paintRect(graphics, x, y, w, h, color) {
    graphics.fillStyle(color, 1);
    graphics.fillRect(x, y, w, h);
  }

  /* Fill one pixel row with a base colour plus a light left edge and dark right edge. */
  function shadeRow(graphics, x, y, w, base, light, dark) {
    if (w <= 0) {
      return;
    }
    paintRect(graphics, x, y, w, 1, base);
    if (w >= 3) {
      paintRect(graphics, x, y, 1, 1, light);
      paintRect(graphics, x + w - 1, y, 1, 1, dark);
    } else if (w === 2) {
      paintRect(graphics, x, y, 1, 1, light);
    }
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
      this.hudKeys = null;
      this.pad = { up: false, down: false, left: false, right: false };
    }

    create() {
      this.generateTextures();
      this.createWorld();
      this.createBorders();
      this.createPlayer();
      this.setupCamera();
      this.createKeys();
      this.createHud();
      this.bindControlsProbe();
    }

    /* Texture generation — floor, wall, and the player. Nothing else. */
    generateTextures() {
      this.generateFloorTexture();
      this.generateWallTexture();
      this.generatePlayerTexture();
    }

    /* Minimal floor: dark slate base with a very subtle grid seam. */
    generateFloorTexture() {
      var g = this.make.graphics({ add: false });
      var s = TILE;

      g.fillStyle(0x161d2b, 1);
      g.fillRect(0, 0, s, s);

      g.fillStyle(0x1e2737, 1);
      g.fillRect(0, 0, s, 1);
      g.fillRect(0, 0, 1, s);

      g.fillStyle(0x10151e, 1);
      g.fillRect(0, s - 1, s, 1);
      g.fillRect(s - 1, 0, 1, s);

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

    /* 32x32 chibi mage: outlined, shaded, with a soft shadow at the feet. */
    generatePlayerTexture() {
      var g = this.make.graphics({ add: false });
      var i;
      var row;

      /* Soft pixel ellipse shadow under the feet. */
      g.fillStyle(0x03060b, 0.30);
      g.fillRect(9, 28, 14, 1);
      g.fillStyle(0x03060b, 0.38);
      g.fillRect(8, 29, 16, 1);
      g.fillStyle(0x03060b, 0.22);
      g.fillRect(10, 30, 12, 1);

      /* Hat cone — dark silhouette first. */
      var coneOutline = [
        [2, 15, 3],
        [3, 14, 5],
        [4, 13, 7],
        [5, 13, 7],
        [6, 12, 9],
        [7, 11, 11],
        [8, 11, 11],
        [9, 10, 13],
      ];
      for (i = 0; i < coneOutline.length; i += 1) {
        row = coneOutline[i];
        paintRect(g, row[1], row[0], row[2], 1, OUTLINE);
      }

      /* Hat cone — shaded fill. */
      var coneFill = [
        [3, 15, 3],
        [4, 14, 5],
        [5, 14, 5],
        [6, 13, 7],
        [7, 12, 9],
        [8, 12, 9],
      ];
      for (i = 0; i < coneFill.length; i += 1) {
        row = coneFill[i];
        shadeRow(g, row[1], row[0], row[2], HAT, HAT_LIGHT, HAT_DARK);
      }
      paintRect(g, 11, 9, 11, 1, GOLD);

      /* Hat brim. */
      paintRect(g, 7, 10, 19, 3, OUTLINE);
      paintRect(g, 8, 10, 17, 1, HAT_LIGHT);
      paintRect(g, 8, 11, 17, 1, HAT);

      /* Head. */
      paintRect(g, 9, 12, 15, 8, OUTLINE);
      paintRect(g, 10, 13, 13, 6, SKIN);
      paintRect(g, 10, 18, 13, 1, SKIN_SHADE);

      /* Eyes with tiny highlights. */
      paintRect(g, 12, 15, 2, 2, EYE);
      paintRect(g, 19, 15, 2, 2, EYE);
      paintRect(g, 12, 15, 1, 1, EYE_LIGHT);
      paintRect(g, 19, 15, 1, 1, EYE_LIGHT);

      /* Cheeks and mouth. */
      paintRect(g, 11, 17, 2, 1, CHEEK);
      paintRect(g, 20, 17, 2, 1, CHEEK);
      paintRect(g, 15, 17, 2, 1, MOUTH);

      /* Robe silhouette, then shaded fill. */
      paintRect(g, 8, 19, 17, 7, OUTLINE);
      shadeRow(g, 10, 19, 13, ROBE, ROBE_LIGHT, ROBE_DARK);
      for (i = 20; i <= 22; i += 1) {
        shadeRow(g, 9, i, 15, ROBE, ROBE_LIGHT, ROBE_DARK);
      }
      paintRect(g, 9, 23, 15, 1, GOLD);
      paintRect(g, 15, 23, 2, 1, GOLD_LIGHT);
      shadeRow(g, 9, 24, 15, ROBE, ROBE_LIGHT, ROBE_DARK);

      /* Boots. */
      paintRect(g, 10, 25, 6, 3, OUTLINE);
      paintRect(g, 17, 25, 6, 3, OUTLINE);
      paintRect(g, 11, 25, 4, 1, BOOT_LIGHT);
      paintRect(g, 11, 26, 4, 1, BOOT_DARK);
      paintRect(g, 18, 25, 4, 1, BOOT_LIGHT);
      paintRect(g, 18, 26, 4, 1, BOOT_DARK);

      g.generateTexture("player", 32, 32);
      g.destroy();
      nearest(this, "player");
    }

    /* Clean floor only — no floating map decorations. */
    createWorld() {
      this.add
        .tileSprite(MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, "floor")
        .setDepth(0);
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
      /* Texture is 32x32; keep the collider centred and flush with the feet. */
      this.player.body.setSize(14, 16);
      this.player.body.setOffset(9, 12);
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

    createKeys() {
      if (this.keys || !this.input.keyboard) {
        return;
      }
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

    /* Small WASD key cluster in the top-left corner. */
    createHud() {
      var scene = this;
      var keySize = 26;
      var gap = 4;
      var step = keySize + gap;
      var originX = 16;
      var originY = 16;

      var layout = [
        { id: "W", flag: "up", col: 1, row: 0 },
        { id: "A", flag: "left", col: 0, row: 1 },
        { id: "S", flag: "down", col: 1, row: 1 },
        { id: "D", flag: "right", col: 2, row: 1 },
      ];

      this.hudKeys = {};

      layout.forEach(function (spec) {
        var px = originX + spec.col * step;
        var py = originY + spec.row * step;

        var gfx = scene.add.graphics().setScrollFactor(0).setDepth(30);

        var label = scene.add
          .text(px, py, spec.id, {
            fontFamily: FONT_FAMILY,
            fontSize: "14px",
            color: KEY_IDLE_TEXT,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(31);

        var entry = {
          id: spec.id,
          flag: spec.flag,
          px: px,
          py: py,
          size: keySize,
          gfx: gfx,
          label: label,
          active: false,
        };

        scene.drawHudKey(entry, false);

        /* Touch / click support on the key itself (screen-space, scroll factor 0). */
        var zone = scene.add
          .zone(px, py, keySize, keySize)
          .setScrollFactor(0)
          .setDepth(32);
        zone.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, keySize, keySize),
          Phaser.Geom.Rectangle.Contains
        );
        zone.on("pointerdown", function () {
          scene.pad[spec.flag] = true;
        });
        zone.on("pointerup", function () {
          scene.pad[spec.flag] = false;
        });
        zone.on("pointerout", function () {
          scene.pad[spec.flag] = false;
        });
        zone.on("pointerupoutside", function () {
          scene.pad[spec.flag] = false;
        });

        scene.hudKeys[spec.id] = entry;
      });
    }

    drawHudKey(entry, active) {
      var g = entry.gfx;
      var half = entry.size / 2;
      g.clear();
      g.fillStyle(active ? KEY_ACTIVE_FILL : KEY_IDLE_FILL, active ? 1 : 0.9);
      g.fillRoundedRect(entry.px - half, entry.py - half, entry.size, entry.size, 6);
      g.lineStyle(2, active ? KEY_ACTIVE_BORDER : KEY_IDLE_BORDER, 1);
      g.strokeRoundedRect(entry.px - half, entry.py - half, entry.size, entry.size, 6);
    }

    setHudKeyActive(id, active) {
      if (!this.hudKeys) {
        return;
      }
      var entry = this.hudKeys[id];
      if (!entry || entry.active === active) {
        return;
      }
      entry.active = active;
      this.drawHudKey(entry, active);
      entry.label.setColor(active ? KEY_ACTIVE_TEXT : KEY_IDLE_TEXT);
    }

    refreshHud() {
      if (!this.hudKeys || !this.keys) {
        return;
      }
      var w =
        this.keyHeld("KeyW", this.keys.W) ||
        this.keyHeld("ArrowUp", this.keys.UP) ||
        this.pad.up;
      var a =
        this.keyHeld("KeyA", this.keys.A) ||
        this.keyHeld("ArrowLeft", this.keys.LEFT) ||
        this.pad.left;
      var s =
        this.keyHeld("KeyS", this.keys.S) ||
        this.keyHeld("ArrowDown", this.keys.DOWN) ||
        this.pad.down;
      var d =
        this.keyHeld("KeyD", this.keys.D) ||
        this.keyHeld("ArrowRight", this.keys.RIGHT) ||
        this.pad.right;

      this.setHudKeyActive("W", !!w);
      this.setHudKeyActive("A", !!a);
      this.setHudKeyActive("S", !!s);
      this.setHudKeyActive("D", !!d);
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
      if (!this.keys) {
        this.createKeys();
      }
      this.applyMovement();
      this.refreshHud();
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

  /* Wait (briefly) for the Iansui webfont so Phaser Text renders with it. */
  function bootWhenFontReady() {
    var started = false;
    var start = function () {
      if (started) {
        return;
      }
      started = true;
      boot();
    };

    if (document.fonts && typeof document.fonts.load === "function") {
      try {
        document.fonts.load('16px "Iansui"').then(start, start);
      } catch (err) {
        start();
      }
      window.setTimeout(start, 1200);
    } else {
      start();
    }
  }

  window.__bootMathPixelQuest = boot;

  if (!window.__MPQ_MANUAL_BOOT) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootWhenFontReady);
    } else {
      bootWhenFontReady();
    }
  }
})();
