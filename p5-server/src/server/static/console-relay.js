if (typeof window !== 'undefined' && typeof window.console === 'object') {
  (function () {
    let savedConsole = {};
    let savedOnError = window.onerror;
    let sequenceId = 0;

    window.onerror = function (message, url, line, col, err) {
      fetch('/__console_relay/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'error',
          sequenceId: sequenceId++,
          message, url, line, col,
          stack: err && err.stack
        })
      }).catch(savedConsole.error);
      return savedOnError ? savedOnError(message, url, line, col, err) : false;
    };

    window.addEventListener('unhandledrejection', (event) => {
      let reason = event.reason;
      fetch('/__console_relay/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'unhandledRejection',
          sequenceId: sequenceId++,
          message: reason.message || String(reason),
          stack: reason.stack
        })
      }).catch(savedConsole.error);
    });

    Object.entries(console).forEach(([methodName, savedFn]) => {
      savedConsole[methodName] = (...args) => savedFn.apply(console, args);
      console[methodName] = (...args) => {
        fetch('/__console_relay/console', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sequenceId: sequenceId++,
            method: methodName,
            args
          })
        }).catch(savedConsole.error);
        return savedFn.apply(console, args);
      }
    })
  })()
}
