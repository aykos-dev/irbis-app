import { formatDistance, formatElevation } from '../units';

describe('profile units', () => {
  it('formats metric distances with one decimal under 10 km and whole values above', () => {
    expect(formatDistance(1850, 'metric')).toBe('1.9 km');
    expect(formatDistance(10_450, 'metric')).toBe('10 km');
    expect(formatElevation(1625, 'metric', 'en')).toBe('1,625 m');
  });

  it('converts distances and elevations to imperial units', () => {
    expect(formatDistance(1609.344, 'imperial', 'en')).toBe('1.0 mi');
    expect(formatElevation(1000, 'imperial', 'en')).toBe('3,281 ft');
  });
});
