class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 500;
        this.DRAG = 1400;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500; //lower makes more floaty jumps.
        this.JUMP_VELOCITY = -900; //more negative = higher jump
        this.DROWNING_DURATION = 1500; // milliseconds before respawn
        
        my.vfx = {};
        this.PARTICLE_VELOCITY = 60; // Define particle velocity for movement effect

        // Initialize score
        this.score = 0;
    }

    create() {
        // Create a new tilemap game object which uses 18x18 pixel tiles, and is
        // 45 tiles wide and 25 tiles tall.
        this.map = this.add.tilemap("platformer-level-1", 18, 18, 45, 25);

        // Add a tileset to the map
        // First parameter: name we gave the tileset in Tiled
        // Second parameter: key for the tilesheet (from this.load.image in Load.js)
        this.tileset = this.map.addTilesetImage("tilemap_packed", "tilemap_tiles");

        // Create a layer
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.groundLayer.setScale(2.0);

        // Make it collidable
        this.groundLayer.setCollisionByProperty({
            collides: true
        });

        this.waterLayer = this.map.createLayer("Water", this.tileset, 0, 0);
        this.waterLayer.setScale(2.0);

        //add water effect
        this.waterLayer.setCollisionByProperty({
            water: true
        });

        // Calculate the world bounds based on the tilemap dimensions
        const mapWidth = this.map.widthInPixels * 2; // Multiplied by 2 because we scaled the layers
        const mapHeight = this.map.heightInPixels * 2;
        
        // Set the physics world bounds to match the tilemap size
        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        
        // Adjust the main camera to show only the tilemap area
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        // Create a group for coins
        this.coinGroup = this.physics.add.group();

        // Initialize particle emitters for later use
        this.initParticles();

        // movement vfx
        // Horizontal movement particles - more refined
        my.vfx.walking = this.add.particles(0, 0, 'smoke_03', {
            //frame: ['smoke_03.png', 'smoke_09.png'],
            random: true, // Randomly select between the two frames
            scale: {start: 0.08, end: 0.11}, // Start smaller, grow less
            maxAliveParticles: 9, // Limit particles for a cleaner look
            lifespan: 280, // Shorter lifespan for quicker fading
            alpha: {start: 0.7, end: 0}, // Start semi-transparent, fade completely
            frequency: 80, // Emit less frequently
            gravityY: -50, // Slight upward drift
            blendMode: 'ADD', // Creates a glowing effect
            emitting: false
        });

        my.vfx.walking.stop();

        // Jumping particles - different effect
        my.vfx.jumping = this.add.particles(0, 0, 'smoke_05', {
            random: true,
            scale: {start: 0.15, end: 0.0},
            maxAliveParticles: 12,
            lifespan: 600,
            alpha: {start: 0.9, end: 0.4},
            speed: {min: 50, max: 150},
            angle: {min: 230, max: 310}, // Spread in a downward arc
            gravityY: -100, // Make particles float upward
            //tint: 00000, // Slight blue tint for a different look
            blendMode: 'ADD',
            emitting: false
        });
        my.vfx.jumping.stop();

        // Add a separate landing emitter for better visual distinction
        my.vfx.landing = this.add.particles(0, 0, 'smoke_01', {
            scale: {start: 0.2, end: 0.05},  // Larger impact effect
            maxAliveParticles: 15,
            lifespan: 500,
            alpha: {start: 0.8, end: 0},
            speed: {min: 80, max: 200},  // Faster outward burst
            angle: {min: 180, max: 360},  // Wider angle for ground impact
            gravityY: -50,
            tint: 0xf8f8ff,
            blendMode: 'ADD',
            emitting: false
        });


        // Find spawn point and coins from the object layer
        // The Objects layer should be created in Tiled with player spawn point and coins
        if (this.map.getObjectLayer('Objects')) {
            // Find objects in the "Objects" object layer
            const objects = this.map.getObjectLayer('Objects').objects;
            
            objects.forEach(object => {
                // "type" is set in Tiled for each object
                if (object.type === 'playerSpawn') {
                    // Store spawnpoint - include 2x scale factor
                    this.spawnPoint = {
                        x: object.x * 2, 
                        y: object.y * 2
                    };
                } else if (object.type === 'coin') {
                    // Create a coin at this position
                    const coin = this.coinGroup.create(
                        object.x * 2, // Apply the 2x scale
                        object.y * 2,
                        'platformer_characters', 
                        'tile_0011.png' // This should be a coin sprite from your atlas
                    ).setScale(SCALE);
                    
                    // Make sure coins don't fall with gravity
                    coin.body.setAllowGravity(false);
                    
                    // Optional: Add a small animation to make coins more appealing
                    this.tweens.add({
                        targets: coin,
                        y: coin.y - 5,
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            });
        } else {
            // Fallback spawn point if no object layer exists
            this.spawnPoint = {
                x: 200,
                y: 400
            };
            console.warn('No "Objects" layer found in the tilemap. Using default spawn point.');
        }

        // Set up player avatar using spawn point from object layer
        my.sprite.player = this.physics.add.sprite(
            this.spawnPoint.x, 
            this.spawnPoint.y, 
            "platformer_characters", 
            "tile_0000.png"
        ).setScale(SCALE);
        my.sprite.player.setCollideWorldBounds(true);

        // Set up drowning state
        my.sprite.player.isDrowning = false;
        
        // Create drowning text (hidden by default)
        this.drowningText = this.add.text(
            game.config.width / 2, 
            game.config.height / 3,
            'DROWNING!', 
            { 
                fontFamily: 'Arial', 
                fontSize: '32px', 
                color: '#ff0000',
                stroke: '#000000',
                strokeThickness: 4
            }
        ).setOrigin(0.5).setVisible(false);

        // Make the drowning text stay fixed to the camera
        this.drowningText.setScrollFactor(0);

        // Create score text
        this.scoreText = this.add.text(
            20, 20, 
            'Score: 0', 
            { 
                fontFamily: 'Arial', 
                fontSize: '24px', 
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setScrollFactor(0); // Fixed to camera

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        
        // Add collision for coins (collect on overlap)
        this.physics.add.overlap(
            my.sprite.player,
            this.coinGroup,
            this.collectCoin,
            null,
            this
        );

        // Set up water collision detection through overlap
        this.physics.add.overlap(
            my.sprite.player,
            this.waterLayer,
            this.playerTouchWater,
            (player, tile) => {
                // Only process tiles with water property and only if not already drowning and not invulnerable
                return !my.sprite.player.isDrowning && 
                       !my.sprite.player.invulnerable &&
                       tile && 
                       tile.index !== -1 && 
                       tile.properties && 
                       tile.properties.water;
            },
            this
        );

        // set up Phaser-provided cursor key input
        cursors = this.input.keyboard.createCursorKeys();

        // debug key listener (assigned to D key)
        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = this.physics.world.drawDebug ? false : true
            this.physics.world.debugGraphic.clear()
        }, this);

        // Set the camera to follow the player
        this.cameras.main.startFollow(my.sprite.player);
        
        // Add some camera lerp for smooth following
        this.cameras.main.followOffset.set(0, 0);
        this.cameras.main.lerp.set(0.1, 0.1);
    }

    // Initialize particle emitters for the scene
    initParticles() {
    // Create the coin collection particles (using coin sprites)
    this.coinEmitter = this.add.particles(0, 0, 'platformer_characters', {
        frame: 'tile_0011.png',
        lifespan: 800,
        speed: { min: 100, max: 200 },
        scale: { start: 0.4, end: 0 },
        gravityY: 100,
        blendMode: 'ADD',
        emitting: false
    });
    
    // Create small bubbles using the player character as tiny bubbles
    this.tinyBubbleEmitter = this.add.particles(0, 0, 'platformer_characters', {
        frame: 'tile_0000.png',
        lifespan: 1000,
        scale: { start: 0.09, end: 0 },
        alpha: { start: 0.4, end: 0 },
        speed: { min: 10, max: 30 },
        angle: { min: 250, max: 290 },
        frequency: 300,
        quantity: 1,
        emitting: false,
        tint: 0xc0ffff  // Light cyan tint
    });
    
    // Create medium bubbles using twirl_02 (hollow circle)
    this.mediumBubbleEmitter = this.add.particles(0, 0, 'twirl_02', {
        lifespan: { min: 900, max: 1100 },
        speed: { min: 40, max: 70 },
        scale: { start: 0.1, end: 0.2 },
        alpha: { start: 0.7, end: 0 },
        frequency: 600,
        quantity: 1,
        gravityY: -40,
        angle: { min: 250, max: 290 },
        emitting: false,
        accelerationX: { min: -5, max: 5 },  // Slight horizontal wobble
        blendMode: 'ADD'
    });
    
    // Create large bubbles using twirl_03 (ring bubble)
    this.largeBubbleEmitter = this.add.particles(0, 0, 'twirl_03', {
        lifespan: { min: 500, max: 1000 },
        speed: { min: 30, max: 60 },
        scale: { start: 0.1, end: 0.2 },    // Bubbles grow as they rise
        alpha: { start: 0.6, end: 0 },
        frequency: 800,                     // Less frequent than other bubbles
        quantity: 1,
        gravityY: -30,                      // Slower rising
        angle: { min: 260, max: 280 },
        emitting: false,
        accelerationX: { min: -5, max: 5 },
        blendMode: 'ADD'
    });
    
    // Create special burst bubbles using twirl_01 (filled circle)
    this.burstBubbleEmitter = this.add.particles(0, 0, 'twirl_01', {
        lifespan: 2000,
        speed: { min: 50, max: 100 },
        scale: { start: 0.2, end: 0.05 },  // Shrink as they rise (like popping)
        alpha: { start: 0.5, end: 0 },
        frequency: -1,                     // Only used for explosion, not continuous
        gravityY: -50,
        emitting: false,
        blendMode: 'ADD'
    });
}





    update() {
        // Skip normal movement if player is drowning
        if (!my.sprite.player.isDrowning) {
            // Track if we were previously in the air (for jump landing effect)
            var wasInAir = !my.sprite.player.body.blocked.down;

            if(cursors.left.isDown) {
                // player accelerate to the left
                my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
                
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                
                //walking movement vfx
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-5, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                } else {
                    my.vfx.walking.stop();
                }

            } else if(cursors.right.isDown) {
                // player accelerate to the right
                my.sprite.player.body.setAccelerationX(this.ACCELERATION);

                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);

                //walking movement vfx for right
                my.vfx.walking.startFollow(my.sprite.player, -my.sprite.player.displayWidth/2+10, my.sprite.player.displayHeight/2-5, false);
                my.vfx.walking.setParticleSpeed(-this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                } else {
                    my.vfx.walking.stop();
                }

            } else {
                // set acceleration to 0 and have DRAG take over
                my.sprite.player.body.setAccelerationX(0);
                my.sprite.player.body.setDragX(this.DRAG);

                my.sprite.player.anims.play('idle');
                my.vfx.walking.stop();
            }

            // player jump
            // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
            if(!my.sprite.player.body.blocked.down) {
                my.sprite.player.anims.play('jump');

                // If we just started jumping, emit jump particles
                //wasInAir === false && 
                //NOT CALLED BC THE WAS IN AIR 
                // also particles are not emitting.
                if (wasInAir === false && my.sprite.player.body.velocity.y < -300) {
                    console.log("JUMP DETECTED");
        
                    // Position at player's feet with offset for visibility
                    my.vfx.jumping.setPosition(
                        my.sprite.player.x, 
                        my.sprite.player.y + my.sprite.player.displayHeight/2
                    );
        
                    // Use a more reliable particle method - emitParticleAt with quantity
                    for (let i = 0; i < 8; i++) {
                        my.vfx.jumping.emitParticleAt(
                            my.sprite.player.x + Phaser.Math.Between(-10, 10), 
                            my.sprite.player.y + my.sprite.player.displayHeight/2
                        );
                    }
                }
            }

            // Landing effect when hitting ground
            // Landing detection - replace with:
            if (wasInAir && my.sprite.player.body.blocked.down) {
                console.log("LANDING DETECTED");
    
                // Use the landing-specific emitter
                my.vfx.landing.setPosition(
                    my.sprite.player.x, 
                    my.sprite.player.y + my.sprite.player.displayHeight/2
                );
    
                // Create a more dramatic landing effect with multiple particles
                for (let i = 0; i < 12; i++) {
                    my.vfx.landing.emitParticleAt(
                        my.sprite.player.x + Phaser.Math.Between(-15, 15), 
                        my.sprite.player.y + my.sprite.player.displayHeight/2 + Phaser.Math.Between(-2, 5)
                    );
                }
    
                // Add a small camera shake for extra feedback
                this.cameras.main.shake(100, 0.005);
            }

            if(my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
                // set a Y velocity to have the player "jump" upwards (negative Y direction)
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
            }

        } else {
            // Update all bubble emitter positions when drowning
            const playerX = my.sprite.player.x;
            const playerY = my.sprite.player.y;
        
            if (this.tinyBubbleEmitter) {
                this.tinyBubbleEmitter.setPosition(playerX, playerY);
            }
        
            if (this.mediumBubbleEmitter) {
                this.mediumBubbleEmitter.setPosition(playerX, playerY - 5);
            }
        
            if (this.largeBubbleEmitter) {
                this.largeBubbleEmitter.setPosition(playerX, playerY - 10);
            }
        }
    }
    
    // Callback for coin collection
    collectCoin(player, coin) {
        // Play a sound effect
        // this.sound.play('coin-collect');  // Uncomment if you have a sound
        
        // Create particle burst at coin position
        this.coinEmitter.setPosition(coin.x, coin.y);
        this.coinEmitter.explode(15); // Emit 15 particles in a burst
        
        // Make the coin disappear
        coin.destroy();
        
        // Increment score
        this.score += 10;
        
        // Update the score text
        this.scoreText.setText(`Score: ${this.score}`);
        
        // Optional: Add a small visual effect
        this.tweens.add({
            targets: this.scoreText,
            scale: 1.2,
            duration: 200,
            yoyo: true
        });
    }

    // Called when player touches water
    playerTouchWater(player, tile) {
    // Only start drowning if not already drowning and tile exists
    if (!my.sprite.player.isDrowning && tile && tile.index !== -1) {
        console.log("Player touched water!");
        
        // Start drowning
        my.sprite.player.isDrowning = true;
        
        // Show drowning text
        this.drowningText.setVisible(true);
        
        // Stop player movement
        my.sprite.player.body.setVelocity(0, 0);
        my.sprite.player.body.setAcceleration(0, 0);
        
        // Position all bubble emitters at player position
        const playerX = my.sprite.player.x;
        const playerY = my.sprite.player.y;
        
        // First, create a burst of bubbles for impact effect
        this.burstBubbleEmitter.setPosition(playerX, playerY);
        this.burstBubbleEmitter.explode(15);
        
        // Start continuous bubble emissions
        this.tinyBubbleEmitter.setPosition(playerX, playerY);
        this.tinyBubbleEmitter.start();
        
        this.mediumBubbleEmitter.setPosition(playerX, playerY);
        this.mediumBubbleEmitter.start();
        
        this.largeBubbleEmitter.setPosition(playerX, playerY);
        this.largeBubbleEmitter.start();
        
        // Make player sink
        this.tweens.add({
            targets: my.sprite.player,
            y: my.sprite.player.y + 30,
            alpha: 0.6,
            angle: 180,
            duration: this.DROWNING_DURATION,
            ease: 'Power2'
        });
        
        // Flash the drowning text
        this.tweens.add({
            targets: this.drowningText,
            alpha: 0.3,
            yoyo: true,
            repeat: 5,
            duration: 200
        });
        
        // Set timer to respawn player
        this.time.delayedCall(this.DROWNING_DURATION, () => {
            this.respawnPlayer();
        });
    }
}


    
    // Reset player after drowning
    
    respawnPlayer() {
    console.log("Player respawning!");
    
    // Reset drowning state
    my.sprite.player.isDrowning = false;
    
    // Reset ALL visual properties thoroughly
    my.sprite.player.setAlpha(1);
    my.sprite.player.setAngle(0);
    my.sprite.player.setRotation(0);
    my.sprite.player.setFlipY(false);
    
    // Stop any tweens
    this.tweens.killTweensOf(my.sprite.player);
    
    // Stop all bubble emitters
    if (this.tinyBubbleEmitter) {
        this.tinyBubbleEmitter.stop();
    }
    
    if (this.mediumBubbleEmitter) {
        this.mediumBubbleEmitter.stop();
    }
    
    if (this.largeBubbleEmitter) {
        this.largeBubbleEmitter.stop();
    }
    
    // Return to spawn point
    my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    
    // Reset velocity and acceleration
    my.sprite.player.body.setVelocity(0, 0);
    my.sprite.player.body.setAcceleration(0, 0);
    
    // Add invulnerability period
    my.sprite.player.invulnerable = true;
    this.time.delayedCall(500, () => {
        my.sprite.player.invulnerable = false;
    });
    
    // Hide the drowning text
    this.drowningText.setVisible(false);
}



}





