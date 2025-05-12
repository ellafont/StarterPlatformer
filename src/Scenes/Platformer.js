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

    update() {
        // Skip normal movement if player is drowning
        if (!my.sprite.player.isDrowning) {
            if(cursors.left.isDown) {
                // player accelerate to the left
                my.sprite.player.body.setAccelerationX(-this.ACCELERATION);
                
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);

            } else if(cursors.right.isDown) {
                // player accelerate to the right
                my.sprite.player.body.setAccelerationX(this.ACCELERATION);

                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);

            } else {
                // set acceleration to 0 and have DRAG take over
                my.sprite.player.body.setAccelerationX(0);
                my.sprite.player.body.setDragX(this.DRAG);

                my.sprite.player.anims.play('idle');
            }

            // player jump
            // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
            if(!my.sprite.player.body.blocked.down) {
                my.sprite.player.anims.play('jump');
            }
            if(my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
                // set a Y velocity to have the player "jump" upwards (negative Y direction)
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
            }
        }
    }
    
    // Callback for coin collection
    collectCoin(player, coin) {
        // Play a sound effect
        // this.sound.play('coin-collect');  // Uncomment if you have a sound
        
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
            
            // Stop player movement and add drowning animation
            my.sprite.player.body.setVelocity(0, 0);
            my.sprite.player.body.setAcceleration(0, 0);
            
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
    
    // Stop any tweens that might be running on the player
    this.tweens.killTweensOf(my.sprite.player);
    
    // Return to spawn point
    my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
    
    // Reset velocity and acceleration
    my.sprite.player.body.setVelocity(0, 0);
    my.sprite.player.body.setAcceleration(0, 0);
    
    // Add a small invulnerability period to prevent immediate drowning if respawn is over water
    my.sprite.player.invulnerable = true;
    this.time.delayedCall(500, () => {
        my.sprite.player.invulnerable = false;
    });
    
    // Hide the drowning text
    this.drowningText.setVisible(false);
}
}

