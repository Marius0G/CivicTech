import { IconName } from '../ui/Icon';

export interface DiscoverCard {
  icon: IconName;
  title: string;
  description: string;
  badge: string;
}

export interface DiscoverTopic {
  title: string;
  description: string;
}

export const DISCOVER_CARDS: DiscoverCard[] = [
  {
    icon: 'globe',
    title: 'DiscoverEU travel pass',
    description: 'Free train and bus travel for 18- to 20-year-olds across the EU.',
    badge: 'Travel',
  },
  {
    icon: 'graduation-cap',
    title: 'Erasmus+ scholarships',
    description: 'Apply for grants, mobility and traineeships with EU support.',
    badge: 'Funding',
  },
  {
    icon: 'shield-check',
    title: 'EHIC health cover',
    description: 'Get your European Health Insurance Card before your next trip.',
    badge: 'Health',
  },
  {
    icon: 'robot',
    title: 'EU youth rights',
    description: 'Learn your rights while studying, working or volunteering abroad.',
    badge: 'Rights',
  },
];

export const DISCOVER_TOPICS: DiscoverTopic[] = [
  {
    title: 'Local youth events',
    description: 'Find workshops, meetups and cultural exchange programmes near you.',
  },
  {
    title: 'Volunteering abroad',
    description: 'Browse European Solidarity Corps projects with travel and living support.',
  },
  {
    title: 'Language exchange',
    description: 'Connect with study buddies and practise a new language every week.',
  },
];
