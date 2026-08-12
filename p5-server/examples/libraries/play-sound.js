let bell;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  bell = await loadSound('doorbell.mp3');
  createButton('Play')
    .position(10, 10)
    .mousePressed(playBell);
}

function playBell() {
  bell.play();
}
