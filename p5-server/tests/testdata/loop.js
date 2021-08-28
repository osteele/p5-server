function setup() {
  createCanvas(windowWidth, windowHeight);

  for (let i = 1; i <= 100; i++) {
    console.info('info #' + i);
  }
}

function mousePressed() {
  console.log('click', mouseX, mouseY);
}
