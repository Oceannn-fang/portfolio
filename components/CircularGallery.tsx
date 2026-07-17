"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { allAlbums } from "@/lib/data";
import "./CircularGallery.css";

export default function CircularGallery() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandingAlbum, setExpandingAlbum] = useState<typeof allAlbums[0] | null>(null);
  const [showTracklist, setShowTracklist] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<typeof allAlbums[0] | null>(null);

  const handleAlbumClick = (album: typeof allAlbums[0], idx: number) => {
    if (selectedAlbum === album) {
      setSelectedAlbum(null);
      return;
    }
    setSelectedAlbum(album);
    setExpandedIdx(idx);
  };

  return (
    <section id="listening-tracklist" className="track-section">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="track-heading"
      >
        RECENT LISTENS
      </motion.h2>

      {/* Horizontal scrollable album row */}
      <div className="track-album-row" ref={scrollRef}>
        <div className="track-album-track">
          {allAlbums.map((album, i) => (
            <motion.button
              key={i}
              className={"track-album-chip" + (selectedAlbum === album ? " active" : "")}
              onClick={() => handleAlbumClick(album, i)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              layout
            >
              <div className="track-chip-img">
                <img src={album.src} alt={album.name} draggable={false} />
              </div>
              <span className="track-chip-name">{album.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Expanded tracklist */}
      <AnimatePresence mode="wait">
        {selectedAlbum && (
          <motion.div
            key={selectedAlbum.name}
            className="track-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="track-expanded-inner">
              <div className="track-expanded-art">
                <img src={selectedAlbum.src} alt={selectedAlbum.name} />
              </div>
              <div className="track-expanded-info">
                <h3 className="track-expanded-name">{selectedAlbum.name}</h3>
                <p className="track-expanded-artist">{selectedAlbum.artist}</p>
                <ol className="track-list">
                  {(selectedAlbum as any).tracks?.map((track: string, ti: number) => (
                    <li key={ti} className="track-item">
                      <span className="track-num">{String(ti + 1).padStart(2, "0")}</span>
                      <span className="track-title">{track}</span>
                    </li>
                  ))}
                </ol>
                {(selectedAlbum as any).spotifyUrl ? (
                  <a
                    href={(selectedAlbum as any).spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="track-spotify-btn"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Listen on Spotify
                  </a>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}