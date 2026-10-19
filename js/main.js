/*
 * Math Pixel Quest — walking prototype.
 * One scene, Arcade physics, runtime textures only.
 * Grass theme, dense tree borders, chibi player with 4-way animations.
 */
(function () {
  "use strict";

  var MAP_WIDTH = 1600;
  var MAP_HEIGHT = 1200;
  var TILE = 32;
  var SPEED = 180;
  var FONT_FAMILY = '"Iansui", sans-serif';

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
      this.lastDir = "down";
    }

    create() {
      this.generateTextures();
      this.createAnims();
      this.createWorld();
      this.createBorders();
      this.createPlayer();
      this.setupCamera();
      this.createKeys();
      this.createHud();
      this.bindControlsProbe();
    }

    /* Texture generation */
    generateTextures() {
      this.generateGrassTextures();
      this.generateTreeTextures();
      this.generatePlayerFrames();
    }

    generateGrassTextures() {
      let g;

      // Grass 1: Solid base green
      g = this.make.graphics({ add: false });
      paintRect(g, 0, 0, 32, 32, 0x4a8c3f);
      g.generateTexture("grass1", 32, 32);
      g.destroy();
      nearest(this, "grass1");

      // Grass 2: Base with darker pixel blades
      g = this.make.graphics({ add: false });
      paintRect(g, 0, 0, 32, 32, 0x4a8c3f);
      const blades = [
        [5, 5], [12, 8], [20, 4], [28, 15], [8, 22], [16, 18], [24, 28], [3, 15], [14, 30]
      ];
      for (let i = 0; i < blades.length; i++) {
        const b = blades[i];
        paintRect(g, b[0], b[1], 1, 2, 0x3d7a33);
        paintRect(g, b[0] + 1, b[1] + 2, 1, 1, 0x3d7a33);
      }
      g.generateTexture("grass2", 32, 32);
      g.destroy();
      nearest(this, "grass2");

      // Grass 3: Base with a tiny lighter pixel flower and dirt speck
      g = this.make.graphics({ add: false });
      paintRect(g, 0, 0, 32, 32, 0x4a8c3f);
      paintRect(g, 8, 8, 2, 2, 0x6b4c3a); // Dirt speck
      paintRect(g, 22, 20, 1, 1, 0xf0e68c); // yellow center
      paintRect(g, 21, 19, 1, 1, 0xffffff); // white petal
      paintRect(g, 23, 19, 1, 1, 0xffffff);
      paintRect(g, 22, 18, 1, 1, 0xffffff);
      paintRect(g, 22, 20, 1, 1, 0xffffff);
      g.generateTexture("grass3", 32, 32);
      g.destroy();
      nearest(this, "grass3");
    }

    generateTreeTextures() {
      let g;

      // Background Tree (darker, slightly smaller)
      g = this.make.graphics({ add: false });
      paintRect(g, 9, 22, 6, 10, 0x3e2723); // trunk
      paintRect(g, 0, 4, 24, 18, 0x1b5e20); // canopy base
      paintRect(g, 4, 0, 16, 22, 0x1b5e20);
      paintRect(g, 2, 6, 20, 14, 0x2e7d32); // highlight
      g.generateTexture("tree_bg", 24, 32);
      g.destroy();
      nearest(this, "tree_bg");

      // Foreground Tree (brighter, larger, distinct leaf pattern)
      g = this.make.graphics({ add: false });
      paintRect(g, 8, 24, 8, 12, 0x4e342e); // trunk
      paintRect(g, 0, 6, 24, 18, 0x2e7d32); // canopy base
      paintRect(g, 4, 0, 16, 24, 0x2e7d32);
      paintRect(g, 2, 8, 20, 14, 0x388e3c); // mid tone
      paintRect(g, 6, 2, 12, 18, 0x43a047); // top highlight
      // Leaf details
      paintRect(g, 6, 10, 2, 2, 0x1b5e20);
      paintRect(g, 16, 14, 2, 2, 0x1b5e20);
      paintRect(g, 12, 6, 2, 2, 0x1b5e20);
      paintRect(g, 10, 18, 2, 2, 0x1b5e20);
      g.generateTexture("tree_fg", 24, 36);
      g.destroy();
      nearest(this, "tree_fg");
    }

    generatePlayerFrames() {
      const directions = ["down", "up", "left", "right"];
      for (const dir of directions) {
        for (let frame = 0; frame <= 2; frame++) {
          const g = this.make.graphics({ add: false });
          this.drawPlayerFrame(g, dir, frame);
          const key = frame === 0 ? `player-idle-${dir}` : `player-walk-${dir}-${frame}`;
          g.generateTexture(key, 32, 32);
          g.destroy();
          nearest(this, key);
        }
      }
    }

    drawPlayerFrame(g, dir, frame) {
      const OUT = 0x181425;
      const HAIR = 0x673d24;
      const HAIR_HI = 0x8a5a3a;
      const SKIN = 0xffd5b3;
      const SKIN_SH = 0xdfa482;
      const SHIRT = 0xd34c4c;
      const SHIRT_SH = 0xa63232;
      const SHORTS = 0x3ecbcd;
      const SHORTS_SH = 0x2e9ea0;
      const SHOE = 0x3b222a;

      function f(x, y, w, h, c) {
        g.fillStyle(c, 1);
        g.fillRect(x, y, w, h);
      }

      // Shadow
      g.fillStyle(0x000000, 0.3);
      g.fillRect(10, 29, 12, 2);
      g.fillStyle(0x000000, 0.15);
      g.fillRect(8, 29, 16, 2);

      // Body Outline
      if (dir === 'down' || dir === 'up') {
        f(9, 19, 14, 11, OUT);
        f(10, 20, 12, 9, SHIRT);
        f(10, 24, 12, 2, SHIRT_SH);
        f(10, 26, 12, 3, SHORTS);
        f(10, 29, 12, 1, SHORTS_SH);
      } else {
        f(11, 19, 10, 11, OUT);
        f(12, 20, 8, 9, SHIRT);
        f(12, 24, 8, 2, SHIRT_SH);
        f(12, 26, 8, 3, SHORTS);
        f(12, 29, 8, 1, SHORTS_SH);
      }

      // Legs & Shoes
      let legY1 = 30, legY2 = 30;
      if (frame === 1) legY1 = 29;
      if (frame === 2) legY2 = 29;

      if (dir === 'down' || dir === 'up') {
        f(10, legY1, 4, 32 - legY1, OUT);
        f(11, legY1 + 1, 2, 32 - legY1 - 1, SHOE);
        f(18, legY2, 4, 32 - legY2, OUT);
        f(19, legY2 + 1, 2, 32 - legY2 - 1, SHOE);
      } else if (dir === 'right') {
        f(17, legY2, 4, 32 - legY2, OUT);
        f(18, legY2 + 1, 2, 32 - legY2 - 1, SHOE);
        f(12, legY1, 4, 32 - legY1, OUT);
        f(13, legY1 + 1, 2, 32 - legY1 - 1, SHOE);
      } else if (dir === 'left') {
        f(11, legY2, 4, 32 - legY2, OUT);
        f(12, legY2 + 1, 2, 32 - legY2 - 1, SHOE);
        f(16, legY1, 4, 32 - legY1, OUT);
        f(17, legY1 + 1, 2, 32 - legY1 - 1, SHOE);
      }

      // Head
      if (dir === 'down') {
        f(8, 6, 16, 15, OUT);
        f(9, 6, 14, 6, HAIR);
        f(9, 12, 2, 4, HAIR);
        f(21, 12, 2, 4, HAIR);
        f(10, 7, 12, 2, HAIR_HI);
        f(11, 11, 10, 9, SKIN);
        f(11, 19, 10, 1, SKIN_SH);
        f(13, 14, 2, 3, OUT);
        f(19, 14, 2, 3, OUT);
        f(13, 14, 1, 1, 0xffffff);
        f(19, 14, 1, 1, 0xffffff);
        f(12, 16, 2, 1, 0xff8888);
        f(20, 16, 2, 1, 0xff8888);
        f(16, 17, 2, 1, OUT);
      } else if (dir === 'up') {
        f(8, 6, 16, 15, OUT);
        f(9, 6, 14, 14, HAIR);
        f(10, 7, 12, 4, HAIR_HI);
        f(9, 18, 14, 2, HAIR);
      } else if (dir === 'right') {
        f(9, 6, 14, 15, OUT);
        f(10, 6, 12, 6, HAIR);
        f(10, 12, 4, 6, HAIR);
        f(11, 7, 10, 2, HAIR_HI);
        f(14, 12, 8, 9, SKIN);
        f(14, 19, 8, 1, SKIN_SH);
        f(18, 14, 2, 3, OUT);
        f(18, 14, 1, 1, 0xffffff);
        f(18, 16, 2, 1, 0xff8888);
        f(21, 15, 1, 1, SKIN_SH);
      } else if (dir === 'left') {
        f(9, 6, 14, 15, OUT);
        f(10, 6, 12, 6, HAIR);
        f(18, 12, 4, 6, HAIR);
        f(11, 7, 10, 2, HAIR_HI);
        f(10, 12, 8, 9, SKIN);
        f(10, 19, 8, 1, SKIN_SH);
        f(12, 14, 2, 3, OUT);
        f(13, 14, 1, 1, 0xffffff);
        f(12, 16, 2, 1, 0xff8888);
        f(10, 15, 1, 1, SKIN_SH);
      }
    }

    createAnims() {
      const dirs = ["down", "up", "left", "right"];
      for (const dir of dirs) {
        this.anims.create({
          key: `walk-${dir}`,
          frames: [
            { key: `player-walk-${dir}-1` },
            { key: `player-walk-${dir}-2` }
          ],
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    createWorld() {
      const cols = MAP_WIDTH / TILE;
      const rows = MAP_HEIGHT / TILE;
      const grassTypes = ["grass1", "grass2", "grass3"];

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = x * TILE + TILE / 2;
          const py = y * TILE + TILE / 2;
          const type = grassTypes[Math.floor(Math.random() * grassTypes.length)];
          this.add.image(px, py, type).setDepth(0);
        }
      }
    }

    createBorders() {
      this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Top & Bottom Borders
      for (let x = 12; x < MAP_WIDTH; x += 24) {
        this.add.image(x, 32, "tree_bg").setDepth(2);
        this.add.image(x, 38, "tree_fg").setDepth(3);
        
        this.add.image(x, MAP_HEIGHT - 32, "tree_bg").setDepth(2);
        this.add.image(x, MAP_HEIGHT - 38, "tree_fg").setDepth(3);
      }

      // Left & Right Borders
      for (let y = 12; y < MAP_HEIGHT; y += 24) {
        this.add.image(32, y, "tree_bg").setDepth(2);
        this.add.image(38, y, "tree_fg").setDepth(3);

        this.add.image(MAP_WIDTH - 32, y, "tree_bg").setDepth(2);
        this.add.image(MAP_WIDTH - 38, y, "tree_fg").setDepth(3);
      }

      // Invisible physics bodies for collision
      this.borderBodies = this.physics.add.staticGroup();
      this.addBorderBody(MAP_WIDTH / 2, 32, MAP_WIDTH, 64);
      this.addBorderBody(MAP_WIDTH / 2, MAP_HEIGHT - 32, MAP_WIDTH, 64);
      this.addBorderBody(32, MAP_HEIGHT / 2, 64, MAP_HEIGHT);
      this.addBorderBody(MAP_WIDTH - 32, MAP_HEIGHT / 2, 64, MAP_HEIGHT);
    }

    addBorderBody(x, y, w, h) {
      var block = this.borderBodies.create(x, y, "tree_bg");
      block.setVisible(false);
      block.displayWidth = w;
      block.displayHeight = h;
      block.refreshBody();
    }

    createPlayer() {
      this.player = this.physics.add.sprite(MAP_WIDTH / 2, MAP_HEIGHT / 2, "player-idle-down");
      this.player.setScale(2);
      this.player.setDepth(5);
      this.player.setCollideWorldBounds(true);
      this.player.body.setAllowGravity(false);
      this.player.body.setSize(10, 10);
      this.player.body.setOffset(11, 20);
      this.player.refreshBody();
      this.physics.add.collider(this.player, this.borderBodies);
    }

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

    createHud() {
      const scene = this;
      const keySize = 26;
      const gap = 4;
      const step = keySize + gap;
      const originX = 16;
      const originY = 16;

      const layout = [
        { id: "W", flag: "up", col: 1, row: 0 },
        { id: "A", flag: "left", col: 0, row: 1 },
        { id: "S", flag: "down", col: 1, row: 1 },
        { id: "D", flag: "right", col: 2, row: 1 },
      ];

      this.hudKeys = {};

      layout.forEach(function (spec) {
        const px = originX + spec.col * step;
        const py = originY + spec.row * step;

        const gfx = scene.add.graphics().setScrollFactor(0).setDepth(30);

        const label = scene.add
          .text(px, py, spec.id, {
            fontFamily: FONT_FAMILY,
            fontSize: "14px",
            color: KEY_IDLE_TEXT,
            resolution: window.devicePixelRatio || 2,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(31);

        const entry = {
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

        const zone = scene.add
          .zone(px, py, keySize, keySize)
          .setScrollFactor(0)
          .setDepth(32);
        zone.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, keySize, keySize),
          Phaser.Geom.Rectangle.Contains
        );
        zone.on("pointerdown", function () { scene.pad[spec.flag] = true; });
        zone.on("pointerup", function () { scene.pad[spec.flag] = false; });
        zone.on("pointerout", function () { scene.pad[spec.flag] = false; });
        zone.on("pointerupoutside", function () { scene.pad[spec.flag] = false; });

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
      if (!this.hudKeys) return;
      var entry = this.hudKeys[id];
      if (!entry || entry.active === active) return;
      entry.active = active;
      this.drawHudKey(entry, active);
      entry.label.setColor(active ? KEY_ACTIVE_TEXT : KEY_IDLE_TEXT);
    }

    refreshHud() {
      if (!this.hudKeys || !this.keys) return;
      var w = this.keyHeld("KeyW", this.keys.W) || this.keyHeld("ArrowUp", this.keys.UP) || this.pad.up;
      var a = this.keyHeld("KeyA", this.keys.A) || this.keyHeld("ArrowLeft", this.keys.LEFT) || this.pad.left;
      var s = this.keyHeld("KeyS", this.keys.S) || this.keyHeld("ArrowDown", this.keys.DOWN) || this.pad.down;
      var d = this.keyHeld("KeyD", this.keys.D) || this.keyHeld("ArrowRight", this.keys.RIGHT) || this.pad.right;

      this.setHudKeyActive("W", !!w);
      this.setHudKeyActive("A", !!a);
      this.setHudKeyActive("S", !!s);
      this.setHudKeyActive("D", !!d);
    }

    bindControlsProbe() {
      var scene = this;
      window.__controlsTest = {
        getX: function () { return scene.player.x; },
        getY: function () { return scene.player.y; },
        getSpeed: function () {
          var velocity = scene.player.body.velocity;
          return Math.hypot(velocity.x, velocity.y);
        },
        getVelocity: function () {
          return { x: scene.player.body.velocity.x, y: scene.player.body.velocity.y };
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
      if (this.injectedKeys) return this.injectedKeys.has(code);
      return !!(key && key.isDown);
    }

    applyMovement() {
      if (!this.player || !this.keys) return;

      var xAxis = 0;
      var yAxis = 0;
      if (this.keyHeld("KeyA", this.keys.A) || this.keyHeld("ArrowLeft", this.keys.LEFT) || this.pad.left) xAxis -= 1;
      if (this.keyHeld("KeyD", this.keys.D) || this.keyHeld("ArrowRight", this.keys.RIGHT) || this.pad.right) xAxis += 1;
      if (this.keyHeld("KeyW", this.keys.W) || this.keyHeld("ArrowUp", this.keys.UP) || this.pad.up) yAxis -= 1;
      if (this.keyHeld("KeyS", this.keys.S) || this.keyHeld("ArrowDown", this.keys.DOWN) || this.pad.down) yAxis += 1;

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

    updatePlayerAnim() {
      if (!this.player || !this.player.body) return;

      const vx = this.player.body.velocity.x;
      const vy = this.player.body.velocity.y;

      if (vx === 0 && vy === 0) {
        if (this.player.anims.isPlaying) {
          this.player.anims.stop();
          this.player.setTexture(`player-idle-${this.lastDir}`);
        }
        return;
      }

      let dir = this.lastDir;
      if (vx < 0) dir = "left";
      else if (vx > 0) dir = "right";
      else if (vy < 0) dir = "up";
      else if (vy > 0) dir = "down";

      this.lastDir = dir;

      if (!this.player.anims.isPlaying || this.player.anims.currentAnim.key !== `walk-${dir}`) {
        this.player.play(`walk-${dir}`);
      }
    }

    update() {
      if (!this.keys) this.createKeys();
      this.applyMovement();
      this.refreshHud();
      this.updatePlayerAnim();
    }
  }

  function boot() {
    var parent = document.getElementById("game-container");
    if (!parent || typeof Phaser === "undefined") return;

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

  function bootWhenFontReady() {
    var started = false;
    var start = function () {
      if (started) return;
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
