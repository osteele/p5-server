/** Description: This JavaScript-only file demonstrates automatic library
  * inclusion. The sketch calls `enableVectorArguments()`), so the server includes the
  * [p5.vectorArguments
  * library](https://osteele.github.io/p5.libs/p5.vector-arguments/)
  */

function setup() {
  createCanvas(windowWidth, windowHeight);
  enableVectorArguments();
}

function draw() {
  background(220, 220, 255);

  translate(width / 2, height / 2);
  rotate(-PI / 2);

  let ratio = 5 * sin(millis() / 8000);

  rotate(radians(millis() / 100));
  rot = 0;
  pattern('blue');

  rotate(sin(millis() / 2000) / 50);
  pattern('red');

  function pattern(c) {
    stroke(c);
    for (let angle = 0; angle < 180; angle += 2) {
      let p1 = pointAlongRect(radians(ratio * angle), map(angle, 0, 180, 200, 100));
      let p2 = pointAlongRect(radians(angle), map(angle, 0, 180, 100, 200));
      fill(c);
      circle(p1, 3);
      noFill();
      circle(p2, 5);
      line(p1, p2);
    }
  }
}

// These are spaced evenly by angle not distance
function pointAlongRect(angle, radius) {
  let pt = p5.Vector.fromAngle(angle);
  let { x, y } = pt;
  return pt.mult(radius / (abs(x) > abs(y) ? abs(x) : abs(y)));
}

const sign = n => (n > 0) - (n < 0);
