import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { i18n } from '../../../../../shared/i18n';
import { campColors, campScheme } from '../../../campTheme';
import { GeoModeSheet } from '../GeoModeSheet';

/*
 * Like the real modal, the sheet renders its content in a portal at the app root, under the root
 * (light) theme instead of Campfire's dark subtree. The stock mock renders it in place, which hid
 * the bug: dark-ink headings on the dark sheet in light theme, i.e. invisible.
 */
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const base = jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock');
  const theme = jest.requireActual<typeof import('../../../../../shared/contexts/theme')>(
    '../../../../../shared/contexts/theme',
  );
  class BottomSheetModal extends React.Component<{ children: import('react').ReactNode }> {
    present() {}
    dismiss() {}
    render() {
      return React.createElement(theme.ThemeProvider, {
        scheme: 'light',
        children: this.props.children,
      });
    }
  }
  return { ...base, __esModule: true, BottomSheetModal };
});

let previousLocale = i18n.locale;
beforeEach(() => {
  previousLocale = i18n.locale;
});
afterEach(() => {
  i18n.locale = previousLocale;
});

const showSheet = () =>
  render(
    <ThemeProvider scheme={campScheme}>
      <GeoModeSheet onPick={jest.fn()} onDismiss={jest.fn()} />
    </ThemeProvider>,
  );

describe('GeoModeSheet names (bug: blank title and game names)', () => {
  it.each([
    ['en', 'Geocore', ['Find the country', 'Capital → Country', 'Country → Capital', 'City distance']],
    ['uz', 'Geokor', null],
  ] as const)('%s: the title and all 4 games are drawn in the dark ink of the sheet', async (locale, title, names) => {
    i18n.locale = locale;
    await showSheet();
    const expected =
      names ??
      (['findCountry', 'capitalToCountry', 'countryToCapital', 'cityDistance'] as const).map(mode =>
        i18n.t(`camp.geo.mode.${mode}`),
      );
    for (const text of [title, ...expected]) {
      expect(screen.getByText(text)).toHaveStyle({ color: campColors.ink });
    }
  });
});
