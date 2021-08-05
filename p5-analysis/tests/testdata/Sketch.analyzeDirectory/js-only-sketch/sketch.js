// Description: A directory with only a sketch.js file is itself a valid sketch.

function setup() {
    createCanvas(windowWidth, windowHeight);
    text('Subdirectory with a bare JavaScript file (no index.html)', 10, 10);
}

function draw() {
    circle(mouseX, mouseY, 20);
}
