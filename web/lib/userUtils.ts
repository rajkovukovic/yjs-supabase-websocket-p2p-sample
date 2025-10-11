/**
 * Global utility functions for user display and formatting
 */

/**
 * Generates a 3-letter short name from a full name.
 * - 1 word: First 3 letters (e.g., "Peter" -> "PET"). Pads if shorter.
 * - 2 words: First letter of first word, first two of second (e.g., "Ann Smith" -> "ASM"). Adjusts if words are short.
 * - 3+ words: First letter of each of the first 3 words (e.g., "Ann Marie Smith" -> "AMS").
 *
 * @param name - The full name to convert.
 * @returns The 3-letter short name, uppercase.
 */
export const getShortName = (name: string): string => {
  if (!name || name.trim() === '') {
    return 'USR'
  }

  const trimmedName = name.trim()
  const words = trimmedName.split(/[\s-]+/).filter(word => word.length > 0)

  if (words.length === 0) {
    return 'USR'
  }

  let shortName = ''

  if (words.length === 1) {
    const word = words[0]
    shortName = word.substring(0, 3)
    if (shortName.length < 3) {
      const lastChar = shortName.charAt(shortName.length - 1) || 'X'
      shortName = shortName.padEnd(3, lastChar)
    }
  } else if (words.length === 2) {
    const [word1, word2] = words
    shortName = word1.charAt(0) + word2.substring(0, 2)
    if (shortName.length < 3) {
      shortName = word1.substring(0, 2) + word2.charAt(0)
    }
    if (shortName.length < 3) {
      shortName = shortName.padEnd(3, 'X')
    }
  } else {
    shortName = words
      .slice(0, 3)
      .map(word => word.charAt(0))
      .join('')
  }

  return shortName.substring(0, 3).toUpperCase()
}

/**
 * Generate a consistent color from a string (email or name)
 * 
 * @param str - The string to generate color from
 * @returns A hex color code
 */
export const generateColorFromString = (str: string): string => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#F59E0B', // amber
    '#10B981', // emerald
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#EF4444', // red
  ]
  
  return colors[Math.abs(hash) % colors.length]
}

