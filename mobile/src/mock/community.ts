import { IconName } from '../ui/Icon';

export interface CommunityGroup {
  icon: IconName;
  title: string;
  subtitle: string;
  members: string;
  status: string;
}

export interface CommunityEvent {
  title: string;
  date: string;
  location: string;
  attendees: string;
  description: string;
}

export const COMMUNITY_GROUPS: CommunityGroup[] = [
  {
    icon: 'user',
    title: 'Erasmus students',
    subtitle: 'Find study partners and local meetups in 8 countries.',
    members: '1.1k members',
    status: 'Open',
  },
  {
    icon: 'chat',
    title: 'Language exchange',
    subtitle: 'Weekly online meetups for French, Spanish and German practice.',
    members: '760 members',
    status: 'Join',
  },
  {
    icon: 'compass',
    title: 'Housing share board',
    subtitle: 'Swap tips and short-term stays with fellow EU travellers.',
    members: '420 members',
    status: 'Hot',
  },
];

export const COMMUNITY_EVENTS: CommunityEvent[] = [
  {
    title: 'Budapest student meetup',
    date: 'Fri 12 Jul · 18:00',
    location: 'Central Library',
    attendees: '24 going',
    description: 'Tips for first-year students and travel discounts across Europe.',
  },
  {
    title: 'Volunteer onboarding',
    date: 'Wed 17 Jul · 17:30',
    location: 'Online',
    attendees: '88 going',
    description: 'Learn how to join the European Solidarity Corps this autumn.',
  },
  {
    title: 'Study abroad Q&A',
    date: 'Tue 23 Jul · 19:00',
    location: 'Madrid Campus',
    attendees: '65 going',
    description: 'Ask alumni about visas, budgets and housing abroad.',
  },
];
