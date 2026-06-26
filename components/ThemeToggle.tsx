'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const ICONS = { light: '☀️', dark: '🌙', system: '💻' };
const MODES = ['light', 'dark', 'system'] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-9 h-9" />;

  const cycle = () => {
    const idx  = MODES.indexOf((theme as typeof MODES[number]) ?? 'system');
    const next = MODES[(idx + 1) % MODES.length];
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      aria-label={`Current theme: ${theme}. Click to switch.`}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800
                 min-h-[44px] min-w-[44px] flex items-center justify-center
                 transition-colors"
    >
      <span>{ICONS[(theme as keyof typeof ICONS) ?? 'system']}</span>
    </button>
  );
}