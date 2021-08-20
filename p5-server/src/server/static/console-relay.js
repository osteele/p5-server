if (window.console && typeof console === 'object') {
  (function () {
    let sequenceId = 0;
    Object.entries(console).forEach(([methodName, savedFn]) => {
      console[methodName] = (...args) => {
        fetch('/__p5_server_console', {
          method: 'put',
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
