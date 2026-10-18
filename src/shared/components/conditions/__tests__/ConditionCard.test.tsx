import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PlaceConditionDto } from '../../../api/generated/model';
import { ThemeProvider } from '../../../contexts/theme';
import { i18n } from '../../../i18n';
import { ConditionCard } from '../ConditionCard';

const NOW = new Date('2026-10-17T12:00:00Z');

/** Synthetic condition — not a real place. */
const condition = (overrides: Partial<PlaceConditionDto> = {}): PlaceConditionDto => ({
  placeId: '00000000-0000-4000-8000-0000000000c1',
  status: 'go',
  source: 'forecast',
  reasons: [{ code: 'GOOD_WEATHER', day: 'sat', value: 12 }],
  text: null,
  opensMonth: null,
  hazards: [],
  weekend: [],
  forecastAt: '2026-10-17T11:00:00Z',
  computedAt: '2026-10-17T11:48:00Z',
  ...overrides,
});

async function show(props: Partial<Parameters<typeof ConditionCard>[0]> = {}) {
  const onRetry = jest.fn();
  await render(
    <ThemeProvider>
      <ConditionCard
        condition={undefined}
        error={null}
        isOnline
        onRetry={onRetry}
        locale="en"
        now={NOW}
        {...props}
      />
    </ThemeProvider>,
  );
  return onRetry;
}

beforeEach(() => {
  i18n.locale = 'en';
});

describe('conditions — ConditionCard (AC7, AC8)', () => {
  it('AC7: no status yet shows the grey "not available" card', async () => {
    await show({ condition: condition({ status: null, source: null, reasons: [], computedAt: null }) });
    expect(screen.getByTestId('place.condition-empty')).toHaveTextContent('Condition not available yet');
    expect(screen.queryByTestId('place.condition-status')).not.toBeOnTheScreen();
  });

  it('AC7: not now shows chip, title, age, reasons and the worried Irbis', async () => {
    await show({
      condition: condition({
        status: 'not_now',
        reasons: [
          { code: 'THUNDERSTORM', day: 'sat' },
          { code: 'GUSTS', day: 'sun', value: 62 },
        ],
      }),
    });
    expect(screen.getByTestId('place.condition-status')).toHaveTextContent('Not now');
    expect(screen.getByTestId('place.condition-title')).toHaveTextContent('Not now this weekend');
    expect(screen.getByTestId('place.condition-updated')).toHaveTextContent('Updated 12 min ago · forecast');
    expect(screen.getByTestId('place.condition-reason.1')).toHaveTextContent('Thunderstorm on Saturday');
    expect(screen.getByTestId('place.condition-reason.2')).toHaveTextContent('Gusts up to 62 km/h on Sunday');
    expect(screen.getByTestId('place.condition-mascot')).toBeOnTheScreen();
  });

  it('AC7: seasonal lock names the opening month, or just "Closed for the season"', async () => {
    await show({
      condition: condition({ status: 'seasonal_lock', source: 'season', reasons: [], opensMonth: 5 }),
    });
    expect(screen.getByTestId('place.condition-status')).toHaveTextContent('Seasonal lock');
    expect(screen.getByTestId('place.condition-title')).toHaveTextContent(
      'Closed for the season · Opens in May',
    );
    expect(screen.queryByTestId('place.condition-mascot')).not.toBeOnTheScreen();

    await show({
      condition: condition({ status: 'seasonal_lock', source: 'season', reasons: [], opensMonth: null }),
    });
    expect(screen.getByTestId('place.condition-title')).toHaveTextContent(/^Closed for the season$/);
  });

  it('AC8: offline without cache and a fetch error both offer "Try again"', async () => {
    const offlineRetry = await show({ isOnline: false });
    expect(screen.getByTestId('place.condition-offline')).toHaveTextContent(
      /You're offline — condition not loaded/,
    );
    await fireEvent.press(screen.getByTestId('place.condition-retry'));
    expect(offlineRetry).toHaveBeenCalledTimes(1);

    await show({ error: new Error('boom') });
    expect(screen.getByTestId('place.condition-error')).toHaveTextContent(/Couldn't load the condition/);
  });
});
