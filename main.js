/* Goat Guardian — v1 (2.5D Isométrico / Phaser 3)
   - Estética: base para semi-realista (arte pode vir depois)
   - “Câmera inclinada” simulada: escala por Y mais forte + eixo Y “achatado”
   - Profundidade: depth(Y) + scale(Y) + sombras + overlay de atmosfera (leve)
   - Minimap no topo ESQUERDO
   - Desktop + Mobile (joystick + botões)
*/

const GAME_W = 1280;
const GAME_H = 720;

const WORLD_W = 3000;
const WORLD_H = 2000;

// ====== Regras do seu conceito ======
const PLAYER_MAX_HP = 10;

// Cada ataque tira 1 “hit” (reduz 1 HP do bode)
const ENEMY_DEFS = {
  brown:  { hp: 1, damage: 1, speed: 85,  tint: 0x8b5a2b, label: "Bode Marrom" },
  orange: { hp: 3, damage: 2, speed: 75,  tint: 0xff8c00, label: "Bode Laranja" },
  blue:   { hp: 5, damage: 3, speed: 70,  tint: 0x2e86ff, label: "Bode Azul" },
  black:  { hp: 5, damage: 5, speed: 65,  tint: 0x111111, label: "Bode Preto Gigante" },
};

const PHASE_V1 = {
  brownCount: 10,
  orangeCount: 5,
  hasBlueGeneral: true,
  hasBlackBoss: true
};

// Cura
const FRUIT_HEAL = 2;

// Riacho: +1 por segundo (com cooldown após sair)
const RIVER_HEAL_PER_SEC = 1;
const RIVER_COOLDOWN_MS = 5000;
const RIVER_TICK_MS = 250; // acumula até virar 1 segundo

// Ataques
const COOLDOWN_HORN = 500;
const COOLDOWN_KICK = 750;
const IFRAME_MS = 600;      // invencibilidade pós-dano
const KNOCKBACK = 220;

// ====== Phaser Config ======
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
      { key: "rexVirtualJoystick", plugin: rexvirtualjoystickplugin, start: true }
    ]
  },
  scene: []
};

// ====== Helpers (2.5D) ======
function yToScale(y) {
  // MAIS variação = MAIS sensação de profundidade (longe menor / perto maior)
  const t = Phaser.Math.Clamp(y / WORLD_H, 0, 1);
  return 0.70 + t * 0.55; // 0.70 .. 1.25  (antes era mais “leve”)
}

function setIsoDepthAndScale(sprite, shadow) {
  sprite.setDepth(sprite.y);
  const s = yToScale(sprite.y);
  sprite.setScale(s);
  if (shadow) {
    shadow.setDepth(sprite.depth - 1);
    shadow.setScale(s);
    shadow.setPosition(sprite.x, sprite.y + 18 * s);
  }
}

function isoVectorFromInput(dx, dy) {
  // “Câmera inclinada” simulada:
  // - mantemos vx forte
  // - “achatamos” vy para dar sensação de perspectiva (mundo inclinado)
  const vx = (dx - dy) * 0.7071;
  const vy = (dx + dy) * 0.55; // antes 0.7071, agora 0.55 (mais inclinado)
  return { vx, vy };
}

function clampToWorld(x, y) {
  return {
    x: Phaser.Math.Clamp(x, 24, WORLD_W - 24),
    y: Phaser.Math.Clamp(y, 24, WORLD_H - 24)
  };
}

// ====== Scenes ======
class BootScene extends Phaser.Scene {
  constructor(){ super("BootScene"); }

  preload() {
    // Tenta carregar assets se existirem.
    // Se não existirem (404), o Phaser segue e a gente cria placeholders no create().
    this.load.image("map_bg", "assets/images/map_background.png");
    this.load.image("fruit", "assets/images/fruit.png");

    // Caso você crie sprites depois (mesmo sem transparência), pode pôr aqui:
    this.load.image("player_goat", "assets/images/player_goat.png");
    this.load.image("enemy_brown", "assets/images/bode_marrom.png");
    this.load.image("enemy_orange", "assets/images/bode_laranja.png");
    this.load.image("enemy_blue", "assets/images/bode_azul.png");
    this.load.image("enemy_black", "assets/images/bode_preto_gigante.png");

    this.load.image("tree_big", "assets/images/tree_big.png");
    this.load.image("tree_small", "assets/images/tree_small.png");
    this.load.image("rock_big", "assets/images/rock_big.png");
    this.load.image("rock_small", "assets/images/rock_small.png");
    this.load.image("bush", "assets/images/bush.png");
  }

  create() {
    this.ensurePlaceholderTextures();
    this.scene.start("StartScene");
  }

  ensurePlaceholderTextures() {
    const makeRect = (key, w, h, color) => {
      if (this.textures.exists(key)) return;
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRoundedRect(0, 0, w, h, 10);
      g.generateTexture(key, w, h);
      g.destroy();
    };

    // Fundo fallback (tile verde)
    if (!this.textures.exists("map_bg")) {
      const g = this.add.graphics();
      g.fillStyle(0x2b6b2b, 1);
      g.fillRect(0, 0, 2, 2);
      g.generateTexture("map_bg", 2, 2);
      g.destroy();
    }

    // Player e inimigos (fallbacks)
    makeRect("player_goat", 44, 44, 0xffffff);
    makeRect("enemy_brown", 40, 40, ENEMY_DEFS.brown.tint);
    makeRect("enemy_orange", 44, 44, ENEMY_DEFS.orange.tint);
    makeRect("enemy_blue", 52, 52, ENEMY_DEFS.blue.tint);
    makeRect("enemy_black", 70, 70, 0x222222);

    // Fruta fallback
    if (!this.textures.exists("fruit")) makeRect("fruit", 22, 22, 0xff4d4d);

    // Obstáculos fallback
    makeRect("tree_big", 70, 110, 0x1f4f1f);
    makeRect("tree_small", 52, 80, 0x2f7a2f);
    makeRect("rock_big", 80, 55, 0x888888);
    makeRect("rock_small", 45, 30, 0x777777);
    makeRect("bush", 55, 40, 0x2a8a2a);
  }
}

class StartScene extends Phaser.Scene {
    constructor() {
        super("StartScene");
    }

    create() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        // Fundo simples (independente de assets)
        this.add.rectangle(w / 2, h / 2, w, h, 0x0b1a0b).setScrollFactor(0);

        this.add.text(w / 2, h / 2 - 60, "GOAT GUARDIAN", {
            fontFamily: "Arial",
            fontSize: "54px",
            color: "#ffffff"
        }).setOrigin(0.5);

        const t = this.add.text(w / 2, h / 2 + 40, "Clique / Toque para começar", {
            fontFamily: "Arial",
            fontSize: "26px",
            color: "#ffffff"
        }).setOrigin(0.5);

        this.tweens.add({ targets: t, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

        const startGame = () => {
            console.log("[GoatGuardian] Start pressed -> starting GameScene");
            this.scene.start("GameScene");
        };

        // 1) Área clicável em tela cheia (mais confiável que texto)
        const hit = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.001)
            .setInteractive({ useHandCursor: true });
        hit.on("pointerdown", startGame);

        // 2) Texto também clicável
        t.setInteractive({ useHandCursor: true });
        t.on("pointerdown", startGame);

        // 3) Qualquer input de mouse/toque
        this.input.on("pointerdown", startGame);

        // 4) Teclado: Enter/Espaço/Seta para cima
        this.input.keyboard.on("keydown-ENTER", startGame);
        this.input.keyboard.on("keydown-SPACE", startGame);
        this.input.keyboard.on("keydown-UP", startGame);

        // 5) Fallback: se nada funcionar, inicia sozinho em 2s
        this.time.delayedCall(2000, () => {
            if (this.scene.isActive("StartScene")) {
                console.log("[GoatGuardian] Auto-start fallback");
                startGame();
            }
        });
    }
}

class GameOverScene extends Phaser.Scene {
  constructor(){ super("GameOverScene"); }
  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.add.rectangle(w/2, h/2, w, h, 0x200000).setScrollFactor(0);
    this.add.text(w/2, h/2 - 30, "GAME OVER", {
      fontFamily:"Arial", fontSize:"58px", color:"#fff"
    }).setOrigin(0.5);

    const t = this.add.text(w/2, h/2 + 60, "Tentar de novo", {
      fontFamily:"Arial", fontSize:"28px", color:"#fff"
    }).setOrigin(0.5).setInteractive();

    t.on("pointerdown", () => this.scene.start("GameScene"));
  }
}

class VictoryScene extends Phaser.Scene {
  constructor(){ super("VictoryScene"); }
  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.add.rectangle(w/2, h/2, w, h, 0x002020).setScrollFactor(0);
    this.add.text(w/2, h/2 - 30, "VITÓRIA!", {
      fontFamily:"Arial", fontSize:"58px", color:"#fff"
    }).setOrigin(0.5);

    this.add.text(w/2, h/2 + 20, "Próxima fase em breve: poderes e skins", {
      fontFamily:"Arial", fontSize:"22px", color:"#cfe"
    }).setOrigin(0.5);

    const t = this.add.text(w/2, h/2 + 80, "Jogar novamente", {
      fontFamily:"Arial", fontSize:"28px", color:"#fff"
    }).setOrigin(0.5).setInteractive();

    t.on("pointerdown", () => this.scene.start("GameScene"));
  }
}

class GameScene extends Phaser.Scene {
  constructor(){
    super("GameScene");

    // Estado
    this.hp = PLAYER_MAX_HP;
    this.lastDamageAt = -99999;

    this.lastHornAt = -99999;
    this.lastKickAt = -99999;

    // Riacho
    this.river = null;
    this.riverRect = new Phaser.Geom.Rectangle(520, 420, 320, 720);
    this.riverCanHealAt = 0;
    this.lastRiverTickAt = 0;
    this.inRiver = false;
    this.wasInRiver = false;
    this.riverAccum = 0;

    // Progressão
    this.spawnedBlue = false;
    this.spawnedBlack = false;

    // Grupos
    this.enemies = null;
    this.fruits = null;
    this.obstacles = null;

    // Player
    this.player = null;
    this.playerShadow = null;

    // UI
    this.hpText = null;
    this.remainingText = null;
    this.minimapBox = null;
    this.minimapG = null;

    // Atmosfera (overlay)
    this.atmoOverlay = null;

    // Input
    this.isMobile = false;
    this.joystick = null;
    this.btnHorn = null;
    this.btnKick = null;

    // Hitboxes
    this.hornHit = null;
    this.kickHit = null;

    // Contagem
    this.remainingBrownOrange = 0;
  }

  create() {
    this.isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS;

    // Mundo
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    // Fundo (tileSprite)
    const bg = this.add.tileSprite(0, 0, WORLD_W, WORLD_H, "map_bg").setOrigin(0);
    bg.setDepth(-999);

    // Obstáculos
    this.obstacles = this.physics.add.staticGroup();
    this.placeEnvironment();

    // Riacho (visual simples)
    const riverG = this.add.graphics();
    riverG.fillStyle(0x1b8cff, 0.35);
    riverG.fillRect(this.riverRect.x, this.riverRect.y, this.riverRect.width, this.riverRect.height);
    riverG.setDepth(-500);

    this.river = this.add.zone(this.riverRect.x, this.riverRect.y, this.riverRect.width, this.riverRect.height).setOrigin(0);
    this.physics.world.enable(this.river, Phaser.Physics.Arcade.STATIC_BODY);

    // Player
    this.player = this.physics.add.sprite(WORLD_W/2, WORLD_H/2, "player_goat");
    this.player.setCollideWorldBounds(true);
    this.player.body.setCircle(16, 6, 10);

    // Sombra (maior e mais suave => mais “semi-realista”)
    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 18, 56, 22, 0x000000, 0.28);

    // Câmera
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Grupos
    this.enemies = this.physics.add.group();
    this.fruits = this.physics.add.group();

    // Colliders
    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);

    this.physics.add.overlap(this.player, this.fruits, this.onFruit, null, this);
    this.physics.add.overlap(this.player, this.river, () => { this.inRiver = true; }, null, this);

    // Hitboxes de ataque (sprites invisíveis)
    this.hornHit = this.physics.add.sprite(0, 0, "player_goat").setVisible(false);
    this.kickHit = this.physics.add.sprite(0, 0, "player_goat").setVisible(false);
    this.hornHit.body.setAllowGravity(false);
    this.kickHit.body.setAllowGravity(false);
    this.hornHit.body.enable = false;
    this.kickHit.body.enable = false;

    this.physics.add.overlap(this.hornHit, this.enemies, (hit, enemy) => this.hitEnemy(enemy), null, this);
    this.physics.add.overlap(this.kickHit, this.enemies, (hit, enemy) => this.hitEnemy(enemy), null, this);

    // Input teclado
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyJ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.keyK = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);

    this.keyJ.on("down", () => this.tryAttack("horn"));
    this.keyK.on("down", () => this.tryAttack("kick"));

    // Mobile controls
    if (this.isMobile) this.createMobileControls();

    // HUD + minimapa (topo esquerdo)
    this.createHUD();

    // Atmosfera (overlay leve no topo da tela)
    this.createAtmosphereOverlay();

    // Spawns iniciais
    this.spawnPhaseV1();

    // Aplica depth+scale inicial
    setIsoDepthAndScale(this.player, this.playerShadow);

    // Estado
    this.hp = PLAYER_MAX_HP;
    this.spawnedBlue = false;
    this.spawnedBlack = false;
    this.riverCanHealAt = 0;
    this.lastRiverTickAt = 0;
    this.riverAccum = 0;

    this.updateHUD();
  }

  placeEnvironment() {
    const place = (key, count) => {
      for (let i = 0; i < count; i++) {
        const x = Phaser.Math.Between(80, WORLD_W - 80);
        const y = Phaser.Math.Between(80, WORLD_H - 80);

        // Evita centro e riacho
        if (Phaser.Math.Distance.Between(x, y, WORLD_W/2, WORLD_H/2) < 260) { i--; continue; }
        if (this.riverRect.contains(x, y)) { i--; continue; }

        const o = this.obstacles.create(x, y, key);
        o.setOrigin(0.5, 1); // pé embaixo
        o.body.setSize(o.width * 0.5, o.height * 0.25).setOffset(o.width*0.25, o.height*0.75);
        o.setDepth(y);
        o.setScale(yToScale(y));
      }
    };

    place("tree_big", 18);
    place("tree_small", 22);
    place("rock_big", 10);
    place("rock_small", 14);
    place("bush", 20);
  }

  createHUD() {
    this.add.rectangle(150, 50, 280, 90, 0x000000, 0.45).setScrollFactor(0).setDepth(999);

    this.hpText = this.add.text(20, 18, "", {
      fontFamily:"Arial",
      fontSize:"22px",
      color:"#bfffbf"
    }).setScrollFactor(0).setDepth(1000);

    this.remainingText = this.add.text(20, 46, "", {
      fontFamily:"Arial",
      fontSize:"20px",
      color:"#ffffff"
    }).setScrollFactor(0).setDepth(1000);

    // Minimap topo esquerdo
    const mmX = 20, mmY = 110, mmS = 160;
    this.minimapBox = this.add.graphics().setScrollFactor(0).setDepth(999);
    this.minimapBox.fillStyle(0x000000, 0.55);
    this.minimapBox.fillRect(mmX, mmY, mmS, mmS);
    this.minimapBox.lineStyle(2, 0xffffff, 1);
    this.minimapBox.strokeRect(mmX, mmY, mmS, mmS);

    this.minimapG = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.mm = { x:mmX, y:mmY, s:mmS, sx:mmS/WORLD_W, sy:mmS/WORLD_H };
  }

  createAtmosphereOverlay() {
    // Overlay em faixas (screen space): dá profundidade (topo mais “lavado”)
    const w = this.game.config.width;
    const h = this.game.config.height;

    this.atmoOverlay = this.add.graphics().setScrollFactor(0).setDepth(1500);
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const alpha = 0.22 * (1 - t);
      const bandH = (h * 0.45) / bands;
      this.atmoOverlay.fillStyle(0xffffff, alpha);
      this.atmoOverlay.fillRect(0, i * bandH, w, bandH);
    }
  }

  createMobileControls() {
    const w = this.game.config.width;
    const h = this.game.config.height;

    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: 170, y: h - 170,
      radius: 90,
      base: this.add.circle(0,0,70,0xffffff,0.10).setScrollFactor(0),
      thumb: this.add.circle(0,0,40,0xffffff,0.18).setScrollFactor(0),
      dir: "8dir",
      force: true
    });

    this.btnHorn = this.add.circle(w - 140, h - 140, 52, 0xffffff, 0.12).setScrollFactor(0).setDepth(2000).setInteractive();
    this.add.text(w - 140, h - 148, "J", { fontFamily:"Arial", fontSize:"24px", color:"#fff" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.btnKick = this.add.circle(w - 260, h - 220, 52, 0xffffff, 0.12).setScrollFactor(0).setDepth(2000).setInteractive();
    this.add.text(w - 260, h - 228, "K", { fontFamily:"Arial", fontSize:"24px", color:"#fff" })
      .setOrigin(0.5).setScrollFactor(0).setDepth(2001);

    this.btnHorn.on("pointerdown", () => this.tryAttack("horn"));
    this.btnKick.on("pointerdown", () => this.tryAttack("kick"));
  }

  spawnPhaseV1() {
    this.remainingBrownOrange = 0;
    for (let i = 0; i < PHASE_V1.brownCount; i++) { this.spawnEnemy("brown"); this.remainingBrownOrange++; }
    for (let i = 0; i < PHASE_V1.orangeCount; i++) { this.spawnEnemy("orange"); this.remainingBrownOrange++; }

    for (let i = 0; i < 8; i++) this.spawnFruit();
  }

  spawnEnemy(type) {
    const def = ENEMY_DEFS[type];

    let x, y;
    do {
      x = Phaser.Math.Between(60, WORLD_W - 60);
      y = Phaser.Math.Between(60, WORLD_H - 60);
    } while (
      Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 340 ||
      this.riverRect.contains(x, y)
    );

    const key =
      type === "brown" ? "enemy_brown" :
      type === "orange"? "enemy_orange":
      type === "blue"  ? "enemy_blue"  :
                         "enemy_black";

    const e = this.enemies.create(x, y, key);
    e.setTint(def.tint);
    e.setCollideWorldBounds(true);

    const radius = (type === "black") ? 22 : 16;
    e.body.setCircle(radius, e.width/2 - radius, e.height/2 - radius);

    e.type = type;
    e.hp = def.hp;
    e.damage = def.damage;
    e.speed = def.speed;
    e.state = "patrol";
    e.patrolTarget = new Phaser.Math.Vector2(x, y);

    const sw = (type === "black") ? 88 : (type === "blue" ? 64 : 54);
    const sh = (type === "black") ? 30 : (type === "blue" ? 24 : 22);
    const sa = (type === "black") ? 0.30 : 0.24;

    e.shadow = this.add.ellipse(e.x, e.y + 18, sw, sh, 0x000000, sa);

    setIsoDepthAndScale(e, e.shadow);
    return e;
  }

  spawnFruit() {
    let x, y;
    do {
      x = Phaser.Math.Between(60, WORLD_W - 60);
      y = Phaser.Math.Between(60, WORLD_H - 60);
    } while (this.riverRect.contains(x, y));

    const f = this.fruits.create(x, y, "fruit");
    f.setDepth(y);
    f.setScale(yToScale(y));
    f.body.setCircle(10, f.width/2 - 10, f.height/2 - 10);
    return f;
  }

  tryAttack(kind) {
    const now = this.time.now;
    if (kind === "horn" && now - this.lastHornAt < COOLDOWN_HORN) return;
    if (kind === "kick" && now - this.lastKickAt < COOLDOWN_KICK) return;

    if (kind === "horn") this.lastHornAt = now;
    else this.lastKickAt = now;

    const facingLeft = (this.player.body.velocity.x < -5) || (this.player.flipX === true);
    const dir = facingLeft ? -1 : 1;

    const hit = (kind === "horn") ? this.hornHit : this.kickHit;

    const w = (kind === "horn") ? 60 : 52;
    const h = 34;

    const ox = (kind === "horn") ? 38 * dir : 22 * dir;
    const oy = (kind === "horn") ? -10 : 12;

    hit.body.enable = true;
    hit.setPosition(this.player.x + ox, this.player.y + oy);
    hit.body.setSize(w, h, true);

    this.player.setTint(kind === "horn" ? 0xffffcc : 0xccffff);
    this.time.delayedCall(90, () => this.player.setTint(0xffffff));

    this.time.delayedCall(160, () => { hit.body.enable = false; });
  }

  hitEnemy(enemy) {
    if (!enemy.active) return;

    const now = this.time.now;
    if (enemy.lastHitAt && now - enemy.lastHitAt < 220) return;
    enemy.lastHitAt = now;

    enemy.hp -= 1;

    const dx = enemy.x - this.player.x;
    const dy = enemy.y - this.player.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    enemy.body.velocity.x += (dx/len) * KNOCKBACK;
    enemy.body.velocity.y += (dy/len) * KNOCKBACK;

    enemy.setTint(0xff5555);
    this.time.delayedCall(80, () => enemy.setTint(ENEMY_DEFS[enemy.type].tint));

    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  killEnemy(enemy) {
    if (!enemy.active) return;
    enemy.disableBody(true, true);
    if (enemy.shadow) enemy.shadow.destroy();

    if (enemy.type === "brown" || enemy.type === "orange") {
      this.remainingBrownOrange--;
    }

    if (enemy.type === "blue") {
      this.spawnedBlue = true;
    }

    this.updateHUD();
  }

  damagePlayer(amount, fromEnemy) {
    const now = this.time.now;
    if (now - this.lastDamageAt < IFRAME_MS) return;

    this.lastDamageAt = now;
    this.hp = Math.max(0, this.hp - amount);

    if (fromEnemy) {
      const dx = this.player.x - fromEnemy.x;
      const dy = this.player.y - fromEnemy.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      this.player.body.velocity.x += (dx/len) * KNOCKBACK;
      this.player.body.velocity.y += (dy/len) * KNOCKBACK;
    }

    this.player.setTint(0xff4444);
    this.time.delayedCall(90, () => this.player.setTint(0xffffff));
  }

  onFruit(player, fruit) {
    fruit.disableBody(true, true);
    this.hp = Math.min(PLAYER_MAX_HP, this.hp + FRUIT_HEAL);
    this.updateHUD();

    this.time.delayedCall(2500, () => this.spawnFruit());
  }

  update(time) {
    if (!this.player || this.hp <= 0) return;

    this.inRiver = false;

    let dx = 0, dy = 0;

    if (this.isMobile && this.joystick) {
      const fx = this.joystick.forceX;
      const fy = this.joystick.forceY;
      const mag = Math.hypot(fx, fy);
      if (mag > 0.001) {
        dx = Phaser.Math.Clamp(fx / 100, -1, 1);
        dy = Phaser.Math.Clamp(fy / 100, -1, 1);
      }
    } else {
      if (this.cursors.left.isDown || this.keyA.isDown) dx = -1;
      else if (this.cursors.right.isDown || this.keyD.isDown) dx = 1;

      if (this.cursors.up.isDown || this.keyW.isDown) dy = -1;
      else if (this.cursors.down.isDown || this.keyS.isDown) dy = 1;
    }

    const iso = isoVectorFromInput(dx, dy);
    const speed = 200;

    this.player.setVelocity(iso.vx * speed, iso.vy * speed);

    if (iso.vx < -0.05) this.player.setFlipX(true);
    else if (iso.vx > 0.05) this.player.setFlipX(false);

    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      this.enemyAI(e, time);
      setIsoDepthAndScale(e, e.shadow);
    });

    setIsoDepthAndScale(this.player, this.playerShadow);

    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      if (Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y) < 28) {
        this.damagePlayer(e.damage, e);
      }
    });

    this.handleRiverHealing(time);
    this.handleSpawns();
    this.drawMinimap();
    this.updateHUD();

    if (this.hp <= 0) {
      this.scene.start("GameOverScene");
    }
  }

  enemyAI(enemy, time) {
    const dist = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);

    const pursuitRange = (enemy.type === "black") ? 460 : 360;
    const attackRange  = (enemy.type === "black") ? 60  : 46;

    if (dist < attackRange) enemy.state = "attack";
    else if (dist < pursuitRange) enemy.state = "pursuit";
    else enemy.state = "patrol";

    if (enemy.state === "attack") {
      enemy.setVelocity(0);
      return;
    }

    if (enemy.state === "pursuit") {
      const wobble = Math.sin((time + enemy.x) / 350) * 18;
      const tx = this.player.x + wobble;
      const ty = this.player.y - wobble;
      this.physics.moveTo(enemy, tx, ty, enemy.speed);
      return;
    }

    const d2 = Phaser.Math.Distance.Between(enemy.x, enemy.y, enemy.patrolTarget.x, enemy.patrolTarget.y);
    if (d2 < 18) {
      const nx = enemy.x + Phaser.Math.Between(-160, 160);
      const ny = enemy.y + Phaser.Math.Between(-160, 160);
      const p = clampToWorld(nx, ny);
      if (this.riverRect.contains(p.x, p.y)) enemy.patrolTarget.set(enemy.x, enemy.y);
      else enemy.patrolTarget.set(p.x, p.y);
    }
    this.physics.moveTo(enemy, enemy.patrolTarget.x, enemy.patrolTarget.y, enemy.speed * 0.6);
  }

  handleRiverHealing(time) {
    if (!this.inRiver) {
      if (this.wasInRiver) this.riverCanHealAt = time + RIVER_COOLDOWN_MS;
      this.wasInRiver = false;
      return;
    }
    this.wasInRiver = true;

    if (time < this.riverCanHealAt) return;
    if (this.hp >= PLAYER_MAX_HP) return;

    if (time - this.lastRiverTickAt >= RIVER_TICK_MS) {
      this.riverAccum += RIVER_TICK_MS;

      if (this.riverAccum >= 1000) {
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + RIVER_HEAL_PER_SEC);
        this.riverAccum = 0;
      }
      this.lastRiverTickAt = time;
    }
  }

  handleSpawns() {
    if (PHASE_V1.hasBlueGeneral && !this.spawnedBlue && this.remainingBrownOrange <= 0) {
      this.spawnEnemy("blue");
      this.spawnedBlue = true;
      this.flashCenter("GENERAL AZUL!");
    }

    const hasAnyBlueAlive = this.enemies.getChildren().some(e => e.active && e.type === "blue");
    if (PHASE_V1.hasBlackBoss && this.spawnedBlue && !hasAnyBlueAlive && !this.spawnedBlack) {
      this.spawnEnemy("black");
      this.spawnedBlack = true;
      this.flashCenter("CHEFÃO PRETO!");
    }

    const hasBlackAlive = this.enemies.getChildren().some(e => e.active && e.type === "black");
    if (this.spawnedBlack && !hasBlackAlive) {
      this.scene.start("VictoryScene");
    }
  }

  flashCenter(txt) {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const t = this.add.text(w/2, h/2, txt, {
      fontFamily:"Arial",
      fontSize:"56px",
      color:"#fff"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);

    this.tweens.add({ targets: t, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  updateHUD() {
    this.hpText.setText(`HP: ${this.hp}/${PLAYER_MAX_HP}`);

    const aliveEnemies = this.enemies.getChildren().filter(e => e.active).length;
    let phaseTxt = "Fase 1";
    if (!this.spawnedBlue) phaseTxt += " (Marrons/Laranjas)";
    else if (!this.spawnedBlack) phaseTxt += " (General Azul)";
    else phaseTxt += " (Chefão Preto)";

    this.remainingText.setText(`${phaseTxt}\nInimigos vivos: ${aliveEnemies}`);
  }

  drawMinimap() {
    const { x, y, sx, sy } = this.mm;

    this.minimapG.clear();

    this.minimapG.fillStyle(0x1b8cff, 0.6);
    this.minimapG.fillRect(
      x + this.riverRect.x * sx,
      y + this.riverRect.y * sy,
      this.riverRect.width * sx,
      this.riverRect.height * sy
    );

    this.minimapG.fillStyle(0x00ff66, 1);
    this.minimapG.fillRect(x + this.player.x*sx - 2, y + this.player.y*sy - 2, 4, 4);

    this.enemies.getChildren().forEach((e) => {
      if (!e.active) return;
      let c = 0xff3333;
      if (e.type === "blue") c = 0x2e86ff;
      if (e.type === "black") c = 0x999999;
      this.minimapG.fillStyle(c, 1);
      this.minimapG.fillRect(x + e.x*sx - 1, y + e.y*sy - 1, 2, 2);
    });
  }
}

// Scenes
config.scene = [BootScene, StartScene, GameScene, GameOverScene, VictoryScene];

// Start
new Phaser.Game(config);
