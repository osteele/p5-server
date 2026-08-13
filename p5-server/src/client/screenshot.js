window.addEventListener('DOMContentLoaded', () => {
  const settings = __p5_server_screenshot_settings || {};
  let frameNumber = 0;
  let skipFrames = settings.skipFrames || 0;
  let remainingFrames = settings.frameCount || 1;
  const imageType = settings.imageType
    ? settings.imageType.replace('jpg', 'jpeg')
    : 'png';
  let pending = 0;
  let failed = false;

  function wrap(wrapped) {
    return function (...args) {
      const result = wrapped.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.then((value) => {
          capture.call(this);
          return value;
        });
      }
      capture.call(this);
      return result;
    };
  }

  function capture() {
    if (skipFrames > 0) {
      skipFrames--;
    } else if (remainingFrames-- > 0) {
      const headers = {
        'Content-Type': 'application/json',
      };
      const dataURL = this.canvas.toDataURL(`image/${imageType}`);
      const body = JSON.stringify({ dataURL, frameNumber });
      pending++;
      fetch('/__p5_server/screenshot', {
        method: 'post',
        headers,
        body,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Screenshot upload failed with HTTP ${response.status}`
            );
          }
        })
        .catch((error) => {
          failed = true;
          console.error(error);
        })
        .finally(() => {
          pending--;
          if (!failed && pending <= 0 && remainingFrames <= 0) window.close();
        });
      if (remainingFrames <= 0) this.noLoop(); // since it may be a while before the fetch returns
    }
    frameNumber++;
  }

  if (typeof window.draw === 'function') {
    window.draw = wrap(window.draw);
  } else if (typeof window.setup === 'function') {
    window.setup = wrap(window.setup);
  } else {
    console.error(
      'No draw or setup function found. This is not an instance-mode p5.js sketch.'
    );
  }

  if (settings.canvasDimensions) {
    const { width, height } = settings.canvasDimensions;
    const savedCreateCanvas = p5.prototype.createCanvas;
    p5.prototype.createCanvas = function (_x, _y, mode) {
      return savedCreateCanvas.call(this, width, height, mode);
    };
  }
  if (settings.pixelDensity) {
    const savedCreateCanvas = p5.prototype.createCanvas;
    p5.prototype.createCanvas = function (width, height, mode) {
      const canvas = savedCreateCanvas.call(this, width, height, mode);
      p5.prototype.pixelDensity.call(this, settings.pixelDensity);
      return canvas;
    };
  }
});
