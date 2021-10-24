let myNumber = 100;
let myColor = color(255, 0, 0);
let myChoice = ['one', 'two', 'three'];

function setup() {
  createCanvas(windowWidth, windowHeight);

  var gui = createGui('My awesome GUI');
  gui.addGlobals('myColor', 'myNumber', 'myChoice');
}
