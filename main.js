/* Goat Guardian — v1 (2.5D Isométrico / Phaser 3)
   - Correção do erro RexPlugins (joystick)
   - 2.5D com profundidade simulada
*/

const GAME_W = 1280;
const GAME_H = 720;

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: "game-container",
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  plugins: {
    scene: [
      {
        key: "rexVirtualJoystick",
        plugin: rexvirtualjoystickplugin,
        start: true
      }
    ]
  },
  scene: []
};

class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }
  preload() {
    this.load.image("player_goat", "assets/images/player_goat.png");
  }
  create() {
    this.scene.start("GameScene");
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super("GameScene"); }
  create() {
    this.add.text(400, 300, "Goat Guardian funcionando!", {
      fontSize: "32px",
      color: "#ffffff"
    });
  }
}

config.scene = [BootScene, GameScene];
new Phaser.Game(config);
