import {
  ClipboardList,
  FileClock,
  FilePlus2,
  LayoutDashboard,
  Package2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import Button from './ui/Button';

const titles = {
  dashboard: 'Dashboard',
  'new-bill': 'New Bill (POS)',
  inventory: 'Inventory Management',
  'bill-history': 'Bill History',
  reports: 'Reports',
  settings: 'Settings',
};

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'new-bill', label: 'New Bill', icon: FilePlus2 },
  { key: 'inventory', label: 'Inventory', icon: Package2 },
  { key: 'bill-history', label: 'Bill History', icon: FileClock },
  { key: 'reports', label: 'Reports', icon: ClipboardList },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Header({ page, onQuickAction, onNavigate }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-8 py-5 backdrop-blur">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{titles[page] || 'FirstCare'}</h1>
          <p className="text-sm text-slate-500">Billing, inventory, reports, and settings in one place</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                page === item.key
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100',
              )}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
