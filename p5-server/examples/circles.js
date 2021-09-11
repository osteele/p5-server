/* Description: This sketch is just a single JavaScript file, with no associated
 * HTML file.
 */

/* A study inspired by Huw Messie's [Concentric
 * Circles](https://huwmessie.com/2019/12/16/stitching-intricate/).
 */

function setup() {
	createCanvas(windowWidth, windowHeight);
}

function draw() {
	background(100);
	stroke(200);

	translate(width / 2, height / 2);
	rotate(-PI / 2 + millis() / 700);
	strokeWeight(1 / 5);
	let ratio = 10 * sin(millis() / 5000);
	for (let angle = 0; angle < 2 * 360; angle += 2) {
		let p1 = p5.Vector.fromAngle(radians(ratio * angle), 75);
		let p2 = p5.Vector.fromAngle(radians(angle), 150);
		line(p1.x, p1.y, p2.x, p2.y);
	}
}
