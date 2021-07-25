let pulse;

function setup() {
  createCanvas(windowWidth, windowHeight);
  text('click to play', 10, 20);

  pulse = new p5.Pulse();
  pulse.amp(0.5);
  pulse.freq(220);
}

function mousePressed() {
  pulse.start();
  pulse.amp(0.5, 0.02);
}

function mouseReleased() {
  pulse.amp(0, 0.2);
}
