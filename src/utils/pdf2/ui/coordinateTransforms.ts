/**
 * Coordinate transformation utilities for mapping between content space and screen space
 * Content space: original page coordinates (0-1 range) before any transforms
 * Screen space: coordinates after rotation/scale/offset transforms are applied
 * 
 * IMPORTANT: These transforms account for aspect ratio changes when rotating non-square content.
 * When content is rotated 90°/270°, its effective dimensions are swapped, affecting how it
 * fits within the fixed-size canvas.
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
 * Calculate where the rotated, scaled content appears on the canvas.
 * Returns the content bounds in normalized canvas coordinates [0,1].
 * 
 * When content is rotated 90°/270°, its dimensions are effectively swapped,
 * so it may not fill the entire canvas and needs to be centered.
 * 
 * @param rotationDeg - Rotation in degrees (0, 90, 180, 270)
 * @param scaleFactor - Scale factor applied to content (includes auto-fit for rotation)
 * @param aspectRatio - Content aspect ratio (width/height), e.g., 1.42 for landscape
 */
export function getContentBounds(
  rotationDeg: number,
  scaleFactor: number,
  aspectRatio: number = 1
): Box {
  const normalized = ((rotationDeg % 360) + 360) % 360
  const isRotated90or270 = normalized === 90 || normalized === 270
  
  let contentWidth: number
  let contentHeight: number
  
  if (!isRotated90or270) {
    // 0° or 180°: content dimensions match canvas, scale uniformly
    contentWidth = scaleFactor
    contentHeight = scaleFactor
  } else {
    // 90° or 270°: content dimensions are swapped
    // 
    // For a landscape page (AR > 1) rotated 90°:
    // - Original: W x H (e.g., 841.9 x 595.3)
    // - After rotation: H x W (595.3 x 841.9) - now portrait in landscape canvas
    // - scaleFactor = 1/AR to fit the taller dimension
    // 
    // After scaling by scaleFactor:
    // - Content size in pixels: (H * scaleFactor) x (W * scaleFactor)
    // - In normalized canvas coords:
    //   - width = (H * scaleFactor) / W = scaleFactor / AR
    //   - height = (W * scaleFactor) / H = scaleFactor * AR
    //
    // Example: AR=1.417, scaleFactor=0.706 (100% at 90° rotation)
    //   contentWidth = 0.706 / 1.417 = 0.498 (content is narrower than canvas)
    //   contentHeight = 0.706 * 1.417 = 1.0 (content fills canvas height)
    //
    // Example: AR=1.417, scaleFactor=0.882 (125% at 90° rotation)
    //   contentWidth = 0.882 / 1.417 = 0.622 (wider than at 100%)
    //   contentHeight = 0.882 * 1.417 = 1.25 (extends BEYOND canvas by 25%)
    //   x = (1 - 0.622) / 2 = 0.189
    //   y = (1 - 1.25) / 2 = -0.125 (negative = extends above canvas)
    //
    // NOTE: We do NOT clamp to 1.0 here. When scale > 100%, content extends
    // beyond the canvas. The overlay needs these true bounds to correctly
    // map coordinates. CropOverlay has its own clamping for visible handles.
    
    contentWidth = scaleFactor / aspectRatio
    contentHeight = scaleFactor * aspectRatio
  }
  
  // Center the content in the canvas (may result in negative x/y when content overflows)
  const x = (1 - contentWidth) / 2
  const y = (1 - contentHeight) / 2
  
  return { x, y, width: contentWidth, height: contentHeight }
}

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
 * Forward transform: content space -> screen space (aspect-ratio aware)
 * 
 * This transform accounts for the fact that when content is rotated 90°/270°,
 * the content doesn't fill the entire canvas. Instead, it's scaled down and 
 * centered within the canvas.
 * 
 * @param contentBox - Box in content normalized coords [0,1]
 * @param rotationDeg - Rotation in degrees (0, 90, 180, 270)
 * @param scaleFactor - Scale factor (includes auto-fit adjustment)
 * @param aspectRatio - Content aspect ratio (width/height), e.g., 1.42 for landscape
 * @param offset - Additional offset (default {0,0})
 */
export function forwardTransformBox(
  contentBox: Box,
  rotationDeg: number,
  scaleFactor: number,
  aspectRatio: number = 1,
  offset: Point = { x: 0, y: 0 }
): Box {
  // Calculate content bounds on canvas
  const contentBounds = getContentBounds(rotationDeg, scaleFactor, aspectRatio)
  
  // Step 1: Rotate the content box corners
  const corners = boxToCorners(contentBox)
  const rotatedCorners = corners.map(corner => rotatePoint(corner, rotationDeg))
  const rotatedBox = getBoundingBox(rotatedCorners)
  
  // Step 2: Map from [0,1] content-relative to content bounds on canvas
  // The rotated box is in [0,1] of the rotated content
  // We need to map it to the actual content bounds on the canvas
  const screenBox: Box = {
    x: contentBounds.x + rotatedBox.x * contentBounds.width,
    y: contentBounds.y + rotatedBox.y * contentBounds.height,
    width: rotatedBox.width * contentBounds.width,
    height: rotatedBox.height * contentBounds.height
  }
  
  // Apply offset
  const result: Box = {
    x: screenBox.x + offset.x,
    y: screenBox.y + offset.y,
    width: screenBox.width,
    height: screenBox.height
  }
  
  console.log(`🔄 [forwardTransformBox] rotation=${rotationDeg}°, AR=${aspectRatio.toFixed(3)}:`)
  console.log(`   Content: ${JSON.stringify(contentBox)}`)
  console.log(`   Bounds: ${JSON.stringify(contentBounds)}`)
  console.log(`   Screen: ${JSON.stringify(result)}`)
  
  return result
}

/**
 * Inverse transform: screen space -> content space (aspect-ratio aware)
 * 
 * Reverses the forward transform, mapping from screen/canvas coordinates
 * back to content coordinates.
 */
export function inverseTransformBox(
  screenBox: Box,
  rotationDeg: number,
  scaleFactor: number,
  aspectRatio: number = 1,
  offset: Point = { x: 0, y: 0 }
): Box {
  // Calculate content bounds on canvas
  const contentBounds = getContentBounds(rotationDeg, scaleFactor, aspectRatio)
  
  // Step 1: Remove offset
  const unoffseted: Box = {
    x: screenBox.x - offset.x,
    y: screenBox.y - offset.y,
    width: screenBox.width,
    height: screenBox.height
  }
  
  // Step 2: Map from canvas space to [0,1] content-relative (rotated) space
  // Inverse of: screenBox = bounds.x + rotatedBox.x * bounds.width
  const rotatedBox: Box = {
    x: contentBounds.width > 0 ? (unoffseted.x - contentBounds.x) / contentBounds.width : 0,
    y: contentBounds.height > 0 ? (unoffseted.y - contentBounds.y) / contentBounds.height : 0,
    width: contentBounds.width > 0 ? unoffseted.width / contentBounds.width : 0,
    height: contentBounds.height > 0 ? unoffseted.height / contentBounds.height : 0
  }
  
  // Step 3: Unrotate the corners to get content coordinates
  const corners = boxToCorners(rotatedBox)
  const contentCorners = corners.map(corner => unrotatePoint(corner, rotationDeg))
  const result = getBoundingBox(contentCorners)
  
  console.log(`🔄 [inverseTransformBox] rotation=${rotationDeg}°, AR=${aspectRatio.toFixed(3)}:`)
  console.log(`   Screen: ${JSON.stringify(screenBox)}`)
  console.log(`   Bounds: ${JSON.stringify(contentBounds)}`)
  console.log(`   Content: ${JSON.stringify(result)}`)
  
  return result
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
