import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { Pressable } from '../../../../shared/components/Pressable';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { campColors, lobbySizes, mafiaSizes } from '../../campTheme';
import { RoleGlyph } from './RoleGlyph';
import {
  balance,
  civilians,
  clampCounts,
  dealBlocked,
  defaultCounts,
  readMafiaSettings,
  roles,
  saveMafiaSettings,
  specials,
  teamCounts,
  type MafiaCounts,
  type MafiaSettings,
  type Role,
  type SpecialRoleId,
} from './roles';

type Props = {
  /** Connected seats besides the host. */
  players: number;
  onDeal: (settings: MafiaSettings) => void;
};

/**
 * Mafia host setup (campfire-mafia AC1): one row per role with a 0..n stepper (Civilian fills the
 * rest), balance hint, "Reveal role when out", Deal roles. The last setup is reused (clamped to n);
 * a fresh host gets the default counts for the table size.
 */
export function MafiaSetup({ players: n, onDeal }: Props) {
  const [saved] = useState(readMafiaSettings);
  const [edited, setEdited] = useState<MafiaCounts | null>(
    saved?.counts ?? null,
  );
  const [revealOut, setRevealOut] = useState(saved?.revealOut ?? true);
  const counts = clampCounts(edited ?? defaultCounts(n), n);
  const civilianCount = civilians(counts, n);
  const teams = teamCounts(counts, n);
  const blocked = dealBlocked(counts, n);

  const change = (next: MafiaCounts, reveal: boolean) => {
    setEdited(next);
    saveMafiaSettings({ counts: next, revealOut: reveal });
  };

  const step = (id: SpecialRoleId, delta: number) => {
    const value = counts[id] + delta;
    if (value < 0 || value > n) {
      return;
    }
    haptics.selection();
    change({ ...counts, [id]: value }, revealOut);
  };

  const toggleReveal = (value: boolean) => {
    haptics.selection();
    setRevealOut(value);
    change(counts, value);
  };

  return (
    <View testID="maf.setup" style={layout.section}>
      <View style={layout.header}>
        <AppText variant="caption">{t('camp.maf.setupTitle')}</AppText>
        <AppText variant="h2" accessibilityRole="header">
          {t('camp.maf.chooseRoles')}
        </AppText>
        <AppText variant="small" tone="muted">
          {t('camp.maf.players', { n })}
        </AppText>
      </View>

      {roles.map(role => {
        const id = role.id;
        return (
          <RoleRow
            key={id}
            role={role}
            count={id === 'civilian' ? civilianCount : counts[id]}
            max={n}
            onStep={
              id === 'civilian' ? undefined : delta => step(id, delta)
            }
          />
        );
      })}

      <View style={layout.header}>
        <AppText testID="maf.balance" variant="h3">
          {t('camp.maf.summary', {
            total: specials(counts) + civilianCount,
            n,
            balance: t(`camp.maf.${balance(counts, n)}`),
          })}
        </AppText>
        <AppText variant="small" tone="muted">
          {t('camp.maf.teamCounts', teams)}
        </AppText>
      </View>

      <View style={layout.switchRow}>
        <View style={layout.flex}>
          <AppText variant="h3">{t('camp.maf.revealOut')}</AppText>
          <AppText variant="small" tone="muted">
            {t('camp.maf.revealOutSub')}
          </AppText>
        </View>
        <Switch
          testID="maf.reveal-out"
          accessibilityLabel={t('camp.maf.revealOut')}
          accessibilityHint={t('camp.maf.revealOutSub')}
          value={revealOut}
          onValueChange={toggleReveal}
          trackColor={{ true: campColors.teal, false: campColors.line }}
          thumbColor={campColors.white}
        />
      </View>

      <AppButton
        testID="maf.deal"
        label={t('camp.maf.deal')}
        variant="secondary"
        disabled={blocked !== null}
        onPress={() => {
          haptics.success();
          onDeal({ counts, revealOut });
        }}
      />
      {blocked ? (
        <AppText
          testID="maf.deal-reason"
          variant="small"
          style={layout.center}
        >
          {t(`camp.maf.${blocked}`)}
        </AppText>
      ) : null}
    </View>
  );
}

function RoleRow({
  role,
  count,
  max,
  onStep,
}: {
  role: Role;
  count: number;
  max: number;
  /** Absent for Civilian (its count follows the others). */
  onStep?: (delta: number) => void;
}) {
  const styles = useStyles();
  const name = t(`camp.maf.role.${role.id}.name`);
  return (
    <View testID={`maf.role.${role.id}`} style={[layout.row, styles.row]}>
      <View
        style={[layout.tile, { backgroundColor: role.color }]}
        importantForAccessibility="no-hide-descendants"
      >
        <RoleGlyph roleId={role.id} />
      </View>
      <View style={layout.flex}>
        <View style={layout.nameRow}>
          <AppText variant="h3">{name}</AppText>
          <View style={[layout.chip, styles.chip]}>
            <AppText variant="chip">
              {t(`camp.maf.team.${role.team}.name`)}
            </AppText>
          </View>
        </View>
        <AppText variant="small" tone="muted">
          {t(`camp.maf.role.${role.id}.desc`)}
        </AppText>
      </View>
      <View style={layout.stepper}>
        {onStep ? (
          <StepButton
            testID={`maf.role.${role.id}.minus`}
            label={`${name} −1`}
            symbol="−"
            disabled={count <= 0}
            onPress={() => onStep(-1)}
          />
        ) : null}
        <AppText
          testID={`maf.role.${role.id}.count`}
          variant="h3"
          style={layout.count}
          accessibilityLabel={`${name}: ${count}`}
        >
          {count}
        </AppText>
        {onStep ? (
          <StepButton
            testID={`maf.role.${role.id}.plus`}
            label={`${name} +1`}
            symbol="+"
            disabled={count >= max}
            onPress={() => onStep(1)}
          />
        ) : null}
      </View>
    </View>
  );
}

function StepButton({
  testID,
  label,
  symbol,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  symbol: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={spacing[4]}
      style={[layout.step, styles.step, disabled && layout.stepDisabled]}
    >
      <AppText variant="h3">{symbol}</AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
  header: { gap: spacing[4] },
  flex: { flex: 1, gap: spacing[4] },
  center: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.tile,
    borderWidth: borders.card,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[8],
  },
  tile: {
    width: mafiaSizes.roleTile,
    height: mafiaSizes.roleTile,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  step: {
    width: mafiaSizes.stepper,
    height: mafiaSizes.stepper,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: lobbySizes.dimmed },
  count: { minWidth: spacing[20], textAlign: 'center' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
});

const useStyles = createThemedStyles(c => ({
  row: { backgroundColor: c.card, borderColor: c.line },
  chip: { backgroundColor: c.soft },
  step: { borderColor: c.line },
}));
