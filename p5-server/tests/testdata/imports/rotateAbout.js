function setup() {
  createCanvas(400, 400);
  angleMode(DEGREES);
}

function draw() {
  background(220, 20);
  rotateAbout(frameCount, 200, 200);
  rect(100, 100, 20, 30);
}
