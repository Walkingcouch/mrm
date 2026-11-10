// Visual tokens sampled from the current McArthur River Mine app (owner's
// screenshots, 10 Nov 2026). Brand assets (logo) still come from the owner.
import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export const colors = {
  background: '#FFFFFF',
  header: '#EEEEEE',        // light grey top bar
  headerBorder: '#D5D5D5',
  headerText: '#333333',    // title + hamburger
  teal: '#00AFAA',          // footer band on Home, icons
  tealText: '#16A09B',      // menu labels, Back button (sampled #1BA39F, nudged for legibility)
  tealSoft: '#E3F4F3',
  drawer: '#F1F1F1',
  row: '#F1F1F1',           // list rows
  rowDivider: '#E6E6E6',
  text: '#333333',
  muted: '#797979',
  danger: '#B42318',
  surface: '#F1F1F1',
  // kept for components that referenced the earlier names
  accent: '#16A09B',
  divider: '#E6E6E6',
};

export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
};

export const appTitle = 'McArthur River Mining';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Outline icons in the spirit of the current app (open-licence icon set, not
// the builder's artwork).
export const sectionIcons: Record<string, IconName> = {
  home: 'home-outline',
  flight: 'airplane',
  timetables: 'calendar-clock-outline',
  weather: 'weather-partly-cloudy',
  messages: 'email-outline',
  village: 'home-city-outline',
  wellbeing: 'heart-pulse',
  hr: 'account-group-outline',
  memorandum: 'newspaper-variant-outline',
  report: 'tools',
  call: 'cellphone',
  find: 'map-search-outline',
  settings: 'cog',
};
