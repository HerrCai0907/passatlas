import './ViewModeSwitch.css';

export type ViewMode = 'cfg' | 'ir';

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** 深色控制台里用 dark，纸色背景里用 light */
  tone?: 'light' | 'dark';
  label?: string;
}

/** IR 展示模块统一的「图 / 文」切换。默认选 CFG。 */
export default function ViewModeSwitch({
  value,
  onChange,
  tone = 'light',
  label = '展示模式',
}: Props) {
  return (
    <div className={`vm${tone === 'dark' ? ' vm--dark' : ''}`} role="group" aria-label={label}>
      <button
        type="button"
        aria-pressed={value === 'cfg'}
        onClick={() => onChange('cfg')}
        title="按基本块显示为有向图"
      >
        CFG
      </button>
      <button
        type="button"
        aria-pressed={value === 'ir'}
        onClick={() => onChange('ir')}
        title="显示原始 IR 文本"
      >
        IR
      </button>
    </div>
  );
}
