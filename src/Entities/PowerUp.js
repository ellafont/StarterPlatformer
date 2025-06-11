import { SCALE } from '../globals.js';

class PowerUp extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type) {
        let frame;
        switch(type) {
            case 'speed':
                frame = 'tile_0019.png'; // Speed power-up
                break;
            case 'jump':
                frame = 'tile_0016.png'; // Jump power-up
                break;
            case 'shield':
                frame = 'tile_0017.png'; // Shield power-up
                break;
            default:
                frame = 'tile_0019.png';
        }
        super(scene, x, y, 'platformer_characters', frame);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(SCALE);
        this.body.setAllowGravity(false);
        this.body.setImmovable(true);
        this.body.setVelocity(0, 0);
        this.type = type;

        // Match the coin hover effect exactly
        this._floatingTween = scene.tweens.add({
            targets: this,
            y: this.y - 5,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    collect(player) {
        // Play collection sound only, no crazy animation
        this.scene.sound.play('powerup_collect');
        // Apply power-up effect
        this.applyEffect(player);
        // Destroy the floating tween before destroying the sprite
        if (this._floatingTween) {
            this._floatingTween.stop();
            this._floatingTween = null;
        }
        this.destroy();
    }
    
    getPowerUpColor() {
        switch(this.type) {
            case 'speed':
                return 0x00ff00; // Green
            case 'jump':
                return 0x0000ff; // Blue
            case 'shield':
                return 0xff0000; // Red
            default:
                return 0xffffff; // White
        }
    }
    
    applyEffect(player) {
        switch(this.type) {
            case 'speed':
                this.applySpeedBoost(player);
                break;
            case 'jump':
                this.applyJumpBoost(player);
                break;
            case 'shield':
                this.applyShield(player);
                break;
        }
    }
    
    applySpeedBoost(player) {
        const originalSpeed = player.scene.ACCELERATION;
        player.scene.ACCELERATION *= 1.5;
        // Add trailing particle effect
        const speedTrail = player.scene.add.particles(0, 0, 'dash_trail', {
            speed: 40,
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 250,
            blendMode: 'ADD',
            follow: player
        });
        speedTrail.startFollow(player);
        // Reset after 5 seconds
        player.scene.time.delayedCall(5000, () => {
            player.scene.ACCELERATION = originalSpeed;
            speedTrail.destroy();
        });
    }
    
    applyJumpBoost(player) {
        const originalJump = player.scene.JUMP_VELOCITY;
        player.scene.JUMP_VELOCITY *= 1.3;
        // Reset after 5 seconds
        player.scene.time.delayedCall(5000, () => {
            player.scene.JUMP_VELOCITY = originalJump;
        });
    }
    
    applyShield(player) {
        player.invulnerable = true;
        // Reset after 5 seconds
        player.scene.time.delayedCall(5000, () => {
            player.invulnerable = false;
        });
    }
}

export default PowerUp; 