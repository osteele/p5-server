/**
 * Author: Oliver Steele <https://code.osteele.com>
 * Source: https://www.openprocessing.org/sketch/1045212
 *
 * Draw an arrow between two points.
 * Developed for use in https://www.openprocessing.org/sketch/1045156
 *
 * Also see Trimmed Arrow https://www.openprocessing.org/sketch/1045123
 */

function arrow(x0, y0, x1, y1, options) {
  let defaultOptions = { arrowLength: 10, arrowWidth: 5, lineWidth: 5 }
  let { arrowLength, arrowWidth, lineWidth, dash } = { ...defaultOptions, ...options || {} }
  let ll = dist(x0, y0, x1, y1) // line length
  let al = min(arrowLength, ll)
  let sl = ll - al // stem length
  let hw = lineWidth / 2 // line half width
  push()
  translate(x0, y0)
  rotate(atan2(y1 - y0, x1 - x0));
  if (dash) {
    let [pag, gap] = Array.isArray(dash) ? dash : [dash, dash];
    let dl = pag + gap
    while (dl < sl) {
      rect(0, -hw, pag, 2 * hw)
      translate(dl, 0)
      ll -= dl
      sl -= dl
    }
  }
  let pts = [
    [0, hw],
    [sl, hw],
    [sl, hw + arrowWidth / 2],
    [ll, 0],
  ]
  beginShape()
  pts.forEach(([x, y]) => vertex(x, y))
  pts.reverse().forEach(([x, y]) => vertex(x, -y))
  endShape()
  pop()
}
