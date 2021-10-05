function setup() {
  const s = min(windowWidth, windowHeight) * 0.9;
  createCanvas(s, s);
  background(250);

  const t = width / 2;

  //set pattern
  pattern(PTN.cross(20, 5));

  //rect
  rectMode(CENTER);
  rectPattern(t * 0.5, t * 0.5, t * 0.8, t * 0.8, t * 0.2);

  //ellipse
  ellipsePattern(t * 1.5, t * 0.5, t * 0.8, t * 0.8);

  //arc
  arcPattern(t * 0.5, t * 1.5, t * 0.8, t * 0.8, 0, TAU * 0.75);

  //vertex
  beginShapePattern();
  vertexPattern(t * 1.5, t * 1.1);
  vertexPattern(t * 1.1, t * 1.9);
  vertexPattern(t * 1.9, t * 1.9);
  endShapePattern();
}
