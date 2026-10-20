import { describe, expect, it } from 'vitest';
import { distanceKm } from './geo';

describe('distanceKm', () => {
  it('returns zero for the same point', () => {
    expect(distanceKm({ lat: 30.3, lng: 78.0 }, { lat: 30.3, lng: 78.0 })).toBe(0);
  });

  it('calculates approximate distance between coordinates', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.2, 0);
  });
});