import { haversineKm } from '../geo';

describe('haversineKm', () => {
  it('Tashkent → Samarkand is about 270 km', () => {
    const km = haversineKm({ lat: 41.3111, lng: 69.2797 }, { lat: 39.6542, lng: 66.9597 });
    expect(km).toBeGreaterThan(260);
    expect(km).toBeLessThan(280);
  });
});
