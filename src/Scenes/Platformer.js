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

        // Store starting position for respawn
        this.spawnPoint = {
            x: game.config.width/4,
            y: game.config.height
        };

        // set up player avatar
        my.sprite.player = this.physics.add.sprite(game.config.width/4, game.config.height/2, "platformer_characters", "tile_0000.png").setScale(SCALE)
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

        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Set up water collision detection through overlap
        //this.physics.add.overlap(my.sprite.player, this.waterLayer, this.playerTouchWater, null, this);
        this.physics.add.overlap(
            my.sprite.player,
            this.waterLayer,
            this.playerTouchWater,
            (player, tile) => {
                // Only process tiles with water property and only if not already drowning
                return !my.sprite.player.isDrowning && 
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

    // Called when player touches water
    playerTouchWater(player, tile) {
        // Only start drowning if not already drowning and tile exists
        // The check for tile.index is to ensure this is an actual tile
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
    respawnPlayer() {
        console.log("Player respawning!");
        
        // Reset drowning state
        my.sprite.player.isDrowning = false;
        
        // Reset visual properties
        my.sprite.player.setAlpha(1);
        my.sprite.player.setAngle(0);
        
        // Return to spawn point
        my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
        
        // Reset velocity and acceleration
        my.sprite.player.body.setVelocity(0, 0);
        my.sprite.player.body.setAcceleration(0, 0);
        
        // Hide the drowning text
        this.drowningText.setVisible(false);
    }
    
    // Called when player touches water
    // playerTouchWater(sprite, tile) {
    //     // Only start drowning if not already drowning
    //     if (!my.sprite.player.isDrowning) {
    //         // Start drowning
    //         my.sprite.player.isDrowning = true;
            
    //         // Show drowning text
    //         this.drowningText.setVisible(true);
            
    //         // Stop player movement and add drowning animation
    //         my.sprite.player.body.setVelocity(0, 0);
    //         my.sprite.player.body.setAcceleration(0, 0);
            
    //         // Make player sink
    //         this.tweens.add({
    //             targets: my.sprite.player,
    //             y: my.sprite.player.y + 30,
    //             alpha: 0.6,
    //             angle: 180,
    //             duration: this.DROWNING_DURATION,
    //             ease: 'Power2'
    //         });
            
    //         // Flash the drowning text
    //         this.tweens.add({
    //             targets: this.drowningText,
    //             alpha: 0.3,
    //             yoyo: true,
    //             repeat: 5,
    //             duration: 200
    //         });
            
    //         // Set timer to respawn player
    //         this.time.delayedCall(this.DROWNING_DURATION, () => {
    //             this.respawnPlayer();
    //         });
    //     }
        
    //     // Always return true to prevent default collision
    //     return false;
    // }
    
    // // Reset player after drowning
    // respawnPlayer() {
    //     // Reset drowning state
    //     my.sprite.player.isDrowning = false;
        
    //     // Reset visual properties
    //     my.sprite.player.setAlpha(1);
    //     my.sprite.player.setAngle(0);
        
    //     // Return to spawn point
    //     my.sprite.player.setPosition(this.spawnPoint.x, this.spawnPoint.y);
        
    //     // Reset velocity and acceleration
    //     my.sprite.player.body.setVelocity(0, 0);
    //     my.sprite.player.body.setAcceleration(0, 0);
        
    //     // Hide the drowning text
    //     this.drowningText.setVisible(false);
    // }
}
