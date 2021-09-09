// These are spaced evenly by angle not distance
function pointAlongRect(angle, radius) {
  let pt = p5.Vector.fromAngle(angle);
  let { x, y } = pt;
  return pt.mult(radius / (abs(x) > abs(y) ? abs(x) : abs(y)));
}

const sign = n => (n > 0) - (n < 0);
