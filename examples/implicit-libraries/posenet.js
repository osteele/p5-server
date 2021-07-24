let video; // setup initializes this to a p5.js Video instance.
let currentPose = null; // the poseNet.on callback sets this from new poses

function setup() {
    createCanvas(640, 480);
    video = createCapture(VIDEO);
    video.size(width, height);

    let poseNet = ml5.poseNet(
        video,
        { flipHorizontal: true, detectionType: "single" },
        () => select("#status").hide()
    );

    poseNet.on("pose", (poses) => {
        currentPose = poses[0];
    });

    // Hide the video element, and just show the canvas
    video.hide();
}

function draw() {
    push();
    translate(video.width, 0);
    scale(-1, 1);
    image(video, 0, 0);
    pop();

    if (currentPose) {
        drawKeypoints(currentPose);
        drawSkeleton(currentPose);
    }
}

function drawKeypoints(pose) {
    for (let keypoint of pose.pose.keypoints) {
        if (keypoint.score > 0.2) {
            fill(0, 255, 0);
            noStroke();
            ellipse(keypoint.position.x, keypoint.position.y, 10, 10);
        }
    }
}

function drawSkeleton(pose) {
    for (let skeleton of pose.skeleton) {
        let [p1, p2] = skeleton;
        stroke(0, 0, 255);
        line(p1.position.x, p1.position.y, p2.position.x, p2.position.y);
    }
}
