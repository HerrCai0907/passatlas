import './ViewModeSwitch.css';

export type ViewMode = 'cfg' | 'ir';

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  label?: string;
}

/** IR 展示模块统一的「图 / 文」切换。默认选 CFG。 */
export default function ViewModeSwitch({
  value,
  onChange,
  label = '展示模式',
}: Props) {
  return (
    <div className="vm" role="group" aria-label={label}>
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
