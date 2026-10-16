import { uuidV4 } from '../uuid';

describe('uuidV4', () => {
  it('returns RFC 4122 version-4 UUIDs', () => {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (let i = 0; i < 200; i += 1) {
      expect(uuidV4()).toMatch(pattern);
    }
  });

  it('does not repeat', () => {
    const values = new Set(Array.from({ length: 500 }, () => uuidV4()));
    expect(values.size).toBe(500);
  });
});
