// Description: Tests console relay of errors in setup()

function setup() {
  createCanvas(windowWidth, windowHeight);
  throw new Error('throw error in setup');
}
