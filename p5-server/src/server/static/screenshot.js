window.addEventListener('DOMContentLoaded', () => {
  let settings = __p5_server_screenshot_settings || {};
  let frameNumber = 0;
  let skipFrames = settings.skipFrames || 0;
  let remainingFrames = settings.frames || 1;
  let imageType = settings.imageType || 'image/png';

  function wrap(wrapped) {
    return () => {
      wrapped.call(this);

      if (skipFrames-- < 0 && remainingFrames-- > 0) {
        const headers = {
          'Content-Type': 'application/json',
        };
        let dataURL = this.canvas.toDataURL(imageType);
        const body = JSON.stringify({ dataURL, frameNumber });
        fetch('/__p5_server/screenshot', { method: 'post', headers, body })
          .then(() => {
            if (remainingFrames <= 0) window.close();
          });
      }
      frameNumber++;
    }
  }

  if (typeof window.draw === 'function') {
    window.draw = wrap(window.draw);
  } else if (typeof window.setup === 'function') {
    window.setup = wrap(window.setup);
  } else {
    console.error('No draw or setup function found. This is not an instance-mode p5.js sketch.');
  }

  if (settings.canvasDimensions) {
    const { width, height } = settings.canvasDimensions;
    let savedCreateCanvas = p5.prototype.createCanvas;
    p5.prototype.createCanvas = (x, y, mode) => {
      return savedCreateCanvas.call(this, width, height, mode);
    }
  }
  if (settings.pixelDensity) {
    let savedCreateCanvas = p5.prototype.createCanvas;
    p5.prototype.createCanvas = (width, height, mode) => {
      let canvas = savedCreateCanvas.call(this, width, height, mode);
      p5.prototype.pixelDensity.call(this, settings.pixelDensity);
      return canvas;
    }
  }
});
