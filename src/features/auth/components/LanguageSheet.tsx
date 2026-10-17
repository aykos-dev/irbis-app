import { StyleSheet } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { getLocale, languageNames, setLocale, supportedLocales, t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';

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
