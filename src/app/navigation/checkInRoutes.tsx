import { CheckInButton } from '../../features/check-in/components/CheckInButton';
import { ActiveTripScreen } from '../../features/active-trip/screens/ActiveTripScreen';
import { PlaceScreen } from '../../features/places/screens/PlaceScreen';
import { useLocale } from '../../shared/hooks/useLocale';
import type { RootStackScreenProps } from './types';

/** Place with Check in under it (check-in AC4); features never import each other, so it is wired here. */
export function PlaceRoute(props: RootStackScreenProps<'Place'>) {
  return (
    <PlaceScreen
      {...props}
      renderCheckIn={(place, name) => (
        <CheckInButton
          placeId={place.id}
          name={name}
          type={place.type}
          lat={place.latitude}
          lng={place.longitude}
          elevationM={place.elevationM}
          checkInRadiusM={place.checkInRadiusM}
        />
      )}
    />
  );
}

/** The active trip with Check in at its place (check-in AC4); radius and elevation load on tap. */
export function ActiveTripRoute(props: RootStackScreenProps<'ActiveTrip'>) {
  const locale = useLocale();
  return (
    <ActiveTripScreen
      {...props}
      renderCheckIn={({ place }) => (
        <CheckInButton
          placeId={place.id}
          name={(locale === 'ru' ? place.nameRu : locale === 'en' ? place.nameEn : null) ?? place.nameUz}
          type={place.type}
          lat={place.latitude}
          lng={place.longitude}
        />
      )}
    />
  );
}
