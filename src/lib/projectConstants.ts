import {
  FolderKanban, Briefcase, Rocket, Target, Star, Heart, Code, Book, Music, Camera,
  Palette, Gamepad2, GraduationCap, Plane, ShoppingBag, Home, type LucideIcon
} from 'lucide-react'

// Project color palette
export const PROJECT_COLORS: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
}

// Project icon map
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  folder: FolderKanban,
  briefcase: Briefcase,
  rocket: Rocket,
  target: Target,
  star: Star,
  heart: Heart,
  code: Code,
  book: Book,
  music: Music,
  camera: Camera,
  palette: Palette,
  gamepad: Gamepad2,
  'graduation-cap': GraduationCap,
  home: Home,
  plane: Plane,
  'shopping-bag': ShoppingBag,
}
