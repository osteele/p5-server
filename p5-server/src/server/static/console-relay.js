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
        let strings = args.map(value => value && typeof value === 'object' && typeof value.toString === 'function' ? value.toString() : null);
        send('/__script_event/console', { method, args, strings });
        return savedFn.apply(console, args);
      };
    });

    window.addEventListener('load', () => send('/__script_event/window', { event: 'load' }));

    function send(url, data) {
      data.sequenceId = sequenceId++;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stringify(data)
      }).catch(savedConsole.error);
    }

    function stringify(value) {
      try {
        return JSON.stringify(value);
      } catch (e) {
        if (e instanceof TypeError) {
          return stringifyCycle(value);
        } else {
          throw e;
        }
      }
    }

    function stringifyCycle(value) {
      let seen = new Set();
      let defs = new Map();

      JSON.stringify(value, collector);
      seen.clear();
      return defs.size === 0
        ? JSON.stringify(value)
        : JSON.stringify({ '$__p5_server:circular': value }, replacer);

      function collector(_key, value) {
        if (value && (typeof value === 'object' || Array.isArray(value))) {
          if (defs.has(value)) {
            return undefined;
          } else if (seen.has(value)) {
            defs.set(value, defs.size);
            return undefined;
          } else {
            seen.add(value);
          }
        }
        return value;
      }

      function replacer(key, value) {
        if (value && (typeof value === 'object' || Array.isArray(value))) {
          if (key === '$__p5_server:def') {
            return value;
          } else if (seen.has(value)) {
            return { '$__p5_server:ref': defs.get(value) };
          } else if (defs.has(value)) {
            seen.add(value);
            return { '$__p5_server:def': value };
          }
        }
        return value;
      }
    }

  })();
}
