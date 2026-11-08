import { useEffect, useMemo, useState } from 'react';
import CFGViewer from './CFGViewer';
import type { LocalizedCFGSample } from '../data/cfg-samples';
import { defaultLocale, type Locale } from '../i18n/config';
import { t } from '../i18n/ui';
import { parseIR } from '../lib/ir/parse';
import './CFGLab.css';

interface Props {
  samples: LocalizedCFGSample[];
  locale?: Locale;
}

export default function CFGLab({ samples, locale = defaultLocale }: Props) {
  const [text, setText] = useState(samples[0]?.ir ?? '');
  const [debounced, setDebounced] = useState(text);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(text), 220);
    return () => window.clearTimeout(timer);
  }, [text]);

  // 支持 /ir/?sample=loop 这样的直达链接，方便在文档里引用某个示例
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('sample');
    if (!id) return;
    const sample = samples.find((item) => item.id === id);
    if (!sample) return;
    setText(sample.ir);
    setDebounced(sample.ir);
  }, [samples]);

  const parsed = useMemo(() => parseIR(debounced, locale), [debounced, locale]);

  const stats = useMemo(() => {
    const blocks = parsed.functions.reduce((sum, fn) => sum + fn.blocks.length, 0);
    const edges = parsed.functions.reduce((sum, fn) => sum + fn.edges.length, 0);
    return { functions: parsed.functions.length, blocks, edges };
  }, [parsed]);

  // 用文本反推当前示例：用户一改 IR 就不再高亮任何示例，永远不会和 textarea 不一致
  const activeSample = samples.find((sample) => sample.ir === text);
  const lines = text.split('\n').length;

  const loadSample = (sample: LocalizedCFGSample) => {
    setText(sample.ir);
    setDebounced(sample.ir);
  };

  return (
    <div className="lab">
      <div className="lab__toolbar">
        <span className="lab__label">{t(locale, 'lab.samples')}</span>
        <div className="lab__samples">
          {samples.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="lab__sample"
              aria-pressed={activeSample?.id === sample.id}
              onClick={() => loadSample(sample)}
            >
              {sample.label}
            </button>
          ))}
        </div>
        <span className="lab__stats">
          {t(locale, 'lab.stats', {
            functions: stats.functions,
            blocks: stats.blocks,
            edges: stats.edges,
          })}
        </span>
      </div>

      <div className="lab__grid">
        <section className="lab__editor" aria-labelledby="lab-editor-title">
          <header className="lab__editor-head">
            <h2 id="lab-editor-title">{t(locale, 'lab.editorTitle')}</h2>
            <span className="lab__lines">{t(locale, 'lab.lines', { count: lines })}</span>
          </header>
          <textarea
            className="lab__textarea"
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            aria-label={t(locale, 'lab.irLabel')}
          />
          <p className="lab__note">
            {activeSample ? activeSample.description : t(locale, 'lab.custom')}
            <span>{t(locale, 'lab.local')}</span>
          </p>
        </section>

        <div className="lab__viewer">
          <CFGViewer
            ir={debounced}
            locale={locale}
            title={t(locale, 'lab.viewerTitle')}
            height={640}
          />
        </div>
      </div>
    </div>
  );
}
