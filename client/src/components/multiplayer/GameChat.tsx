/**
 * GameChat Component
 * In-game chat panel for multiplayer games
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../../types/index.js';

interface GameChatProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (message: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function GameChat({
  messages,
  currentUserId,
  onSendMessage,
  isCollapsed = false,
  onToggleCollapse,
}: GameChatProps) {
  const [input, setInput] = useState('');
  const [hasUnread, setHasUnread] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatRef.current && !isCollapsed) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }

    // Track unread messages when collapsed
    if (isCollapsed && messages.length > prevMessageCountRef.current) {
      setHasUnread(true);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, isCollapsed]);

  // Clear unread when expanded
  useEffect(() => {
    if (!isCollapsed) {
      setHasUnread(false);
    }
  }, [isCollapsed]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      onSendMessage(input.trim());
      setInput('');
      inputRef.current?.focus();
    },
    [input, onSendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  // Format timestamp
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        style={{
          position: 'relative',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <span>Chat</span>
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              width: '12px',
              height: '12px',
              backgroundColor: 'var(--color-primary)',
              borderRadius: 'var(--radius-full)',
            }}
          />
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        height: '300px',
        maxHeight: '40vh',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>Chat</span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="btn btn-ghost btn-sm"
            style={{ padding: 'var(--space-1)' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={chatRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              padding: 'var(--space-4)',
            }}
          >
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems:
                  msg.playerId === currentUserId ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.type === 'system' ? (
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    width: '100%',
                    padding: 'var(--space-1) 0',
                  }}
                >
                  {msg.message}
                </div>
              ) : (
                <>
                  {/* Sender name (only for others) */}
                  {msg.playerId !== currentUserId && (
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-1)',
                        marginLeft: 'var(--space-2)',
                      }}
                    >
                      {msg.playerName}
                    </span>
                  )}

                  {/* Message bubble */}
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor:
                        msg.playerId === currentUserId
                          ? 'var(--color-primary)'
                          : 'var(--color-surface)',
                      color:
                        msg.playerId === currentUserId
                          ? 'white'
                          : 'var(--color-text)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.message}
                  </div>

                  {/* Timestamp */}
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-secondary)',
                      marginTop: 'var(--space-1)',
                      marginLeft:
                        msg.playerId === currentUserId ? '0' : 'var(--space-2)',
                      marginRight:
                        msg.playerId === currentUserId ? 'var(--space-2)' : '0',
                    }}
                  >
                    {formatTime(msg.timestamp)}
                  </span>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          padding: 'var(--space-2)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={200}
          style={{
            flex: 1,
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-sm)',
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={!input.trim()}
          style={{ padding: 'var(--space-2)' }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
