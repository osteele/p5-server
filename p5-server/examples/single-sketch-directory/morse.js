/**
 * Author: Oliver Steele
 * Source: https://www.openprocessing.org/sketch/1045156
 *
 * The graphic design for the Morse tree is adapted from the image in
 * https://www.offgridweb.com/preparation/morse-code-dits-dahs-dots-and-dashes/
 */

const DOT_COLOR = "orange";
const DASH_COLOR = "#4CACE9";
const LABEL_COLOR = 100;

let rowStrings = [
  "ET",
  "IANM",
  "SURWDKGO",
  "HVF L PJBXCYZQ  ",
  "54 3   2       16       7   8 90",
];

// Source: https://home.unicode.org/emoji/emoji-frequency/
// Source: https://home.unicode.org/emoji/emoji-frequency/
let emojiFreqs = [
  "😂 ❤️",
  "😍 🤣",
  "😊 🙏 💕 😭 😘",
  "👍 😅 👏 😁 ♥️ 🔥 💔 💖 💙 😢 🤔 😆 🙄 💪 😉 👌 🤗", // skip ☺️
  "💜 😔 😎 😇 🌹 🤦 🎉 ‼️ 💞 ✌️ ✨ 🤷 😱 😌 🌸 🙌 😋 💗 💚 😏 💛 🙂 💓 🤩 😄 😀 🖤 😃 💯 🙈 👇 🎶 😒 🤭 ❣️",
];
let allEmoji = emojiFreqs.join("").replace(/\s+/g, "");

let includeEmoji = false;
let rows;

function setup() {
  createCanvas(windowWidth - 10, windowHeight - 10);
  noLoop();
}

function draw() {
  let emoji = includeEmoji ? emojiFreqs.join(" ").split(/\s+/g) : [];
  rows = [
    ["START"],
    ...rowStrings.map((s) =>
      s.split("").map((c) => (c === " " ? emoji.shift() : c))
    ),
  ];

  background(255);
  fill(200);
  textFont("Helvetica");
  textAlign(RIGHT, BOTTOM);
  textSize(20);
  text("osteele.com", width, height - 16);
  textSize(12);
  text("Graphic design adapted from offgridweb.com", width, height);

  if (!includeEmoji) {
    textAlign(CENTER, BASELINE);
    text("Click to add emoji", width / 2, 40);
  }

  fill(LABEL_COLOR);
  textFont("Arial Black");
  textAlign(CENTER, BASELINE);
  noStroke();
  textSize(30);

  function legendArrow(x, w) {
    let h = textAscent() / 2 - 6;
    translate(x, 0)
    triangle(0, 0, 0, -h, w, -h / 2);
  }
  {
    push();
    let labelText = "DOT";
    fill(DASH_COLOR);
    translate(width / 4, 40);
    text("DOT", 0, 0);
    circle(0, 18, 14);
    legendArrow(-textWidth("DOT") / 2 - 5, -35);
    fill(DASH_COLOR);
    pop();
  }

  {
    let labelText = "DASH"
    push();
    fill(DOT_COLOR);
    translate((width * 3) / 4, 40);
    text("DASH", 0, 0);
    rect(-12, 12, 24, 8);
    legendArrow(textWidth("DASH") / 2 + 5, 35);
    pop();
  }

  textAlign(CENTER, CENTER);
  rows.forEach((row, j) => {
    row.forEach((c, i) => {
      let isDot = !(i & 1);
      let arrowColor = [DASH_COLOR, DOT_COLOR][i & 1];
      let p = getCenter(i, j);

      // parent
      let iʹ = floor(i / 2);
      let jʹ = j - 1;
      let cʹ = (rows[jʹ] || [])[iʹ];
      let pʹ = getCenter(iʹ, jʹ);

      // left child
      let iʹʹ = 2 * i;
      let rowʹʹ = rows[j + 1] || [];

      let isDotDashLabel = !c && (rowʹʹ[iʹʹ] || rowʹʹ[iʹʹ + 1])
      let label = c || isDotDashLabel && ".-".charAt(i & 1)

      fill(arrowColor);
      if (label && j > 0) {
        let [{ x: x0ʹ, y: y0ʹ }, { x: x1ʹ, y: y1ʹ }] = trimLine(
          pʹ, p, getBounds(iʹ, jʹ), getBounds(i, j))
        arrow(x0ʹ, y0ʹ, x1ʹ, y1ʹ, { dash: isDot && 5 });
      }

      if (c) {
        fill(LABEL_COLOR)
        text(label, p.x, p.y);
      } else if (label === ".") {
        circle(p.x, p.y - 4, 16)
      } else if (label === "-") {
        rect(p.x - 12, p.y - 9, 24, 10)
      }
    });
  });
}

function mousePressed() {
  includeEmoji = !includeEmoji;
  redraw();
}

function windowResized() {
  resizeCanvas(windowWidth - 10, windowHeight - 10);
  redraw();
}

const getCenter = (i, j) => {
  let rowCount = rows.length;
  return createVector(
    map((i + 0.5) * 2 ** (rowCount - j), -1, 2 ** rowCount + 1, 0, width),
    min(100 + 80 * j, map(j, 0, rowCount - 0.5, 100, height))
  );
};

function getBounds(i, j) {
  let p = getCenter(i, j);
  let label = rows[j][i] || "-";
  let th = textAscent() * .8;
  let tw = textWidth(label) + 5;
  return [p.x - tw / 2, p.y - th / 2, tw, th]
}
