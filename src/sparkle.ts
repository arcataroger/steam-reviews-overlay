/**
 * The Overwhelmingly Positive sparkle. Each light is a chain of short pieces, all riding the frame's
 * path. One rigid streak cannot turn a corner: on a short side its head shoots past the end, so it
 * seems to vanish there. A piece trails the head by a share of the lap, so tails stay the same
 * length in pixels on every size of frame.
 */
export const LAP_SECONDS = 5 // keep in step with .sro-orbit > i in content.css
const LENGTH = 1000
const LIGHTS = 2
const MIN_PIECES = 6
const MAX_PIECES = 24
const PIECE_LENGTH = 16

export interface OrbitPiece {
  width: string
  delay: string
  background: string
}

/** White at the head, into the frame's color, fading out along the tail. */
function paint(along: number, length: number): string {
  const white = Math.max(0, 100 - (along / length) * 500)
  const alpha = 100 * Math.max(0, 1 - along / length) ** 1.5
  return `color-mix(in srgb, color-mix(in srgb, #fff ${white.toFixed(1)}%, var(--sro-hl)) ${alpha.toFixed(1)}%, transparent)`
}

/** The pieces for a frame of this size. A tail stops just short of the light ahead of it. */
export function orbitPieces(width: number, height: number): OrbitPiece[] {
  const lap = 2 * (width + height)
  const length = Math.min(LENGTH, (lap / LIGHTS) * 0.98)
  const count = Math.min(MAX_PIECES, Math.max(MIN_PIECES, Math.ceil(length / PIECE_LENGTH)))
  const step = length / count
  const pieces: OrbitPiece[] = []
  for (let light = 0; light < LIGHTS; light++) {
    for (let i = 0; i < count; i++) {
      const phase = (((light / LIGHTS - (i * step) / lap) % 1) + 1) % 1
      pieces.push({
        width: `${step + 1}px`, // a pixel of overlap hides the seams
        delay: `${(-LAP_SECONDS * phase).toFixed(3)}s`,
        background: `linear-gradient(to right, ${paint((i + 1) * step, length)}, ${paint(i * step, length)})`,
      })
    }
  }
  return pieces
}
