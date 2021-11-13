// Description: Demonstrates the console methods.

function setup() {
  createCanvas(windowWidth, windowHeight);

  console.info('creating canvas at', windowWidth, 'x', windowHeight);
}

function mousePressed() {
  console.log('clicked at', mouseX, mouseY, 'at', millis(), 'ms');
  circle(mouseX, mouseY, 20);
}

function keyPressed() {
  circel(mouseX, mouseY, 20);
}
