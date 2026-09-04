import { describe, expect, it } from 'vitest'
import { canAccessStrategy } from './strategyAccess'
describe('strategy tier access', () => { it('keeps basic strategies free', () => { expect(canAccessStrategy('normal', 'LONG_CALL')).toBe(true); expect(canAccessStrategy('normal', 'LONG_PUT')).toBe(true) }); it('locks advanced strategies for free and unlocks them for premium', () => { expect(canAccessStrategy('normal', 'BULL_CALL_SPREAD')).toBe(false); expect(canAccessStrategy('premium', 'IRON_CONDOR')).toBe(true) }) })
