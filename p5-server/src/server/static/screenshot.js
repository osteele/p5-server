window.addEventListener('DOMContentLoaded', () => {
  function wrap(wrapped) {
    let settings = __p5_server_screenshot_settings || {};
    let frameNumber = 0;
    let skipFrames = settings.skipFrames || 0;
    let remainingFrames = settings.frames || 1;
    let imageType = settings.imageType || 'image/png';

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
});
