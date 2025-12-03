/**
 * Coordinate transformation utilities for mapping between content space and screen space
 * Content space: original page coordinates (0-1 range) before any transforms
 * Screen space: coordinates after rotation/scale/offset transforms are applied
 */

interface Point {
  x: number
  y: number
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const CENTER = { x: 0.5, y: 0.5 }

/**
 * Rotate a point around center (0.5, 0.5) by given degrees (90, 180, 270)
 * 
 * CRITICAL: This must match how ctx.rotate() displays content on screen.
 * ctx.rotate(+90°) makes content appear rotated 90° CLOCKWISE visually.
 * 
 * For 90° CW visual rotation:
 *   Content's LEFT edge → appears at TOP of screen
 *   Content's TOP edge → appears at RIGHT of screen
 *   Content's RIGHT edge → appears at BOTTOM of screen
 *   Content's BOTTOM edge → appears at LEFT of screen
 * 
 * Corner mappings for 90° CW:
 *   - (0, 0) [top-left] → (1, 0) [top-right]
 *   - (1, 0) [top-right] → (1, 1) [bottom-right]
 *   - (1, 1) [bottom-right] → (0, 1) [bottom-left]
 *   - (0, 1) [bottom-left] → (0, 0) [top-left]
 * Formula: (x, y) → (1 - y, x)
 */
function rotatePoint(point: Point, degrees: number): Point {
  const normalized = ((degrees % 360) + 360) % 360
  
  switch (normalized) {
    case 90:
      // 90° CW: content left → screen top
      return { x: 1 - point.y, y: point.x }
    case 180:
      // 180°: top-left goes to bottom-right
      return { x: 1 - point.x, y: 1 - point.y }
    case 270:
      // 270° CW (= 90° CCW): content left → screen bottom
      return { x: point.y, y: 1 - point.x }
    default:
      return point
  }
}

/**
 * Inverse rotation (rotate by negative angle)
 */
function unrotatePoint(point: Point, degrees: number): Point {
  const inverseDegrees = (360 - (degrees % 360)) % 360
  return rotatePoint(point, inverseDegrees)
}

/**
 * Scale a point around center (0.5, 0.5) by given factor
 */
function scalePoint(point: Point, scaleFactor: number): Point {
  return {
    x: CENTER.x + scaleFactor * (point.x - CENTER.x),
    y: CENTER.y + scaleFactor * (point.y - CENTER.y)
  }
}

/**
 * Inverse scale (divide by scale factor)
 */
function unscalePoint(point: Point, scaleFactor: number): Point {
  if (scaleFactor === 0) return point
  return {
    x: CENTER.x + (point.x - CENTER.x) / scaleFactor,
    y: CENTER.y + (point.y - CENTER.y) / scaleFactor
  }
}

/**
 * Apply offset to a point
 */
function offsetPoint(point: Point, offset: Point): Point {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y
  }
}

/**
 * Remove offset from a point
 */
function unoffsetPoint(point: Point, offset: Point): Point {
  return {
    x: point.x - offset.x,
    y: point.y - offset.y
  }
}

/**
 * Get axis-aligned bounding box from four points
 */
function getBoundingBox(points: Point[]): Box {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

/**
 * Convert box to four corner points
 */
function boxToCorners(box: Box): Point[] {
  return [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x, y: box.y + box.height },
    { x: box.x + box.width, y: box.y + box.height }
  ]
}

/**
 * Forward transform: content space -> screen space
 * Apply rotation, then scale, then offset
 * (Skip crop since crop defines the region we're transforming)
 */
export function forwardTransformBox(
  contentBox: Box,
  rotationDeg: number,
  scaleFactor: number,
  offset: Point = { x: 0, y: 0 }
): Box {
  const corners = boxToCorners(contentBox)
  
  // Transform each corner: ROTATE -> SCALE -> OFFSET
  const transformedCorners = corners.map(corner => {
    let p = rotatePoint(corner, rotationDeg)
    p = scalePoint(p, scaleFactor)
    p = offsetPoint(p, offset)
    return p
  })
  
  // Return axis-aligned bounding box
  return getBoundingBox(transformedCorners)
}

/**
 * Inverse transform: screen space -> content space
 * Remove offset, then unscale, then unrotate
 */
export function inverseTransformBox(
  screenBox: Box,
  rotationDeg: number,
  scaleFactor: number,
  offset: Point = { x: 0, y: 0 }
): Box {
  const corners = boxToCorners(screenBox)
  
  // Transform each corner: remove OFFSET -> UNSCALE -> UNROTATE
  const transformedCorners = corners.map(corner => {
    let p = unoffsetPoint(corner, offset)
    p = unscalePoint(p, scaleFactor)
    p = unrotatePoint(p, rotationDeg)
    return p
  })
  
  // Return axis-aligned bounding box
  return getBoundingBox(transformedCorners)
}

/**
 * Forward transform a single point
 */
export function forwardTransformPoint(
  contentPoint: Point,
  rotationDeg: number,
  scaleFactor: number,
  offset: Point = { x: 0, y: 0 }
): Point {
  let p = rotatePoint(contentPoint, rotationDeg)
  p = scalePoint(p, scaleFactor)
  p = offsetPoint(p, offset)
  return p
}

/**
 * Inverse transform a single point
 */
export function inverseTransformPoint(
  screenPoint: Point,
  rotationDeg: number,
  scaleFactor: number,
  offset: Point = { x: 0, y: 0 }
): Point {
  let p = unoffsetPoint(screenPoint, offset)
  p = unscalePoint(p, scaleFactor)
  p = unrotatePoint(p, rotationDeg)
  return p
}

/**
 * Full page box (0,0,1,1) - represents the entire content space
 */
export const FULL_PAGE_BOX: Box = { x: 0, y: 0, width: 1, height: 1 }

/**
 * Compose a child crop with a base crop to get absolute content coordinates
 * 
 * Think of it like: base crop defines the visible area, child crop is relative to that visible area
 * Result is the child crop expressed in original full-page coordinates
 * 
 * Example: 
 *   base = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 } (cropped to center 60%)
 *   child = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } (crop center 50% of visible)
 *   result = { x: 0.35, y: 0.35, width: 0.3, height: 0.3 } (absolute position in full page)
 */
export function composeCrop(baseCrop: Box | null, childCrop: Box): Box {
  const base = baseCrop || FULL_PAGE_BOX
  
  return {
    x: base.x + childCrop.x * base.width,
    y: base.y + childCrop.y * base.height,
    width: childCrop.width * base.width,
    height: childCrop.height * base.height
  }
}

/**
 * Decompose an absolute crop back to relative coordinates within a base crop
 * 
 * Inverse of composeCrop - converts absolute content coordinates back to
 * coordinates relative to the base crop's visible area
 * 
 * Example:
 *   base = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }
 *   absoluteCrop = { x: 0.35, y: 0.35, width: 0.3, height: 0.3 }
 *   result = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } (relative to visible area)
 */
export function decomposeCrop(baseCrop: Box | null, absoluteCrop: Box): Box {
  const base = baseCrop || FULL_PAGE_BOX
  
  if (base.width === 0 || base.height === 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  
  return {
    x: (absoluteCrop.x - base.x) / base.width,
    y: (absoluteCrop.y - base.y) / base.height,
    width: absoluteCrop.width / base.width,
    height: absoluteCrop.height / base.height
  }
}

/**
 * Clamp a box to valid [0,1] range with minimum size enforcement
 * Guarantees: x + width <= 1 and y + height <= 1
 */
export function clampBox(box: Box, minSize: number = 0.05): Box {
  let { x, y, width, height } = box
  
  // Step 1: Clamp position to valid range that allows minimum size
  // x must be in [0, 1 - minSize] to leave room for minimum width
  x = Math.max(0, Math.min(1 - minSize, x))
  y = Math.max(0, Math.min(1 - minSize, y))
  
  // Step 2: Enforce minimum size first
  width = Math.max(minSize, width)
  height = Math.max(minSize, height)
  
  // Step 3: Cap to boundary (guaranteed to be >= minSize since x <= 1 - minSize)
  width = Math.min(1 - x, width)
  height = Math.min(1 - y, height)
  
  return { x, y, width, height }
}
