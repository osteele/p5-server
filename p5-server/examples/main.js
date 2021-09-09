function setup() {
	createCanvas(windowWidth, windowHeight);
	pixelDensity(1);
}

function draw() {
	background(220, 220, 255, 100);

	translate(width / 2, height / 2);
	rotate(-PI / 2);

	let ratio1 = 5 * sin(millis() / 8000);
	let ratio2 = 5 * sin(millis() / 7000);
	let outerRot = millis() / 2000;
	let tx1 = p5.Vector.fromAngle(millis() / 5500, 100);
	let tx2 = p5.Vector.fromAngle(millis() / 2500, 50);

	rotate(radians(millis() / 100));
	pattern(color(255, 0, 0, 50));

	rotate(sin(millis() / 2000) / 50);
	pattern(color(0, 0, 255, 50));

	strokeWeight(1 / 10);

	function pattern(c) {
		stroke(c);
		noFill();
		for (let angle = 0; angle < 360; angle += .2) {
			let p1 = pointAlongRect(radians(ratio1 * angle), 100).add(tx1);
			let p2 = pointAlongRect(radians(ratio2 * angle), 100).rotate(outerRot).add(tx2);
			circle(p1.x, p1.y, 3);
			circle(p2.x, p2.y, 3);
			line(p1.x, p1.y, p2.x, p2.y);
		}
	}
}
