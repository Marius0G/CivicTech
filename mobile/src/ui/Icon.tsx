// Icon — thin wrapper over phosphor-react-native (the design's icon set).
// Use semantic names matching the design handoff's Lucide→Phosphor map so screens read clearly.
// Phosphor is SVG-based (react-native-svg) → a native rebuild is required after adding it.

import React from 'react';
import {
  ScanSmiley, Envelope, Lock, Eye, EyeSlash, ShieldCheck, Shield, Fingerprint, QrCode, Bell,
  ArrowRight, ArrowLeft, ArrowUp, GraduationCap, Folder, Plus, Microphone, Phone, MagnifyingGlass,
  CloudArrowUp, SealCheck, FileText, House, DotsThreeVertical, PencilSimple, Globe, Robot, Database,
  Question, SignOut, CaretRight, CaretDown, ChatCircle, Compass, User, Check, MapPin, Paperclip,
  Camera, X, IconWeight,
} from 'phosphor-react-native';
import { colors } from '../theme';

const MAP = {
  'scan-face': ScanSmiley,
  mail: Envelope,
  lock: Lock,
  eye: Eye,
  'eye-off': EyeSlash,
  'shield-check': ShieldCheck,
  shield: Shield,
  fingerprint: Fingerprint,
  'qr-code': QrCode,
  bell: Bell,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'graduation-cap': GraduationCap,
  folder: Folder,
  plus: Plus,
  mic: Microphone,
  phone: Phone,
  search: MagnifyingGlass,
  'cloud-upload': CloudArrowUp,
  'seal-check': SealCheck,
  'file-text': FileText,
  house: House,
  kebab: DotsThreeVertical,
  pencil: PencilSimple,
  globe: Globe,
  robot: Robot,
  database: Database,
  help: Question,
  'log-out': SignOut,
  'chevron-right': CaretRight,
  'caret-down': CaretDown,
  chat: ChatCircle,
  compass: Compass,
  user: User,
  check: Check,
  'map-pin': MapPin,
  paperclip: Paperclip,
  camera: Camera,
  close: X,
} as const;

export type IconName = keyof typeof MAP;

export default function Icon({
  name, size = 22, color = colors.textPrimary, weight = 'bold',
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
}) {
  const Cmp = MAP[name];
  return <Cmp size={size} color={color} weight={weight} />;
}
