let bell;

function preload() {
  bell = loadSound('doorbell.mp3');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  createButton('Play')
    .position(10, 10)
    .click(playBell);
}

function playBell() {
  bell.play();
}
