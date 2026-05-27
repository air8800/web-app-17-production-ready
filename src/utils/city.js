export const ALL_CITIES_LABEL = 'All Cities'

const NON_CITY_ADDRESS_PARTS = new Set(['india', 'maharashtra', 'mh'])

/** Lowercase key for matching — ignores case, extra spaces, trailing symbols. */
export const normalizeCityKey = (city) =>
  String(city || '')
    .trim()
    .toLowerCase()
    .replace(/[-–—.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const formatCityName = (city) => {
  const cleaned = cleanAddressPart(city)
  if (!cleaned) return ''

  return cleaned
    .split(' ')
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(' ')
}

export const cleanAddressPart = (part) =>
  String(part || '')
    .replace(/\b\d{5,6}\b/g, '')
    .replace(/\b(dist\.?|district|taluka)\b/gi, '')
    .replace(/^[\s\-–—.,;:]+|[\s\-–—.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const isNonCityAddressPart = (part) => {
  const normalized = normalizeCityKey(part)
  return !normalized || NON_CITY_ADDRESS_PARTS.has(normalized) || /^\d+$/.test(normalized)
}

export const getShopCity = (shop) => {
  const address = shop?.address
  if (!address) return null

  const parts = String(address)
    .split(',')
    .map(cleanAddressPart)
    .filter(Boolean)

  const candidates = parts.length > 1 ? [...parts].reverse() : parts
  const city = candidates.find((part) => !isNonCityAddressPart(part))
  return city ? formatCityName(city) : null
}

export const getAvailableCities = (shops) => {
  const byKey = new Map()

  ;(shops || []).forEach((shop) => {
    const city = getShopCity(shop)
    const key = normalizeCityKey(city)
    if (key && !byKey.has(key)) {
      byKey.set(key, city)
    }
  })

  return [...byKey.values()].sort((a, b) => a.localeCompare(b))
}

export const shopMatchesCity = (shop, city) => {
  const selectedKey = normalizeCityKey(city)
  if (!selectedKey || selectedKey === normalizeCityKey(ALL_CITIES_LABEL)) return true

  const shopCityKey = normalizeCityKey(getShopCity(shop))
  if (shopCityKey && shopCityKey === selectedKey) return true

  return normalizeCityKey(shop?.address).includes(selectedKey)
}
