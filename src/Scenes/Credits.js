class Credits extends Phaser.Scene {
    constructor() {
        super('creditsScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#222244');
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Title
        this.add.text(width / 2, 80, 'CREDITS', {
            fontFamily: 'Arial',
            fontSize: 48,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: true, fill: true }
        }).setOrigin(0.5);

        // Credits list
        const credits = [
            'Game Design: Ella Fontenot',
            'Programming: Ella Fontenote',
            'Art: Assets created/distributed by Kenney (www.kenney.nl)',
            'Audio: Kenney.nl',
            'Powered by Phaser 3',
            '',
            'Special Thanks: CMPM 120'
        ];
        this.add.text(width / 2, height / 2, credits, {
            fontFamily: 'Arial',
            fontSize: 28,
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 1, stroke: true, fill: true },
            lineSpacing: 10
        }).setOrigin(0.5);

        // Return to title prompt
        this.add.text(width / 2, height - 80, 'Press SPACE to return', {
            fontFamily: 'Arial',
            fontSize: 32,
            color: '#ffff00',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 2, stroke: true, fill: true }
        }).setOrigin(0.5);

        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    update() {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.scene.start('titleScene');
        }
    }
}

export default Credits; 