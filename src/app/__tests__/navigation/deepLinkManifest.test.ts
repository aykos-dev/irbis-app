import { readFileSync } from 'fs';
import { join } from 'path';

import { linking } from '../../navigation/linking';

const manifest = readFileSync(
  join(__dirname, '../../../../android/app/src/main/AndroidManifest.xml'),
  'utf8',
);

function mainActivityFilters(): string[] {
  const activity = /<activity[^>]*android:name="\.MainActivity"[\s\S]*?<\/activity>/.exec(manifest);
  if (!activity) {
    throw new Error('MainActivity not found in AndroidManifest.xml');
  }
  return activity[0].match(/<intent-filter[\s\S]*?<\/intent-filter>/g) ?? [];
}

describe('Android deep-link intent-filter (D1)', () => {
  it('registers a VIEW/DEFAULT/BROWSABLE filter on MainActivity for the scheme used in linking.ts', () => {
    const schemes = linking.prefixes.map((p) => p.replace('://', ''));
    expect(schemes).toEqual(['irbis']);

    const viewFilter = mainActivityFilters().find((f) =>
      f.includes('android.intent.action.VIEW'),
    );
    expect(viewFilter).toBeDefined();
    expect(viewFilter).toContain('android.intent.category.DEFAULT');
    expect(viewFilter).toContain('android.intent.category.BROWSABLE');
    expect(viewFilter).toMatch(new RegExp(`<data\\s+android:scheme="${schemes[0]}"\\s*/>`));
  });

  it('keeps MAIN/LAUNCHER in its own filter', () => {
    const launcher = mainActivityFilters().find((f) => f.includes('android.intent.action.MAIN'));
    expect(launcher).toContain('android.intent.category.LAUNCHER');
    expect(launcher).not.toContain('android.intent.action.VIEW');
  });
});
