import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.js';
import { ENTRY_THRESHOLD, TARGET_SCORE } from '../engine/constants.js';

interface HelpPanelProps {
  onClose: () => void;
}

/**
 * HelpPanel - Modal overlay with game rules and scoring guide
 *
 * Designed for Maya (8 years old) but useful for all players:
 * - Large, readable text
 * - Visual examples where possible
 * - Organized by topic
 * - Easy to dismiss
 */
export function HelpPanel({ onClose }: HelpPanelProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus management for accessibility
  useEffect(() => {
    const panel = panelRef.current;
    if (panel) {
      panel.focus();
    }

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <motion.div
        ref={panelRef}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          background: 'var(--color-background)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid var(--color-border-strong)',
          maxWidth: 600,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            position: 'sticky',
            top: 0,
            background: 'var(--color-background)',
            zIndex: 1,
          }}
        >
          <h2
            id="help-title"
            style={{
              margin: 0,
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
            }}
          >
            {t('howToPlay')}
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            aria-label={t('close')}
            style={{
              fontSize: 'var(--font-size-xl)',
              minWidth: 44,
              minHeight: 44,
              padding: 0,
            }}
          >
            ×
          </button>
        </header>

        {/* Content */}
        <div
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-5)',
          }}
        >
          {/* Goal */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpGoal')}</h3>
            <p style={paragraphStyle}>
              {t('helpGoalText', { target: TARGET_SCORE.toLocaleString() })}
            </p>
          </section>

          {/* Basic Rules */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpHowToPlay')}</h3>
            <ol style={{ ...paragraphStyle, paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <li><strong>{t('helpStep1')}</strong></li>
              <li><strong>{t('helpStep2')}</strong></li>
              <li><strong>{t('helpStep3')}</strong></li>
              <li><strong>{t('helpStep4')}</strong></li>
            </ol>
          </section>

          {/* Getting On Board */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpGettingOnBoard')}</h3>
            <p style={paragraphStyle}>
              {t('helpGettingOnBoardText', { threshold: ENTRY_THRESHOLD })}
            </p>
          </section>

          {/* Scoring */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpScoring')}</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 'var(--space-2)',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4)',
              }}
            >
              <ScoreRow label={t('helpSingle1')} points={100} />
              <ScoreRow label={t('helpSingle5')} points={50} />
              <ScoreRow label={t('helpThree1s')} points={1000} highlight />
              <ScoreRow label={t('helpThree2s')} points={200} />
              <ScoreRow label={t('helpThree3s')} points={300} />
              <ScoreRow label={t('helpThree4s')} points={400} />
              <ScoreRow label={t('helpThree5s')} points={500} />
              <ScoreRow label={t('helpThree6s')} points={600} />
              <ScoreRow label={t('helpFourOfKind')} points={t('helpDoubleTriple')} />
              <ScoreRow label={t('helpFiveOfKind')} points={t('helpQuadrupleTriple')} />
              <ScoreRow label={t('helpSmallStraight')} points={750} />
              <ScoreRow label={t('helpLargeStraight')} points={1500} highlight />
            </div>
          </section>

          {/* Hot Dice */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpHotDice')}</h3>
            <p style={paragraphStyle}>
              {t('helpHotDiceText')}
            </p>
          </section>

          {/* Lucky Break (Carryover) */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpLuckyBreak')}</h3>
            <p style={paragraphStyle}>
              {t('helpLuckyBreakText')}
            </p>
          </section>

          {/* Tips */}
          <section>
            <h3 style={sectionTitleStyle}>{t('helpTips')}</h3>
            <ul style={{ ...paragraphStyle, paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <li>{t('helpTip1')}</li>
              <li>{t('helpTip2')}</li>
              <li>{t('helpTip3', { threshold: ENTRY_THRESHOLD })}</li>
              <li>{t('helpTip4')}</li>
              <li>{t('helpTip5')}</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-primary btn-lg"
            style={{ minWidth: 200 }}
          >
            {t('gotIt')}
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 var(--space-2) 0',
  fontSize: 'var(--font-size-lg)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-primary)',
};

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-base)',
  lineHeight: 'var(--line-height-relaxed)',
  color: 'var(--color-text-secondary)',
};

function ScoreRow({ label, points, highlight }: { label: string; points: number | string; highlight?: boolean }) {
  return (
    <>
      <span
        style={{
          fontSize: 'var(--font-size-base)',
          color: highlight ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          fontWeight: highlight ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-bold)',
          color: highlight ? 'var(--color-primary)' : 'var(--color-text-primary)',
          textAlign: 'right',
        }}
      >
        {typeof points === 'number' ? points.toLocaleString() : points}
      </span>
    </>
  );
}
