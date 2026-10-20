import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  roleCards,
  roleGlyphImages,
} from '../../../../../assets/images/campfire';
import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { campScheme } from '../../../campTheme';
import { RoleCard } from '../RoleCard';
import { RoleGlyph } from '../RoleGlyph';

jest.mock('../../useSecureScreen', () => ({
  useSecureScreen: () => ({ captured: false }),
}));

describe('campfire art', () => {
  it('shows the role card art for the dealt role while the card is held', async () => {
    await render(
      <ThemeProvider scheme={campScheme}>
        <RoleCard
          roleId="detective"
          seat={3}
          nickname="guest_1"
          readyCount={0}
          playerCount={6}
          ready={false}
          onReady={jest.fn()}
        />
      </ThemeProvider>,
    );
    expect(
      screen.queryByTestId('maf.card.art', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();

    await fireEvent(screen.getByTestId('camp.secret.card'), 'pressIn');

    expect(
      screen.getByTestId('maf.card.art', { includeHiddenElements: true }).props
        .source,
    ).toBe(roleCards.detective);
  });

  it('draws the sniper glyph as a tinted image', async () => {
    await render(<RoleGlyph roleId="sniper" size={22} color="#000000" />);

    const glyph = screen.getByTestId('maf.glyph.sniper');
    expect(glyph.props.source).toBe(roleGlyphImages.sniper);
    expect(glyph.props.tintColor).toBe('#000000');
  });
});
