import { storage } from '../../../shared/storage';
import { applyFix, clearTrack, emptyTrack, haversineM, loadTrack, MAX_POINTS, saveTrack, type Fix } from '../trackStore';

const TRIP_ID = 'trip_1';

const fix = (overrides: Partial<Fix> = {}): Fix => ({
  lat: 41.5,
  lng: 70.1,
  alt: 1000,
  accuracyM: 10,
  at: 0,
  ...overrides,
});

/** 0.001° of latitude ≈ 111.2 m. */
const NORTH_STEP = 0.001;

describe('active-trip trackStore — distance and climb (AC2)', () => {
  it('AC2: distance adds the haversine step between accepted fixes', () => {
    let track = applyFix(emptyTrack(TRIP_ID), fix());
    track = applyFix(track, fix({ lat: 41.5 + NORTH_STEP }));
    expect(track.distanceM).toBeCloseTo(haversineM(fix(), fix({ lat: 41.5 + NORTH_STEP })), 6);
    expect(track.distanceM).toBeGreaterThan(110);
    expect(track.distanceM).toBeLessThan(112);
    expect(track.points).toHaveLength(2);
  });

  it('AC2: a fix less accurate than 50 m is dropped', () => {
    const start = applyFix(emptyTrack(TRIP_ID), fix());
    const next = applyFix(start, fix({ lat: 41.6, accuracyM: 51 }));
    expect(next).toBe(start);
  });

  it('AC2: climb counts only gains of 3 m or more over the anchor; a descent moves the anchor', () => {
    const alts = [1000, 1002, 1004, 1001, 1003, 1006];
    const track = alts.reduce((acc, alt) => applyFix(acc, fix({ alt })), emptyTrack(TRIP_ID));
    // 1000 → 1004 (+4, anchor 1004) → 1001 (anchor 1001) → 1006 (+5)
    expect(track.climbM).toBe(9);
    expect(track.anchorAlt).toBe(1006);
  });

  it('AC2: a full track drops every second point', () => {
    let track = emptyTrack(TRIP_ID);
    for (let i = 0; i <= MAX_POINTS; i += 1) {
      track = applyFix(track, fix({ lat: 41 + i * 1e-5 }));
    }
    expect(track.points.length).toBeLessThanOrEqual(MAX_POINTS / 2 + 1);
  });

  it('AC2: the track is saved per trip and cleared after check-out', () => {
    storage.clearAll();
    const track = applyFix(emptyTrack(TRIP_ID), fix());
    saveTrack(track);
    expect(loadTrack(TRIP_ID)).toEqual(track);
    expect(loadTrack('trip_2')).toEqual(emptyTrack('trip_2'));
    clearTrack();
    expect(loadTrack(TRIP_ID)).toEqual(emptyTrack(TRIP_ID));
  });
});
