// Description: Tests that loadSound() implies the sound library

let bell;

function preload() {
    bell = loadSound('doorbell.mp3');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    text('click anywhere to play', 10, 10);
}

function mousePressed() {
    bell.play();
}
