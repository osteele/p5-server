function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  circle(mouseX, mouseY, 20);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
