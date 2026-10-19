/*
 * Math Pixel Quest — walking prototype.
 * One scene, Arcade physics, runtime textures only.
 * Grass theme, tree borders, animated player, and crisp HUD.
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

    /* Texture generation — grass, trees, and player frames. */
    generateTextures() {
      this.generateGrassTextures();
      this.generateTreeTexture();
      this.generatePlayerFrames();
    }

    /* Three distinct grass tiles to break up repetition. */
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
      // Dirt speck
      paintRect(g, 8, 8, 2, 2, 0x6b4c3a);
      // Flower
      paintRect(g, 22, 20, 1, 1, 0xf0e68c); // yellow center
      paintRect(g, 21, 19, 1, 1, 0xffffff); // white petal
      paintRect(g, 23, 19, 1, 1, 0xffffff);
      paintRect(g, 22, 18, 1, 1, 0xffffff);
      paintRect(g, 22, 20, 1, 1, 0xffffff);
      g.generateTexture("grass3", 32, 32);
      g.destroy();
      nearest(this, "grass3");
    }

    /* Tree/bush texture for the map boundaries. */
    generateTreeTexture() {
      const g = this.make.graphics({ add: false });
      const w = 64;
      const h = 64;

      // Trunk
      paintRect(g, 26, 40, 12, 24, 0x5c3a21);
      paintRect(g, 27, 40, 10, 24, 0x7a4e2e);
      paintRect(g, 28, 40, 8, 24, 0x8b5a35);

      // Leaves
      const leafColors = [0x2d6a2e, 0x3d8c3e, 0x4a9c4b, 0x256b26];

      // Bottom layer
      g.fillStyle(leafColors[0], 1);
      g.fillRect(8, 24, 48, 24);
      g.fillRect(12, 20, 40, 32);

      // Mid layer
      g.fillStyle(leafColors[1], 1);
      g.fillRect(12, 16, 40, 24);
      g.fillRect(16, 12, 32, 32);

      // Top layer
      g.fillStyle(leafColors[2], 1);
      g.fillRect(16, 8, 32, 20);
      g.fillRect(20, 4, 24, 24);

      // Highlights
      g.fillStyle(leafColors[3], 1);
      g.fillRect(18, 10, 12, 8);
      g.fillRect(14, 18, 16, 8);
      g.fillRect(10, 26, 20, 10);

      g.generateTexture("tree", w, h);
      g.destroy();
      nearest(this, "tree");
    }

    /* Generate 4-directional player frames with 2 walking frames per direction. */
    generatePlayerFrames() {
      const directions = ["down", "left", "right", "up"];
      const frames = [0, 1, 2]; // 0 = idle, 1 & 2 = walk frames

      for (const dir of directions) {
        for (const frame of frames) {
          const g = this.make.graphics({ add: false });
          this.drawPlayerFrame(g, dir, frame);
          const key = frame === 0 ? `idle-${dir}` : `walk-${dir}-${frame}`;
          g.generateTexture(key, 32, 32);
          g.destroy();
          nearest(this, key);
        }
      }
    }

    drawPlayerFrame(g, dir, frame) {
      const OUTLINE = 0x0b0f18;
      const SKIN = 0xf6c9a4;
      const SKIN_SHADE = 0xd79c74;
      const CHEEK = 0xf0a08c;
      const MOUTH = 0xb9795a;
      const EYE = 0x11182a;
      const EYE_LIGHT = 0xdff2ff;
      const HAT = 0x2f43b8;
      const HAT_LIGHT = 0x5468e8;
      const HAT_DARK = 0x1d2a7c;
      const ROBE = 0x3a55cf;
      const ROBE_LIGHT = 0x5c78ee;
      const ROBE_DARK = 0x27399c;
      const GOLD = 0xe9c05a;
      const GOLD_LIGHT = 0xf7dd8e;
      const BOOT_LIGHT = 0x9a6b46;
      const BOOT_DARK = 0x6b4630;

      function paint(x, y, w, h, color) {
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
      }

      function shadeRow(x, y, w, base, light, dark) {
        if (w <= 0) return;
        paint(x, y, w, 1, base);
        if (w >= 3) {
          paint(x, y, 1, 1, light);
          paint(x + w - 1, y, 1, 1, dark);
        } else if (w === 2) {
          paint(x, y, 1, 1, light);
        }
      }

      // Shadow
      g.fillStyle(0x03060b, 0.30);
      g.fillRect(9, 28, 14, 1);
      g.fillStyle(0x03060b, 0.38);
      g.fillRect(8, 29, 16, 1);
      g.fillStyle(0x03060b, 0.22);
      g.fillRect(10, 30, 12, 1);

      // Hat offset for left/right perspective
      let hatOffset = 0;
      if (dir === "left") hatOffset = -2;
      if (dir === "right") hatOffset = 2;

      // Hat cone outline
      const coneOutline = [
        [2, 15 + hatOffset, 3],
        [3, 14 + hatOffset, 5],
        [4, 13 + hatOffset, 7],
        [5, 13 + hatOffset, 7],
        [6, 12 + hatOffset, 9],
        [7, 11 + hatOffset, 11],
        [8, 11 + hatOffset, 11],
        [9, 10 + hatOffset, 13],
      ];
      for (let i = 0; i < coneOutline.length; i++) {
        const row = coneOutline[i];
        paint(row[1], row[0], row[2], 1, OUTLINE);
      }

      // Hat cone fill
      const coneFill = [
        [3, 15 + hatOffset, 3],
        [4, 14 + hatOffset, 5],
        [5, 14 + hatOffset, 5],
        [6, 13 + hatOffset, 7],
        [7, 12 + hatOffset, 9],
        [8, 12 + hatOffset, 9],
      ];
      for (let i = 0; i < coneFill.length; i++) {
        const row = coneFill[i];
        shadeRow(row[1], row[0], row[2], HAT, HAT_LIGHT, HAT_DARK);
      }
      paint(11 + hatOffset, 9, 11, 1, GOLD);

      // Hat brim
      paint(7 + hatOffset, 10, 19, 3, OUTLINE);
      paint(8 + hatOffset, 10, 17, 1, HAT_LIGHT);
      paint(8 + hatOffset, 11, 17, 1, HAT);

      // Head outline
      paint(9, 12, 15, 8, OUTLINE);

      // Head fill
      paint(10, 13, 13, 6, SKIN);
      paint(10, 18, 13, 1, SKIN_SHADE);

      // Face details (only for down, left, right)
      if (dir === "down") {
        paint(12, 15, 2, 2, EYE);
        paint(19, 15, 2, 2, EYE);
        paint(12, 15, 1, 1, EYE_LIGHT);
        paint(19, 15, 1, 1, EYE_LIGHT);
        paint(11, 17, 2, 1, CHEEK);
        paint(20, 17, 2, 1, CHEEK);
        paint(15, 17, 2, 1, MOUTH);
      } else if (dir === "left") {
        paint(11, 15, 2, 2, EYE);
        paint(11, 15, 1, 1, EYE_LIGHT);
        paint(10, 17, 2, 1, CHEEK);
      } else if (dir === "right") {
        paint(19, 15, 2, 2, EYE);
        paint(19, 15, 1, 1, EYE_LIGHT);
        paint(20, 17, 2, 1, CHEEK);
      }

      // Body outline
      paint(8, 19, 17, 7, OUTLINE);

      // Body fill
      shadeRow(10, 19, 13, ROBE, ROBE_LIGHT, ROBE_DARK);
      for (let i = 20; i <= 22; i++) {
        shadeRow(9, i, 15, ROBE, ROBE_LIGHT, ROBE_DARK);
      }
      paint(9, 23, 15, 1, GOLD);
      paint(15, 23, 2, 1, GOLD_LIGHT);
      shadeRow(9, 24, 15, ROBE, ROBE_LIGHT, ROBE_DARK);

      // Boots
      const drawBoot = (x, y) => {
        paint(x, y, 6, 3, OUTLINE);
        paint(x + 1, y, 4, 1, BOOT_LIGHT);
        paint(x + 1, y + 1, 4, 1, BOOT_DARK);
      };

      if (dir === "down" || dir === "up") {
        if (frame === 0) {
          drawBoot(10, 25);
          drawBoot(17, 25);
        } else if (frame === 1) {
          drawBoot(10, 25);
          drawBoot(17, 26);
        } else if (frame === 2) {
          drawBoot(10, 26);
          drawBoot(17, 25);
        }
      } else if (dir === "left") {
        if (frame === 0) {
          drawBoot(11, 25);
          drawBoot(17, 25);
        } else if (frame === 1) {
          drawBoot(10, 25);
          drawBoot(18, 26);
        } else if (frame === 2) {
          drawBoot(10, 26);
          drawBoot(18, 25);
        }
      } else if (dir === "right") {
        if (frame === 0) {
          drawBoot(10, 25);
          drawBoot(16, 25);
        } else if (frame === 1) {
          drawBoot(9, 25);
          drawBoot(17, 26);
        } else if (frame === 2) {
          drawBoot(9, 26);
          drawBoot(17, 25);
        }
      }
    }

    createAnims() {
      this.anims.create({
        key: "walk-down",
        frames: [{ key: "walk-down-1" }, { key: "walk-down-2" }],
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "walk-left",
        frames: [{ key: "walk-left-1" }, { key: "walk-left-2" }],
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "walk-right",
        frames: [{ key: "walk-right-1" }, { key: "walk-right-2" }],
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "walk-up",
        frames: [{ key: "walk-up-1" }, { key: "walk-up-2" }],
        frameRate: 8,
        repeat: -1,
      });
    }

    /* Randomly place grass tiles to avoid checkerboard repetition. */
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

    /* Tree borders with invisible physics bodies for collision. */
    createBorders() {
      this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Top and bottom rows
      for (let x = 32; x < MAP_WIDTH; x += 64) {
        this.add.image(x, 32, "tree").setDepth(2);
        this.add.image(x, MAP_HEIGHT - 32, "tree").setDepth(2);
      }
      // Left and right columns
      for (let y = 32; y < MAP_HEIGHT; y += 64) {
        this.add.image(32, y, "tree").setDepth(2);
        this.add.image(MAP_WIDTH - 32, y, "tree").setDepth(2);
      }
      // Corners (redundant but ensures full coverage)
      this.add.image(32, 32, "tree").setDepth(2);
      this.add.image(MAP_WIDTH - 32, 32, "tree").setDepth(2);
      this.add.image(32, MAP_HEIGHT - 32, "tree").setDepth(2);
      this.add.image(MAP_WIDTH - 32, MAP_HEIGHT - 32, "tree").setDepth(2);

      this.borderBodies = this.physics.add.staticGroup();
      this.addBorderBody(MAP_WIDTH / 2, 32, MAP_WIDTH, 64);
      this.addBorderBody(MAP_WIDTH / 2, MAP_HEIGHT - 32, MAP_WIDTH, 64);
      this.addBorderBody(32, MAP_HEIGHT / 2, 64, MAP_HEIGHT);
      this.addBorderBody(MAP_WIDTH - 32, MAP_HEIGHT / 2, 64, MAP_HEIGHT);
    }

    addBorderBody(x, y, w, h) {
      var block = this.borderBodies.create(x, y, "tree");
      block.setVisible(false);
      block.displayWidth = w;
      block.displayHeight = h;
      block.refreshBody();
    }

    createPlayer() {
      this.player = this.physics.add.sprite(MAP_WIDTH / 2, MAP_HEIGHT / 2, "idle-down");
      this.player.setScale(2);
      this.player.setDepth(5);
      this.player.setCollideWorldBounds(true);
      this.player.body.setAllowGravity(false);
      this.player.body.setSize(14, 16);
      this.player.body.setOffset(9, 12);
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

    /* High-DPI WASD UI with crisp text rendering. */
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

    updatePlayerAnim() {
      if (!this.player || !this.player.body) return;

      const vx = this.player.body.velocity.x;
      const vy = this.player.body.velocity.y;

      if (vx === 0 && vy === 0) {
        if (this.player.anims.isPlaying) {
          this.player.anims.stop();
          this.player.setTexture(`idle-${this.lastDir}`);
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
      if (!this.keys) {
        this.createKeys();
      }
      this.applyMovement();
      this.refreshHud();
      this.updatePlayerAnim();
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
