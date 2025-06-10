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
        this.scene.add.particles(this.x, this.y, 'enemy_hit', {
            speed: 100,
            scale: { start: 0.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            quantity: 10
        });
        
        // Fade out and destroy
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            y: this.y - 20,
            duration: 500,
            onComplete: () => this.destroy()
        });
    }
}

class Walkabot extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemies', 'walkabot_0');
        this.anims.play('walkabot-walk');
        this.patrolDistance = 200; // Distance to patrol before turning
        this.startX = x;
    }

    update() {
        super.update();
        if (this.isDead) return;

        // Move in current direction
        this.body.setVelocityX(this.speed * this.direction);
        
        // Check if we need to turn around
        if (Math.abs(this.x - this.startX) > this.patrolDistance) {
            this.direction *= -1;
            this.flipX = !this.flipX;
        }
    }
}

class SpikeSentry extends Enemy {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemies', 'spike_0');
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
            'enemies',
            'spike_projectile'
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