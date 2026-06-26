'use client';
import { Command } from 'cmdk';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIONS = [
  { id: 'dashboard',   label: 'Go to Dashboard',       shortcut: 'G D', href: '/dashboard' },
  { id: 'create',      label: 'Create New Stream',      shortcut: 'G C', href: '/stream/create' },
  { id: 'streams',     label: 'View All Streams',       shortcut: '',    href: '/streams' },
  { id: 'disconnect',  label: 'Disconnect Wallet',      shortcut: '',    href: '#disconnect' },
  { id: 'help',        label: 'Keyboard Shortcut Help', shortcut: 'Ctrl+/', href: '#help' },
];

export function CommandPalette() {
  const [open, setOpen]     = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't fire when user is typing in a form input
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setOpen(o => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault(); setShowHelp(o => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault(); router.push('/stream/create');
      }
      if (e.key === 'Escape') {
        setOpen(false); setShowHelp(false);
      }
    };

    // G-then-key chords
    let gPressed = false;
    const chord = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
      if (e.key === 'g') { gPressed = true; setTimeout(() => { gPressed = false; }, 1000); return; }
      if (gPressed) {
        if (e.key === 'd') router.push('/dashboard');
        if (e.key === 'c') router.push('/stream/create');
        gPressed = false;
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keydown', chord);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keydown', chord);
    };
  }, [router]);

  return (
    <>
      {/* Command Palette */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24"
             onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()}
               className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <Command>
              <Command.Input placeholder="Type a command or search..."
                             className="w-full px-4 py-3 text-sm outline-none border-b" />
              <Command.List className="max-h-72 overflow-y-auto p-2">
                <Command.Empty className="p-4 text-sm text-gray-400">
                  No results found.
                </Command.Empty>
                {ACTIONS.map(action => (
                  <Command.Item key={action.id}
                    onSelect={() => { router.push(action.href); setOpen(false); }}
                    className="flex justify-between items-center px-3 py-2 rounded
                               cursor-pointer hover:bg-gray-100 text-sm">
                    {action.label}
                    {action.shortcut && (
                      <kbd className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                        {action.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </div>
        </div>
      )}

      {/* Shortcut Help Overlay */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
             onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full"
               onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-4">Keyboard Shortcuts</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {[
                  ['Cmd/Ctrl + K', 'Open command palette'],
                  ['Cmd/Ctrl + N', 'Create new stream'],
                  ['Cmd/Ctrl + /', 'Toggle this help'],
                  ['G then D',     'Go to dashboard'],
                  ['G then C',     'Go to create stream'],
                  ['Esc',          'Close dialogs'],
                ].map(([key, desc]) => (
                  <tr key={key}>
                    <td className="py-2 pr-4">
                      <kbd className="bg-gray-100 px-2 py-0.5 rounded text-xs">{key}</kbd>
                    </td>
                    <td className="py-2 text-gray-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}