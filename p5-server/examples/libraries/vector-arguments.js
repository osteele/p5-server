function setup() {
  createCanvas(windowWidth, windowHeight);
  enableVectorArguments();
}

function draw() {
  clear();

  translate(width / 2, height / 2);
  rotate(-PI / 2 + millis() / 700);

  stroke('red');
  strokeWeight(1 / 5);

  let ratio = 10 * sin(millis() / 5000);
  for (let angle = 0; angle < 2 * 360; angle += 2) {
    let p1 = p5.Vector.fromAngle(radians(ratio * angle), 75);
    let p2 = p5.Vector.fromAngle(radians(angle), 150);
    line(p1, p2);
  }
}
