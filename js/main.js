/*
 * Math Pixel Quest — walking prototype.
 * One scene, Arcade physics, runtime textures only.
 * Grass theme, dense tree borders, high-quality chibi player with 4-way animations.
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

    generateTextures() {
      this.generateGrassTextures();
      this.generateTreeTextures();
      this.generatePixelCharacter();
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

    /* High-quality chibi character generation using exact pixel arrays. */
    generatePixelCharacter() {
      const PALETTE = {
        '.': null,       // transparent
        'O': 0x2a2333,   // Outline
        'S': 0xfcd5c5,   // Skin
        'D': 0xe8a593,   // Skin Shadow
        'P': 0xf79292,   // Blush
        'H': 0x5c3a21,   // Hair Base
        'L': 0x8b5a2b,   // Hair Highlight
        'K': 0x3d2515,   // Hair Shadow
        'R': 0xc93b3b,   // Shirt
        'E': 0x962424,   // Shirt Shadow
        'T': 0x4db6ac,   // Shorts
        'U': 0x318d85,   // Shorts Shadow
        'B': 0x4a2c1b,   // Shoes
      };

      const grids = {
        'player-idle-down': [
          "................................",
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHKKKKKKKKHHKO..........",
          ".......OHSSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSPSSSSSSSPSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          "........ODSSSSSSSSSDO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OTTTTTTTTTO............",
          ".........OTTTTOTTTTO............",
          ".........OUUUUOUUUOO............",
          ".........OSSSSOSSSSO............",
          ".........OOOOOOOOOOO............",
          "........OBBBBOOBBBBBO...........",
          "........OBBBBOOBBBBBO...........",
          ".........OOOOOOOOOOO............",
          "................................",
          "................................",
          "................................"
        ],
        'player-walk-down-1': [
          "................................",
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHKKKKKKKKHHKO..........",
          ".......OHSSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSPSSSSSSSPSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          "........ODSSSSSSSSSDO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OTTTTTTTTTO............",
          ".........OTTTTOTTTTO............",
          ".........OUUUUOUUUOO............",
          ".........OOOOOOSSSSO............",
          ".........OBBBBOOOOOO............",
          "........OBBBBO.OBBBBO...........",
          ".........OOOO..OBBBBO...........",
          "................OOOO............",
          "................................",
          "................................",
          "................................"
        ],
        'player-walk-down-2': [
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHKKKKKKKKHHKO..........",
          ".......OHSSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSOSSSSSSSOSSSO..........",
          ".......OSPSSSSSSSPSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          "........ODSSSSSSSSSDO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OTTTTTTTTTO............",
          ".........OTTTTOTTTTO............",
          ".........OUUUUOUUUOO............",
          ".........OSSSSOOOOOO............",
          ".........OOOOOOBBBBO............",
          "........OBBBBO.OBBBBO...........",
          "........OBBBBO..OOOO............",
          ".........OOOO...................",
          "................................",
          "................................",
          "................................"
        ],
        'player-idle-up': [
          "................................",
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OKKKKKKKKKKKKKO..........",
          "........OKKKKKKKKKKKO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OTTTTTTTTTO............",
          ".........OTTTTOTTTTO............",
          ".........OUUUUOUUUOO............",
          ".........OSSSSOSSSSO............",
          ".........OOOOOOOOOOO............",
          "........OBBBBOOBBBBBO...........",
          "........OBBBBOOBBBBBO...........",
          ".........OOOOOOOOOOO............",
          "................................",
          "................................",
          "................................"
        ],
        'player-walk-up-1': [
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OKKKKKKKKKKKKKO..........",
          "........OKKKKKKKKKKKO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OTTTTTTTTTO............",
          ".........OTTTTOTTTTO............",
          ".........OUUUUOUUUOO............",
          ".........OOOOOOSSSSO............",
          ".........OBBBBOOOOOO............",
          "........OBBBBO.OBBBBO...........",
          ".........OOOO..OBBBBO...........",
          "................OOOO............",
          "................................",
          "................................",
          "................................"
        ],
        'player-walk-up-2': [
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OKKKKKKKKKKKKKO..........",
          "........OKKKKKKKKKKKO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OTTTTTTTTTO............",
          ".........OTTTTOTTTTO............",
          ".........OUUUUOUUUOO............",
          ".........OSSSSOOOOOO............",
          ".........OOOOOOBBBBO............",
          "........OBBBBO.OBBBBO...........",
          "........OBBBBO..OOOO............",
          ".........OOOO...................",
          "................................",
          "................................",
          "................................"
        ],
        'player-idle-left': [
          "................................",
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHKKKKKKKKHHKO..........",
          ".......OHSSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSPSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          "........ODSSSSSSSSSDO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OOTTTTTTTOO............",
          "..........OTTTTTTTO.............",
          "..........OUUUUUUUO.............",
          "..........OSSSSSSOO.............",
          "..........OOOOOOOOO.............",
          ".........OBBBBBBBBBO............",
          ".........OBBBBBBBBBO............",
          "..........OOOOOOOOO.............",
          "................................",
          "................................",
          "................................"
        ],
        'player-walk-left-1': [
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHKKKKKKKKHHKO..........",
          ".......OHSSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSPSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          "........ODSSSSSSSSSDO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OOTTTTTTTOO............",
          "..........OTTTTTTTO.............",
          "..........OUUUUUUUO.............",
          "..........OSSSSOOOO.............",
          ".........OOOOOOBBBBO............",
          "........OBBBBBOOBBBBO...........",
          "........OBBBBO..OOOO............",
          ".........OOOO...................",
          "................................",
          "................................",
          "................................"
        ],
        'player-walk-left-2': [
          "..........OOOOOOOOOO............",
          "........OOLHHHHHHHHKO...........",
          ".......OLHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHHHHHHHHHHHKO..........",
          ".......OHHKKKKKKKKHHKO..........",
          ".......OHSSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSOSSSSSSSSSSSO..........",
          ".......OSPSSSSSSSSSSSO..........",
          ".......OSSSSSSSSSSSSSO..........",
          "........ODSSSSSSSSSDO...........",
          ".........OOOOOOOOOOO............",
          ".........ORRRRRRRRRO............",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........ORRRRRRRRRRRO...........",
          "........OEEEEEEEEEEEO...........",
          ".........OOTTTTTTTOO............",
          "..........OTTTTTTTO.............",
          "..........OUUUUUUUO.............",
          "..........OOOOSSSSO.............",
          ".........OBBBBOOOOOO............",
          "........OBBBBBOBBBBBO...........",
          ".........OOOOO.OBBBBO...........",
          "................OOOO............",
          "................................",
          "................................",
          "................................"
        ]
      };

      const keys = Object.keys(grids);
      for (const key of keys) {
        const grid = grids[key];
        const g = this.make.graphics({ add: false });

        // Draw pixel shadow
        g.fillStyle(0x000000, 0.3);
        for (let y = 27; y <= 29; y++) {
          const w = y === 27 ? 8 : (y === 28 ? 12 : 10);
          const startX = 16 - Math.floor(w / 2);
          g.fillRect(startX, y, w, 1);
        }

        // Draw grid
        for (let y = 0; y < grid.length; y++) {
          const row = grid[y];
          for (let x = 0; x < row.length; x++) {
            const char = row[x];
            const color = PALETTE[char];
            if (color) {
              g.fillStyle(color, 1);
              g.fillRect(x, y, 1, 1);
            }
          }
        }

        g.generateTexture(key, 32, 32);
        g.destroy();
        nearest(this, key);

        // For right facing, flip the left texture
        if (key.includes('left')) {
          const rightKey = key.replace('left', 'right');
          const rg = this.make.graphics({ add: false });

          rg.fillStyle(0x000000, 0.3);
          for (let y = 27; y <= 29; y++) {
            const w = y === 27 ? 8 : (y === 28 ? 12 : 10);
            const startX = 16 - Math.floor(w / 2);
            rg.fillRect(startX, y, w, 1);
          }

          for (let y = 0; y < grid.length; y++) {
            const row = grid[y];
            for (let x = 0; x < row.length; x++) {
              const char = row[x];
              const color = PALETTE[char];
              if (color) {
                rg.fillStyle(color, 1);
                const px = 31 - x;
                rg.fillRect(px, y, 1, 1);
              }
            }
          }

          rg.generateTexture(rightKey, 32, 32);
          rg.destroy();
          nearest(this, rightKey);
        }
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

      for (let x = 12; x < MAP_WIDTH; x += 24) {
        this.add.image(x, 32, "tree_bg").setDepth(2);
        this.add.image(x, 38, "tree_fg").setDepth(3);
        
        this.add.image(x, MAP_HEIGHT - 32, "tree_bg").setDepth(2);
        this.add.image(x, MAP_HEIGHT - 38, "tree_fg").setDepth(3);
      }

      for (let y = 12; y < MAP_HEIGHT; y += 24) {
        this.add.image(32, y, "tree_bg").setDepth(2);
        this.add.image(38, y, "tree_fg").setDepth(3);

        this.add.image(MAP_WIDTH - 32, y, "tree_bg").setDepth(2);
        this.add.image(MAP_WIDTH - 38, y, "tree_fg").setDepth(3);
      }

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
      
      // Match physics body to the feet of the new sprite
      this.player.body.setSize(12, 6);
      this.player.body.setOffset(10, 23);
      
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
      if (this.keys || !this.input.keyboard) return;
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
        }
        this.player.setTexture(`player-idle-${this.lastDir}`);
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
