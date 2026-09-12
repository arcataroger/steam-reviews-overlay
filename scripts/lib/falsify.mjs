// Pure manifest falsifications for the border gate's self-test. Each one takes a truthful card
// record and returns a record that LIES about the treatment in a specific way, so a gate that still
// works must fail that card. A gate that passes a falsified manifest is not checking anything.

/** Claim a different tone than the one actually drawn. */
export function wrongTone(card) {
  if (!card.shape || !card.color) return null
  const swap = { '#66c0f4': '#c85e2d', '#b9a074': '#66c0f4', '#c85e2d': '#66c0f4', '#929396': '#66c0f4' }
  const next = swap[String(card.color).toLowerCase()]
  if (!next) return null
  return { ...card, color: next }
}

/** Claim a highlight on a card the overlay deliberately left alone. */
export function inventHighlight(card) {
  if (card.shape) return null
  return { ...card, shape: 'row', highlight: 'positive', color: '#66c0f4' }
}

/** Claim the wings run down the sides when they actually run across the top and bottom, or vice versa. */
export function flipAxis(card) {
  if (card.shape !== 'panel') return null
  return { ...card, axis: card.axis === 'x' ? 'y' : 'x' }
}

/** Claim a ring on all four sides when only two are drawn. */
export function panelToRow(card) {
  if (card.shape !== 'panel') return null
  return { ...card, shape: 'row', axis: null }
}

/** Claim the card is parked when a highlight is actually drawn on it. */
export function dropHighlight(card) {
  if (!card.shape) return null
  return { ...card, shape: null, axis: null, highlight: null, color: null }
}

export const FALSIFICATIONS = {
  'wrong-tone': wrongTone,
  'invent-highlight': inventHighlight,
  'flip-axis': flipAxis,
  'panel-to-row': panelToRow,
  'drop-highlight': dropHighlight,
}

/**
 * Apply one falsification across a manifest's active-state cards.
 * @returns {{manifest: object, falsified: string[]}} the falsified manifest and the files it lies about
 */
export function falsifyManifest(manifest, mode) {
  const fn = FALSIFICATIONS[mode]
  if (!fn) throw new Error(`unknown falsification: ${mode} (have ${Object.keys(FALSIFICATIONS).join(', ')})`)
  const falsified = []
  const cards = (manifest.cards ?? []).map((card) => {
    if (card.state !== 'active') return card
    const lie = fn(card)
    if (!lie) return card
    falsified.push(card.file)
    return lie
  })
  return { manifest: { ...manifest, cards }, falsified }
}
