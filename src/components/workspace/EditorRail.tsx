import type { ComponentType, SVGProps } from 'react';

export type EditorTab = 'create' | 'scene' | 'tools';

type IconProps = SVGProps<SVGSVGElement>;

const tabs: Array<{
  id: EditorTab;
  label: string;
  shortcut: string;
  Icon: ComponentType<IconProps>;
}> = [
  { id: 'create', label: 'Create', shortcut: 'C', Icon: CreateIcon },
  { id: 'scene', label: 'Scene', shortcut: 'S', Icon: SceneIcon },
  { id: 'tools', label: 'Tools', shortcut: 'T', Icon: ToolsIcon },
];

export function EditorRail({
  activeTab,
  onChange,
}: {
  activeTab: EditorTab;
  onChange: (tab: EditorTab) => void;
}) {
  return (
    <nav
      aria-label="Editor regions"
      data-testid="editor-rail"
      className="flex w-[52px] shrink-0 flex-col items-center border-r border-border-subtle bg-bg-chrome py-3"
    >
      <div className="mb-5 flex size-7 items-center justify-center text-accent-forge" aria-label="EchoForge mark">
        <svg viewBox="0 0 28 28" className="size-7 fill-none stroke-current" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 7.5h11M4 14h8M4 20.5h11" />
          <path d="M17.5 7.5h6M20.5 14h3M17.5 20.5h6" />
          <path d="M15 4.5 12.5 7.5 15 10.5M15 17.5 12.5 20.5 15 23.5" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        {tabs.map(({ id, label, shortcut, Icon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              type="button"
              data-testid={`rail-${id}`}
              aria-label={label}
              aria-pressed={active}
              title={`${label} (${shortcut})`}
              onClick={() => onChange(id)}
              className={`group relative flex size-9 items-center justify-center border transition-colors ${
                active
                  ? 'border-accent-forge/55 bg-accent-forge/10 text-accent-forge'
                  : 'border-transparent text-text-muted hover:border-border-interactive hover:bg-bg-subtle hover:text-text-primary'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="pointer-events-none absolute left-11 z-30 hidden whitespace-nowrap border border-border-interactive bg-bg-chrome px-2 py-1 text-[10px] text-text-primary shadow-[0_4px_12px_rgba(32,37,34,0.12)] group-hover:block">
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto font-mono text-[9px] text-text-muted" aria-hidden="true">
        EF
      </div>
    </nav>
  );
}

function CreateIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}><path d="M4 7h16M4 12h10M4 17h16" /><path d="M17 10v8M13 14h8" /></svg>;
}

function SceneIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}><path d="M5 5h14v14H5z" /><path d="M8 9h8M8 12h5M8 15h7" /></svg>;
}

function ToolsIcon(props: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}><path d="m14.5 5.5 4 4M5 19l6.5-6.5M13 4a4 4 0 0 0 5 5l-8.5 8.5a2.1 2.1 0 1 1-3-3L15 6a4 4 0 0 0-2-2Z" /><path d="M4 4h4M6 2v4" /></svg>;
}
