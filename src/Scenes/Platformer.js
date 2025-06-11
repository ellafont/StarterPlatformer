// Import global variables
import { my, cursors, SCALE } from '../globals.js';

// Import game entities
import { Enemy, Walkabot, SpikeSentry } from '../Entities/Enemy.js';
import MovingPlatform from '../Entities/MovingPlatform.js';
import PowerUp from '../Entities/PowerUp.js';

class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    preload() {
        // Load the AnimatedTiles plugin for this scene
        this.load.scenePlugin('AnimatedTiles', '../lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    init() {
        // Variables and settings
        this.ACCELERATION = 500;
        this.DRAG = 1400;
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -900;
        this.DROWNING_DURATION = 1500; // Used for visual effect duration
        
        my.vfx = {}; 
        this.PARTICLE_VELOCITY = 60;

        // Initialize score
        this.score = 0;
        this.gameOver = false; // For level completion
        this.playerDied = false; // For player drowning death
        this.lastFootstepTime = 0;
        console.log("[INIT] Scene initialized.");

        // Dash properties
        this.DASH_SPEED = 800;
        this.DASH_DURATION = 200; // milliseconds
        this.DASH_COOLDOWN = 500; // milliseconds
        this.canDash = true;
        this.isDashing = false;
        this.lastDashTime = 0;
        this.dashTrailEmitter = null;

        // Enemy properties
        this.enemies = null;
        this.projectiles = null;
        
        // Platform properties
        this.movingPlatforms = null;
        
        // Power-up properties
        this.powerUps = null;

        // Input properties
        this.cursors = null;
    }

    create() {
        this.gameOver = false;
        this.playerDied = false;
        console.log("[CREATE] Scene create started.");

        // Initialize input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.settingsKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);

        // Create tilemap
        this.map = this.add.tilemap("platformer-level-1");

        // Initialize the animated tiles plugin after creating the tilemap
        this.animatedTiles.init(this.map);

        // Add parallax background after tilemap is created
        this.createParallaxBackground();

        // Add tileset
        this.tileset = this.map.addTilesetImage("tilemap_packed", "tilemap_tiles");

        // Create layers
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.groundLayer.setScale(SCALE);
        this.groundLayer.setCollisionByProperty({ collides: true });

        this.waterLayer = this.map.createLayer("Water", this.tileset, 0, 0);
        this.waterLayer.setScale(SCALE);
        this.waterLayer.setCollisionByProperty({ water: true });

        // World and camera bounds
        const mapWidth = this.map.widthInPixels * SCALE;
        const mapHeight = this.map.heightInPixels * SCALE;
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        // Set TILE_BIAS to prevent falling through tiles at high speeds
        // Adjust this value based on your tile size and game feel.
        // Effective tile size is 18 * SCALE (2.0) = 36.
        this.physics.world.TILE_BIAS = 36; 
        console.log(`[CREATE] TILE_BIAS set to: ${this.physics.world.TILE_BIAS}`);


        // Initialize particle emitters
        this.initParticles();

        // Groups
        this.coinGroup = this.physics.add.group();
        this.endGameObjectGroup = this.physics.add.group();
        this.enemies = this.physics.add.group();
        this.projectiles = this.physics.add.group();
        this.movingPlatforms = this.physics.add.group();
        this.powerUps = this.physics.add.group();

        // Process objects from Tiled
        if (this.map.getObjectLayer('Objects')) {
            const objects = this.map.getObjectLayer('Objects').objects;
            objects.forEach(object => {
                if (object.type === 'playerSpawn' || object.name === 'playerSpawn') {
                    this.spawnPoint = { x: object.x * SCALE, y: object.y * SCALE };
                } else if (object.type === 'coin' || object.name === 'Coin') {
                    const coin = this.coinGroup.create(
                        object.x * SCALE,
                        object.y * SCALE,
                        'platformer_characters', 
                        'tile_0011.png'
                    ).setScale(SCALE);
                    coin.body.setAllowGravity(false);
                    coin.anims.play('coin-spin', true); 
                    this.tweens.add({
                        targets: coin,
                        y: coin.y - 5, 
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else if (object.class === 'end-game' || object.type === 'end-game' || object.name === 'End-Game') {
                    const endGoal = this.endGameObjectGroup.create(
                        object.x * SCALE + (object.width * SCALE / 2),
                        object.y * SCALE + (object.height * SCALE / 2),
                        null 
                    );
                    endGoal.setSize(object.width * SCALE, object.height * SCALE);
                    endGoal.setOrigin(0.5, 0.5);
                    endGoal.setVisible(false);
                    endGoal.body.setAllowGravity(false);
                    endGoal.body.setImmovable(true);
                } else if (object.type === 'enemy' || object.name === 'Enemy') {
                    // Create enemy based on properties
                    const enemyType = object.properties.find(p => p.name === 'type')?.value || 'walkabot';
                    let enemy;
                    
                    if (enemyType === 'walkabot') {
                        enemy = new Walkabot(this, object.x * SCALE, object.y * SCALE);
                    } else if (enemyType === 'spike') {
                        enemy = new SpikeSentry(this, object.x * SCALE, object.y * SCALE);
                    }
                    
                    if (enemy) {
                        this.enemies.add(enemy);
                    }
                } else if (object.type === 'platform' || object.name === 'Platform') {
                    // Create moving platform based on properties
                    const config = {
                        type: object.properties.find(p => p.name === 'type')?.value || 'horizontal',
                        distance: object.properties.find(p => p.name === 'distance')?.value || 200,
                        speed: object.properties.find(p => p.name === 'speed')?.value || 100,
                        delay: object.properties.find(p => p.name === 'delay')?.value || 0
                    };
                    
                    const platform = new MovingPlatform(
                        this,
                        object.x * SCALE,
                        object.y * SCALE,
                        'tilemap_tiles',
                        object.gid - 1,
                        config
                    );
                    
                    this.movingPlatforms.add(platform);
                } else if (object.type === 'powerup' || object.name === 'PowerUp') {
                    // Create power-up based on properties
                    const type = object.properties.find(p => p.name === 'type')?.value || 'speed';
                    const powerUp = new PowerUp(this, object.x * SCALE, object.y * SCALE, type);
                    this.powerUps.add(powerUp);
                }
            });
        } else {
            this.spawnPoint = { x: 200, y: 400 }; 
            console.warn('No "Objects" layer found in tilemap. Using default spawn point.');
        }
        
        if (!this.spawnPoint) {
            this.spawnPoint = { x: 100 * SCALE, y: 100 * SCALE };
            console.warn("Player spawn point not found. Using default.");
        }

        // Player avatar
        my.sprite.player = this.physics.add.sprite(
            this.spawnPoint.x,
            this.spawnPoint.y,
            "platformer_characters", 
            "tile_0000.png"     
        ).setScale(SCALE);
        my.sprite.player.setCollideWorldBounds(true);
        my.sprite.player.active = true; 
        my.sprite.player.body.enable = true; 
        my.sprite.player.body.reset(this.spawnPoint.x, this.spawnPoint.y); 
        my.sprite.player.body.setVelocity(0,0); 
        my.sprite.player.body.setAcceleration(0,0); 

        my.sprite.player.isDrowning = false; 
        my.sprite.player.invulnerable = false; // Player is NOT invulnerable on spawn/restart
        console.log(`[CREATE] Player created/reset. playerDied: ${this.playerDied}, isDrowning: ${my.sprite.player.isDrowning}, invulnerable: ${my.sprite.player.invulnerable}, active: ${my.sprite.player.active}, body.enable: ${my.sprite.player.body.enable}, X: ${my.sprite.player.x}, Y: ${my.sprite.player.y}`);


        // UI Text elements
        this.scoreText = this.add.text(20, 20, 'Score: 0',
            { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
        ).setScrollFactor(0);

        // Settings text
        this.settingsText = this.add.text(this.cameras.main.width - 20, 20, 'Press S for Settings',
            { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
        ).setScrollFactor(0).setOrigin(1, 0);

        // Settings popup container
        this.settingsContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
        const settingsGraphics = this.add.graphics();
        settingsGraphics.fillStyle(0x000000, 0.8);
        settingsGraphics.fillRect(-300, -200, 600, 400);
        this.settingsContainer.add(settingsGraphics);

        // Settings title
        const settingsTitle = this.add.text(0, -150, 'Controls', { fontSize: '36px', color: '#ffffff', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 4 }).setOrigin(0.5);
        this.settingsContainer.add(settingsTitle);

        // Controls text
        const controlsText = [
            'Arrow Keys: Move and Jump',
            'Shift: Dash',
            'S: Toggle Settings',
            'Enter: Restart Level'
        ];

        controlsText.forEach((text, index) => {
            const controlText = this.add.text(0, -80 + (index * 40), text, 
                { fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 }
            ).setOrigin(0.5);
            this.settingsContainer.add(controlText);
        });

        // Close button
        const closeButton = this.add.text(250, -150, 'X', 
            { fontSize: '32px', color: '#ffffff', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 }
        ).setOrigin(0.5).setInteractive();
        closeButton.on('pointerdown', () => {
            this.settingsContainer.setVisible(false);
        });
        this.settingsContainer.add(closeButton);

        // Collisions
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        this.physics.add.collider(my.sprite.player, this.movingPlatforms);
        this.physics.add.collider(this.enemies, this.groundLayer);
        this.physics.add.collider(this.enemies, this.movingPlatforms);
        this.physics.add.collider(this.projectiles, this.groundLayer, (projectile) => {
            projectile.destroy();
        });
        this.physics.add.overlap(my.sprite.player, this.coinGroup, this.collectCoin, null, this);
        this.physics.add.overlap(my.sprite.player, this.endGameObjectGroup, this.reachEndGoal, null, this);
        this.physics.add.overlap(my.sprite.player, this.powerUps, this.collectPowerUp, null, this);
        this.physics.add.overlap(my.sprite.player, this.enemies, this.handleEnemyCollision, null, this);
        this.physics.add.overlap(my.sprite.player, this.projectiles, this.handleProjectileHit, null, this);
        this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, (player, tile) => {
            return my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied && !my.sprite.player.invulnerable && tile && tile.index !== -1 && tile.properties && tile.properties.water;
        }, this);

        // Input
        this.initializeInput();

        // Camera
        this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1);

        // Game Complete Screen (for winning)
        this.gameCompleteContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
        const completeGraphics = this.add.graphics();
        completeGraphics.fillStyle(0x000000, 0.7);
        completeGraphics.fillRect(-250, -150, 500, 300); 
        this.gameCompleteContainer.add(completeGraphics);
        this.completeText = this.add.text(0, -50, 'Level Complete!', { fontSize: '48px', color: '#00ff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
        this.gameCompleteContainer.add(this.completeText);
        this.playAgainWinText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
            .setOrigin(0.5);
        this.gameCompleteContainer.add(this.playAgainWinText);

        // Player Died Screen (for drowning)
        this.playerDiedContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setDepth(100).setVisible(false);
        const diedGraphics = this.add.graphics();
        diedGraphics.fillStyle(0x330000, 0.8); 
        diedGraphics.fillRect(-250, -150, 500, 300);
        this.playerDiedContainer.add(diedGraphics);
        this.playerDiedText = this.add.text(0, -50, 'You Drowned!', { fontSize: '48px', color: '#ff4444', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
        this.playerDiedContainer.add(this.playerDiedText);
        this.playAgainDiedText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
            .setOrigin(0.5);
        this.playerDiedContainer.add(this.playAgainDiedText);

        // Initialize dash trail particles
        this.dashTrailEmitter = this.add.particles(0, 0, 'dash_trail', {
            speed: { min: 80, max: 180 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 0.7, end: 0 },
            lifespan: 250,
            angle: { min: 0, max: 360 },
            frequency: 10,
            quantity: 1,
            blendMode: 'ADD',
            emitting: false
        });

        // Add dash key
        this.dashKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    initializeInput() {
        if (!cursors) {
            Object.defineProperty(window, 'cursors', {
                value: this.input.keyboard.createCursorKeys(),
                writable: true
            });
        }
    }

    initParticles() {
        // Particle emitters
        my.vfx.walking = this.add.particles(0, 0, 'smoke_03', {
            scale: { start: 0.08, end: 0.11 }, maxAliveParticles: 9, lifespan: 280,
            alpha: { start: 0.7, end: 0 }, frequency: 80, gravityY: -50,
            blendMode: 'ADD', emitting: false
        });

        my.vfx.jumping = this.add.particles(0, 0, 'smoke_05', {
            scale: { start: 0.15, end: 0.0 }, maxAliveParticles: 12, lifespan: 400,
            alpha: { start: 0.9, end: 0.2 }, speed: { min: 80, max: 180 },
            angle: { min: 240, max: 300 }, gravityY: 200,
            emitting: false, blendMode: 'ADD'
        });
        my.vfx.jumping.stop();

        my.vfx.landing = this.add.particles(0, 0, 'smoke_01', {
            scale: { start: 0.2, end: 0.05 }, maxAliveParticles: 15, lifespan: 500,
            alpha: { start: 0.8, end: 0 }, speed: { min: 80, max: 200 },
            angle: { min: 180, max: 360 }, gravityY: -50, tint: 0xf8f8ff,
            blendMode: 'ADD', emitting: false
        });

        this.coinEmitter = this.add.particles(0, 0, 'platformer_characters', {
            frame: 'tile_0011.png', lifespan: 800, speed: { min: 100, max: 200 },
            scale: { start: SCALE * 0.5, end: 0 }, gravityY: 300,
            blendMode: 'ADD', emitting: false
        });

        this.tinyBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
            lifespan: 1000, scale: { start: 0.05, end: 0.01 }, alpha: { start: 0.4, end: 0 },
            speed: { min: 10, max: 30 }, angle: { min: 250, max: 290 },
            frequency: 200, quantity: 1, emitting: false, tint: 0xc0ffff, gravityY: -60
        });
        this.mediumBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
            lifespan: { min: 900, max: 1100 }, speed: { min: 40, max: 70 },
            scale: { start: 0.1, end: 0.2 }, alpha: { start: 0.7, end: 0 },
            frequency: 400, quantity: 1, gravityY: -80, angle: { min: 250, max: 290 },
            emitting: false, accelerationX: { min: -10, max: 10 }, blendMode: 'ADD'
        });
        this.largeBubbleEmitter = this.add.particles(0, 0, 'twirl_03', {
            lifespan: { min: 500, max: 1000 }, speed: { min: 30, max: 60 },
            scale: { start: 0.15, end: 0.25 }, alpha: { start: 0.6, end: 0 },
            frequency: 600, quantity: 1, gravityY: -70, angle: { min: 260, max: 280 },
            emitting: false, accelerationX: { min: -15, max: 15 }, blendMode: 'ADD'
        });
        this.burstBubbleEmitter = this.add.particles(0, 0, 'twirl_01', {
            lifespan: 800, speed: { min: 80, max: 150 },
            scale: { start: 0.25, end: 0.05 }, alpha: { start: 0.7, end: 0 },
            frequency: -1, gravityY: -100, emitting: false, blendMode: 'ADD'
        });
    }

    update(time, delta) {
        // Update parallax background to follow camera scroll and move continuously
        if (this.parallaxLayers) {
            this.parallaxLayers.forEach(layer => {
                const timeOffset = time * 0.04 * layer.speed;
                layer.sprite.tilePositionX = this.cameras.main.scrollX * layer.speed + timeOffset;
                layer.sprite.tilePositionY = this.cameras.main.scrollY * layer.speed;
            });
        }

        // Ensure player exists before any checks
        if (!my.sprite.player || !my.sprite.player.body) {
            // console.warn("Player sprite or body missing at top of update. Scene likely shutting down or in error state.");
            return;
        }

        // Ensure cursors are initialized
        if (!this.cursors) {
            return;
        }

        // Toggle settings popup
        if (Phaser.Input.Keyboard.JustDown(this.settingsKey)) {
            this.settingsContainer.setVisible(!this.settingsContainer.visible);
        }

        // State 1: Game Over (Win) or Player Has Died (Drown) - Awaiting Restart
        if (this.gameOver || this.playerDied) {
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                console.log(`[UPDATE] ENTER pressed. Restarting scene. gameOver: ${this.gameOver}, playerDied: ${this.playerDied}`);
                // Stop all particle emitters before restart to prevent them from carrying over
                if(my.vfx.walking) my.vfx.walking.stop();
                if(my.vfx.jumping) my.vfx.jumping.stop();
                if(my.vfx.landing) my.vfx.landing.stop();
                if(this.tinyBubbleEmitter) this.tinyBubbleEmitter.stop();
                if(this.mediumBubbleEmitter) this.mediumBubbleEmitter.stop();
                if(this.largeBubbleEmitter) this.largeBubbleEmitter.stop();

                window.location.reload();
                return; 
            }

            // Stop player movement and set appropriate animation
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setVelocity(0,0); 
            my.sprite.player.body.setDragX(this.DRAG);

            if (this.gameOver) { 
                my.sprite.player.anims.play('idle', true);
            } else if (this.playerDied) {
                // Player animation is stopped in playerTouchWater or managed by its tween.
                // Visual drowning effects (bubbles)
                if (my.sprite.player.isDrowning) { // isDrowning flag controls bubble visuals
                    const playerX = my.sprite.player.x;
                    const playerY = my.sprite.player.y;
                    if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
                    if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
                    if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
                }
            }
            if (my.vfx.walking) my.vfx.walking.stop();
            return; 
        }
        
        // State 2: Player sprite exists, but might be inactive or body disabled (should not happen in normal flow after create)
        if (!my.sprite.player.active || !my.sprite.player.body.enable) {
            console.warn("Player sprite inactive or body disabled during active game state. Controls skipped.");
            return;
        }

        // State 3: Visual Drowning Sequence (player.isDrowning is true, but playerDied is false)
        if (my.sprite.player.isDrowning) { 
            // console.log(`[UPDATE] Player is visually drowning (isDrowning=true, playerDied=false). Controls locked.`);
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setVelocity(0,0); 
            my.sprite.player.body.setDragX(this.DRAG);
            
            if (my.vfx.walking) my.vfx.walking.stop();
            
            const playerX = my.sprite.player.x;
            const playerY = my.sprite.player.y;
            if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
            if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
            if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
            return; 
        }
        
        // State 4: Active Gameplay 
        // console.log(`[UPDATE] Player controls ACTIVE. Time: ${time.toFixed(0)}, Invulnerable: ${my.sprite.player.invulnerable}`);
        var wasInAir = !my.sprite.player.body.blocked.down;

        // Horizontal movement
        if (this.cursors.left.isDown) {
            my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
            my.sprite.player.resetFlip();
            my.sprite.player.anims.play('walk', true);
            my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
            my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
            if (my.sprite.player.body.blocked.down) {
                my.vfx.walking.start();
                this.playFootstepSound(time);
            } else {
                my.vfx.walking.stop();
            }
        } else if (this.cursors.right.isDown) {
            my.sprite.player.body.setAccelerationX(this.ACCELERATION);
            my.sprite.player.setFlip(true, false);
            my.sprite.player.anims.play('walk', true);
            my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth / 2 + 10, my.sprite.player.displayHeight / 2 - 5, false);
            my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
            if (my.sprite.player.body.blocked.down) {
                my.vfx.walking.start();
                this.playFootstepSound(time);
            } else {
                my.vfx.walking.stop();
            }
        } else {
            my.sprite.player.body.setAccelerationX(0);
            my.sprite.player.body.setDragX(this.DRAG);
            my.sprite.player.anims.play('idle', true);
            my.vfx.walking.stop();
        }

        // Vertical movement (Jump)
        if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
            const jumpSoundKey = 'jump_sound';
            this.sound.play(jumpSoundKey, { volume: 0.6 }); 
            my.vfx.jumping.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2 - 5);
            my.vfx.jumping.explode(10);
        }

        // Animation and landing particles
        if (!my.sprite.player.body.blocked.down) {
            my.sprite.player.anims.play('jump', true);
        } else {
            if (wasInAir) {
                my.vfx.landing.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2);
                my.vfx.landing.explode(12);
                this.cameras.main.shake(100, 0.005);
                const landSoundKey = 'land_sound';
                this.sound.play(landSoundKey, { volume: 0.5 }); 
            }
        }

        // Handle dash input and mechanics
        if (this.dashKey.isDown && this.canDash && !this.isDashing && !this.gameOver && !this.playerDied) {
            this.startDash(time);
        }

        if (this.isDashing) {
            this.updateDash(time);
        }

        // Update enemies
        this.enemies.getChildren().forEach(enemy => {
            enemy.update(time);
        });

        // Update moving platforms
        this.movingPlatforms.getChildren().forEach(platform => {
            platform.update();
        });
    }

    playFootstepSound(currentTime) {
        if (currentTime > this.lastFootstepTime + 350) {
            let soundKey = 'footstep_grass_' + Phaser.Math.Between(0, 4);
            this.sound.play(soundKey, { volume: 0.3 }); 
            this.lastFootstepTime = currentTime;
        }
    }

    collectCoin(player, coin) {
        const coinSoundKey = 'coin_collect_sound';
        this.sound.play(coinSoundKey, { volume: 0.5 }); 
        this.coinEmitter.setPosition(coin.x, coin.y);
        this.coinEmitter.explode(10);
        coin.destroy();
        this.score += 10;
        this.scoreText.setText(`Score: ${this.score}`);
        this.tweens.add({
            targets: this.scoreText, scale: 1.2, duration: 100,
            yoyo: true, ease: 'Sine.easeInOut'
        });
    }

    playerTouchWater(player, tile) {
        console.log(`[playerTouchWater] Entered. playerDied: ${this.playerDied}, isDrowning: ${my.sprite.player ? my.sprite.player.isDrowning : 'N/A'}, invulnerable: ${my.sprite.player ? my.sprite.player.invulnerable : 'N/A'}`);
        if (my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied && !my.sprite.player.invulnerable) { 
            console.log("[playerTouchWater] Conditions met, processing drowning.");
            my.sprite.player.isDrowning = true; 
            this.playerDied = true; 

            my.sprite.player.body.setVelocity(0, 0);
            my.sprite.player.body.setAcceleration(0, 0);
            my.sprite.player.anims.stop(); 

            this.playerDiedContainer.setVisible(true);

            const playerX = my.sprite.player.x;
            const playerY = my.sprite.player.y;
            this.burstBubbleEmitter.setPosition(playerX, playerY);
            this.burstBubbleEmitter.explode(20);
            this.tinyBubbleEmitter.setPosition(playerX, playerY);
            this.tinyBubbleEmitter.start();
            this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
            this.mediumBubbleEmitter.start();
            this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
            this.largeBubbleEmitter.start();

            this.tweens.add({
                targets: my.sprite.player, y: my.sprite.player.y + 30,
                alpha: 0.5, angle: Phaser.Math.Between(-15, 15),
                duration: this.DROWNING_DURATION, ease: 'Power1'
            });
        } else {
             console.log(`[playerTouchWater] Conditions NOT met. Bypassing. isDrowning: ${my.sprite.player ? my.sprite.player.isDrowning : 'N/A'}, playerDied: ${this.playerDied}, invulnerable: ${my.sprite.player ? my.sprite.player.invulnerable : 'N/A'}`);
        }
    }

    respawnPlayer() { 
        console.log("[RESPAWN_PLAYER] This function is mostly vestigial. Scene restart is preferred.");
        if (this.gameOver || !my.sprite.player) return;

        my.sprite.player.isDrowning = false;
        this.playerDied = false; 
        my.sprite.player.setAlpha(1);
        my.sprite.player.setAngle(0);
        my.sprite.player.setRotation(0);
        my.sprite.player.setFlipY(false);
        this.tweens.killTweensOf(my.sprite.player);
        
        if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.stop();
        if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.stop();
        if (this.largeBubbleEmitter) this.largeBubbleEmitter.stop();
        if (this.playerDiedContainer) this.playerDiedContainer.setVisible(false);


        my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
        my.sprite.player.body.reset(this.spawnPoint.x, this.spawnPoint.y); 
        my.sprite.player.body.setVelocity(0, 0);
        my.sprite.player.body.setAcceleration(0, 0);
        // my.sprite.player.invulnerable = true; // No longer set here
        // this.time.delayedCall(500, () => { if(my.sprite.player) my.sprite.player.invulnerable = false; });
    }

    reachEndGoal(player, endGoalObject) {
        if (this.gameOver || !my.sprite.player || this.playerDied) return;

        this.gameOver = true; 
        my.sprite.player.body.setVelocity(0,0);
        my.sprite.player.body.setAcceleration(0,0);
        my.sprite.player.anims.play('idle', true); 
        if(my.vfx.walking) my.vfx.walking.stop();

        this.gameCompleteContainer.setVisible(true); 
        this.completeText.setText(`Level Complete!\nScore: ${this.score}`);

        const celebrationEmitter = this.add.particles(this.cameras.main.width / 2, this.cameras.main.height / 2, 'twirl_01', {
            x: { min: -this.cameras.main.width/2 + 50, max: this.cameras.main.width/2 - 50 },
            y: { min: -this.cameras.main.height/2 + 50, max: this.cameras.main.height/2 - 50 },
            lifespan: 2000, speed: { min: 100, max: 300 }, scale: { start: 0.3, end: 0 },
            gravityY: 100, blendMode: 'ADD', emitting: true, frequency: 50, quantity: 2,
            maxParticles: 50, tint: [0xffff00, 0x00ff00, 0xff00ff]
        }).setScrollFactor(0).setDepth(99);

        this.time.delayedCall(3000, () => {
            if (celebrationEmitter && celebrationEmitter.scene) { 
                celebrationEmitter.stop();
                this.time.delayedCall(2000, () => {
                    if (celebrationEmitter && celebrationEmitter.scene) celebrationEmitter.destroy();
                });
            }
        });
    }

    startDash(time) {
        this.isDashing = true;
        this.canDash = false;
        this.lastDashTime = time;
        
        // Set dash velocity - reversed direction
        const direction = my.sprite.player.flipX ? 1 : -1;
        my.sprite.player.body.setVelocityX(this.DASH_SPEED * direction);
        
        // Start dash trail effect
        this.dashTrailEmitter.setPosition(my.sprite.player.x, my.sprite.player.y);
        this.dashTrailEmitter.start();
        
        // Play dash sound
        this.sound.play('dash_sound');
    }

    updateDash(time) {
        if (time - this.lastDashTime >= this.DASH_DURATION) {
            this.endDash();
        }
        
        // Update dash trail position
        this.dashTrailEmitter.setPosition(my.sprite.player.x, my.sprite.player.y);
    }

    endDash() {
        this.isDashing = false;
        this.dashTrailEmitter.stop();
        
        // Reset velocity to normal
        my.sprite.player.body.setVelocityX(0);
        
        // Start cooldown
        this.time.delayedCall(this.DASH_COOLDOWN, () => {
            this.canDash = true;
        });
    }

    collectPowerUp(player, powerUp) {
        powerUp.collect(player);
    }

    handleEnemyCollision(player, enemy) {
        if (this.playerDied || this.gameOver) return;
        
        // Get the bottom of the player and top of the enemy
        const playerBottom = player.y + player.height/2;
        const enemyTop = enemy.y - enemy.height/2;
        
        // Check if player is above enemy (regardless of velocity)
        if (playerBottom <= enemyTop + 10) { // Added small buffer for better feel
            // Player is on top of enemy - only enemy takes damage
            enemy.takeDamage();
            player.body.setVelocityY(-300); // Bounce off enemy
        } else if (!player.invulnerable) {
            // Player hits enemy from side - player takes damage
            this.playerDied = true;
            player.body.setVelocity(0, 0);
            player.body.setAcceleration(0, 0);
            player.anims.stop();
            
            this.playerDiedContainer.setVisible(true);
            this.playerDiedText.setText("You've Been Killed!");
            
            // Add death animation
            this.tweens.add({
                targets: player,
                y: player.y - 20,
                alpha: 0,
                duration: 1000,
                ease: 'Power2'
            });
        }
    }

    handleProjectileHit(player, projectile) {
        if (this.playerDied || this.gameOver || player.invulnerable) return;
        
        projectile.destroy();
        
        // Player takes damage
        this.playerDied = true;
        player.body.setVelocity(0, 0);
        player.body.setAcceleration(0, 0);
        player.anims.stop();
        
        this.playerDiedContainer.setVisible(true);
        this.playerDiedText.setText("You've Been Killed!");
        
        // Add death animation
        this.tweens.add({
            targets: player,
            y: player.y - 20,
            alpha: 0,
            duration: 1000,
            ease: 'Power2'
        });
    }

    createParallaxBackground() {
        // Get world size
        const mapWidth = this.map.widthInPixels * SCALE;
        const mapHeight = this.map.heightInPixels * SCALE;

        // Remove old parallax layers if present
        if (this.backgroundContainer) {
            this.backgroundContainer.destroy();
        }
        this.backgroundContainer = this.add.container(0, 0).setDepth(-1);

        // Create parallax layers array
        this.parallaxLayers = [];

        // Add the main background image as a parallax layer
        const bgSprite = this.add.tileSprite(0, 0, mapWidth, mapHeight, 'background.png')
            .setOrigin(0, 0)
            .setScrollFactor(0);
        this.backgroundContainer.add(bgSprite);
        this.parallaxLayers.push({
            sprite: bgSprite,
            speed: 0.2 // Adjust for desired parallax effect
        });

        // Debris particle emitter (Phaser 3.60+ syntax)
        this.debrisEmitterManager = this.add.particles('debris', {
            x: { min: mapWidth * 0.7, max: mapWidth }, // Emit from right side
            y: 0, // Start at top
            lifespan: { min: 4000, max: 7000 },
            speedX: { min: -100, max: -30 }, // Move left
            speedY: { min: 80, max: 180 },   // Move down
            scale: { start: 0.5, end: 0.2 },
            alpha: { start: 0.7, end: 0 },
            angle: { min: 200, max: 250 }, // Some rotation
            quantity: 1,
            frequency: 120,
            rotate: { min: 0, max: 360 },
            blendMode: 'ADD'
        });
        this.backgroundContainer.add(this.debrisEmitterManager);
    }
}

export default Platformer;

