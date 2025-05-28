


class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    // preload() is REMOVED - asset loading is handled by Load.js

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
    }

    create() {
        this.gameOver = false;
        this.playerDied = false;
        console.log("[CREATE] Scene create started.");


        // Create tilemap
        this.map = this.add.tilemap("platformer-level-1");

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

        // Collisions
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        this.physics.add.overlap(my.sprite.player, this.coinGroup, this.collectCoin, null, this);
        this.physics.add.overlap(my.sprite.player, this.endGameObjectGroup, this.reachEndGoal, null, this);
        this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, (player, tile) => {
            // Invulnerability check is still here, but invulnerable is now always false unless set elsewhere
            return my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied && !my.sprite.player.invulnerable && tile && tile.index !== -1 && tile.properties && tile.properties.water;
        }, this);

        // Input
        if (typeof cursors === 'undefined') { 
            cursors = this.input.keyboard.createCursorKeys(); 
        }
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = !this.physics.world.drawDebug;
            this.physics.world.debugGraphic.clear();
        }, this);

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
        this.playerDiedContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
        const diedGraphics = this.add.graphics();
        diedGraphics.fillStyle(0x330000, 0.8); 
        diedGraphics.fillRect(-250, -150, 500, 300);
        this.playerDiedContainer.add(diedGraphics);
        this.playerDiedText = this.add.text(0, -50, 'You Drowned!', { fontSize: '48px', color: '#ff4444', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
        this.playerDiedContainer.add(this.playerDiedText);
        this.playAgainDiedText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
            .setOrigin(0.5);
        this.playerDiedContainer.add(this.playAgainDiedText);
        console.log("[CREATE] Scene create finished.");
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
        // Ensure player exists before any checks
        if (!my.sprite.player || !my.sprite.player.body) {
            // console.warn("Player sprite or body missing at top of update. Scene likely shutting down or in error state.");
            return;
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
        if (cursors.left.isDown) {
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
        } else if (cursors.right.isDown) {
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
        if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
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
}



// class Platformer extends Phaser.Scene {
//     constructor() {
//         super("platformerScene");
//     }

//     // preload() is REMOVED - asset loading is handled by Load.js

//     init() {
//         // Variables and settings
//         this.ACCELERATION = 500;
//         this.DRAG = 1400;
//         this.physics.world.gravity.y = 1500;
//         this.JUMP_VELOCITY = -900;
//         this.DROWNING_DURATION = 1500; // Used for visual effect duration
        
//         my.vfx = {}; 
//         this.PARTICLE_VELOCITY = 60;

//         // Initialize score
//         this.score = 0;
//         this.gameOver = false; // For level completion
//         this.playerDied = false; // For player drowning death
//         this.lastFootstepTime = 0;
//         console.log("[INIT] Scene initialized.");
//     }

//     create() {
//         this.gameOver = false;
//         this.playerDied = false;
//         console.log("[CREATE] Scene create started.");


//         // Create tilemap
//         this.map = this.add.tilemap("platformer-level-1");

//         // Add tileset
//         this.tileset = this.map.addTilesetImage("tilemap_packed", "tilemap_tiles");

//         // Create layers
//         this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
//         this.groundLayer.setScale(SCALE);
//         this.groundLayer.setCollisionByProperty({ collides: true });

//         this.waterLayer = this.map.createLayer("Water", this.tileset, 0, 0);
//         this.waterLayer.setScale(SCALE);
//         this.waterLayer.setCollisionByProperty({ water: true });

//         // World and camera bounds
//         const mapWidth = this.map.widthInPixels * SCALE;
//         const mapHeight = this.map.heightInPixels * SCALE;
//         this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
//         this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

//         // Initialize particle emitters
//         this.initParticles();

//         // Groups
//         this.coinGroup = this.physics.add.group();
//         this.endGameObjectGroup = this.physics.add.group();

//         // Process objects from Tiled
//         if (this.map.getObjectLayer('Objects')) {
//             const objects = this.map.getObjectLayer('Objects').objects;
//             objects.forEach(object => {
//                 if (object.type === 'playerSpawn' || object.name === 'playerSpawn') {
//                     this.spawnPoint = { x: object.x * SCALE, y: object.y * SCALE };
//                 } else if (object.type === 'coin' || object.name === 'Coin') {
//                     const coin = this.coinGroup.create(
//                         object.x * SCALE,
//                         object.y * SCALE,
//                         'platformer_characters', 
//                         'tile_0011.png'
//                     ).setScale(SCALE);
//                     coin.body.setAllowGravity(false);
//                     coin.anims.play('coin-spin', true); 
//                     this.tweens.add({
//                         targets: coin,
//                         y: coin.y - 5, 
//                         duration: 800,
//                         yoyo: true,
//                         repeat: -1,
//                         ease: 'Sine.easeInOut'
//                     });
//                 } else if (object.class === 'end-game' || object.type === 'end-game' || object.name === 'End-Game') {
//                     const endGoal = this.endGameObjectGroup.create(
//                         object.x * SCALE + (object.width * SCALE / 2),
//                         object.y * SCALE + (object.height * SCALE / 2),
//                         null 
//                     );
//                     endGoal.setSize(object.width * SCALE, object.height * SCALE);
//                     endGoal.setOrigin(0.5, 0.5);
//                     endGoal.setVisible(false);
//                     endGoal.body.setAllowGravity(false);
//                     endGoal.body.setImmovable(true);
//                 }
//             });
//         } else {
//             this.spawnPoint = { x: 200, y: 400 }; 
//             console.warn('No "Objects" layer found in tilemap. Using default spawn point.');
//         }
        
//         if (!this.spawnPoint) {
//             this.spawnPoint = { x: 100 * SCALE, y: 100 * SCALE };
//             console.warn("Player spawn point not found. Using default.");
//         }

//         // Player avatar
//         my.sprite.player = this.physics.add.sprite(
//             this.spawnPoint.x,
//             this.spawnPoint.y,
//             "platformer_characters", 
//             "tile_0000.png"     
//         ).setScale(SCALE);
//         my.sprite.player.setCollideWorldBounds(true);
//         my.sprite.player.active = true; // Ensure sprite is active
//         my.sprite.player.body.enable = true; // Ensure physics body is enabled
//         my.sprite.player.body.reset(this.spawnPoint.x, this.spawnPoint.y); // Reset physics state at spawn
//         my.sprite.player.body.setVelocity(0,0); // Explicitly set velocity to 0
//         my.sprite.player.body.setAcceleration(0,0); // Explicitly set acceleration to 0

//         my.sprite.player.isDrowning = false; 
//         my.sprite.player.invulnerable = true; 
//         console.log(`[CREATE] Player created/reset. playerDied: ${this.playerDied}, isDrowning: ${my.sprite.player.isDrowning}, invulnerable: ${my.sprite.player.invulnerable}, active: ${my.sprite.player.active}, body.enable: ${my.sprite.player.body.enable}, X: ${my.sprite.player.x}, Y: ${my.sprite.player.y}`);


//         this.time.delayedCall(1000, () => { 
//             if (my.sprite.player) { 
//                 my.sprite.player.invulnerable = false;
//                 console.log(`[CREATE - delayedCall] Invulnerability ended. playerDied: ${this.playerDied}, isDrowning: ${my.sprite.player.isDrowning}, invulnerable: ${my.sprite.player.invulnerable}`);
//             } else {
//                 console.log("[CREATE - delayedCall] Player sprite no longer exists when invulnerability was to end.");
//             }
//         }, [], this);


//         // UI Text elements
//         this.scoreText = this.add.text(20, 20, 'Score: 0',
//             { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
//         ).setScrollFactor(0);

//         // Collisions
//         this.physics.add.collider(my.sprite.player, this.groundLayer);
//         this.physics.add.overlap(my.sprite.player, this.coinGroup, this.collectCoin, null, this);
//         this.physics.add.overlap(my.sprite.player, this.endGameObjectGroup, this.reachEndGoal, null, this);
//         this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, (player, tile) => {
//             return my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied && !my.sprite.player.invulnerable && tile && tile.index !== -1 && tile.properties && tile.properties.water;
//         }, this);

//         // Input
//         if (typeof cursors === 'undefined') { 
//             cursors = this.input.keyboard.createCursorKeys(); 
//         }
//         this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

//         this.input.keyboard.on('keydown-D', () => {
//             this.physics.world.drawDebug = !this.physics.world.drawDebug;
//             this.physics.world.debugGraphic.clear();
//         }, this);

//         // Camera
//         this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1);

//         // Game Complete Screen (for winning)
//         this.gameCompleteContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
//         const completeGraphics = this.add.graphics();
//         completeGraphics.fillStyle(0x000000, 0.7);
//         completeGraphics.fillRect(-250, -150, 500, 300); 
//         this.gameCompleteContainer.add(completeGraphics);
//         this.completeText = this.add.text(0, -50, 'Level Complete!', { fontSize: '48px', color: '#00ff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
//         this.gameCompleteContainer.add(this.completeText);
//         this.playAgainWinText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
//             .setOrigin(0.5);
//         this.gameCompleteContainer.add(this.playAgainWinText);

//         // Player Died Screen (for drowning)
//         this.playerDiedContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
//         const diedGraphics = this.add.graphics();
//         diedGraphics.fillStyle(0x330000, 0.8); 
//         diedGraphics.fillRect(-250, -150, 500, 300);
//         this.playerDiedContainer.add(diedGraphics);
//         this.playerDiedText = this.add.text(0, -50, 'You Drowned!', { fontSize: '48px', color: '#ff4444', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
//         this.playerDiedContainer.add(this.playerDiedText);
//         this.playAgainDiedText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
//             .setOrigin(0.5);
//         this.playerDiedContainer.add(this.playAgainDiedText);
//         console.log("[CREATE] Scene create finished.");
//     }

//     initParticles() {
//         // Particle emitters
//         my.vfx.walking = this.add.particles(0, 0, 'smoke_03', {
//             scale: { start: 0.08, end: 0.11 }, maxAliveParticles: 9, lifespan: 280,
//             alpha: { start: 0.7, end: 0 }, frequency: 80, gravityY: -50,
//             blendMode: 'ADD', emitting: false
//         });

//         my.vfx.jumping = this.add.particles(0, 0, 'smoke_05', {
//             scale: { start: 0.15, end: 0.0 }, maxAliveParticles: 12, lifespan: 400,
//             alpha: { start: 0.9, end: 0.2 }, speed: { min: 80, max: 180 },
//             angle: { min: 240, max: 300 }, gravityY: 200,
//             emitting: false, blendMode: 'ADD'
//         });
//         my.vfx.jumping.stop();

//         my.vfx.landing = this.add.particles(0, 0, 'smoke_01', {
//             scale: { start: 0.2, end: 0.05 }, maxAliveParticles: 15, lifespan: 500,
//             alpha: { start: 0.8, end: 0 }, speed: { min: 80, max: 200 },
//             angle: { min: 180, max: 360 }, gravityY: -50, tint: 0xf8f8ff,
//             blendMode: 'ADD', emitting: false
//         });

//         this.coinEmitter = this.add.particles(0, 0, 'platformer_characters', {
//             frame: 'tile_0011.png', lifespan: 800, speed: { min: 100, max: 200 },
//             scale: { start: SCALE * 0.5, end: 0 }, gravityY: 300,
//             blendMode: 'ADD', emitting: false
//         });

//         this.tinyBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: 1000, scale: { start: 0.05, end: 0.01 }, alpha: { start: 0.4, end: 0 },
//             speed: { min: 10, max: 30 }, angle: { min: 250, max: 290 },
//             frequency: 200, quantity: 1, emitting: false, tint: 0xc0ffff, gravityY: -60
//         });
//         this.mediumBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: { min: 900, max: 1100 }, speed: { min: 40, max: 70 },
//             scale: { start: 0.1, end: 0.2 }, alpha: { start: 0.7, end: 0 },
//             frequency: 400, quantity: 1, gravityY: -80, angle: { min: 250, max: 290 },
//             emitting: false, accelerationX: { min: -10, max: 10 }, blendMode: 'ADD'
//         });
//         this.largeBubbleEmitter = this.add.particles(0, 0, 'twirl_03', {
//             lifespan: { min: 500, max: 1000 }, speed: { min: 30, max: 60 },
//             scale: { start: 0.15, end: 0.25 }, alpha: { start: 0.6, end: 0 },
//             frequency: 600, quantity: 1, gravityY: -70, angle: { min: 260, max: 280 },
//             emitting: false, accelerationX: { min: -15, max: 15 }, blendMode: 'ADD'
//         });
//         this.burstBubbleEmitter = this.add.particles(0, 0, 'twirl_01', {
//             lifespan: 800, speed: { min: 80, max: 150 },
//             scale: { start: 0.25, end: 0.05 }, alpha: { start: 0.7, end: 0 },
//             frequency: -1, gravityY: -100, emitting: false, blendMode: 'ADD'
//         });
//     }

//     update(time, delta) {
//         // State 1: Game Over (Win) or Player Has Died (Drown)
//         if (this.gameOver || this.playerDied) {
//             if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
//                 console.log(`[UPDATE] ENTER pressed. Restarting scene. gameOver: ${this.gameOver}, playerDied: ${this.playerDied}`);
//                 this.scene.restart();
//                 return; 
//             }

//             if (my.sprite.player && my.sprite.player.body) {
//                 my.sprite.player.body.setAccelerationX(0);
//                 my.sprite.player.body.setVelocity(0,0); // Ensure velocity is also zeroed
//                 my.sprite.player.body.setDragX(this.DRAG);

//                 if (this.gameOver) { 
//                     my.sprite.player.anims.play('idle', true);
//                 } 
//                 // If playerDied, animation is handled by the tween in playerTouchWater or stopped
//             }
//             if (my.vfx.walking) my.vfx.walking.stop();
            
//             // Continue visual drowning effects if playerDied is true and player is visually drowning
//             if (this.playerDied && my.sprite.player && my.sprite.player.isDrowning) {
//                 const playerX = my.sprite.player.x;
//                 const playerY = my.sprite.player.y;
//                 if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
//                 if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//                 if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             }
//             return; 
//         }
        
//         // If we reach here, the game is NOT over and the player has NOT died.
//         // Now, check for player sprite and body validity before proceeding.
//         if (!my.sprite.player || !my.sprite.player.body || !my.sprite.player.active) {
//             console.warn("Player sprite, body, or active status is invalid in active game state. Player controls skipped.");
//             return;
//         }

//         // State 2: Visual Drowning Sequence (player.isDrowning is true)
//         // This locks controls if the player is in the visual drowning animation.
//         if (my.sprite.player.isDrowning) { 
//             // console.log(`[UPDATE] Player is visually drowning (isDrowning=true). Controls locked. playerDied: ${this.playerDied}`);
//              if (my.sprite.player.body) {
//                 my.sprite.player.body.setAccelerationX(0);
//                 my.sprite.player.body.setVelocity(0,0); 
//                 my.sprite.player.body.setDragX(this.DRAG);
//             }
//             if (my.vfx.walking) my.vfx.walking.stop();
            
//             const playerX = my.sprite.player.x;
//             const playerY = my.sprite.player.y;
//             if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
//             if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//             if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             return; 
//         }
        
//         // State 3: Active Gameplay (player is alive, not visually drowning, game not over)
//         // console.log(`[UPDATE] Player controls ACTIVE. Time: ${time.toFixed(0)}, Invulnerable: ${my.sprite.player.invulnerable}`);
//         var wasInAir = !my.sprite.player.body.blocked.down;

//         // Horizontal movement
//         if (cursors.left.isDown) {
//             my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
//             my.sprite.player.resetFlip();
//             my.sprite.player.anims.play('walk', true);
//             my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
//             my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
//             if (my.sprite.player.body.blocked.down) {
//                 my.vfx.walking.start();
//                 this.playFootstepSound(time);
//             } else {
//                 my.vfx.walking.stop();
//             }
//         } else if (cursors.right.isDown) {
//             my.sprite.player.body.setAccelerationX(this.ACCELERATION);
//             my.sprite.player.setFlip(true, false);
//             my.sprite.player.anims.play('walk', true);
//             my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth / 2 + 10, my.sprite.player.displayHeight / 2 - 5, false);
//             my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
//             if (my.sprite.player.body.blocked.down) {
//                 my.vfx.walking.start();
//                 this.playFootstepSound(time);
//             } else {
//                 my.vfx.walking.stop();
//             }
//         } else {
//             my.sprite.player.body.setAccelerationX(0);
//             my.sprite.player.body.setDragX(this.DRAG);
//             my.sprite.player.anims.play('idle', true);
//             my.vfx.walking.stop();
//         }

//         // Vertical movement (Jump)
//         if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
//             my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
//             const jumpSoundKey = 'jump_sound';
//             this.sound.play(jumpSoundKey, { volume: 0.6 }); 
//             my.vfx.jumping.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2 - 5);
//             my.vfx.jumping.explode(10);
//         }

//         // Animation and landing particles
//         if (!my.sprite.player.body.blocked.down) {
//             my.sprite.player.anims.play('jump', true);
//         } else {
//             if (wasInAir) {
//                 my.vfx.landing.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2);
//                 my.vfx.landing.explode(12);
//                 this.cameras.main.shake(100, 0.005);
//                 const landSoundKey = 'land_sound';
//                 this.sound.play(landSoundKey, { volume: 0.5 }); 
//             }
//         }
//     }

//     playFootstepSound(currentTime) {
//         if (currentTime > this.lastFootstepTime + 350) {
//             let soundKey = 'footstep_grass_' + Phaser.Math.Between(0, 4);
//             this.sound.play(soundKey, { volume: 0.3 }); 
//             this.lastFootstepTime = currentTime;
//         }
//     }

//     collectCoin(player, coin) {
//         const coinSoundKey = 'coin_collect_sound';
//         this.sound.play(coinSoundKey, { volume: 0.5 }); 
//         this.coinEmitter.setPosition(coin.x, coin.y);
//         this.coinEmitter.explode(10);
//         coin.destroy();
//         this.score += 10;
//         this.scoreText.setText(`Score: ${this.score}`);
//         this.tweens.add({
//             targets: this.scoreText, scale: 1.2, duration: 100,
//             yoyo: true, ease: 'Sine.easeInOut'
//         });
//     }

//     playerTouchWater(player, tile) {
//         console.log(`[playerTouchWater] Entered. playerDied: ${this.playerDied}, isDrowning: ${my.sprite.player ? my.sprite.player.isDrowning : 'N/A'}, invulnerable: ${my.sprite.player ? my.sprite.player.invulnerable : 'N/A'}`);
//         if (my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied && !my.sprite.player.invulnerable) { 
//             console.log("[playerTouchWater] Conditions met, processing drowning.");
//             my.sprite.player.isDrowning = true; 
//             this.playerDied = true; 

//             my.sprite.player.body.setVelocity(0, 0);
//             my.sprite.player.body.setAcceleration(0, 0);
//             my.sprite.player.anims.stop(); 

//             this.playerDiedContainer.setVisible(true);

//             const playerX = my.sprite.player.x;
//             const playerY = my.sprite.player.y;
//             this.burstBubbleEmitter.setPosition(playerX, playerY);
//             this.burstBubbleEmitter.explode(20);
//             this.tinyBubbleEmitter.setPosition(playerX, playerY);
//             this.tinyBubbleEmitter.start();
//             this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//             this.mediumBubbleEmitter.start();
//             this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             this.largeBubbleEmitter.start();

//             this.tweens.add({
//                 targets: my.sprite.player, y: my.sprite.player.y + 30,
//                 alpha: 0.5, angle: Phaser.Math.Between(-15, 15),
//                 duration: this.DROWNING_DURATION, ease: 'Power1'
//             });
//         } else {
//              console.log(`[playerTouchWater] Conditions NOT met. Bypassing. isDrowning: ${my.sprite.player ? my.sprite.player.isDrowning : 'N/A'}, playerDied: ${this.playerDied}, invulnerable: ${my.sprite.player ? my.sprite.player.invulnerable : 'N/A'}`);
//         }
//     }

//     respawnPlayer() { 
//         console.log("[RESPAWN_PLAYER] This function is mostly vestigial. Scene restart is preferred.");
//         // This function is not directly used in the current drown->restart flow.
//         // Kept for potential other uses or if direct respawn logic is ever needed.
//         // For the current flow, scene.restart() calls init() and create(), which handle player setup.
//         if (this.gameOver || !my.sprite.player) return;

//         my.sprite.player.isDrowning = false;
//         this.playerDied = false; 
//         my.sprite.player.setAlpha(1);
//         my.sprite.player.setAngle(0);
//         my.sprite.player.setRotation(0);
//         my.sprite.player.setFlipY(false);
//         this.tweens.killTweensOf(my.sprite.player);
        
//         if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.stop();
//         if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.stop();
//         if (this.largeBubbleEmitter) this.largeBubbleEmitter.stop();
//         if (this.playerDiedContainer) this.playerDiedContainer.setVisible(false);


//         my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
//         my.sprite.player.body.reset(this.spawnPoint.x, this.spawnPoint.y); // Ensure body is reset too
//         my.sprite.player.body.setVelocity(0, 0);
//         my.sprite.player.body.setAcceleration(0, 0);
//         my.sprite.player.invulnerable = true;
//         this.time.delayedCall(500, () => { if(my.sprite.player) my.sprite.player.invulnerable = false; });
//     }

//     reachEndGoal(player, endGoalObject) {
//         if (this.gameOver || !my.sprite.player || this.playerDied) return;

//         this.gameOver = true; 
//         my.sprite.player.body.setVelocity(0,0);
//         my.sprite.player.body.setAcceleration(0,0);
//         my.sprite.player.anims.play('idle', true); 
//         if(my.vfx.walking) my.vfx.walking.stop();

//         this.gameCompleteContainer.setVisible(true); 
//         this.completeText.setText(`Level Complete!\nScore: ${this.score}`);

//         const celebrationEmitter = this.add.particles(this.cameras.main.width / 2, this.cameras.main.height / 2, 'twirl_01', {
//             x: { min: -this.cameras.main.width/2 + 50, max: this.cameras.main.width/2 - 50 },
//             y: { min: -this.cameras.main.height/2 + 50, max: this.cameras.main.height/2 - 50 },
//             lifespan: 2000, speed: { min: 100, max: 300 }, scale: { start: 0.3, end: 0 },
//             gravityY: 100, blendMode: 'ADD', emitting: true, frequency: 50, quantity: 2,
//             maxParticles: 50, tint: [0xffff00, 0x00ff00, 0xff00ff]
//         }).setScrollFactor(0).setDepth(99);

//         this.time.delayedCall(3000, () => {
//             if (celebrationEmitter && celebrationEmitter.scene) { 
//                 celebrationEmitter.stop();
//                 this.time.delayedCall(2000, () => {
//                     if (celebrationEmitter && celebrationEmitter.scene) celebrationEmitter.destroy();
//                 });
//             }
//         });
//     }
// }








// class Platformer extends Phaser.Scene {
//     constructor() {
//         super("platformerScene");
//     }

//     // preload() is REMOVED - asset loading is handled by Load.js

//     init() {
//         // Variables and settings
//         this.ACCELERATION = 500;
//         this.DRAG = 1400;
//         this.physics.world.gravity.y = 1500;
//         this.JUMP_VELOCITY = -900;
//         this.DROWNING_DURATION = 1500; // Used for visual effect duration
        
//         my.vfx = {}; 
//         this.PARTICLE_VELOCITY = 60;

//         // Initialize score
//         this.score = 0;
//         this.gameOver = false; // For level completion
//         this.playerDied = false; // For player drowning death
//         this.lastFootstepTime = 0;
//     }

//     create() {
//         this.gameOver = false;
//         this.playerDied = false;


//         // Create tilemap
//         this.map = this.add.tilemap("platformer-level-1");

//         // Add tileset
//         this.tileset = this.map.addTilesetImage("tilemap_packed", "tilemap_tiles");

//         // Create layers
//         this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
//         this.groundLayer.setScale(SCALE);
//         this.groundLayer.setCollisionByProperty({ collides: true });

//         this.waterLayer = this.map.createLayer("Water", this.tileset, 0, 0);
//         this.waterLayer.setScale(SCALE);
//         this.waterLayer.setCollisionByProperty({ water: true });

//         // World and camera bounds
//         const mapWidth = this.map.widthInPixels * SCALE;
//         const mapHeight = this.map.heightInPixels * SCALE;
//         this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
//         this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

//         // Initialize particle emitters
//         this.initParticles();

//         // Groups
//         this.coinGroup = this.physics.add.group();
//         this.endGameObjectGroup = this.physics.add.group();

//         // Process objects from Tiled
//         if (this.map.getObjectLayer('Objects')) {
//             const objects = this.map.getObjectLayer('Objects').objects;
//             objects.forEach(object => {
//                 if (object.type === 'playerSpawn' || object.name === 'playerSpawn') {
//                     this.spawnPoint = { x: object.x * SCALE, y: object.y * SCALE };
//                 } else if (object.type === 'coin' || object.name === 'Coin') {
//                     const coin = this.coinGroup.create(
//                         object.x * SCALE,
//                         object.y * SCALE,
//                         'platformer_characters', 
//                         'tile_0011.png'
//                     ).setScale(SCALE);
//                     coin.body.setAllowGravity(false);
//                     coin.anims.play('coin-spin', true); 
//                     this.tweens.add({
//                         targets: coin,
//                         y: coin.y - 5, 
//                         duration: 800,
//                         yoyo: true,
//                         repeat: -1,
//                         ease: 'Sine.easeInOut'
//                     });
//                 } else if (object.class === 'end-game' || object.type === 'end-game' || object.name === 'End-Game') {
//                     const endGoal = this.endGameObjectGroup.create(
//                         object.x * SCALE + (object.width * SCALE / 2),
//                         object.y * SCALE + (object.height * SCALE / 2),
//                         null 
//                     );
//                     endGoal.setSize(object.width * SCALE, object.height * SCALE);
//                     endGoal.setOrigin(0.5, 0.5);
//                     endGoal.setVisible(false);
//                     endGoal.body.setAllowGravity(false);
//                     endGoal.body.setImmovable(true);
//                 }
//             });
//         } else {
//             this.spawnPoint = { x: 200, y: 400 }; 
//             console.warn('No "Objects" layer found in tilemap. Using default spawn point.');
//         }
        
//         if (!this.spawnPoint) {
//             this.spawnPoint = { x: 100 * SCALE, y: 100 * SCALE };
//             console.warn("Player spawn point not found. Using default.");
//         }

//         // Player avatar
//         my.sprite.player = this.physics.add.sprite(
//             this.spawnPoint.x,
//             this.spawnPoint.y,
//             "platformer_characters", 
//             "tile_0000.png"     
//         ).setScale(SCALE);
//         my.sprite.player.setCollideWorldBounds(true);
//         my.sprite.player.isDrowning = false; // This flag is still used for visual drowning state

//         // UI Text elements
//         this.scoreText = this.add.text(20, 20, 'Score: 0',
//             { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
//         ).setScrollFactor(0);

//         // Collisions
//         this.physics.add.collider(my.sprite.player, this.groundLayer);
//         this.physics.add.overlap(my.sprite.player, this.coinGroup, this.collectCoin, null, this);
//         this.physics.add.overlap(my.sprite.player, this.endGameObjectGroup, this.reachEndGoal, null, this);
//         this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, (player, tile) => {
//             // Condition to trigger drowning: not already drowning, not invulnerable, valid water tile
//             return my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied && !my.sprite.player.invulnerable && tile && tile.index !== -1 && tile.properties && tile.properties.water;
//         }, this);

//         // Input
//         if (typeof cursors === 'undefined') { 
//             cursors = this.input.keyboard.createCursorKeys(); 
//         }
//         this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

//         this.input.keyboard.on('keydown-D', () => {
//             this.physics.world.drawDebug = !this.physics.world.drawDebug;
//             this.physics.world.debugGraphic.clear();
//         }, this);

//         // Camera
//         this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1);

//         // Game Complete Screen (for winning)
//         this.gameCompleteContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
//         const completeGraphics = this.add.graphics();
//         completeGraphics.fillStyle(0x000000, 0.7);
//         completeGraphics.fillRect(-250, -150, 500, 300); 
//         this.gameCompleteContainer.add(completeGraphics);
//         this.completeText = this.add.text(0, -50, 'Level Complete!', { fontSize: '48px', color: '#00ff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
//         this.gameCompleteContainer.add(this.completeText);
//         this.playAgainWinText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
//             .setOrigin(0.5);
//         this.gameCompleteContainer.add(this.playAgainWinText);

//         // Player Died Screen (for drowning)
//         this.playerDiedContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
//         const diedGraphics = this.add.graphics();
//         diedGraphics.fillStyle(0x330000, 0.8); // Dark red background
//         diedGraphics.fillRect(-250, -150, 500, 300);
//         this.playerDiedContainer.add(diedGraphics);
//         this.playerDiedText = this.add.text(0, -50, 'You Drowned!', { fontSize: '48px', color: '#ff4444', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
//         this.playerDiedContainer.add(this.playerDiedText);
//         this.playAgainDiedText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
//             .setOrigin(0.5);
//         this.playerDiedContainer.add(this.playAgainDiedText);
//     }

//     initParticles() {
//         // Particle emitters
//         my.vfx.walking = this.add.particles(0, 0, 'smoke_03', {
//             scale: { start: 0.08, end: 0.11 }, maxAliveParticles: 9, lifespan: 280,
//             alpha: { start: 0.7, end: 0 }, frequency: 80, gravityY: -50,
//             blendMode: 'ADD', emitting: false
//         });

//         my.vfx.jumping = this.add.particles(0, 0, 'smoke_05', {
//             scale: { start: 0.15, end: 0.0 }, maxAliveParticles: 12, lifespan: 400,
//             alpha: { start: 0.9, end: 0.2 }, speed: { min: 80, max: 180 },
//             angle: { min: 240, max: 300 }, gravityY: 200,
//             emitting: false, blendMode: 'ADD'
//         });
//         my.vfx.jumping.stop();

//         my.vfx.landing = this.add.particles(0, 0, 'smoke_01', {
//             scale: { start: 0.2, end: 0.05 }, maxAliveParticles: 15, lifespan: 500,
//             alpha: { start: 0.8, end: 0 }, speed: { min: 80, max: 200 },
//             angle: { min: 180, max: 360 }, gravityY: -50, tint: 0xf8f8ff,
//             blendMode: 'ADD', emitting: false
//         });

//         this.coinEmitter = this.add.particles(0, 0, 'platformer_characters', {
//             frame: 'tile_0011.png', lifespan: 800, speed: { min: 100, max: 200 },
//             scale: { start: SCALE * 0.5, end: 0 }, gravityY: 300,
//             blendMode: 'ADD', emitting: false
//         });

//         this.tinyBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: 1000, scale: { start: 0.05, end: 0.01 }, alpha: { start: 0.4, end: 0 },
//             speed: { min: 10, max: 30 }, angle: { min: 250, max: 290 },
//             frequency: 200, quantity: 1, emitting: false, tint: 0xc0ffff, gravityY: -60
//         });
//         this.mediumBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: { min: 900, max: 1100 }, speed: { min: 40, max: 70 },
//             scale: { start: 0.1, end: 0.2 }, alpha: { start: 0.7, end: 0 },
//             frequency: 400, quantity: 1, gravityY: -80, angle: { min: 250, max: 290 },
//             emitting: false, accelerationX: { min: -10, max: 10 }, blendMode: 'ADD'
//         });
//         this.largeBubbleEmitter = this.add.particles(0, 0, 'twirl_03', {
//             lifespan: { min: 500, max: 1000 }, speed: { min: 30, max: 60 },
//             scale: { start: 0.15, end: 0.25 }, alpha: { start: 0.6, end: 0 },
//             frequency: 600, quantity: 1, gravityY: -70, angle: { min: 260, max: 280 },
//             emitting: false, accelerationX: { min: -15, max: 15 }, blendMode: 'ADD'
//         });
//         this.burstBubbleEmitter = this.add.particles(0, 0, 'twirl_01', {
//             lifespan: 800, speed: { min: 80, max: 150 },
//             scale: { start: 0.25, end: 0.05 }, alpha: { start: 0.7, end: 0 },
//             frequency: -1, gravityY: -100, emitting: false, blendMode: 'ADD'
//         });
//     }

//     update(time, delta) {
//         // Handle restart input if game is over (win or lose)
//         if (this.gameOver || this.playerDied) {
//             if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
//                 this.scene.restart();
//             }
//             // Keep player idle visuals if game is over or player died
//              if (my.sprite.player && my.sprite.player.body) {
//                  my.sprite.player.body.setAccelerationX(0);
//                  my.sprite.player.body.setDragX(this.DRAG);
//                  // Only play idle if not in the visual drowning state (isDrowning might still be true for visuals)
//                  if (!my.sprite.player.isDrowning) { 
//                     my.sprite.player.anims.play('idle', true);
//                  }
//             }
//             if(my.vfx.walking) my.vfx.walking.stop();
//             return; 
//         }
        
//         // Normal game loop if player is alive and game not won
//         if (!my.sprite.player || !my.sprite.player.body) {
//             return; 
//         }

//         // Drowning visual updates (bubbles, sinking) happen here even if playerDied is true,
//         // until ENTER is pressed. This is controlled by my.sprite.player.isDrowning
//         if (my.sprite.player.isDrowning) {
//             // This block is for visual effects of drowning. Game logic for death is handled by playerDied flag.
//             if (my.sprite.player.body) { 
//                  my.sprite.player.body.setAccelerationX(0);
//                  my.sprite.player.body.setDragX(this.DRAG); // Slow down any residual movement
//             }
//             if(my.vfx.walking) my.vfx.walking.stop();

//             const playerX = my.sprite.player.x;
//             const playerY = my.sprite.player.y;
//             if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
//             if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//             if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             // No return here, so game input check for ENTER can still happen if playerDied is also true.
//         }


//         // Player controls if not game over, not dead, and not visually drowning (for input lock)
//         if (!this.gameOver && !this.playerDied && !my.sprite.player.isDrowning) {
//             var wasInAir = !my.sprite.player.body.blocked.down;

//             // Horizontal movement
//             if (cursors.left.isDown) {
//                 my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
//                 my.sprite.player.resetFlip();
//                 my.sprite.player.anims.play('walk', true);
//                 my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
//                 my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
//                 if (my.sprite.player.body.blocked.down) {
//                     my.vfx.walking.start();
//                     this.playFootstepSound(time);
//                 } else {
//                     my.vfx.walking.stop();
//                 }
//             } else if (cursors.right.isDown) {
//                 my.sprite.player.body.setAccelerationX(this.ACCELERATION);
//                 my.sprite.player.setFlip(true, false);
//                 my.sprite.player.anims.play('walk', true);
//                 my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth / 2 + 10, my.sprite.player.displayHeight / 2 - 5, false);
//                 my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
//                 if (my.sprite.player.body.blocked.down) {
//                     my.vfx.walking.start();
//                     this.playFootstepSound(time);
//                 } else {
//                     my.vfx.walking.stop();
//                 }
//             } else {
//                 my.sprite.player.body.setAccelerationX(0);
//                 my.sprite.player.body.setDragX(this.DRAG);
//                 my.sprite.player.anims.play('idle', true);
//                 my.vfx.walking.stop();
//             }

//             // Vertical movement (Jump)
//             if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
//                 my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
//                 const jumpSoundKey = 'jump_sound';
//                 this.sound.play(jumpSoundKey, { volume: 0.6 }); 
//                 my.vfx.jumping.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2 - 5);
//                 my.vfx.jumping.explode(10);
//             }

//             // Animation and landing particles
//             if (!my.sprite.player.body.blocked.down) {
//                 my.sprite.player.anims.play('jump', true);
//             } else {
//                 if (wasInAir) {
//                     my.vfx.landing.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2);
//                     my.vfx.landing.explode(12);
//                     this.cameras.main.shake(100, 0.005);
//                     const landSoundKey = 'land_sound';
//                     this.sound.play(landSoundKey, { volume: 0.5 }); 
//                 }
//             }
//         }
//     }

//     playFootstepSound(currentTime) {
//         if (currentTime > this.lastFootstepTime + 350) {
//             let soundKey = 'footstep_grass_' + Phaser.Math.Between(0, 4);
//             this.sound.play(soundKey, { volume: 0.3 }); 
//             this.lastFootstepTime = currentTime;
//         }
//     }

//     collectCoin(player, coin) {
//         const coinSoundKey = 'coin_collect_sound';
//         this.sound.play(coinSoundKey, { volume: 0.5 }); 
//         this.coinEmitter.setPosition(coin.x, coin.y);
//         this.coinEmitter.explode(10);
//         coin.destroy();
//         this.score += 10;
//         this.scoreText.setText(`Score: ${this.score}`);
//         this.tweens.add({
//             targets: this.scoreText, scale: 1.2, duration: 100,
//             yoyo: true, ease: 'Sine.easeInOut'
//         });
//     }

//     playerTouchWater(player, tile) {
//         // This function is called only once when overlap begins due to the overlap condition in create()
//         if (my.sprite.player && !my.sprite.player.isDrowning && !this.playerDied) {
//             console.log("Player touched water - starting drown sequence.");
//             my.sprite.player.isDrowning = true; // For visual drowning effects
//             this.playerDied = true; // For game logic (awaiting restart)

//             my.sprite.player.body.setVelocity(0, 0);
//             my.sprite.player.body.setAcceleration(0, 0);
//             my.sprite.player.anims.stop(); 

//             // Show "You Drowned!" screen
//             this.playerDiedContainer.setVisible(true);

//             // Drowning visual effects
//             const playerX = my.sprite.player.x;
//             const playerY = my.sprite.player.y;
//             this.burstBubbleEmitter.setPosition(playerX, playerY);
//             this.burstBubbleEmitter.explode(20);
//             this.tinyBubbleEmitter.setPosition(playerX, playerY);
//             this.tinyBubbleEmitter.start();
//             this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//             this.mediumBubbleEmitter.start();
//             this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             this.largeBubbleEmitter.start();

//             this.tweens.add({
//                 targets: my.sprite.player, y: my.sprite.player.y + 30,
//                 alpha: 0.5, angle: Phaser.Math.Between(-15, 15),
//                 duration: this.DROWNING_DURATION, ease: 'Power1'
//             });
            
//             // No automatic respawn timer, wait for ENTER key in update()
//         }
//     }

//     respawnPlayer() {
//         // This function is effectively not used anymore for drowning,
//         // as scene.restart() handles the full reset.
//         // It's kept here in case it's needed for other reset mechanisms in the future
//         // or if create() relies on some of these being explicitly reset.
//         // For the current drowning->restart flow, init() and create() will re-initialize the player.
//         console.log("respawnPlayer called - this should generally not happen with scene.restart for drowning.");
//         if (this.gameOver || !my.sprite.player) return;

//         my.sprite.player.isDrowning = false;
//         this.playerDied = false; // Reset this flag too
//         my.sprite.player.setAlpha(1);
//         my.sprite.player.setAngle(0);
//         my.sprite.player.setRotation(0);
//         my.sprite.player.setFlipY(false);
//         this.tweens.killTweensOf(my.sprite.player);
        
//         if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.stop();
//         if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.stop();
//         if (this.largeBubbleEmitter) this.largeBubbleEmitter.stop();
//         if (this.playerDiedContainer) this.playerDiedContainer.setVisible(false);


//         my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
//         my.sprite.player.body.setVelocity(0, 0);
//         my.sprite.player.body.setAcceleration(0, 0);
//         my.sprite.player.invulnerable = true;
//         this.time.delayedCall(500, () => { if(my.sprite.player) my.sprite.player.invulnerable = false; });
//     }

//     reachEndGoal(player, endGoalObject) {
//         if (this.gameOver || !my.sprite.player || this.playerDied) return;

//         this.gameOver = true; // Set game over for winning
//         my.sprite.player.body.setVelocity(0,0);
//         my.sprite.player.body.setAcceleration(0,0);
//         my.sprite.player.anims.play('idle', true); 
//         if(my.vfx.walking) my.vfx.walking.stop();

//         this.gameCompleteContainer.setVisible(true); // Show win screen
//         this.completeText.setText(`Level Complete!\nScore: ${this.score}`);

//         const celebrationEmitter = this.add.particles(this.cameras.main.width / 2, this.cameras.main.height / 2, 'twirl_01', {
//             x: { min: -this.cameras.main.width/2 + 50, max: this.cameras.main.width/2 - 50 },
//             y: { min: -this.cameras.main.height/2 + 50, max: this.cameras.main.height/2 - 50 },
//             lifespan: 2000, speed: { min: 100, max: 300 }, scale: { start: 0.3, end: 0 },
//             gravityY: 100, blendMode: 'ADD', emitting: true, frequency: 50, quantity: 2,
//             maxParticles: 50, tint: [0xffff00, 0x00ff00, 0xff00ff]
//         }).setScrollFactor(0).setDepth(99);

//         this.time.delayedCall(3000, () => {
//             celebrationEmitter.stop();
//             this.time.delayedCall(2000, () => celebrationEmitter.destroy());
//         });
//     }
// }





// class Platformer extends Phaser.Scene {
//     constructor() {
//         super("platformerScene");
//     }

//     // preload() is REMOVED - asset loading is handled by Load.js

//     init() {
//         // Variables and settings
//         this.ACCELERATION = 500;
//         this.DRAG = 1400;
//         this.physics.world.gravity.y = 1500;
//         this.JUMP_VELOCITY = -900;
//         this.DROWNING_DURATION = 1500;
        
//         my.vfx = {}; 
//         this.PARTICLE_VELOCITY = 60;

//         // Initialize score
//         this.score = 0;
//         this.gameOver = false;
//         this.lastFootstepTime = 0;
//     }

//     create() {
//         this.gameOver = false;

//         // Create tilemap
//         this.map = this.add.tilemap("platformer-level-1");

//         // Add tileset
//         this.tileset = this.map.addTilesetImage("tilemap_packed", "tilemap_tiles");

//         // Create layers
//         this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
//         this.groundLayer.setScale(SCALE);
//         this.groundLayer.setCollisionByProperty({ collides: true });

//         this.waterLayer = this.map.createLayer("Water", this.tileset, 0, 0);
//         this.waterLayer.setScale(SCALE);
//         this.waterLayer.setCollisionByProperty({ water: true });

//         // World and camera bounds
//         const mapWidth = this.map.widthInPixels * SCALE;
//         const mapHeight = this.map.heightInPixels * SCALE;
//         this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
//         this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

//         // Initialize particle emitters
//         this.initParticles();

//         // Groups
//         this.coinGroup = this.physics.add.group();
//         this.endGameObjectGroup = this.physics.add.group();

//         // Process objects from Tiled
//         if (this.map.getObjectLayer('Objects')) {
//             const objects = this.map.getObjectLayer('Objects').objects;
//             objects.forEach(object => {
//                 if (object.type === 'playerSpawn' || object.name === 'playerSpawn') {
//                     this.spawnPoint = { x: object.x * SCALE, y: object.y * SCALE };
//                 } else if (object.type === 'coin' || object.name === 'Coin') {
//                     const coin = this.coinGroup.create(
//                         object.x * SCALE,
//                         object.y * SCALE,
//                         'platformer_characters', 
//                         'tile_0011.png'
//                     ).setScale(SCALE);
//                     coin.body.setAllowGravity(false);
//                     coin.anims.play('coin-spin', true); // Coin animation is played
//                     this.tweens.add({
//                         targets: coin,
//                         y: coin.y - 5, 
//                         duration: 800,
//                         yoyo: true,
//                         repeat: -1,
//                         ease: 'Sine.easeInOut'
//                     });
//                 } else if (object.class === 'end-game' || object.type === 'end-game' || object.name === 'End-Game') {
//                     const endGoal = this.endGameObjectGroup.create(
//                         object.x * SCALE + (object.width * SCALE / 2),
//                         object.y * SCALE + (object.height * SCALE / 2),
//                         null 
//                     );
//                     endGoal.setSize(object.width * SCALE, object.height * SCALE);
//                     endGoal.setOrigin(0.5, 0.5);
//                     endGoal.setVisible(false);
//                     endGoal.body.setAllowGravity(false);
//                     endGoal.body.setImmovable(true);
//                 }
//             });
//         } else {
//             this.spawnPoint = { x: 200, y: 400 }; 
//             console.warn('No "Objects" layer found in tilemap. Using default spawn point.');
//         }
        
//         if (!this.spawnPoint) {
//             this.spawnPoint = { x: 100 * SCALE, y: 100 * SCALE };
//             console.warn("Player spawn point not found. Using default.");
//         }

//         // Player avatar
//         my.sprite.player = this.physics.add.sprite(
//             this.spawnPoint.x,
//             this.spawnPoint.y,
//             "platformer_characters", 
//             "tile_0000.png"     
//         ).setScale(SCALE);
//         my.sprite.player.setCollideWorldBounds(true);
//         my.sprite.player.isDrowning = false;

//         // UI Text elements
//         this.drowningText = this.add.text(
//             this.cameras.main.width / 2, this.cameras.main.height / 3, 'DROWNING!',
//             { fontFamily: 'Arial', fontSize: '32px', color: '#ff0000', stroke: '#000000', strokeThickness: 4 }
//         ).setOrigin(0.5).setVisible(false).setScrollFactor(0);

//         this.scoreText = this.add.text(20, 20, 'Score: 0',
//             { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
//         ).setScrollFactor(0);

//         // Collisions
//         this.physics.add.collider(my.sprite.player, this.groundLayer);
//         this.physics.add.overlap(my.sprite.player, this.coinGroup, this.collectCoin, null, this);
//         this.physics.add.overlap(my.sprite.player, this.endGameObjectGroup, this.reachEndGoal, null, this);
//         this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, (player, tile) => {
//             return !my.sprite.player.isDrowning && !my.sprite.player.invulnerable && tile && tile.index !== -1 && tile.properties && tile.properties.water;
//         }, this);

//         // Input
//         if (typeof cursors === 'undefined') { 
//             cursors = this.input.keyboard.createCursorKeys(); 
//         }
//         // Define Enter Key for restarting
//         this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

//         this.input.keyboard.on('keydown-D', () => {
//             this.physics.world.drawDebug = !this.physics.world.drawDebug;
//             this.physics.world.debugGraphic.clear();
//         }, this);

//         // Camera
//         this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1);

//         // Game Complete Screen
//         this.gameCompleteContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
//         const graphics = this.add.graphics();
//         graphics.fillStyle(0x000000, 0.7);
//         graphics.fillRect(-250, -150, 500, 300); // Adjusted width for longer text
//         this.gameCompleteContainer.add(graphics);
//         this.completeText = this.add.text(0, -50, 'Level Complete!', { fontSize: '48px', color: '#00ff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
//         this.gameCompleteContainer.add(this.completeText);
        
//         // Changed "Play Again" button to a text display
//         this.playAgainText = this.add.text(0, 50, 'Press ENTER to Play Again', { fontSize: '28px', color: '#ffff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 3 })
//             .setOrigin(0.5);
//         this.gameCompleteContainer.add(this.playAgainText);
//     }

//     initParticles() {
//         // Particle emitters
//         my.vfx.walking = this.add.particles(0, 0, 'smoke_03', {
//             scale: { start: 0.08, end: 0.11 }, maxAliveParticles: 9, lifespan: 280,
//             alpha: { start: 0.7, end: 0 }, frequency: 80, gravityY: -50,
//             blendMode: 'ADD', emitting: false
//         });

//         my.vfx.jumping = this.add.particles(0, 0, 'smoke_05', {
//             scale: { start: 0.15, end: 0.0 }, maxAliveParticles: 12, lifespan: 400,
//             alpha: { start: 0.9, end: 0.2 }, speed: { min: 80, max: 180 },
//             angle: { min: 240, max: 300 }, gravityY: 200,
//             emitting: false, blendMode: 'ADD'
//         });
//         my.vfx.jumping.stop();

//         my.vfx.landing = this.add.particles(0, 0, 'smoke_01', {
//             scale: { start: 0.2, end: 0.05 }, maxAliveParticles: 15, lifespan: 500,
//             alpha: { start: 0.8, end: 0 }, speed: { min: 80, max: 200 },
//             angle: { min: 180, max: 360 }, gravityY: -50, tint: 0xf8f8ff,
//             blendMode: 'ADD', emitting: false
//         });

//         this.coinEmitter = this.add.particles(0, 0, 'platformer_characters', {
//             frame: 'tile_0011.png', lifespan: 800, speed: { min: 100, max: 200 },
//             scale: { start: SCALE * 0.5, end: 0 }, gravityY: 300,
//             blendMode: 'ADD', emitting: false
//         });

//         this.tinyBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: 1000, scale: { start: 0.05, end: 0.01 }, alpha: { start: 0.4, end: 0 },
//             speed: { min: 10, max: 30 }, angle: { min: 250, max: 290 },
//             frequency: 200, quantity: 1, emitting: false, tint: 0xc0ffff, gravityY: -60
//         });
//         this.mediumBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: { min: 900, max: 1100 }, speed: { min: 40, max: 70 },
//             scale: { start: 0.1, end: 0.2 }, alpha: { start: 0.7, end: 0 },
//             frequency: 400, quantity: 1, gravityY: -80, angle: { min: 250, max: 290 },
//             emitting: false, accelerationX: { min: -10, max: 10 }, blendMode: 'ADD'
//         });
//         this.largeBubbleEmitter = this.add.particles(0, 0, 'twirl_03', {
//             lifespan: { min: 500, max: 1000 }, speed: { min: 30, max: 60 },
//             scale: { start: 0.15, end: 0.25 }, alpha: { start: 0.6, end: 0 },
//             frequency: 600, quantity: 1, gravityY: -70, angle: { min: 260, max: 280 },
//             emitting: false, accelerationX: { min: -15, max: 15 }, blendMode: 'ADD'
//         });
//         this.burstBubbleEmitter = this.add.particles(0, 0, 'twirl_01', {
//             lifespan: 800, speed: { min: 80, max: 150 },
//             scale: { start: 0.25, end: 0.05 }, alpha: { start: 0.7, end: 0 },
//             frequency: -1, gravityY: -100, emitting: false, blendMode: 'ADD'
//         });
//     }

//     update(time, delta) {
//         if (this.gameOver) { // Check for game over first
//             if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
//                 this.scene.restart();
//             }
//             // Keep player idle if game is over
//              if (my.sprite.player && my.sprite.player.body) {
//                  my.sprite.player.body.setAccelerationX(0);
//                  my.sprite.player.body.setDragX(this.DRAG);
//                  my.sprite.player.anims.play('idle', true);
//             }
//             if(my.vfx.walking) my.vfx.walking.stop();
//             return; 
//         }
        
//         if (my.sprite.player && my.sprite.player.isDrowning) {
//             if (my.sprite.player.body) { 
//                  my.sprite.player.body.setAccelerationX(0);
//                  my.sprite.player.body.setDragX(this.DRAG);
//             }
//             if(my.vfx.walking) my.vfx.walking.stop();

//             if (my.sprite.player.isDrowning) { 
//                 const playerX = my.sprite.player.x;
//                 const playerY = my.sprite.player.y;
//                 if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
//                 if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//                 if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             }
//             return; 
//         }

//         if (!my.sprite.player || !my.sprite.player.body) {
//             return; 
//         }

//         var wasInAir = !my.sprite.player.body.blocked.down;

//         // Horizontal movement
//         if (cursors.left.isDown) {
//             my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
//             my.sprite.player.resetFlip();
//             my.sprite.player.anims.play('walk', true);
//             my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
//             my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
//             if (my.sprite.player.body.blocked.down) {
//                 my.vfx.walking.start();
//                 this.playFootstepSound(time);
//             } else {
//                 my.vfx.walking.stop();
//             }
//         } else if (cursors.right.isDown) {
//             my.sprite.player.body.setAccelerationX(this.ACCELERATION);
//             my.sprite.player.setFlip(true, false);
//             my.sprite.player.anims.play('walk', true);
//             my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth / 2 + 10, my.sprite.player.displayHeight / 2 - 5, false);
//             my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
//             if (my.sprite.player.body.blocked.down) {
//                 my.vfx.walking.start();
//                 this.playFootstepSound(time);
//             } else {
//                 my.vfx.walking.stop();
//             }
//         } else {
//             my.sprite.player.body.setAccelerationX(0);
//             my.sprite.player.body.setDragX(this.DRAG);
//             my.sprite.player.anims.play('idle', true);
//             my.vfx.walking.stop();
//         }

//         // Vertical movement (Jump)
//         if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
//             my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
//             const jumpSoundKey = 'jump_sound';
//             this.sound.play(jumpSoundKey, { volume: 0.6 }); // Direct play, no exists check
//             my.vfx.jumping.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2 - 5);
//             my.vfx.jumping.explode(10);
//         }

//         // Animation and landing particles
//         if (!my.sprite.player.body.blocked.down) {
//             my.sprite.player.anims.play('jump', true);
//         } else {
//             if (wasInAir) {
//                 my.vfx.landing.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2);
//                 my.vfx.landing.explode(12);
//                 this.cameras.main.shake(100, 0.005);
//                 const landSoundKey = 'land_sound';
//                 this.sound.play(landSoundKey, { volume: 0.5 }); // Direct play, no exists check
//             }
//         }
//     }

//     playFootstepSound(currentTime) {
//         if (currentTime > this.lastFootstepTime + 350) {
//             let soundKey = 'footstep_grass_' + Phaser.Math.Between(0, 4);
//             this.sound.play(soundKey, { volume: 0.3 }); // Direct play, no exists check
//             this.lastFootstepTime = currentTime;
//         }
//     }

//     collectCoin(player, coin) {
//         const coinSoundKey = 'coin_collect_sound';
//         this.sound.play(coinSoundKey, { volume: 0.5 }); // Direct play, no exists check
//         this.coinEmitter.setPosition(coin.x, coin.y);
//         this.coinEmitter.explode(10);
//         coin.destroy();
//         this.score += 10;
//         this.scoreText.setText(`Score: ${this.score}`);
//         this.tweens.add({
//             targets: this.scoreText, scale: 1.2, duration: 100,
//             yoyo: true, ease: 'Sine.easeInOut'
//         });
//     }

//     playerTouchWater(player, tile) {
//         if (my.sprite.player && !my.sprite.player.isDrowning && tile && tile.index !== -1) {
//             my.sprite.player.isDrowning = true;
//             this.drowningText.setVisible(true);
//             my.sprite.player.body.setVelocity(0, 0);
//             my.sprite.player.body.setAcceleration(0, 0);
//             my.sprite.player.anims.stop(); 

//             // const drownSoundKey = 'drown_sound'; // Example if you add a drown sound
//             // this.sound.play(drownSoundKey, { volume: 0.5 }); // Direct play

//             const playerX = my.sprite.player.x;
//             const playerY = my.sprite.player.y;
//             this.burstBubbleEmitter.setPosition(playerX, playerY);
//             this.burstBubbleEmitter.explode(20);
//             this.tinyBubbleEmitter.setPosition(playerX, playerY);
//             this.tinyBubbleEmitter.start();
//             this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//             this.mediumBubbleEmitter.start();
//             this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             this.largeBubbleEmitter.start();

//             this.tweens.add({
//                 targets: my.sprite.player, y: my.sprite.player.y + 30,
//                 alpha: 0.5, angle: Phaser.Math.Between(-15, 15),
//                 duration: this.DROWNING_DURATION, ease: 'Power1'
//             });
//             this.tweens.add({
//                 targets: this.drowningText, alpha: 0.3, yoyo: true,
//                 repeat: -1, duration: 300 
//             });
//             this.time.delayedCall(this.DROWNING_DURATION, this.respawnPlayer, [], this);
//         }
//     }

//     respawnPlayer() {
//         if (this.gameOver || !my.sprite.player) return;

//         my.sprite.player.isDrowning = false;
//         my.sprite.player.setAlpha(1);
//         my.sprite.player.setAngle(0);
//         my.sprite.player.setRotation(0);
//         my.sprite.player.setFlipY(false);
//         this.tweens.killTweensOf(my.sprite.player);
//         this.tweens.killTweensOf(this.drowningText); 

//         if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.stop();
//         if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.stop();
//         if (this.largeBubbleEmitter) this.largeBubbleEmitter.stop();

//         my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
//         my.sprite.player.body.setVelocity(0, 0);
//         my.sprite.player.body.setAcceleration(0, 0);
//         my.sprite.player.invulnerable = true;
//         this.time.delayedCall(500, () => { if(my.sprite.player) my.sprite.player.invulnerable = false; });
//         this.drowningText.setVisible(false);
//         // this.missingSoundLogged = {}; // Removed as sound.exists checks are removed
//     }

//     reachEndGoal(player, endGoalObject) {
//         if (this.gameOver || !my.sprite.player) return;

//         this.gameOver = true;
//         my.sprite.player.body.setVelocity(0,0);
//         my.sprite.player.body.setAcceleration(0,0);
//         my.sprite.player.anims.play('idle', true); 
//         if(my.vfx.walking) my.vfx.walking.stop();

//         this.gameCompleteContainer.setVisible(true);
//         this.completeText.setText(`Level Complete!\nScore: ${this.score}`);

//         const celebrationEmitter = this.add.particles(this.cameras.main.width / 2, this.cameras.main.height / 2, 'twirl_01', {
//             x: { min: -this.cameras.main.width/2 + 50, max: this.cameras.main.width/2 - 50 },
//             y: { min: -this.cameras.main.height/2 + 50, max: this.cameras.main.height/2 - 50 },
//             lifespan: 2000, speed: { min: 100, max: 300 }, scale: { start: 0.3, end: 0 },
//             gravityY: 100, blendMode: 'ADD', emitting: true, frequency: 50, quantity: 2,
//             maxParticles: 50, tint: [0xffff00, 0x00ff00, 0xff00ff]
//         }).setScrollFactor(0).setDepth(99);

//         this.time.delayedCall(3000, () => {
//             celebrationEmitter.stop();
//             this.time.delayedCall(2000, () => celebrationEmitter.destroy());
//         });
//     }
// }


// class Platformer extends Phaser.Scene {
//     constructor() {
//         super("platformerScene");
//     }

//     // preload() is REMOVED - asset loading is handled by Load.js

//     init() {
//         // Variables and settings
//         this.ACCELERATION = 500;
//         this.DRAG = 1400;
//         this.physics.world.gravity.y = 1500;
//         this.JUMP_VELOCITY = -900;
//         this.DROWNING_DURATION = 1500;
        
//         // Initialize vfx for this scene under the global 'my' object
//         // If my.vfx is intended to be shared across scenes and initialized elsewhere,
//         // this line might clear it. If it's scene-specific, this is fine.
//         my.vfx = {}; 
//         this.PARTICLE_VELOCITY = 60;

//         // Initialize score
//         this.score = 0;
//         this.gameOver = false;
//         this.lastFootstepTime = 0;
//     }

//     create() {
//         this.gameOver = false;

//         // Create tilemap
//         // The key "platformer-level-1" should match the key used in Load.js for the tilemap JSON
//         this.map = this.add.tilemap("platformer-level-1");

//         // Add tileset
//         // "tilemap_tiles" is the key for the tileset image loaded in Load.js
//         // "tilemap_packed" is the name of the tileset in Tiled
//         this.tileset = this.map.addTilesetImage("tilemap_packed", "tilemap_tiles");

//         // Create layers
//         this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
//         this.groundLayer.setScale(SCALE);
//         this.groundLayer.setCollisionByProperty({ collides: true });

//         this.waterLayer = this.map.createLayer("Water", this.tileset, 0, 0);
//         this.waterLayer.setScale(SCALE);
//         this.waterLayer.setCollisionByProperty({ water: true });

//         // World and camera bounds
//         const mapWidth = this.map.widthInPixels * SCALE;
//         const mapHeight = this.map.heightInPixels * SCALE;
//         this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
//         this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

//         // Initialize particle emitters (uses keys for textures loaded in Load.js)
//         this.initParticles();

//         // Groups
//         this.coinGroup = this.physics.add.group();
//         this.endGameObjectGroup = this.physics.add.group();

//         // Process objects from Tiled
//         // Ensure your Tiled "Objects" layer contains objects with correct 'type' or 'name' or 'class'
//         if (this.map.getObjectLayer('Objects')) {
//             const objects = this.map.getObjectLayer('Objects').objects;
//             objects.forEach(object => {
//                 if (object.type === 'playerSpawn' || object.name === 'playerSpawn') {
//                     this.spawnPoint = { x: object.x * SCALE, y: object.y * SCALE };
//                 } else if (object.type === 'coin' || object.name === 'Coin') {
//                     const coin = this.coinGroup.create(
//                         object.x * SCALE,
//                         object.y * SCALE,
//                         'platformer_characters', // Atlas key
//                         'tile_0011.png'         // Default frame for coin from atlas
//                     ).setScale(SCALE);
//                     coin.body.setAllowGravity(false);
//                     coin.anims.play('coin-spin', true); // Play coin animation from Load.js
//                     this.tweens.add({
//                         targets: coin,
//                         y: coin.y - 5, // Slight bobbing effect
//                         duration: 800,
//                         yoyo: true,
//                         repeat: -1,
//                         ease: 'Sine.easeInOut'
//                     });
//                 } else if (object.class === 'end-game' || object.type === 'end-game' || object.name === 'End-Game') {
//                     const endGoal = this.endGameObjectGroup.create(
//                         object.x * SCALE + (object.width * SCALE / 2),
//                         object.y * SCALE + (object.height * SCALE / 2),
//                         null 
//                     );
//                     endGoal.setSize(object.width * SCALE, object.height * SCALE);
//                     endGoal.setOrigin(0.5, 0.5);
//                     endGoal.setVisible(false);
//                     endGoal.body.setAllowGravity(false);
//                     endGoal.body.setImmovable(true);
//                 }
//             });
//         } else {
//             this.spawnPoint = { x: 200, y: 400 }; // Fallback
//             console.warn('No "Objects" layer found in tilemap. Using default spawn point.');
//         }
        
//         if (!this.spawnPoint) {
//             this.spawnPoint = { x: 100 * SCALE, y: 100 * SCALE };
//             console.warn("Player spawn point not found. Using default.");
//         }

//         // Player avatar
//         // "platformer_characters" is the atlas key, "tile_0000.png" is the initial frame from the atlas
//         my.sprite.player = this.physics.add.sprite(
//             this.spawnPoint.x,
//             this.spawnPoint.y,
//             "platformer_characters", 
//             "tile_0000.png"     
//         ).setScale(SCALE);
//         my.sprite.player.setCollideWorldBounds(true);
//         my.sprite.player.isDrowning = false;

//         // UI Text elements
//         this.drowningText = this.add.text(
//             this.cameras.main.width / 2, this.cameras.main.height / 3, 'DROWNING!',
//             { fontFamily: 'Arial', fontSize: '32px', color: '#ff0000', stroke: '#000000', strokeThickness: 4 }
//         ).setOrigin(0.5).setVisible(false).setScrollFactor(0);

//         this.scoreText = this.add.text(20, 20, 'Score: 0',
//             { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 }
//         ).setScrollFactor(0);

//         // Collisions
//         this.physics.add.collider(my.sprite.player, this.groundLayer);
//         this.physics.add.overlap(my.sprite.player, this.coinGroup, this.collectCoin, null, this);
//         this.physics.add.overlap(my.sprite.player, this.endGameObjectGroup, this.reachEndGoal, null, this);
//         this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, (player, tile) => {
//             return !my.sprite.player.isDrowning && !my.sprite.player.invulnerable && tile && tile.index !== -1 && tile.properties && tile.properties.water;
//         }, this);

//         // Input
//         // 'cursors' should be initialized in main.js if it's global, or here if scene-specific
//         if (typeof cursors === 'undefined') { 
//             cursors = this.input.keyboard.createCursorKeys(); 
//         }
//         this.input.keyboard.on('keydown-D', () => {
//             this.physics.world.drawDebug = !this.physics.world.drawDebug;
//             this.physics.world.debugGraphic.clear();
//         }, this);

//         // Camera
//         this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1);

//         // Game Complete Screen
//         this.gameCompleteContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2).setScrollFactor(0).setVisible(false).setDepth(100);
//         const graphics = this.add.graphics();
//         graphics.fillStyle(0x000000, 0.7);
//         graphics.fillRect(-200, -150, 400, 300);
//         this.gameCompleteContainer.add(graphics);
//         this.completeText = this.add.text(0, -50, 'Level Complete!', { fontSize: '48px', color: '#00ff00', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
//         this.gameCompleteContainer.add(this.completeText);
//         this.playAgainButton = this.add.text(0, 50, 'Play Again?', { fontSize: '32px', color: '#ffff00', fontFamily: 'Arial', backgroundColor: '#555555', padding: { x: 10, y: 5 }, stroke: '#000000', strokeThickness: 3 })
//             .setOrigin(0.5)
//             .setInteractive({ useHandCursor: true })
//             .on('pointerdown', () => this.scene.restart())
//             .on('pointerover', () => this.playAgainButton.setStyle({ fill: '#ffdd00' }))
//             .on('pointerout', () => this.playAgainButton.setStyle({ fill: '#ffff00' }));
//         this.gameCompleteContainer.add(this.playAgainButton);

//         // Player Animations are now defined in Load.js
//         // Ensure keys 'walk', 'idle', 'jump' are available from Load.js
//     }

//     initParticles() {
//         // Particle emitters - keys like 'smoke_03' must match those loaded in Load.js
//         my.vfx.walking = this.add.particles(0, 0, 'smoke_03', {
//             scale: { start: 0.08, end: 0.11 }, maxAliveParticles: 9, lifespan: 280,
//             alpha: { start: 0.7, end: 0 }, frequency: 80, gravityY: -50,
//             blendMode: 'ADD', emitting: false
//         });

//         my.vfx.jumping = this.add.particles(0, 0, 'smoke_05', {
//             scale: { start: 0.15, end: 0.0 }, maxAliveParticles: 12, lifespan: 400,
//             alpha: { start: 0.9, end: 0.2 }, speed: { min: 80, max: 180 },
//             angle: { min: 240, max: 300 }, gravityY: 200,
//             emitting: false, blendMode: 'ADD'
//         });
//         my.vfx.jumping.stop();

//         my.vfx.landing = this.add.particles(0, 0, 'smoke_01', {
//             scale: { start: 0.2, end: 0.05 }, maxAliveParticles: 15, lifespan: 500,
//             alpha: { start: 0.8, end: 0 }, speed: { min: 80, max: 200 },
//             angle: { min: 180, max: 360 }, gravityY: -50, tint: 0xf8f8ff,
//             blendMode: 'ADD', emitting: false
//         });

//         // Coin collection particles use 'platformer_characters' atlas and 'tile_0011.png' frame
//         this.coinEmitter = this.add.particles(0, 0, 'platformer_characters', {
//             frame: 'tile_0011.png', lifespan: 800, speed: { min: 100, max: 200 },
//             scale: { start: SCALE * 0.5, end: 0 }, gravityY: 300,
//             blendMode: 'ADD', emitting: false
//         });

//         // Bubble particles for drowning - use 'twirl_02', 'twirl_03', 'twirl_01' keys
//         this.tinyBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: 1000, scale: { start: 0.05, end: 0.01 }, alpha: { start: 0.4, end: 0 },
//             speed: { min: 10, max: 30 }, angle: { min: 250, max: 290 },
//             frequency: 200, quantity: 1, emitting: false, tint: 0xc0ffff, gravityY: -60
//         });
//         this.mediumBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
//             lifespan: { min: 900, max: 1100 }, speed: { min: 40, max: 70 },
//             scale: { start: 0.1, end: 0.2 }, alpha: { start: 0.7, end: 0 },
//             frequency: 400, quantity: 1, gravityY: -80, angle: { min: 250, max: 290 },
//             emitting: false, accelerationX: { min: -10, max: 10 }, blendMode: 'ADD'
//         });
//         this.largeBubbleEmitter = this.add.particles(0, 0, 'twirl_03', {
//             lifespan: { min: 500, max: 1000 }, speed: { min: 30, max: 60 },
//             scale: { start: 0.15, end: 0.25 }, alpha: { start: 0.6, end: 0 },
//             frequency: 600, quantity: 1, gravityY: -70, angle: { min: 260, max: 280 },
//             emitting: false, accelerationX: { min: -15, max: 15 }, blendMode: 'ADD'
//         });
//         this.burstBubbleEmitter = this.add.particles(0, 0, 'twirl_01', {
//             lifespan: 800, speed: { min: 80, max: 150 },
//             scale: { start: 0.25, end: 0.05 }, alpha: { start: 0.7, end: 0 },
//             frequency: -1, gravityY: -100, emitting: false, blendMode: 'ADD'
//         });
//     }

//     update(time, delta) {
//         if (this.gameOver || (my.sprite.player && my.sprite.player.isDrowning)) {
//             if (my.sprite.player && my.sprite.player.body) {
//                  my.sprite.player.body.setAccelerationX(0);
//                  my.sprite.player.body.setDragX(this.DRAG);
//                  if (!my.sprite.player.isDrowning) {
//                     my.sprite.player.anims.play('idle', true); // Uses 'idle' animation from Load.js
//                  }
//             }
//             if(my.vfx.walking) my.vfx.walking.stop();

//             if (my.sprite.player && my.sprite.player.isDrowning) {
//                 const playerX = my.sprite.player.x;
//                 const playerY = my.sprite.player.y;
//                 if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.setPosition(playerX, playerY);
//                 if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//                 if (this.largeBubbleEmitter) this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             }
//             return; 
//         }

//         // Ensure player sprite and body exist before trying to access them
//         if (!my.sprite.player || !my.sprite.player.body) {
//             return; // Or handle error appropriately
//         }

//         var wasInAir = !my.sprite.player.body.blocked.down;

//         // Horizontal movement
//         if (cursors.left.isDown) {
//             my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
//             my.sprite.player.resetFlip();
//             my.sprite.player.anims.play('walk', true); // Uses 'walk' animation from Load.js
//             my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
//             my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
//             if (my.sprite.player.body.blocked.down) {
//                 my.vfx.walking.start();
//                 this.playFootstepSound(time);
//             } else {
//                 my.vfx.walking.stop();
//             }
//         } else if (cursors.right.isDown) {
//             my.sprite.player.body.setAccelerationX(this.ACCELERATION);
//             my.sprite.player.setFlip(true, false);
//             my.sprite.player.anims.play('walk', true); // Uses 'walk' animation from Load.js
//             my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth / 2 + 10, my.sprite.player.displayHeight / 2 - 5, false);
//             my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
//             if (my.sprite.player.body.blocked.down) {
//                 my.vfx.walking.start();
//                 this.playFootstepSound(time);
//             } else {
//                 my.vfx.walking.stop();
//             }
//         } else {
//             my.sprite.player.body.setAccelerationX(0);
//             my.sprite.player.body.setDragX(this.DRAG);
//             my.sprite.player.anims.play('idle', true); // Uses 'idle' animation from Load.js
//             my.vfx.walking.stop();
//         }

//         // Vertical movement (Jump)
//         if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
//             my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
//             const jumpSoundKey = 'jump_sound';
//             // Ensure 'jump_sound' is loaded in Load.js
//             this.sound.play(jumpSoundKey, { volume: 0.6 }); 
           

//             my.vfx.jumping.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2 - 5);
//             my.vfx.jumping.explode(10);
//         }

//         // Animation and landing particles
//         if (!my.sprite.player.body.blocked.down) {
//             my.sprite.player.anims.play('jump', true); // Uses 'jump' animation from Load.js (frame tile_0001.png)
//         } else {
//             if (wasInAir) {
//                 my.vfx.landing.setPosition(my.sprite.player.x, my.sprite.player.y + my.sprite.player.displayHeight / 2);
//                 my.vfx.landing.explode(12);
//                 this.cameras.main.shake(100, 0.005);
//                 const landSoundKey = 'land_sound';
//                 this.sound.play(landSoundKey, { volume: 0.5 });
//             }
//         }
//     }

//     playFootstepSound(currentTime) {
//         if (currentTime > this.lastFootstepTime + 350) {
//             let soundKey = 'footstep_grass_' + Phaser.Math.Between(0, 4);
//             this.sound.play(soundKey, { volume: 0.3 });
//             this.lastFootstepTime = currentTime;
//         }
//     }

//     collectCoin(player, coin) {
//         const coinSoundKey = 'coin_collect_sound';
//         this.sound.play(coinSoundKey, { volume: 0.5 });
//         this.coinEmitter.setPosition(coin.x, coin.y);
//         this.coinEmitter.explode(10);
//         coin.destroy();
//         this.score += 10;
//         this.scoreText.setText(`Score: ${this.score}`);
//         this.tweens.add({
//             targets: this.scoreText, scale: 1.2, duration: 100,
//             yoyo: true, ease: 'Sine.easeInOut'
//         });
//     }

//     playerTouchWater(player, tile) {
//         if (my.sprite.player && !my.sprite.player.isDrowning && tile && tile.index !== -1) {
//             my.sprite.player.isDrowning = true;
//             this.drowningText.setVisible(true);
//             my.sprite.player.body.setVelocity(0, 0);
//             my.sprite.player.body.setAcceleration(0, 0);
//             my.sprite.player.anims.stop(); 

//             const drownSoundKey = 'drown_sound';
//             this.sound.play(drownSoundKey, { volume: 0.5 });

//             const playerX = my.sprite.player.x;
//             const playerY = my.sprite.player.y;
//             this.burstBubbleEmitter.setPosition(playerX, playerY);
//             this.burstBubbleEmitter.explode(20);
//             this.tinyBubbleEmitter.setPosition(playerX, playerY);
//             this.tinyBubbleEmitter.start();
//             this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
//             this.mediumBubbleEmitter.start();
//             this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
//             this.largeBubbleEmitter.start();

//             this.tweens.add({
//                 targets: my.sprite.player, y: my.sprite.player.y + 30,
//                 alpha: 0.5, angle: Phaser.Math.Between(-15, 15),
//                 duration: this.DROWNING_DURATION, ease: 'Power1'
//             });
//             this.tweens.add({
//                 targets: this.drowningText, alpha: 0.3, yoyo: true,
//                 repeat: -1, duration: 300 // Loop indefinitely
//             });
//             this.time.delayedCall(this.DROWNING_DURATION, this.respawnPlayer, [], this);
//         }
//     }

//     respawnPlayer() {
//         if (this.gameOver || !my.sprite.player) return;

//         my.sprite.player.isDrowning = false;
//         my.sprite.player.setAlpha(1);
//         my.sprite.player.setAngle(0);
//         my.sprite.player.setRotation(0);
//         my.sprite.player.setFlipY(false);
//         this.tweens.killTweensOf(my.sprite.player);
//         this.tweens.killTweensOf(this.drowningText); // Stop text tween explicitly

//         if (this.tinyBubbleEmitter) this.tinyBubbleEmitter.stop();
//         if (this.mediumBubbleEmitter) this.mediumBubbleEmitter.stop();
//         if (this.largeBubbleEmitter) this.largeBubbleEmitter.stop();

//         my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
//         my.sprite.player.body.setVelocity(0, 0);
//         my.sprite.player.body.setAcceleration(0, 0);
//         my.sprite.player.invulnerable = true;
//         this.time.delayedCall(500, () => { if(my.sprite.player) my.sprite.player.invulnerable = false; });
//         this.drowningText.setVisible(false);
//         this.missingSoundLogged = {}; // Reset missing sound log on respawn
//     }

//     reachEndGoal(player, endGoalObject) {
//         if (this.gameOver || !my.sprite.player) return;

//         this.gameOver = true;
//         my.sprite.player.body.setVelocity(0,0);
//         my.sprite.player.body.setAcceleration(0,0);
//         my.sprite.player.anims.play('idle', true); // Uses 'idle' from Load.js
//         if(my.vfx.walking) my.vfx.walking.stop();

//         this.gameCompleteContainer.setVisible(true);
//         this.completeText.setText(`Level Complete!\nScore: ${this.score}`);

//         const celebrationEmitter = this.add.particles(this.cameras.main.width / 2, this.cameras.main.height / 2, 'twirl_01', {
//             x: { min: -this.cameras.main.width/2 + 50, max: this.cameras.main.width/2 - 50 },
//             y: { min: -this.cameras.main.height/2 + 50, max: this.cameras.main.height/2 - 50 },
//             lifespan: 2000, speed: { min: 100, max: 300 }, scale: { start: 0.3, end: 0 },
//             gravityY: 100, blendMode: 'ADD', emitting: true, frequency: 50, quantity: 2,
//             maxParticles: 50, tint: [0xffff00, 0x00ff00, 0xff00ff]
//         }).setScrollFactor(0).setDepth(99);

//         this.time.delayedCall(3000, () => {
//             celebrationEmitter.stop();
//             this.time.delayedCall(2000, () => celebrationEmitter.destroy());
//         });
//     }
// }

