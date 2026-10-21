import { parsePathVisitLink } from '../pathVisitLink';

describe('debug — QA path visit link (weekly-path AC4)', () => {
  it('reads the place id; anything else is not a visit link', () => {
    expect(parsePathVisitLink('debug/path/visit/00000000-0000-4000-8000-0000000000d1')).toEqual({
      pathVisit: '00000000-0000-4000-8000-0000000000d1',
    });
    expect(parsePathVisitLink('/debug/path/visit/abc/?x=1')).toEqual({ pathVisit: 'abc' });
    expect(parsePathVisitLink('debug/path/visit/')).toBeNull();
    expect(parsePathVisitLink('debug/levels/grant?xp=1')).toBeNull();
  });
});
