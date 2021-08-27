console.info('loading');

function setup() {
    createCanvas(windowWidth, windowHeight);

    console.info('info');
    console.debug('debug');
    console.log('log');
    console.error('error');
    console.warn('warn');

    console.info();
    console.info('args', 1, 2, null, undefined, false, NaN, Infinity, { a: 1 }, [2, 3], circle, function () { });
    console.info('format: %d < %s.', 1, 2);
}
