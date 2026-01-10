import { motion } from 'framer-motion';
import { useI18n } from '../i18n/index.js';

interface ActionButtonsProps {
  onBank: () => void;
  onKeepAndBank: () => void;
  onDeclineCarryover: () => void;
  canBank: boolean;
  canKeepAndBank: boolean;
  canDeclineCarryover: boolean;
}

/**
 * ActionButtons - Secondary game actions
 *
 * Features:
 * - Large touch targets (48px minimum)
 * - Clear action labels
 * - Contextual visibility
 * - Accessible button states
 */
export function ActionButtons({
  onBank,
  onKeepAndBank,
  onDeclineCarryover,
  canBank,
  canKeepAndBank,
  canDeclineCarryover,
}: ActionButtonsProps) {
  const { t } = useI18n();

  // Don't render if no buttons to show
  if (!canBank && !canKeepAndBank && !canDeclineCarryover) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="Game actions"
      style={{
        display: 'flex',
        gap: 'var(--space-3)',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}
    >
      {canKeepAndBank && (
        <motion.button
          onClick={onKeepAndBank}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-warning btn-lg"
          style={{
            flex: '1 1 auto',
            maxWidth: 250,
          }}
        >
          {t('bankPoints')}
        </motion.button>
      )}

      {canBank && (
        <motion.button
          onClick={onBank}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-warning btn-lg"
          style={{
            flex: '1 1 auto',
            maxWidth: 250,
          }}
        >
          {t('bank')}
        </motion.button>
      )}

      {canDeclineCarryover && (
        <motion.button
          onClick={onDeclineCarryover}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-ghost btn-lg"
          style={{
            flex: '1 1 auto',
            maxWidth: 200,
          }}
        >
          {t('declineStartFresh')}
        </motion.button>
      )}
    </div>
  );
}
