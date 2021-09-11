/* sin() + noise() illustration
 *
 * Author: Oliver Steele
 * Source: https://openprocessing.org/sketch/1122664
 */

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background('lightblue');

  fill('darkgray');
  beginShape();
  vertex(0, height);
  for (let x = 0; x < width; x++) {
    let y = 200 + 200 * noise(x / 200);
    vertex(x, y);
  }
  vertex(width, height);
  endShape();

  fill('gray');
  beginShape();
  vertex(0, height);
  for (let x = 0; x < width; x++) {
    let y = 280 + 200 * noise(x / 200 + width);
    vertex(x, y);
  }
  vertex(width, height);
  endShape();

  // back wave
  beginShape();
  vertex(0, height);
  for (let x = 0; x < width; x++) {
    let y = 500 + 40 * sin(-x / 150 + millis() / 3000);
    vertex(x, y);
  }
  fill('blue');
  vertex(width, height);
  endShape();

  // // the boat
  let x = width / 3;
  let y = 700 + 40 * sin(x / 100 + millis() / 2000);
  push();
  translate(x, y + 25);
  fill('white');
  triangle(-50, 0, 0, -50, 50, 0);
  pop();

  // front wave
  beginShape();
  vertex(0, height);
  for (let x = 0; x < width; x++) {
    let y = 700 + 40 * sin(x / 100 + millis() / 2000);
    vertex(x, y);
  }
  fill('darkblue');
  vertex(width, height);
  endShape();
}
