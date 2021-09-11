/* A study of the illustrations from
 * Color for Designers: Ninety-Five Things You Need To Know When Choosing and Using Color,
 * by Jim Krause
 * location 315 (Kindle edition)
 *
 * Author: Oliver Steele
 * Source: https://openprocessing.org/sketch/1142405
 */

const topMargin = 5;
const bottomMargin = 30;
const tileMargin = 20;
const tileWidth = 1000 + 2 * tileMargin;
const tileHeight = 400 + 2 * tileMargin;

const warmPalette = {
  background: [0, 57, 44],
  colors: [
    [19, 66, 52],
    [26, 78, 57],
    [6, 69, 56],
    [63, 69, 59],
    [51, 93, 84],
  ],
  ranges: {
    hue: [[19, 26], [51, 63]],
    sat: [66, 70],
    val: [52, 59],
  },
};

const coolPalette = {
  background: [192, 62, 45],
  colors: [
    [209, 56, 51],
    [197, 85, 78],
    [195, 93, 61],
    [219, 49, 32],
    [208, 55, 50],
  ],
  ranges: {
    hue: [[195, 200], [210, 220]],
    sat: [45, 95],
    val: [30, 80],
  }
};

const mixedPalette = {
  background: [54, 37, 60],
  colors: [
    [199, 93, 83],
    [51, 100, 55],
    [208, 55, 50],
    [61, 74, 82],
    [6, 80, 56],
  ],
  ranges: {
    hue: [[50, 65], [195, 210]]
  }
};

const palettes = [
  warmPalette, coolPalette, mixedPalette
];

let ty = 0;

function setup() {
  const ch = tileHeight * palettes.length + topMargin + bottomMargin;
  createCanvas(windowWidth, ch);
  colorMode(HSL);

  generatePalette(warmPalette);
  // generatePalette(coolPalette);
}

function draw() {
  const ty1 = map(mouseY, 0, windowHeight, topMargin, windowHeight - height)
  ty = lerp(ty, ty1, 0.1);
  translate((windowWidth - tileWidth) / 2, ty);

  background(255);
  noStroke();

  for (let palette of palettes) {
    panel(palette);
    translate(0, tileHeight);
  }
}

function panel(palette) {
  fill(palette.background); {
    const m = tileMargin;
    rect(m, m, tileWidth - 2 * m, tileHeight - 2 * m);
  }

  push();
  translate(0, 55);
  palette.colors.forEach((c, i) => {
    fill(c);
    wave(i);
    translate(0, 85);
  });
  pop();
}

function wave(i) {
  const cycles = 10;
  const period = tileWidth / cycles;
  const p0 = 10 * cos(millis() / 10000 + mouseX / 1000)
  const p1 = 10 * cos(millis() / 15000 + mouseX / 1500)

  beginShape();
  vertex(0, 0);
  for (let x = 0; x < tileWidth; x++) {
    const amp = 25 + 50 * noise(x / 70, i, p0);
    const t = x + 15 * sin(x * TWO_PI / period) * noise(x / 50 / tileWidth, i, p1);
    const y = amp * sin(t * TWO_PI / period);
    vertex(x, y);
  }
  vertex(tileWidth, 0);
  endShape();
}

function windowResized() {
  resizeCanvas(windowWidth, height);
}

function generatePalette(palette) {
  let hueRanges = palette.ranges.hue;
  let satRange = palette.ranges.sat;
  let valRange = palette.ranges.val;
  const findRange = n => hueRanges.find(([a, b]) => a <= n < b);

  for (let i = 0; i < 5; i++) {
    let h = random(...random(hueRanges));
    palette.colors[i] = [h, random(...satRange), random(...valRange)];
  }

  function fdLayout(points) {
    for (let i = 0; i < 5; i++) {
      fdStep(points, [hueRanges, satRange, valRange]);
    }
  }
  fdLayout(palette.colors);

  // choose two colors
  let [c1, c2] = shuffle(palette.colors);
  // give one a hue that is close to the background color
  c1[0] = (360 + palette.background[0] + random(-10, 10)) % 360;
  // give the other a higher value and saturation
  c2.splice(1, 2, random(90, 95), random(60, 61));
}

// Apply a step in a 3d force-directed layout.
// Modifies points in-place.
function fdStep(points, ranges) {
  const findRange = (n, ranges) => ranges.find(([a, b]) => a <= n && n <= b);

  function repel(p1, p2, index, ranges) {
    let d3 = sqrt(sum(...p1.map((n, i) => sq(n - p2[i]))));
    let f = 1 / (1 + d3);
    for (let i = 0; i < 3; i++) {

      let a = p1[0];
      let b = p2[0];
      let d1 = b - a;
      let range = ranges[i];

      p1[i] = clamp(a - d1 * f, ...range);
      p2[i] = clamp(b + d1 * f, ...range);
    }
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      let p1 = points[i],
        p2 = points[j];
      let r1 = findRange(p1[0], ranges[0]);
      let r2 = findRange(p2[0], ranges[0]);
      if (r1 === r2) {
        repel(p1, p2, 0, [r1, ranges[1], ranges[2]]);
      }
    }
  }
}

const clamp = (a, b, c) => min(max(a, b), c);
const sum = (...ar) => ar.reduce((a, b) => a + b, 0);
