'use client';

import { useState, useEffect } from 'react';
import './PlaylistModule.css';

interface Track {
  id: number;
  name: string;
  artists: string;
  album: string;
  cover: string;
  duration: number;
}

interface PlaylistData {
  name: string;
  coverImgUrl: string;
  description: string;
  trackCount: number;
  tracks: Track[];
}

/**
 * 网易云精选歌单模块
 * 展示歌单曲目列表，点击曲目展开网易云外链播放器
 */
export default function PlaylistModule() {
  const [data, setData] = useState<PlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/netease/playlist')
      .then((res) => {
        if (!res.ok) throw new Error('加载失败');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 毫秒 → m:ss
  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading)
    return (
      <div className="pm-root">
        <div className="pm-loading">加载中...</div>
      </div>
    );
  if (error)
    return (
      <div className="pm-root">
        <div className="pm-error">{error}</div>
      </div>
    );
  if (!data) return null;

  return (
    <div className="pm-root">
      {/* 歌单头部 */}
      <div className="pm-header">
        <img className="pm-header-cover" src={data.coverImgUrl} alt="" />
        <div className="pm-header-info">
          <h3 className="pm-header-name">{data.name}</h3>
          <p className="pm-header-count">{data.trackCount} 首</p>
        </div>
      </div>

      {/* 曲目列表 */}
      <div className="pm-list">
        {data.tracks.map((track, index) => (
          <div key={track.id} className="pm-track">
            <div
              className={`pm-track-row${expandedId === track.id ? ' expanded' : ''}`}
              onClick={() => setExpandedId(expandedId === track.id ? null : track.id)}
            >
              <span className="pm-track-num">{(index + 1).toString().padStart(2, '0')}</span>
              <img className="pm-track-cover" src={track.cover} alt="" loading="lazy" />
              <div className="pm-track-info">
                <span className="pm-track-name">{track.name}</span>
                <span className="pm-track-artist">{track.artists}</span>
              </div>
              <span className="pm-track-duration">{formatDuration(track.duration)}</span>
            </div>
            {/* 展开的网易云外链播放器 */}
            {expandedId === track.id && (
              <div className="pm-player">
                <iframe
                  src={`https://music.163.com/outchain/player?type=2&id=${track.id}&auto=0&height=66`}
                  width="100%"
                  height="86"
                  frameBorder="no"
                  allow="autoplay"
                  title={`${track.name} - 网易云播放器`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
