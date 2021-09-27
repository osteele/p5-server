/**
 * Author: Oliver Steele <https://code.osteele.com>
 * Source: https://www.openprocessing.org/sketch/1045123
 *
 * Draw an arrow between two points. Trim the ends, to reduce overlap with
 * rectangles that might be e.g. the bounding boxes of labels as in
 * https://www.openprocessing.org/sketch/1045156.
 *
 * `arrow() is from https://www.openprocessing.org/sketch/1045212
 */

// returns the modified start point
function trimLineStart(p0, p1, [left, top, width, height]) {
  let right = left + width, bottom = top + height
  if (p0.x > p1.x) {
    let hflip = v => p5.Vector.mult(v, createVector(-1, 1))
    let p0ʹ = trimLineStart(hflip(p0), hflip(p1), [-right, top, width, height])
    return hflip(p0ʹ)
  }
  if (p0.y > p1.y) {
    let vflip = v => p5.Vector.mult(v, createVector(1, -1))
    let p0ʹ = trimLineStart(vflip(p0), vflip(p1), [left, -bottom, width, height])
    return vflip(p0ʹ)
  }
  // At this point: p0.x <= p1.x && p0.y <= p1.y
  let p0ʹ
  if (p0.x < right) {
    let y = p0.y + (right - p0.x) * (p1.y - p0.y) / (p1.x - p0.x)
    if (y <= bottom)
      p0ʹ = createVector(right, y)
  }
  if (p0.y < bottom) {
    let x = p0.x + (bottom - p0.y) * (p1.x - p0.x) / (p1.y - p0.y)
    if (x <= right)
      p0ʹ = createVector(x, bottom)
  }
  return p0ʹ || p0
}

// returns a pair: the modified start and end points
// startClipRect and endClipRect may be null
function trimLine(p0, p1, startClipRect, endClipRect) {
  return [
    startClipRect ? trimLineStart(p0, p1, normalizeRect(startClipRect)) : p0,
    endClipRect ? trimLineStart(p1, p0, normalizeRect(endClipRect)) : p1,
  ]
}

function normalizeRect([left, top, width, height]) {
  return width < 0 ? normalizeRect(left + width, top, -left, height)
    : height < 0 ? [left, top + height, width, -height]
      : [left, top, width, height]
}
