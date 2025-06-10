class MovingPlatform extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, frame, config) {
        super(scene, x, y, texture, frame);
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true makes it immovable
        
        this.setScale(SCALE);
        this.body.setCollideWorldBounds(true);
        
        // Movement configuration
        this.config = {
            type: config.type || 'horizontal', // 'horizontal' or 'vertical'
            distance: config.distance || 200,   // Distance to move
            speed: config.speed || 100,        // Movement speed
            startX: x,
            startY: y,
            delay: config.delay || 0           // Delay before starting movement
        };
        
        // Movement state
        this.direction = 1;
        this.isMoving = false;
        
        // Start movement after delay
        if (this.config.delay > 0) {
            scene.time.delayedCall(this.config.delay, () => {
                this.isMoving = true;
            });
        } else {
            this.isMoving = true;
        }
    }
    
    update() {
        if (!this.isMoving) return;
        
        if (this.config.type === 'horizontal') {
            this.body.setVelocityX(this.config.speed * this.direction);
            
            // Check if we need to reverse direction
            if (Math.abs(this.x - this.config.startX) > this.config.distance) {
                this.direction *= -1;
            }
        } else { // vertical
            this.body.setVelocityY(this.config.speed * this.direction);
            
            // Check if we need to reverse direction
            if (Math.abs(this.y - this.config.startY) > this.config.distance) {
                this.direction *= -1;
            }
        }
    }
}

export default MovingPlatform; 