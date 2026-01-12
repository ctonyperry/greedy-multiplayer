# Screenshot Capture for UX Analysis

Automated Playwright script to capture screenshots of all user flows in the Greedy dice game.

## Setup

```bash
cd screenshots
npm install
npx playwright install chromium
```

## Usage

```bash
# Capture from production (getgreedy.io)
npm run capture

# Capture from local dev server
npm run capture:local

# Capture from custom URL
BASE_URL=https://your-url.com npm run capture
```

## Output

Screenshots are saved to `./output/` with separate directories for each viewport:

```
output/
├── desktop/           # 1440x900 viewport
│   ├── 01-auth-screen.png
│   ├── 02-guest-name-input.png
│   ├── 03-guest-name-filled.png
│   ├── 04-home-screen.png
│   ├── 05-create-game-settings.png
│   ├── 06-game-lobby-empty.png
│   ├── 07-add-ai-form.png
│   ├── 08-lobby-with-ai.png
│   ├── 09-game-initial.png
│   ├── 10-after-roll.png
│   ├── 11-die-selected.png
│   ├── 12-bank-option.png
│   ├── 13-second-roll.png
│   ├── 14-ai-turn.png
│   ├── 15-help-panel.png
│   └── 16-join-game.png
└── mobile/            # 390x844 viewport (iPhone 14 Pro)
    └── (same files)
```

## Captured Flows

1. **Auth Screen** - Initial landing/sign-in page
2. **Guest Login** - Name input and submission
3. **Home Screen** - Main menu after authentication
4. **Create Game** - Game settings configuration
5. **Game Lobby** - Waiting room with player list
6. **Add AI Player** - AI opponent configuration
7. **Gameplay** - Various game states (rolling, selecting, banking)
8. **Help Panel** - Rules and instructions overlay
9. **Join Game** - Game code entry screen

## Customization

Edit `capture-flows.js` to:
- Add new screens to capture
- Change viewport sizes
- Adjust timing for animations
- Add new user flows

## Troubleshooting

**Browser not found:**
```bash
npx playwright install chromium
```

**SSL certificate errors:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run capture
```

**Screenshots missing elements:**
- Increase `waitForTimeout` values in the script
- Check if selectors have changed in the app
