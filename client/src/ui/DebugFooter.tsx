import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gameLogger } from '../debug/GameLogger.js';

export function DebugFooter() {
  const [showMenu, setShowMenu] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const handleDownload = (format: 'text' | 'json') => {
    try {
      gameLogger.downloadLog(format);
      setDownloadStatus(`Downloaded ${gameLogger.getLogCount()} events`);
      setTimeout(() => setDownloadStatus(null), 3000);
    } catch (error) {
      setDownloadStatus('Download failed');
      setTimeout(() => setDownloadStatus(null), 3000);
    }
    setShowMenu(false);
  };

  return (
    <div
      style={{
        padding: '8px 16px',
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 'auto',
      }}
    >
      <span>Greedy Dice Game v1.0</span>

      <div style={{ position: 'relative' }}>
        <AnimatePresence>
          {downloadStatus && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              style={{
                marginRight: 12,
                color: 'rgba(74, 222, 128, 0.8)',
              }}
            >
              {downloadStatus}
            </motion.span>
          )}
        </AnimatePresence>

        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            padding: '4px 12px',
            fontSize: 10,
            fontWeight: 'bold',
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 4,
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Debug Log ({gameLogger.getLogCount()})
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 8,
                background: 'rgba(30, 30, 50, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 8,
                padding: 8,
                minWidth: 180,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: 8,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                {gameLogger.getLogCount()} events logged
              </div>

              <button
                onClick={() => handleDownload('text')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginBottom: 4,
                  fontSize: 12,
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Download as Text
                <span style={{ float: 'right', opacity: 0.7 }}>.txt</span>
              </button>

              <button
                onClick={() => handleDownload('json')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 'bold',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Download as JSON
                <span style={{ float: 'right', opacity: 0.7 }}>.json</span>
              </button>

              <div
                style={{
                  marginTop: 8,
                  padding: '6px 8px',
                  fontSize: 9,
                  color: 'rgba(255, 255, 255, 0.4)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                Include this file when reporting issues
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
