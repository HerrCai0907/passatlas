import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import './ViewModeSwitch.css';

export type ViewMode = 'cfg' | 'ir';

interface Props {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  locale?: Locale;
  label?: string;
  /** 有值时禁用 CFG 选项，并把原因同时用作 title */
  cfgDisabledReason?: string;
}

/** IR 展示模块统一的「图 / 文」切换。单基本块默认 IR，多基本块默认 CFG。 */
export default function ViewModeSwitch({
  value,
  onChange,
  locale = defaultLocale,
  label,
  cfgDisabledReason,
}: Props) {
  return (
    <div className="vm" role="group" aria-label={label ?? t(locale, 'viewMode.group')}>
      <button
        type="button"
        aria-pressed={value === 'cfg'}
        onClick={() => onChange('cfg')}
        title={cfgDisabledReason ?? t(locale, 'viewMode.cfgTitle')}
        disabled={Boolean(cfgDisabledReason)}
      >
        CFG
      </button>
      <button
        type="button"
        aria-pressed={value === 'ir'}
        onClick={() => onChange('ir')}
        title={t(locale, 'viewMode.irTitle')}
      >
        IR
      </button>
    </div>
  );
}
