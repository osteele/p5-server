let myNumber = 100;
let myColor;
let myChoice = ['one', 'two', 'three'];

function setup() {
  createCanvas(windowWidth, windowHeight);

  myColor = color(255, 0, 0);
  var gui = createGui('My awesome GUI');
  gui.addGlobals('myColor', 'myNumber', 'myChoice');
}
