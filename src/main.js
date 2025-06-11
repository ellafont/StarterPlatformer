// Jim Whitehead
// Created: 4/14/2024
// Phaser: 3.70.0
//
// Cubey
//
// An example of putting sprites on the screen using Phaser
// 
// Art assets from Kenny Assets "Shape Characters" set:
// https://kenney.nl/assets/shape-characters

// debug with extreme prejudice
"use strict"

// Import global variables
import { my, cursors, SCALE } from './globals.js';

// Import scenes
import Load from './Scenes/Load.js';
import Platformer from './Scenes/Platformer.js';
import Title from './Scenes/Title.js';
import Credits from './Scenes/Credits.js';

// game config
const config = {
    parent: 'phaser-game',
    type: Phaser.AUTO,
    render: {
        pixelArt: true  // prevent pixel art from getting blurred when scaled
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: {
                x: 0,
                y: 0
            }
        }
    },
    width: 1440,
    height: 900,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#87ceeb',
    scene: [Title, Load, Platformer, Credits]
};

const game = new Phaser.Game(config);