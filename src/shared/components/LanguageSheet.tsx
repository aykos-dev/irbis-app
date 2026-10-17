import { StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Sheet } from './Sheet';
import { spacing } from '../constants/spacing';
import { useTheme } from '../contexts/theme';
import { getLocale, languageNames, setLocale, supportedLocales, t, type Locale } from '../i18n';
import { haptics } from '../utils/haptics';

type Props = { closing: boolean; onDismiss: () => void; onPick: () => void };

const CHECK = 22;

/** Language picker: a sheet, not a screen (architecture: pickers are sheets). */
export function LanguageSheet({ closing, onDismiss, onPick }: Props) {
  const { colors } = useTheme();
  const current = getLocale();

  const choose = (locale: Locale) => {
    haptics.selection();
    setLocale(locale);
    onPick();
  };

  return (
    <Sheet
      testID="profile.language-sheet"
      accessibilityLabel={t('auth.profile.chooseLanguage')}
      closing={closing}
      onDismiss={onDismiss}
    >
      <AppText variant="h2" accessibilityRole="header">
        {t('auth.profile.chooseLanguage')}
      </AppText>
      {supportedLocales.map(locale => (
        <Pressable
          key={locale}
          testID={`profile.language-${locale}`}
          accessibilityRole="radio"
          accessibilityLabel={languageNames[locale]}
          accessibilityState={{ selected: locale === current }}
          onPress={() => choose(locale)}
          style={styles.option}
        >
          <AppText variant="h3" style={styles.name}>
            {languageNames[locale]}
          </AppText>
          {locale === current ? <Icon name="check" color={colors.teal700} size={CHECK} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: spacing[48],
  },
  name: { flex: 1 },
});
