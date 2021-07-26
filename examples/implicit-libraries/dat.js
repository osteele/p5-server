let settings = { size: 20 };

let gui = new dat.GUI();
gui.add(settings, 'size', 0, 100);

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(255);
  circle(width / 2, height / 2, settings.size);
}
