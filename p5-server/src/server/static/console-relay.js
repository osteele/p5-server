if (typeof window !== 'undefined' && typeof window.console === 'object') {
  (function () {
    let savedConsole = {};
    let savedOnError = window.onerror;
    let sequenceId = 0;

    window.onerror = function (message, url, line, col, err) {
      send('/__script_event/error', {
        kind: 'error',
        message,
        url,
        line,
        col,
        stack: err && err.stack
      });
      return savedOnError ? savedOnError(message, url, line, col, err) : false;
    };

    window.addEventListener('unhandledrejection', event => {
      let reason = event.reason;
      send('/__script_event/error', {
        kind: 'unhandledRejection',
        message: reason.message || String(reason),
        stack: reason.stack
      });
    });

    Object.entries(console).forEach(([method, savedFn]) => {
      savedConsole[method] = (...args) => savedFn.apply(console, args);
      console[method] = (...args) => {
        send('/__script_event/console', { method, args });
        return savedFn.apply(console, args);
      };
    });

    window.addEventListener('load', () => send('/__script_event/window', { event: 'load' }));

    function send(url, data) {
      data.sequenceId = sequenceId++;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).catch(savedConsole.error);
    }
  })();
}
