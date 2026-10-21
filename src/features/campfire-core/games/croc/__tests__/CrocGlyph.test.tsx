import { render, screen } from '@testing-library/react-native';

import crocGlyph from '../../../../../assets/images/campfire/gameGlyph_croc.png';
import { palette } from '../../../../../shared/constants/colors';
import { CrocGlyph } from '../CrocGlyph';

it('draws the Crocodile tile glyph as the owner art tinted white', async () => {
  await render(<CrocGlyph size={26} />);

  const glyph = screen.getByTestId('camp.glyph.croc');
  expect(glyph.props.source).toBe(crocGlyph);
  expect(glyph.props.tintColor).toBe(palette.white);
});
