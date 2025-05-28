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

        this.load.image("smoke_01", "particles/smoke_01.png");
        this.load.image("smoke_02", "particles/smoke_02.png");
        this.load.image("smoke_03", "particles/smoke_03.png");
        this.load.image("smoke_04", "particles/smoke_04.png");
        this.load.image("smoke_05", "particles/smoke_05.png");
        this.load.image("smoke_07", "particles/smoke_07.png");
        this.load.image("smoke_09", "particles/smoke_09.png");

        this.load.audio("jump_sound", "audio/kenney_digital-audio/Audio/phaseJump1.ogg")

        this.load.audio("land_sound", "audio/kenny_impact-sounds/Audio/impactSoft_heavy_002.ogg")
        

        this.load.audio("footstep_grass_0", "audio/kenney_impact-sounds/Audio/footstep_grass_000.ogg")
        this.load.audio("footstep_grass_1", "audio/kenney_impact-sounds/Audio/footstep_grass_001.ogg")
        this.load.audio("footstep_grass_2", "audio/kenney_impact-sounds/Audio/footstep_grass_002.ogg")
        this.load.audio("footstep_grass_3", "audio/kenney_impact-sounds/Audio/footstep_grass_003.ogg")
        this.load.audio("footstep_grass_4", "audio/kenney_impact-sounds/Audio/footstep_grass_004.ogg")

        this.load.audio("coin_collect_sound", "audio/kenney_sci-fi-sounds/Audio/forceField_001.ogg")

        this.load.audio("drown_sound", "audio/kenney_sci-fi-sounds/Audio/doorOpen_002.ogg")


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
                start: 11,  // Assuming coin frames start here
                end: 12,    // And end here
                suffix: ".png",
                zeroPad: 4
            }),
            frameRate: 1.15,
            repeat: -1
        });

         // ...and pass to the next Scene
         this.scene.start("platformerScene");
    }

    // Never get here since a new scene is started in create()
    update() {
    }
}
