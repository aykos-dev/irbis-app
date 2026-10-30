import { formatDistance, formatElevation } from '../units';

describe('profile units', () => {
  it('formats metric distances with one decimal under 10 km and whole values above', () => {
    expect(formatDistance(1850, 'metric')).toBe('1.9 km');
    expect(formatDistance(10_450, 'metric')).toBe('10 km');
    expect(formatElevation(1625, 'metric')).toBe('1625 m');
  });

  it('converts distances and elevations to imperial units', () => {
    expect(formatDistance(1609.344, 'imperial')).toBe('1.0 mi');
    expect(formatElevation(1000, 'imperial')).toBe('3281 ft');
  });
});
