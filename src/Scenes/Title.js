class Title extends Phaser.Scene {
    constructor() {
        super("titleScene");
    }

    preload() {
        // Load character spritesheet for the coin
        this.load.atlas("platformer_characters", "assets/tilemap-characters-packed.png", "assets/tilemap-characters-packed.json");
    }

    create() {
        // Add background color
        this.cameras.main.setBackgroundColor('#87ceeb');

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Create bubble emitters
        const emitterConfig = {
            frame: 'tile_0011.png',
            x: { min: 0, max: width },
            y: height,
            lifespan: 4000,
            speedY: { min: -100, max: -200 },
            speedX: { min: -20, max: 20 },
            scale: { start: 0.1, end: 0.2 },
            quantity: 1,
            frequency: 500,
            alpha: { start: 0.8, end: 0 },
            blendMode: 'ADD'
        };

        // Create three emitters at different positions
        this.add.particles(0, 0, 'platformer_characters', {
            ...emitterConfig,
            x: { min: 0, max: width * 0.2 },
            frequency: 1000
        });

        this.add.particles(0, 0, 'platformer_characters', {
            ...emitterConfig,
            x: { min: width * 0.8, max: width },
            frequency: 1000
        });

        this.add.particles(0, 0, 'platformer_characters', {
            ...emitterConfig,
            x: { min: width * 0.4, max: width * 0.6 },
            speedY: { min: -150, max: -250 },
            scale: { start: 0.15, end: 0.25 },
            frequency: 800
        });

        // Title
        const titleY = this.cameras.main.centerY - 180;
        const titleText = this.add.text(this.cameras.main.centerX, titleY, 
            "Alien can't swim,\na journey on Earth", {
            fontFamily: 'Arial',
            fontSize: 64,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: true, fill: true }
        }).setOrigin(0.5);

        // Subtitle
        const subtitleY = titleY + 105;
        const subtitleText = this.add.text(this.cameras.main.centerX, subtitleY,
            "an alien's runaway adventure", {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: true, fill: true }
        }).setOrigin(0.5);

        // HOW TO PLAY header (just below subtitle)
        const instructionsHeaderY = subtitleY + 80;
        const instructionsHeader = this.add.text(this.cameras.main.centerX, instructionsHeaderY, "HOW TO PLAY:", {
            fontFamily: 'Arial',
            fontSize: 28,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 1, stroke: true, fill: true }
        }).setOrigin(0.5);

        // Instructions (moved even further down)
        const instructions = [
            "• Use ARROW KEYS to move",
            "• Press SHIFT to dash",
            "• Jump on enemies to defeat them",
            "• Avoid travelling aliens",
            "• Collect coins for points",
            "• Reach the end to complete the level"
        ];
        const instructionsY = instructionsHeaderY + 140;
        const instructionsText = this.add.text(this.cameras.main.centerX, instructionsY,
            instructions, {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 1, stroke: true, fill: true },
            lineSpacing: 10
        }).setOrigin(0.5);

        // Start text
        const startTextY = height - 70;
        const startText = this.add.text(this.cameras.main.centerX, startTextY,
            "Press SPACE to Start", {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: true, fill: true }
        }).setOrigin(0.5);

        // Create blinking animation
        this.tweens.add({
            targets: startText,
            alpha: 0,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Add space key input
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Add hover effect to title
        this.tweens.add({
            targets: titleText,
            y: titleText.y - 10,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Add hover effect to subtitle
        this.tweens.add({
            targets: subtitleText,
            y: subtitleText.y - 5,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 500
        });
    }

    update() {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.scene.start("loadScene");
        }
    }
}

export default Title; 