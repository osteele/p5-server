function __p5_server_screenshot(wrapped) {
  let send = true;
  let frame = 0;

  return () => {
    wrapped.call(this);
    if (!send) return;

    const headers = {
      'Content-Type': 'application/json',
    };
    let dataURL = this.canvas.toDataURL("image/png");
    const body = JSON.stringify({ dataURL, frame });
    frame++;
    fetch('/__p5_server/screenshot', { method: 'post', headers, body })
      .then(res => res.text())
      .then(command => {
        switch (command) {
          case 'close':
            window.close();
            break;
          case 'stop':
            send = false;
            break;
        }
      });
  }
}

if (typeof window.draw === 'function') {
  window.draw = __p5_server_screenshot(window.draw);
} else if (typeof window.setup === 'function') {
  window.setup = __p5_server_screenshot(window.setup);
}
