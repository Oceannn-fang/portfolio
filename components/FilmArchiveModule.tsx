'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { filmRolls, type FilmFrame, type FilmRoll } from '../lib/film-rolls';
import './FilmArchiveModule.css';

type FilmArchiveModuleProps = { mode: 'preview' | 'archive' | 'roll'; roll?: FilmRoll };

const formatDate = (date: string) => new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(`${date}T00:00:00`)).toUpperCase();

/**
 * 胶片带网格的可选列数。
 * 参照 Filmer（胶片摄影数据库 App）胶卷详情页的索引图：照片嵌在带齿孔的胶片带里逐行排布，
 * 并可缩小到 4 列 / 5 列查看更多——这里把它做成 3-6 列的列数切换。
 */
const STRIP_COLUMNS = [3, 4, 5, 6] as const;
const DEFAULT_STRIP_COLUMNS = 4;
/** 列数偏好的本地存储键：看过一次就记住，和 App 的列数设置同理 */
const STRIP_COLUMNS_KEY = 'far-strip-columns';

function FrameStrip({ frames, limit, scrollable = false }: { frames: FilmFrame[]; limit?: number; scrollable?: boolean }) {
  const visibleFrames = limit ? frames.slice(0, limit) : frames;
  return (
    <div
      className={`far-frame-strip${scrollable ? ' is-scrollable' : ''}`}
      tabIndex={scrollable ? 0 : undefined}
      aria-label={scrollable ? `${frames.length} frames, scroll horizontally` : undefined}
    >
      {visibleFrames.map((frame) => (
        <div className="far-frame" key={frame.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frame.thumb} alt={frame.title} loading="lazy" />
          <span>{String(frame.index).padStart(2, '0')}</span>
        </div>
      ))}
      {limit && frames.length > limit ? <span className="far-frame-more">+{frames.length - limit}</span> : null}
    </div>
  );
}

function RollSummary({ roll, mode }: { roll: FilmRoll; mode: 'preview' | 'archive' }) {
  const preview = mode === 'preview';
  const rollMeta = [roll.film, roll.location].filter(Boolean).join(' · ');
  const technicalMeta = [roll.camera, `${roll.frames.length} FRAMES`].filter(Boolean).join(' · ');

  return (
    <article className={`far-roll-summary${preview ? ' is-preview' : ''}`}>
      <div className="far-roll-meta">
        <span className="far-roll-number">ROLL {String(roll.rollNumber).padStart(3, '0')}</span>
        <time dateTime={roll.shotDate}>{formatDate(roll.shotDate)}</time>
        <h3>{roll.title}</h3>
        {rollMeta ? <p>{rollMeta}</p> : null}
        <small>{technicalMeta}</small>
      </div>
      <FrameStrip frames={roll.frames} limit={preview ? 3 : undefined} scrollable={!preview} />
      {preview ? <span className="far-roll-link">OPEN ROLL <span>↗</span></span> : null}
    </article>
  );
}

function FrameGrid({ roll }: { roll: FilmRoll }) {
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
  /** 每行胶片带放几张（列数） */
  const [columns, setColumns] = useState<number>(DEFAULT_STRIP_COLUMNS);
  const activeFrame = activeFrameIndex === null ? null : roll.frames[activeFrameIndex];
  const lightboxOpen = activeFrameIndex !== null;
  const moveFrame = (delta: number) => {
    setActiveFrameIndex((current) => {
      if (current === null || roll.frames.length === 0) return current;
      return (current + delta + roll.frames.length) % roll.frames.length;
    });
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveFrameIndex(null);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveFrame(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveFrame(1);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxOpen, roll.frames.length]);

  useEffect(() => {
    if (activeFrameIndex === null || roll.frames.length < 2) return;
    for (const delta of [-1, 1]) {
      const frame = roll.frames[(activeFrameIndex + delta + roll.frames.length) % roll.frames.length];
      const image = new window.Image();
      image.src = frame.src;
    }
  }, [activeFrameIndex, roll.frames.length]);

  // 恢复上次选定的列数（SSR 首帧用默认值，客户端挂载后校正，故不会出现 hydration 不匹配）
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(STRIP_COLUMNS_KEY));
    if ((STRIP_COLUMNS as readonly number[]).includes(saved)) setColumns(saved);
  }, []);

  const chooseColumns = (next: number) => {
    setColumns(next);
    window.localStorage.setItem(STRIP_COLUMNS_KEY, String(next));
  };

  // 按列数把整卷切成一卷卷胶片带：每带一行，行内照片等宽等高（胶片带要求行高一致）
  const strips = useMemo(() => {
    const rows: { frame: FilmFrame; index: number }[][] = [];
    for (let start = 0; start < roll.frames.length; start += columns) {
      rows.push(roll.frames.slice(start, start + columns).map((frame, offset) => ({ frame, index: start + offset })));
    }
    return rows;
  }, [roll.frames, columns]);

  return (
    <>
      <div className="far-strip-head">
        <span className="far-strip-brand">ROLL INDEX · {roll.frames.length} FRAMES</span>
        <div className="far-strip-density" role="group" aria-label="Grid columns per strip">
          {STRIP_COLUMNS.map((count) => (
            <button
              key={count}
              type="button"
              className={count === columns ? 'is-active' : undefined}
              aria-pressed={count === columns}
              aria-label={`${count} columns`}
              onClick={() => chooseColumns(count)}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
      <div className="far-strips">
        {strips.map((row, stripIndex) => (
          <div className="far-strip" key={`strip-${stripIndex}`}>
            <div className="far-strip-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {row.map(({ frame, index }) => (
                <button
                  className="far-strip-frame"
                  key={frame.id}
                  onClick={() => setActiveFrameIndex(index)}
                  type="button"
                  aria-label={`Open frame ${frame.index}: ${frame.title}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.thumb} alt={frame.title} loading="lazy" />
                  <span>{String(frame.index).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {activeFrame ? (
        <div className="far-lightbox" role="dialog" aria-modal="true" aria-label={activeFrame.title} onClick={() => setActiveFrameIndex(null)}>
          <button className="far-lightbox-close" type="button" onClick={() => setActiveFrameIndex(null)} aria-label="Close photo" autoFocus>×</button>
          <button
            className="far-lightbox-nav is-prev"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveFrame(-1);
            }}
            aria-label="Previous frame"
          >
            ←
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activeFrame.src} alt={activeFrame.title} onClick={(event) => event.stopPropagation()} />
          <button
            className="far-lightbox-nav is-next"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              moveFrame(1);
            }}
            aria-label="Next frame"
          >
            →
          </button>
          <span aria-live="polite">{String(activeFrame.index).padStart(2, '0')} / {String(roll.frames.length).padStart(2, '0')} · {activeFrame.title}</span>
        </div>
      ) : null}
    </>
  );
}

export default function FilmArchiveModule({ mode, roll }: FilmArchiveModuleProps) {
  if (mode === 'roll' && roll) {
    const rollMeta = [
      roll.format,
      roll.iso ? `ISO ${roll.iso}` : null,
      roll.type === 'bw' ? 'B&W' : 'COLOR',
    ].filter(Boolean).join(' · ');

    return (
      <main className="far-page far-roll-page">
        <div className="far-page-head">
          <nav className="far-page-nav" aria-label="Film archive navigation">
            <Link className="far-back" href="/">← INDEX</Link>
            <Link className="far-back" href="/film">ALL ROLLS</Link>
          </nav>
          <span>ROLL {String(roll.rollNumber).padStart(3, '0')}</span>
        </div>
        <section className="far-roll-hero">
          <div>
            <p className="far-kicker">{rollMeta}</p>
            <h1>{roll.title}</h1>
            {roll.note ? <p className="far-description">{roll.note}</p> : null}
          </div>
          <dl>
            <div><dt>SHOT</dt><dd>{formatDate(roll.shotDate)}</dd></div>
            {roll.film ? <div><dt>FILM</dt><dd>{roll.film}</dd></div> : null}
            {roll.camera ? <div><dt>CAMERA</dt><dd>{roll.camera}</dd></div> : null}
            {roll.location ? <div><dt>LOCATION</dt><dd>{roll.location}</dd></div> : null}
            <div><dt>FRAMES</dt><dd>{roll.frames.length}</dd></div>
          </dl>
        </section>
        <FrameGrid roll={roll} />
      </main>
    );
  }

  const visibleRolls = mode === 'preview' ? filmRolls.slice(0, 3) : filmRolls;
  return (
    <main className={`far-page${mode === 'preview' ? ' far-preview' : ''}`}>
      {mode === 'archive' ? (
        <header className="far-page-head far-archive-head"><div><Link className="far-back far-index-link" href="/">← INDEX</Link><p className="far-kicker">PERSONAL DARKROOM RECORD</p><h1>Film Archive</h1></div><div className="far-archive-count"><strong>{filmRolls.length}</strong><span>ROLLS<br />{filmRolls.reduce((sum, item) => sum + item.frames.length, 0)} FRAMES</span></div></header>
      ) : <header className="far-preview-head"><span>FILM ARCHIVE / ROLLS</span><span>{filmRolls.length} ROLLS</span></header>}
      <div className="far-roll-list">{visibleRolls.map((item) => <Link className="far-roll-entry" href={`/film/${item.id}`} key={item.id}><RollSummary roll={item} mode={mode === 'preview' ? 'preview' : 'archive'} /></Link>)}</div>
      {mode === 'preview' ? <Link className="far-view-all" href="/film">VIEW ALL ROLLS <span>→</span></Link> : null}
    </main>
  );
}





