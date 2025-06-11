import { SCALE } from '../globals.js';

class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, frame) {
        super(scene, x, y, texture, frame);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.setScale(SCALE);
        this.body.setCollideWorldBounds(true);
        this.body.setImmovable(true);
        
        // Base properties
        this.health = 1;
        this.isDead = false;
        this.direction = 1; // 1 for right, -1 for left
        this.speed = 100;
    }

    update() {
        // Base update logic
        if (this.isDead) return;
    }

    takeDamage() {
        this.health--;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        this.isDead = true;
        this.body.setVelocity(0, 0);
        this.body.setAcceleration(0, 0);
        this.anims.stop();
        
        // Play death animation and effects
        this.scene.sound.play('enemy_die_sound');
        
        // Create death particles
        const particles = this.scene.add.particles(this.x, this.y, 'platformer_characters', {
            frame: this.frame.name,
            speed: { min: 50, max: 150 },
            scale: { start: SCALE * 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            quantity: 8,
            gravityY: 300
        });
        
        // Fade out and destroy
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.y - 20,
            duration: 500,
            onComplete: () => {
                this.destroy();
                particles.destroy();
            }
        });
    }
}

class Walkabot extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'platformer_characters', 'tile_0002.png');
        this.anims.play('walkabot-walk');
        this.patrolDistance = 64; // Reduced patrol distance to about 2 tiles
        this.startX = x;
        this.isTurning = false;
        this.turnDelay = 500; // Half a second delay when turning
        this.lastTurnTime = 0;
    }

    update(time) {
        super.update();
        if (this.isDead) return;

        // If we're in the middle of turning, don't move
        if (this.isTurning) {
            this.body.setVelocityX(0);
            if (time > this.lastTurnTime + this.turnDelay) {
                this.isTurning = false;
            }
            return;
        }

        // Move in current direction
        this.body.setVelocityX(this.speed * this.direction);
        
        // Check if we need to turn around
        if (Math.abs(this.x - this.startX) > this.patrolDistance) {
            this.direction *= -1;
            this.flipX = !this.flipX;
            this.isTurning = true;
            this.lastTurnTime = time;
        }
    }
}

class SpikeSentry extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'platformer_characters', 'tile_0004.png');
        this.anims.play('spike-sentry-idle');
        this.shootInterval = 2000; // Time between shots in ms
        this.lastShotTime = 0;
        this.projectileSpeed = 200;
    }

    update(time) {
        super.update();
        if (this.isDead) return;

        // Shoot projectiles at intervals
        if (time > this.lastShotTime + this.shootInterval) {
            this.shoot();
            this.lastShotTime = time;
        }
    }

    shoot() {
        const projectile = this.scene.physics.add.sprite(
            this.x + (this.flipX ? -20 : 20),
            this.y,
            'platformer_characters',
            'tile_0006.png'  // Using a different frame from the tilemap for the projectile
        ).setScale(SCALE);

        projectile.body.setAllowGravity(false);
        projectile.setVelocityX(this.projectileSpeed * (this.flipX ? -1 : 1));
        
        // Destroy projectile after 2 seconds
        this.scene.time.delayedCall(2000, () => {
            if (projectile && projectile.scene) {
                projectile.destroy();
            }
        });
    }
}

export { Enemy, Walkabot, SpikeSentry }; 