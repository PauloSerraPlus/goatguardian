/* Goat Guardian — v1.2 (ajustes de jogabilidade e visual)
   1) Frutas e moitas menores
   2) Obstáculos mais espaçados (melhor fluxo)
   3) Riacho com visual melhor (faixa + bordas + brilho)
   4) Cura mais confiável + feedback visual (brilho/pulso + texto +HP)
   5) Abertura com logo + botão INICIAR + crédito
   6) Mobile/tablet: touch confiável + joystick + botões + responsivo (FIT)
*/

console.log("[GoatGuardian] BUILD v1.2 loaded");

const GAME_W = 1280;
const GAME_H = 720;

// Mundo
const WORLD_W = 2600;
const WORLD_H = 1800;

// Player
const PLAYER_SPEED = 210;
const PLAYER_MAX_HP = 10;

// Cura
const FRUIT_HEAL = 2;
const RIVER_HEAL = 1;
const RIVER_TICK_MS = 350;

// Combate (simples)
const COOLDOWN_HORN = 450;
const COOLDOWN_KICK = 650;
const INVULN_MS = 500;

// Inimigos (conceito)
const ENEMIES = {
  marrom:  { hp: 1, dmg: 1, spd: 98,  tint: 0x8b5a2b },
  laranja: { hp: 3, dmg: 2, spd: 86,  tint: 0xff8c00 },
  azul:    { hp: 5, dmg: 3, spd: 80,  tint: 0x2e86ff },
  preto:   { hp: 5, dmg: 5, spd: 74,  tint: 0x111111 }
};

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// Isométrico "fake": profundidade e escala por Y
function yToScale(y){
  const t = clamp(y / WORLD_H, 0, 1);
  return 0.72 + t * 0.38;
}
function setIso(sprite){
  sprite.setDepth(sprite.y);
  sprite.setScale(yToScale(sprite.y) * 0.72);
}
function isoVel(dx, dy){
  return { vx: (dx - dy) * 0.95, vy: (dx + dy) * 0.62 };
}

function floatText(scene, x, y, msg, color="#ffffff"){
  const t = scene.add.text(x, y, msg, {
    fontFamily:"Arial",
    fontSize:"18px",
    color,
    stroke:"#000",
    strokeThickness:3
  }).setOrigin(0.5).setDepth(99999);

  scene.tweens.add({
    targets:t,
    y:y-35,
    alpha:0,
    duration:700,
    ease:"Sine.easeOut",
    onComplete:()=>t.destroy()
  });
}

// ------------- Phaser config -------------
const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: "game-container",
  backgroundColor: "#0b0f0b",
  physics: {
    default: "arcade",
    arcade: { gravity:{y:0}, debug:false }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  plugins: {
    scene: [
      { key:"rexVirtualJoystick", plugin: rexvirtualjoystickplugin, start:true }
    ]
  },
  scene: []
};

// ------------- Scenes -------------
class PreloadScene extends Phaser.Scene{
  constructor(){ super("PreloadScene"); }
  preload(){
    const w=this.cameras.main.width, h=this.cameras.main.height;
    this.add.text(w/2, h/2, "Carregando...", {fontSize:"28px", color:"#fff"}).setOrigin(0.5);

    // LOGO: suba como assets/images/logo_goat_guardian.png
    this.load.image("logo", "assets/images/logo_goat_guardian.png");

    // Assets do jogo
    this.load.image("bg", "assets/images/map_background.png");
    this.load.image("goat", "assets/images/player_goat.png");
    this.load.image("bode_marrom", "assets/images/bode_marrom.png");
    this.load.image("bode_laranja", "assets/images/bode_laranja.png");
    this.load.image("bode_azul", "assets/images/bode_azul.png");
    this.load.image("bode_preto", "assets/images/bode_preto_gigante.png");

    this.load.image("fruit", "assets/images/fruit.png");
    this.load.image("tree_big", "assets/images/tree_big.png");
    this.load.image("tree_small", "assets/images/tree_small.png");
    this.load.image("rock_big", "assets/images/rock_big.png");
    this.load.image("rock_small", "assets/images/rock_small.png");
    this.load.image("bush", "assets/images/bush.png");
  }
  create(){ this.scene.start("StartScene"); }
}

class StartScene extends Phaser.Scene{
  constructor(){ super("StartScene"); }
  create(){
    const w=this.cameras.main.width, h=this.cameras.main.height;

    this.add.rectangle(w/2, h/2, w, h, 0x0b0f0b);

    const logo = this.add.image(w/2, h/2 - 70, "logo").setOrigin(0.5);
    logo.setScale(Math.min(1.0, (w*0.78)/logo.width));

    const btnW = 260, btnH = 68;
    const btn = this.add.rectangle(w/2, h/2 + 120, btnW, btnH, 0x24D8FC, 1).setStrokeStyle(3, 0xffffff, 1);
    const txt = this.add.text(w/2, h/2 + 120, "INICIAR", {fontSize:"28px", color:"#001018", fontStyle:"bold"}).setOrigin(0.5);

    this.add.text(w/2, h - 26, "Idealizado e criado por Bernardo Barrocas", {
      fontSize:"14px", color:"#d7d7d7"
    }).setOrigin(0.5);

    // Área clicável full screen (mobile-friendly)
    const hit = this.add.rectangle(w/2, h/2, w, h, 0x000000, 0.001).setInteractive();
    btn.setInteractive({useHandCursor:true});
    txt.setInteractive({useHandCursor:true});

    const startGame = () => {
      console.log("[GoatGuardian] start pressed");
      this.scene.start("GameScene");
    };

    hit.on("pointerdown", startGame);
    btn.on("pointerdown", startGame);
    txt.on("pointerdown", startGame);

    this.input.keyboard?.on("keydown-ENTER", startGame);
    this.input.keyboard?.on("keydown-SPACE", startGame);
  }
}

class GameScene extends Phaser.Scene{
  constructor(){ super("GameScene"); }

  create(){
    this.isMobile = this.sys.game.device.os.android || this.sys.game.device.os.iOS || this.sys.game.device.os.iPad;
    console.log("[GoatGuardian] isMobile:", this.isMobile);

    this.physics.world.setBounds(0,0,WORLD_W,WORLD_H);

    // Background
    this.add.image(0,0,"bg").setOrigin(0,0).setDepth(-100);

    // River visual
    this.riverPath = new Phaser.Geom.Rectangle(1050, 250, 360, 1250);
    this.riverGfx = this.add.graphics().setDepth(-50);
    this.drawRiver();

    this.riverZone = this.add.zone(this.riverPath.x, this.riverPath.y, this.riverPath.width, this.riverPath.height).setOrigin(0,0);
    this.physics.add.existing(this.riverZone, true);

    // Player
    this.playerHp = PLAYER_MAX_HP;
    this.player = this.physics.add.image(WORLD_W*0.45, WORLD_H*0.62, "goat");
    this.player.setCollideWorldBounds(true);
    this.player.body.setSize(this.player.width*0.35, this.player.height*0.25, true);
    this.player.body.setOffset(this.player.width*0.325, this.player.height*0.62);
    setIso(this.player);

    this.lastHit = 0;
    this.lastHorn = 0;
    this.lastKick = 0;

    this.obstacles = this.physics.add.staticGroup();
    this.fruits = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group();

    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);

    this.physics.add.overlap(this.player, this.fruits, this.onFruit, null, this);
    this.physics.add.overlap(this.player, this.riverZone, ()=>{ this.inRiver = true; }, null, this);

    // Attack box
    this.attackBox = this.add.rectangle(0,0,90,70,0xff0000,0).setDepth(9999);
    this.physics.add.existing(this.attackBox);
    this.attackBox.body.setAllowGravity(false);
    this.attackBox.body.enable = false;
    this.physics.add.overlap(this.attackBox, this.enemies, this.onHitEnemy, null, this);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey("W");
    this.keyA = this.input.keyboard.addKey("A");
    this.keyS = this.input.keyboard.addKey("S");
    this.keyD = this.input.keyboard.addKey("D");
    this.keyJ = this.input.keyboard.addKey("J");
    this.keyK = this.input.keyboard.addKey("K");
    this.keyJ.on("down", ()=>this.tryAttack("horn"));
    this.keyK.on("down", ()=>this.tryAttack("kick"));

    if(this.isMobile){
      this.setupMobileControls();
    }

    // HUD
    this.hud = this.add.container(16, 14).setScrollFactor(0).setDepth(99999);
    const hudBg = this.add.rectangle(0,0,260,48,0x000000,0.45).setOrigin(0,0);
    this.hpText = this.add.text(10,10,"HP: "+this.playerHp, {fontSize:"20px", color:"#ffffff"});
    this.hpBarBg = this.add.rectangle(70, 34, 170, 10, 0x333333, 1).setOrigin(0,0.5);
    this.hpBar = this.add.rectangle(70, 34, 170, 10, 0x24d8fc, 1).setOrigin(0,0.5);
    this.hud.add([hudBg, this.hpText, this.hpBarBg, this.hpBar]);

    this.drinkText = this.add.text(GAME_W/2, 16, "", {fontSize:"18px", color:"#aee7ff", stroke:"#000", strokeThickness:3})
      .setOrigin(0.5,0).setScrollFactor(0).setDepth(99999);

    // Camera
    this.cameras.main.setBounds(0,0,WORLD_W,WORLD_H);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Spawn
    this.spawnEnvironment();
    this.spawnFruits(10);
    this.spawnWave();

    this.inRiver = false;
    this.lastRiverTick = 0;
    this.spawnedGeneral = false;
  }

  drawRiver(){
    const g = this.riverGfx;
    g.clear();

    g.fillStyle(0x9fe8ff, 0.40);
    g.fillRoundedRect(this.riverPath.x-10, this.riverPath.y-10, this.riverPath.width+20, this.riverPath.height+20, 34);

    g.fillStyle(0x1c9bd6, 0.55);
    g.fillRoundedRect(this.riverPath.x, this.riverPath.y, this.riverPath.width, this.riverPath.height, 28);

    g.lineStyle(2, 0xd7fbff, 0.25);
    for(let i=0;i<18;i++){
      const yy = this.riverPath.y + 30 + i*65;
      g.beginPath();
      g.moveTo(this.riverPath.x+25, yy);
      g.lineTo(this.riverPath.x+this.riverPath.width-25, yy+Phaser.Math.Between(-10,10));
      g.strokePath();
    }
  }

  setupMobileControls(){
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: 130,
      y: GAME_H - 130,
      radius: 90,
      base: this.add.circle(0,0,52,0xffffff,0.12).setScrollFactor(0),
      thumb: this.add.circle(0,0,28,0xffffff,0.22).setScrollFactor(0),
      dir: "8dir",
      force: false
    }).setScrollFactor(0).setDepth(99999);

    const mkBtn = (x,y,label) => {
      const bg = this.add.circle(x,y,44,0x24d8fc,0.75).setScrollFactor(0).setDepth(99999).setInteractive();
      const tx = this.add.text(x,y,label,{fontSize:"18px", color:"#001018", fontStyle:"bold"}).setOrigin(0.5).setScrollFactor(0).setDepth(100000).setInteractive();
      bg.on("pointerdown", ()=>tx.emit("pointerdown"));
      return {bg, tx};
    };

    const b1 = mkBtn(GAME_W - 130, GAME_H - 140, "J");
    const b2 = mkBtn(GAME_W - 240, GAME_H - 240, "K");
    b1.tx.on("pointerdown", ()=>this.tryAttack("horn"));
    b2.tx.on("pointerdown", ()=>this.tryAttack("kick"));
  }

  spawnEnvironment(){
    const points = [];
    const addPoint = (x,y,minDist)=>{
      for(const p of points){
        if(Phaser.Math.Distance.Between(x,y,p.x,p.y) < minDist) return false;
      }
      points.push({x,y});
      return true;
    };

    const tryPlace = (key, count, minDist, scaleMult)=>{
      for(let i=0;i<count;i++){
        let tries=0, placed=false;
        while(tries<300 && !placed){
          tries++;
          const x = Phaser.Math.Between(120, WORLD_W-120);
          const y = Phaser.Math.Between(120, WORLD_H-120);

          if(Phaser.Math.Distance.Between(x,y,this.player.x,this.player.y) < 260) continue;
          if(Phaser.Geom.Rectangle.ContainsPoint(this.riverPath, new Phaser.Geom.Point(x,y))) continue;
          if(!addPoint(x,y,minDist)) continue;

          const o = this.obstacles.create(x,y,key);
          o.setOrigin(0.5,1);
          const s = yToScale(y) * scaleMult;
          o.setScale(s);
          o.refreshBody();
          o.body.setSize(o.width*0.22, o.height*0.18, true);
          o.body.setOffset(o.width*0.39, o.height*0.78);
          o.setDepth(y - 25);
          o.setAlpha(0.90);
          placed=true;
        }
      }
    };

    tryPlace("tree_big",   10, 260, 0.62);
    tryPlace("tree_small", 14, 210, 0.58);
    tryPlace("rock_big",    8, 240, 0.55);
    tryPlace("rock_small", 12, 190, 0.52);
    tryPlace("bush",       16, 180, 0.40);
  }

  spawnFruits(count){
    for(let i=0;i<count;i++){
      let tries=0;
      while(tries<200){
        tries++;
        const x = Phaser.Math.Between(140, WORLD_W-140);
        const y = Phaser.Math.Between(140, WORLD_H-140);
        if(Phaser.Math.Distance.Between(x,y,this.player.x,this.player.y) < 160) continue;
        if(Phaser.Geom.Rectangle.ContainsPoint(this.riverPath, new Phaser.Geom.Point(x,y))) continue;

        const f = this.fruits.create(x,y,"fruit");
        f.setOrigin(0.5,0.75);
        const s = yToScale(y) * 0.18;
        f.setScale(s);
        f.setDepth(y+5);
        f.refreshBody();
        const bw = Math.max(18, f.displayWidth*0.45);
        const bh = Math.max(18, f.displayHeight*0.45);
        f.body.setSize(bw, bh, false);
        f.body.setOffset((f.displayWidth-bw)/2, (f.displayHeight-bh)/2);
        f.body.setAllowGravity(false);

        this.tweens.add({ targets:f, scale: s*1.10, duration: 600, yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
        break;
      }
    }
  }

  spawnWave(){
    this.remaining = 0;

    const spawnEnemy = (key, type, x, y)=>{
      const e = this.enemies.create(x,y,key);
      e.setOrigin(0.5,0.8);
      e.type = type;
      e.hp = ENEMIES[type].hp;
      e.dmg = ENEMIES[type].dmg;
      e.spd = ENEMIES[type].spd;
      e.setTint(ENEMIES[type].tint);
      e.setCollideWorldBounds(true);
      e.body.setSize(e.width*0.32, e.height*0.24, true);
      e.body.setOffset(e.width*0.34, e.height*0.58);
      setIso(e);
      return e;
    };

    const randSpawn = ()=>{
      let x,y,tries=0;
      while(tries<300){
        tries++;
        x = Phaser.Math.Between(80, WORLD_W-80);
        y = Phaser.Math.Between(80, WORLD_H-80);
        if(Phaser.Math.Distance.Between(x,y,this.player.x,this.player.y) < 420) continue;
        if(Phaser.Geom.Rectangle.ContainsPoint(this.riverPath, new Phaser.Geom.Point(x,y))) continue;
        break;
      }
      return {x,y};
    };

    const make = (type, count, key)=>{
      for(let i=0;i<count;i++){
        const p = randSpawn();
        spawnEnemy(key, type, p.x, p.y);
        this.remaining++;
      }
    };

    make("marrom",  10, "bode_marrom");
    make("laranja",  5, "bode_laranja");
  }

  tryAttack(kind){
    const now = this.time.now;
    if(kind==="horn" && now - this.lastHorn < COOLDOWN_HORN) return;
    if(kind==="kick" && now - this.lastKick < COOLDOWN_KICK) return;

    if(kind==="horn") this.lastHorn = now;
    if(kind==="kick") this.lastKick = now;

    const dir = this.lastMoveDir || {x:1,y:0};
    const ax = this.player.x + dir.x * 55;
    const ay = this.player.y + dir.y * 40;

    this.attackBox.x = ax;
    this.attackBox.y = ay;
    this.attackBox.body.enable = true;
    this.attackBox.body.reset(ax, ay);

    this.time.delayedCall(120, ()=>{ this.attackBox.body.enable = false; }, [], this);
  }

  onHitEnemy(attackBox, enemy){
    if(enemy._lastHit && this.time.now - enemy._lastHit < 180) return;
    enemy._lastHit = this.time.now;

    enemy.hp -= 1;
    enemy.setTint(0xff3333);
    this.time.delayedCall(90, ()=>enemy.setTint(ENEMIES[enemy.type].tint), [], this);

    if(enemy.hp <= 0){
      enemy.disableBody(true,true);
      this.remaining--;
      floatText(this, enemy.x, enemy.y-30, "+1", "#ffeaa7");
    }
  }

  onFruit(player, fruit){
    fruit.disableBody(true,true);
    this.heal(FRUIT_HEAL, fruit.x, fruit.y);

    this.time.delayedCall(6500, ()=>{
      const f = this.fruits.create(fruit.x, fruit.y, "fruit");
      f.setOrigin(0.5,0.75);
      const s = yToScale(fruit.y) * 0.18;
      f.setScale(s);
      f.setDepth(fruit.y+5);
      f.refreshBody();
      const bw = Math.max(18, f.displayWidth*0.45);
      const bh = Math.max(18, f.displayHeight*0.45);
      f.body.setSize(bw, bh, false);
      f.body.setOffset((f.displayWidth-bw)/2, (f.displayHeight-bh)/2);
      this.tweens.add({ targets:f, scale: s*1.10, duration: 600, yoyo:true, repeat:-1, ease:"Sine.easeInOut" });
    });
  }

  heal(amount, x, y){
    const before = this.playerHp;
    this.playerHp = clamp(this.playerHp + amount, 0, PLAYER_MAX_HP);
    const gained = this.playerHp - before;
    if(gained > 0){
      floatText(this, x, y-25, `+${gained} HP`, "#9fe8ff");
      this.hudFlash();
      this.updateHud();
    }
  }

  hudFlash(){
    this.hud.setAlpha(1);
    this.tweens.add({ targets:this.hud, alpha:0.85, duration:120, yoyo:true, repeat:1 });
  }

  updateHud(){
    this.hpText.setText("HP: " + this.playerHp);
    const pct = this.playerHp / PLAYER_MAX_HP;
    this.hpBar.width = 170 * pct;
  }

  update(time, delta){
    this.inRiver = false;

    let dx=0, dy=0;

    if(this.isMobile && this.joystick){
      const f = this.joystick.force;
      if(f > 0.05){
        dx = this.joystick.deltaX / 100;
        dy = this.joystick.deltaY / 100;
        dx = clamp(dx, -1, 1);
        dy = clamp(dy, -1, 1);
      }
    }else{
      if(this.cursors.left.isDown || this.keyA.isDown) dx -= 1;
      if(this.cursors.right.isDown || this.keyD.isDown) dx += 1;
      if(this.cursors.up.isDown || this.keyW.isDown) dy -= 1;
      if(this.cursors.down.isDown || this.keyS.isDown) dy += 1;
    }

    if(dx!==0 || dy!==0){
      const len = Math.hypot(dx,dy);
      dx/=len; dy/=len;
      const v = isoVel(dx,dy);
      this.lastMoveDir = { x: v.vx, y: v.vy };
    }

    const vv = isoVel(dx,dy);
    this.player.setVelocity(vv.vx * PLAYER_SPEED, vv.vy * PLAYER_SPEED);
    setIso(this.player);

    // Fade obstacles behind player
    this.obstacles.getChildren().forEach(o=>{
      const dy2 = this.player.y - o.y;
      const dx2 = Math.abs(this.player.x - o.x);
      if(dy2 < -10 && dx2 < 90){
        o.setAlpha(0.45);
      }else{
        o.setAlpha(0.90);
      }
    });

    // Enemies AI
    this.enemies.getChildren().forEach(e=>{
      if(!e.active) return;
      const d = Phaser.Math.Distance.Between(e.x,e.y,this.player.x,this.player.y);

      if(d < 50){
        e.setVelocity(0,0);
        if(time - this.lastHit > INVULN_MS){
          this.lastHit = time;
          this.playerHp = clamp(this.playerHp - e.dmg, 0, PLAYER_MAX_HP);
          floatText(this, this.player.x, this.player.y-30, `-${e.dmg}`, "#ffb3b3");
          this.updateHud();
          this.player.setTint(0xff6666);
          this.time.delayedCall(120, ()=>this.player.clearTint());
        }
      }else if(d < 480){
        this.physics.moveToObject(e, this.player, e.spd);
      }else{
        e.setVelocity(0,0);
      }

      setIso(e);
    });

    // River healing tick
    if(this.inRiver){
      this.drinkText.setText("BEBENDO NO RIACHO...");
      this.riverGfx.setAlpha(0.92);

      if(time - this.lastRiverTick > RIVER_TICK_MS){
        this.lastRiverTick = time;
        this.heal(RIVER_HEAL, this.player.x, this.player.y);
      }
    }else{
      this.drinkText.setText("");
      this.riverGfx.setAlpha(1);
    }

    // General spawn
    if(this.remaining <= 0 && !this.spawnedGeneral){
      this.spawnedGeneral = true;
      const p = { x: Phaser.Math.Between(120, WORLD_W-120), y: Phaser.Math.Between(120, WORLD_H-120) };
      const g = this.enemies.create(p.x, p.y, "bode_azul");
      g.setOrigin(0.5,0.8);
      g.type="azul";
      g.hp=ENEMIES.azul.hp;
      g.dmg=ENEMIES.azul.dmg;
      g.spd=ENEMIES.azul.spd;
      g.setTint(ENEMIES.azul.tint);
      g.setCollideWorldBounds(true);
      g.body.setSize(g.width*0.34, g.height*0.26, true);
      g.body.setOffset(g.width*0.33, g.height*0.56);
      setIso(g);
      this.remaining = 1;
      floatText(this, this.player.x, this.player.y-60, "GENERAL CHEGOU!", "#9fe8ff");
    }

    // Game over (volta pro menu)
    if(this.playerHp <= 0){
      this.scene.start("StartScene");
    }
  }
}

config.scene = [PreloadScene, StartScene, GameScene];
new Phaser.Game(config);
