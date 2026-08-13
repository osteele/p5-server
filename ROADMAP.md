# Roadmap

## Browser console relay

- Add sustained-traffic backpressure after the WebSocket opens. Use
  `WebSocket.bufferedAmount` watermarks and the existing count-and-byte-bounded
  client queue so a slow receiver cannot cause unbounded browser memory growth.
  Preserve error and lifecycle events preferentially when queued console output
  must be discarded, and cover draining, eviction, and shutdown behavior with
  bundled-client tests.
