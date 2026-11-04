import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../contexts/theme';
import { Sheet } from '../Sheet';
import { TextField } from '../TextField';

// The repo's gorhom mock (jest.setup.js) renders BottomSheetTextInput as a plain TextInput; tag it here so the
// test can tell which input TextField picked.
jest.mock('@gorhom/bottom-sheet', () => {
  const base = require('@gorhom/bottom-sheet/mock');
  const { createElement, forwardRef } = require('react');
  const { TextInput, View } = require('react-native');
  const BottomSheetTextInput = forwardRef((props: object, ref: unknown) =>
    createElement(View, { testID: 'bottom-sheet-input' }, createElement(TextInput, { ...props, ref })),
  );
  return { ...base, __esModule: true, BottomSheetTextInput };
});

// owner-fixes-1022: a plain TextInput inside a sheet never lifts above the keyboard (gorhom focus target).
describe('TextField', () => {
  it('renders the bottom-sheet input inside a Sheet and a plain input elsewhere', async () => {
    await render(
      <ThemeProvider>
        <TextField testID="screen.name" label="Name" value="" onChangeText={() => undefined} />
        <Sheet testID="sheet" accessibilityLabel="Sheet" onDismiss={() => undefined}>
          <TextField testID="sheet.name" label="Name" value="" onChangeText={() => undefined} />
        </Sheet>
      </ThemeProvider>,
    );
    const sheetInput = screen.getByTestId('bottom-sheet-input', { includeHiddenElements: true });
    expect(sheetInput).toContainElement(screen.getByTestId('sheet.name', { includeHiddenElements: true }));
    expect(screen.getAllByTestId('bottom-sheet-input', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByTestId('screen.name', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
