import { describe, it, expect } from 'vitest'
import { 
  adjustColor, 
  lightenColor, 
  darkenColor, 
  generateColorVariants 
} from '@/utils/color'

describe('Color Utilities', () => {
  describe('adjustColor', () => {
    it('should return valid hex colors', () => {
      const result = adjustColor('#8B5CF6', 0.5)
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should lighten colors with positive amounts', () => {
      const original = '#8B5CF6'
      const lightened = adjustColor(original, 0.3)
      
      // Convert to RGB to verify it's actually lighter
      const originalRGB = parseInt(original.slice(1), 16)
      const lightenedRGB = parseInt(lightened.slice(1), 16)
      
      expect(lightenedRGB).toBeGreaterThan(originalRGB)
    })

    it('should darken colors with negative amounts', () => {
      const original = '#8B5CF6'
      const darkened = adjustColor(original, -0.3)
      
      // Convert to RGB to verify it's actually darker
      const originalRGB = parseInt(original.slice(1), 16)
      const darkenedRGB = parseInt(darkened.slice(1), 16)
      
      expect(darkenedRGB).toBeLessThan(originalRGB)
    })

    it('should handle edge cases', () => {
      expect(adjustColor('#000000', 0.5)).toMatch(/^#[0-9a-f]{6}$/i)
      expect(adjustColor('#FFFFFF', 0.5)).toBe('#ffffff')
      expect(adjustColor('#FFFFFF', -0.5)).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should handle 3-character hex codes', () => {
      const result = adjustColor('#F0F', 0.2)
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should never produce decimal values in hex output', () => {
      const testColors = ['#8B5CF6', '#EC4899', '#6B7280', '#3B82F6', '#10B981']
      const testFactors = [0.1, 0.25, 0.5, 0.75, 0.9, -0.1, -0.25, -0.5]
      
      testColors.forEach(color => {
        testFactors.forEach(factor => {
          const result = adjustColor(color, factor)
          expect(result).toMatch(/^#[0-9a-f]{6}$/i)
          expect(result).not.toContain('.')
        })
      })
    })
  })

  describe('lightenColor', () => {
    it('should return valid hex colors', () => {
      const result = lightenColor('#8B5CF6', 0.3)
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should make colors lighter', () => {
      const original = '#8B5CF6'
      const lightened = lightenColor(original, 0.3)
      
      const originalRGB = parseInt(original.slice(1), 16)
      const lightenedRGB = parseInt(lightened.slice(1), 16)
      
      expect(lightenedRGB).toBeGreaterThan(originalRGB)
    })

    it('should clamp factor to valid range', () => {
      const color = '#8B5CF6'
      const result1 = lightenColor(color, -0.5) // Should be clamped to 0
      const result2 = lightenColor(color, 0)
      const result3 = lightenColor(color, 1.5) // Should be clamped to 1
      const result4 = lightenColor(color, 1)
      
      expect(result1).toBe(result2) // Both should be the same (factor = 0)
      expect(result3).toBe(result4) // Both should be the same (factor = 1)
    })
  })

  describe('darkenColor', () => {
    it('should return valid hex colors', () => {
      const result = darkenColor('#8B5CF6', 0.3)
      expect(result).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should make colors darker', () => {
      const original = '#8B5CF6'
      const darkened = darkenColor(original, 0.3)
      
      const originalRGB = parseInt(original.slice(1), 16)
      const darkenedRGB = parseInt(darkened.slice(1), 16)
      
      expect(darkenedRGB).toBeLessThan(originalRGB)
    })
  })

  describe('generateColorVariants', () => {
    it('should return array of valid hex colors', () => {
      const variants = generateColorVariants('#8B5CF6', 5)
      
      expect(variants).toHaveLength(5)
      variants.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
        expect(color).not.toContain('.')
      })
    })

    it('should return base color for count of 1', () => {
      const baseColor = '#8B5CF6'
      const variants = generateColorVariants(baseColor, 1)
      
      expect(variants).toHaveLength(1)
      expect(variants[0]).toBe(baseColor)
    })

    it('should return empty array for count of 0', () => {
      const variants = generateColorVariants('#8B5CF6', 0)
      expect(variants).toHaveLength(0)
    })

    it('should generate variants in correct order for sorted values', () => {
      const variants = generateColorVariants('#8B5CF6', 3, true)
      
      expect(variants).toHaveLength(3)
      
      // Convert to RGB values to check brightness order
      const rgbValues = variants.map(color => {
        const hex = color.slice(1)
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return r + g + b // Simple brightness calculation
      })
      
      // First should be lightest (highest RGB sum), last should be darkest
      expect(rgbValues[0]).toBeGreaterThan(rgbValues[1])
      expect(rgbValues[1]).toBeGreaterThan(rgbValues[2])
    })

    it('should handle different base colors', () => {
      const baseColors = ['#8B5CF6', '#EC4899', '#6B7280', '#3B82F6', '#10B981']
      
      baseColors.forEach(baseColor => {
        const variants = generateColorVariants(baseColor, 4)
        
        expect(variants).toHaveLength(4)
        variants.forEach(color => {
          expect(color).toMatch(/^#[0-9a-f]{6}$/i)
          expect(color).not.toContain('.')
        })
      })
    })

    it('should never produce invalid hex values', () => {
      // Test with extreme cases that previously caused issues
      const testCases = [
        { base: '#8B5CF6', count: 10 },
        { base: '#000000', count: 5 },
        { base: '#FFFFFF', count: 5 },
        { base: '#FF0000', count: 7 },
        { base: '#00FF00', count: 3 },
        { base: '#0000FF', count: 8 }
      ]
      
      testCases.forEach(({ base, count }) => {
        const variants = generateColorVariants(base, count)
        
        variants.forEach((color, index) => {
          expect(color).toMatch(/^#[0-9a-f]{6}$/i)
          expect(color).not.toContain('.')
          expect(color).not.toContain('NaN')
          expect(color).not.toContain('undefined')
          
          // Verify each character is a valid hex digit
          const hex = color.slice(1)
          for (let i = 0; i < hex.length; i++) {
            expect('0123456789abcdef').toContain(hex[i].toLowerCase())
          }
        })
      })
    })
  })

  describe('Integration tests', () => {
    it('should work correctly in the pie chart scenario', () => {
      // Simulate the exact scenario from the pie chart
      const baseColor = '#8B5CF6' // Purple category
      const subcategoryCount = 4
      
      const variants = generateColorVariants(baseColor, subcategoryCount, true)
      
      expect(variants).toHaveLength(subcategoryCount)
      
      // All should be valid hex colors
      variants.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
        expect(color).not.toContain('.')
      })
      
      // Should be ordered from lightest to darkest
      const rgbSums = variants.map(color => {
        const hex = color.slice(1)
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return r + g + b
      })
      
      for (let i = 0; i < rgbSums.length - 1; i++) {
        expect(rgbSums[i]).toBeGreaterThanOrEqual(rgbSums[i + 1])
      }
    })
  })
})
