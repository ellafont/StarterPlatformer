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
        this.patrolDistance = 100; // Distance to patrol before turning
        this.startX = x;
        this.isTurning = false;
        this.turnDelay = 500; // Half a second delay when turning
        this.lastTurnTime = 0;
        this.distanceTraveled = 0; // Track distance traveled in current direction
        this.lastUpdateTime = 0; // Initialize lastUpdateTime
    }

    update(time) {
        super.update();
        if (this.isDead) return;

        // Initialize lastUpdateTime if it's the first update
        if (this.lastUpdateTime === 0) {
            this.lastUpdateTime = time;
            return;
        }

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
        
        // Update distance traveled
        const deltaTime = (time - this.lastUpdateTime) / 1000; // Convert to seconds
        this.distanceTraveled += Math.abs(this.speed * deltaTime);
        this.lastUpdateTime = time;
        
        // Check if we need to turn around
        if (this.distanceTraveled >= this.patrolDistance) {
            this.direction *= -1;
            this.flipX = !this.flipX;
            this.isTurning = true;
            this.lastTurnTime = time;
            this.distanceTraveled = 0; // Reset distance for the new direction
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
        this.shootDirection = 1; // 1 for right, -1 for left
    }

    update(time) {
        super.update();
        if (this.isDead) return;

        // Shoot projectiles at intervals
        if (time > this.lastShotTime + this.shootInterval) {
            this.shoot();
            this.lastShotTime = time;
            this.shootDirection *= -1; // Alternate direction
            this.flipX = (this.shootDirection === -1); // Flip sprite based on direction
        }
    }

    shoot() {
        const projectile = this.scene.physics.add.sprite(
            this.x + (this.shootDirection === -1 ? -20 : 20),
            this.y,
            'platformer_characters',
            'tile_0006.png'
        ).setScale(SCALE);

        // Add projectile to the projectiles group
        this.scene.projectiles.add(projectile);

        projectile.body.setAllowGravity(false);
        projectile.setVelocityX(this.projectileSpeed * this.shootDirection);
        
        // Destroy projectile after 2 seconds
        this.scene.time.delayedCall(2000, () => {
            if (projectile && projectile.scene) {
                projectile.destroy();
            }
        });
    }
}

export { Enemy, Walkabot, SpikeSentry }; 