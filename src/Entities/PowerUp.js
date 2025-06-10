class PowerUp extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, type) {
        super(scene, x, y, 'powerups', `${type}_0`);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setScale(SCALE);
        this.body.setAllowGravity(false);
        this.type = type;
        
        // Play animation based on type
        this.anims.play(`${type}-spin`);
        
        // Add floating animation
        scene.tweens.add({
            targets: this,
            y: this.y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    collect(player) {
        // Play collection effect
        this.scene.sound.play('powerup_collect');
        this.scene.add.particles(this.x, this.y, 'powerup_aura', {
            speed: 100,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            quantity: 10,
            tint: this.getPowerUpColor()
        });
        
        // Apply power-up effect
        this.applyEffect(player);
        
        // Destroy the power-up
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
        
        // Add speed trail effect
        const speedTrail = player.scene.add.particles(0, 0, 'dash_trail', {
            speed: 50,
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.3, end: 0 },
            lifespan: 200,
            blendMode: 'ADD',
            emitting: false
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
        
        // Add jump aura effect
        const jumpAura = player.scene.add.particles(0, 0, 'powerup_aura', {
            speed: 20,
            scale: { start: 0.2, end: 0 },
            alpha: { start: 0.3, end: 0 },
            lifespan: 300,
            blendMode: 'ADD',
            emitting: false
        });
        jumpAura.startFollow(player);
        
        // Reset after 5 seconds
        player.scene.time.delayedCall(5000, () => {
            player.scene.JUMP_VELOCITY = originalJump;
            jumpAura.destroy();
        });
    }
    
    applyShield(player) {
        player.invulnerable = true;
        
        // Add shield effect
        const shield = player.scene.add.particles(0, 0, 'powerup_aura', {
            speed: 20,
            scale: { start: 0.4, end: 0.3 },
            alpha: { start: 0.5, end: 0.2 },
            lifespan: 1000,
            blendMode: 'ADD',
            emitting: true,
            frequency: 50
        });
        shield.startFollow(player);
        
        // Reset after 5 seconds
        player.scene.time.delayedCall(5000, () => {
            player.invulnerable = false;
            shield.destroy();
        });
    }
}

export default PowerUp; 