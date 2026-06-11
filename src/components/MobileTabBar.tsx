import { useIdeStore, type MobileTab } from '../app/store';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Preview' },
  { id: 'settings', label: 'Settings' },
  { id: 'ai', label: 'AI' },
];

export function MobileTabBar() {
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const setMobileTab = useIdeStore((s) => s.setMobileTab);

  return (
    <div className="tab-bar" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={mobileTab === t.id}
          className={mobileTab === t.id ? 'active' : ''}
          onClick={() => setMobileTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
