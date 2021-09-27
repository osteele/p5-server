let settings = { size: 20 };

let gui = new dat.GUI();
gui.add(settings, 'size', 0, 100);

function setup() {
  createCanvas(windowWidth, windowHeight);
  createDiv(
    '<p>This sketch includes the <a href="https://davidwalsh.name/dat-gui">dat.gui</a> library, ' +
    'because it includes a call to <code>new dat.GUI()</code>.</p>' +
    '<p>Drag the slider to change the size of the circle.</p>'
  ).position(10, 20);
}

function draw() {
  background(255);
  circle(width / 2, height / 2, settings.size);
}
