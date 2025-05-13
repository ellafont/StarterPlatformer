class Load extends Phaser.Scene {
    constructor() {
        super("loadScene");
    }

    preload() {
        this.load.setPath("./assets/");

        // Load characters spritesheet
        this.load.atlas("platformer_characters", "tilemap-characters-packed.png", "tilemap-characters-packed.json");

        // Load tilemap information
        this.load.image("tilemap_tiles", "tilemap_packed.png");                         // Packed tilemap
        this.load.tilemapTiledJSON("platformer-level-1", "platformer-level-1.tmj");   // Tilemap in JSON
        
        // Load coin sound (optional)
        // this.load.audio('coin-collect', 'coin-collect.wav');

        // Load twirl particle images
        this.load.image("twirl_01", "particles/circle_01.png");
        this.load.image("twirl_02", "particles/circle_04.png");
        this.load.image("twirl_03", "particles/circle_05.png");

        // Debug loading of twirl images
        this.load.on('filecomplete', function(key) {
            if (key.includes('twirl')) {
                console.log('Loaded twirl image:', key);
            }
        });

    }

    create() {
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNames('platformer_characters', {
                prefix: "tile_",
                start: 0,
                end: 1,
                suffix: ".png",
                zeroPad: 4
            }),
            frameRate: 15,
            repeat: -1
        });

        this.anims.create({
            key: 'idle',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0000.png" }
            ],
            repeat: -1
        });

        this.anims.create({
            key: 'jump',
            defaultTextureKey: "platformer_characters",
            frames: [
                { frame: "tile_0001.png" }
            ],
        });
        
        // Add a spinning coin animation
        this.anims.create({
            key: 'coin-spin',
            frames: this.anims.generateFrameNames('platformer_characters', {
                prefix: "tile_",
                start: 10,  // Assuming coin frames start here
                end: 12,    // And end here
                suffix: ".png",
                zeroPad: 4
            }),
            frameRate: 8,
            repeat: -1
        });

         // ...and pass to the next Scene
         this.scene.start("platformerScene");
    }

    // Never get here since a new scene is started in create()
    update() {
    }
}
