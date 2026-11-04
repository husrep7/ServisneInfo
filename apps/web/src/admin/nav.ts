import type { IconName } from '../components/Icon';

// Stavke sidebara; svaka ima svoju rutu ispod /admin ('' je početna)
export const ADMIN_NAV: { path: string; label: string; icon: IconName }[] = [
  { path: '',          label: 'Dashboard', icon: 'grid'    },
  { path: 'prekidi',   label: 'Prekidi',   icon: 'alert'   },
  { path: 'prijave',   label: 'Prijave',   icon: 'file'    },
  { path: 'blokirani', label: 'Blokirani', icon: 'ban'     },
  { path: 'izvori',    label: 'Izvori',    icon: 'refresh' },
  { path: 'profil',    label: 'Profil',    icon: 'user'    },
];
