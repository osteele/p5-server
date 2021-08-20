if (typeof window !== 'undefined' && typeof window.console === 'object') {
  (function () {
    let savedOnError = window.onerror;
    window.onerror = function (message, url, line, col, err) {
      fetch('/__p5_server_error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, url, line, col,
          stack: err && err.stack
        })
      });
      return savedOnError ? savedOnError(message, url, line) : false;
    };

    window.addEventListener('unhandledrejection', (event) => {
      let reason = event.reason;
      fetch('/__p5_server_error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: reason.message || String(reason),
          stack: reason.stack
        })
      });
    });

    let sequenceId = 0;
    Object.entries(console).forEach(([methodName, savedFn]) => {
      console[methodName] = (...args) => {
        fetch('/__p5_server_console', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequenceId, method: methodName, args
          })
        });
        sequenceId++;
        return savedFn.apply(console, args);
      }
    })
  })()
}
