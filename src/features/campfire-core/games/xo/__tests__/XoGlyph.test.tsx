import { render, screen } from '@testing-library/react-native';

import xoGlyph from '../../../../../assets/images/campfire/gameGlyph_xo.png';
import { palette } from '../../../../../shared/constants/colors';
import { XoGlyph } from '../XoGlyph';

it('draws the XO tile glyph as the owner art tinted white', async () => {
  await render(<XoGlyph size={26} />);

  const glyph = screen.getByTestId('camp.glyph.xo');
  expect(glyph.props.source).toBe(xoGlyph);
  expect(glyph.props.tintColor).toBe(palette.white);
});
