import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';

import type { RootStackParamList } from '../../../app/navigation/types';
import {
  useMeDeleteAvatar,
  useMeUpdate,
  useMeUploadAvatar,
} from '../../../shared/api/generated/me/me';
import {
  HomeRegion,
  Interest,
  type UpdateMeDto,
} from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Sheet } from '../../../shared/components/Sheet';
import { TextField } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { haptics } from '../../../shared/utils/haptics';
import { SettingToggle } from '../components/SettingToggle';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const regions = Object.values(HomeRegion);
const interests = Object.values(Interest);

export function EditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useStyles();
  const { user, setUser } = useAuth();
  const update = useMeUpdate();
  const upload = useMeUploadAvatar();
  const remove = useMeDeleteAvatar();
  const [name, setName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [homeRegion, setHomeRegion] = useState<HomeRegion | null>(
    user?.homeRegion ?? null,
  );
  const [pickedInterests, setPickedInterests] = useState<Interest[]>(
    user?.interests ?? [],
  );
  const [showStats, setShowStats] = useState(
    user?.preferences.showStats ?? true,
  );
  const [showHomeRegion, setShowHomeRegion] = useState(
    user?.preferences.showHomeRegion ?? false,
  );
  const [asset, setAsset] = useState<Asset | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!user)
    return (
      <Screen testID="edit-profile.loading">
        <AppText variant="body">Profile is unavailable.</AppText>
      </Screen>
    );

  const changedUsername = username.trim().toLowerCase() !== user.username;
  const choosePhoto = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      includeExtra: false,
    });
    if (result.didCancel) return;
    if (result.errorCode) {
      setError(
        result.errorCode === 'permission'
          ? 'Photo library permission was denied.'
          : (result.errorMessage ?? 'Could not open your photo library.'),
      );
      return;
    }
    const next = result.assets?.[0];
    if (!next?.uri) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type ?? '')) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if ((next.fileSize ?? 0) > 2 * 1024 * 1024) {
      setError('The photo must be 2 MB or smaller.');
      return;
    }
    setAsset(next);
    setRemovePhoto(false);
    setError(null);
  };

  const validate = () => {
    const trimmedName = name.trim();
    if (trimmedName && trimmedName.length < 2)
      return 'Name must have at least 2 characters.';
    if (!/^[a-z0-9_]{3,20}$/i.test(username.trim()))
      return 'Username must be 3–20 letters, numbers or underscores.';
    return null;
  };

  const save = async (currentPassword?: string) => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    if (changedUsername && !currentPassword) {
      setPasswordOpen(true);
      return;
    }
    setError(null);
    try {
      let nextUser = user;
      if (removePhoto && user.avatarUrl) nextUser = await remove.mutateAsync();
      if (asset?.uri) {
        const file = {
          uri: asset.uri,
          type: asset.type,
          name: asset.fileName ?? 'avatar.jpg',
        } as unknown as Blob;
        nextUser = await upload.mutateAsync({ data: { file } });
      }
      const data: UpdateMeDto = {
        displayName: name.trim() || null,
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        homeRegion,
        interests: pickedInterests,
        preferences: {
          showStats,
          showHomeRegion: homeRegion ? showHomeRegion : false,
        },
        ...(changedUsername ? { currentPassword } : {}),
      };
      nextUser = await update.mutateAsync({ data });
      setUser(nextUser);
      haptics.success();
      toast.show({ variant: 'success', message: 'Profile saved.' });
      navigation.goBack();
    } catch {
      setError('Could not save your profile. Check the fields and try again.');
      setPasswordOpen(false);
    }
  };

  const previewUri = asset?.uri ?? (!removePhoto ? user.avatarUrl : null);
  return (
    <Screen testID="edit-profile.screen" keyboardAware>
      <View style={layout.header}>
        <Pressable
          testID="edit-profile.cancel"
          accessibilityLabel="Cancel"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h2" accessibilityRole="header">
          Edit profile
        </AppText>
      </View>
      <View style={layout.photo}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={layout.avatar} />
        ) : (
          <View style={[layout.avatar, styles.avatar]}>
            <AppText variant="h1">
              {user.username.slice(0, 2).toUpperCase()}
            </AppText>
          </View>
        )}
        <AppButton
          testID="edit-profile.change-photo"
          label="Change photo"
          variant="white"
          onPress={() => void choosePhoto()}
        />
        {previewUri ? (
          <AppButton
            testID="edit-profile.remove-photo"
            label="Remove photo"
            variant="white"
            onPress={() => {
              setAsset(null);
              setRemovePhoto(true);
            }}
          />
        ) : null}
      </View>
      <TextField
        testID="edit-profile.name"
        label="Name"
        value={name}
        maxLength={40}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextField
        testID="edit-profile.username"
        label="Username"
        value={username}
        maxLength={20}
        onChangeText={setUsername}
      />
      <TextField
        testID="edit-profile.bio"
        label="Bio"
        value={bio}
        maxLength={150}
        onChangeText={setBio}
        hint={`${bio.length} / 150`}
      />
      <Pressable
        testID="edit-profile.home-region"
        accessibilityLabel="Home region"
        onPress={() => setRegionOpen(true)}
        style={[layout.select, styles.select]}
      >
        <AppText variant="body">Home region</AppText>
        <AppText variant="small" tone="muted">
          {homeRegion?.replaceAll('_', ' ') ?? 'Not set'}
        </AppText>
      </Pressable>
      <View style={layout.chips}>
        {interests.map(item => {
          const active = pickedInterests.includes(item);
          return (
            <Pressable
              key={item}
              testID={`edit-profile.interest-${item}`}
              accessibilityLabel={item}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              onPress={() =>
                setPickedInterests(current =>
                  active
                    ? current.filter(value => value !== item)
                    : [...current, item].slice(0, 5),
                )
              }
              style={[layout.chip, active ? styles.chipActive : styles.chip]}
            >
              <AppText variant="small">{item}</AppText>
            </Pressable>
          );
        })}
      </View>
      <SettingToggle
        testID="edit-profile.show-stats"
        label="Show stats on my profile"
        value={showStats}
        onChange={setShowStats}
      />
      <SettingToggle
        testID="edit-profile.show-home-region"
        label="Show my home region"
        value={showHomeRegion}
        disabled={!homeRegion}
        onChange={setShowHomeRegion}
      />
      <View
        testID="edit-profile.backpack-colour"
        style={[layout.select, styles.select]}
      >
        <AppText variant="body">Backpack colour</AppText>
        <AppText variant="small" tone="muted">
          Coming with companion styles
        </AppText>
      </View>
      {error ? (
        <AppText
          testID="edit-profile.error"
          variant="small"
          style={{ color: colors.red700 }}
        >
          {error}
        </AppText>
      ) : null}
      <AppButton
        testID="edit-profile.save"
        label="Save"
        loading={update.isPending || upload.isPending || remove.isPending}
        onPress={() => void save()}
      />
      {regionOpen ? (
        <Sheet
          testID="edit-profile.region-sheet"
          accessibilityLabel="Choose home region"
          onDismiss={() => setRegionOpen(false)}
        >
          <AppText variant="h2">Home region</AppText>
          <View style={layout.regionList}>
            <Pressable
              testID="edit-profile.region-none"
              accessibilityLabel="No region"
              onPress={() => {
                setHomeRegion(null);
                setShowHomeRegion(false);
                setRegionOpen(false);
              }}
            >
              <AppText variant="body">Not set</AppText>
            </Pressable>
            {regions.map(region => (
              <Pressable
                key={region}
                testID={`edit-profile.region-${region}`}
                accessibilityLabel={region}
                onPress={() => {
                  setHomeRegion(region);
                  setRegionOpen(false);
                }}
              >
                <AppText variant="body">{region.replaceAll('_', ' ')}</AppText>
              </Pressable>
            ))}
          </View>
        </Sheet>
      ) : null}
      {passwordOpen ? (
        <Sheet
          testID="edit-profile.password-sheet"
          accessibilityLabel="Confirm username change"
          onDismiss={() => setPasswordOpen(false)}
        >
          <AppText variant="h2">Confirm username change</AppText>
          <TextField
            testID="edit-profile.password"
            label="Current password"
            value={password}
            password
            onChangeText={setPassword}
          />
          <AppButton
            testID="edit-profile.password-confirm"
            label="Confirm and save"
            onPress={() => void save(password)}
          />
        </Sheet>
      ) : null}
    </Screen>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  photo: { alignItems: 'center', gap: spacing[8] },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  select: {
    minHeight: 58,
    padding: spacing[12],
    borderRadius: radii.tile,
    gap: spacing[4],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[14],
    borderRadius: radii.pill,
  },
  regionList: { gap: spacing[14] },
});

const useStyles = createThemedStyles(c => ({
  avatar: { backgroundColor: c.navActiveBg },
  select: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1 },
  chip: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1 },
  chipActive: {
    backgroundColor: c.navActiveBg,
    borderColor: c.teal,
    borderWidth: 1,
  },
}));
