# Greedy - Real-Time Multiplayer Dice Game

A full-stack multiplayer implementation of the classic "Greedy" (also known as "Farkle" or "10,000") dice game with real-time gameplay, AI opponents, and a modern React UI.

**Live Demo:** [getgreedy.io](https://getgreedy.io)

## Features

- **Real-time Multiplayer** - Play with friends using shareable game codes
- **AI Opponents** - Three difficulty levels with distinct play styles
- **Live Game State** - WebSocket-powered instant updates across all players
- **Responsive Design** - Optimized for desktop and mobile play
- **In-Game Chat** - Real-time chat with other players
- **Customizable Rules** - Adjustable target score, entry threshold, and turn timers

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and optimized builds
- **Framer Motion** for smooth animations
- **Socket.IO Client** for real-time communication
- **CSS Custom Properties** design system

### Backend
- **Node.js** with Express and TypeScript
- **Socket.IO** for WebSocket communication
- **Azure Cosmos DB** for game state persistence
- **Firebase Authentication** for user management

### Infrastructure
- **Azure Static Web Apps** for frontend hosting
- **Azure App Service** for backend API
- **GitHub Actions** for CI/CD pipelines

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
│  React + TypeScript + Vite                                       │
│  - Game UI with dice animations                                  │
│  - Real-time state synchronization                               │
│  - Responsive mobile-first design                                │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket + REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER                                   │
│  Node.js + Express + Socket.IO                                   │
│  - Game logic and validation                                     │
│  - Turn management and scoring                                   │
│  - AI opponent decision engine                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│  Azure Cosmos DB                                                 │
│  - Game state persistence                                        │
│  - Player sessions                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Game Rules

Greedy is a push-your-luck dice game where players try to reach a target score (default: 10,000 points).

**Scoring:**
- Single 1 = 100 points
- Single 5 = 50 points
- Three of a kind = Face value × 100 (three 1s = 1,000)
- Four of a kind = Three of a kind × 2
- Five of a kind = Four of a kind × 2
- Straight (1-2-3-4-5 or 2-3-4-5-6) = 1,500 points

**Gameplay:**
1. Roll 5 dice
2. Set aside at least one scoring die
3. Choose to bank your points or roll remaining dice
4. If you can't set aside any scoring dice, you "bust" and lose all points for that turn
5. First player to reach the target score triggers the final round

## Local Development

### Prerequisites
- Node.js 20+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/greedy-multiplayer.git
cd greedy-multiplayer

# Install dependencies
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Start development servers (client + server)
npm run dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:3001`.

### Environment Variables

**Client** (`client/.env`):
```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

**Server** (`server/.env`):
```env
PORT=3001
CLIENT_URL=http://localhost:5173
COSMOS_ENDPOINT=<your-cosmos-endpoint>
COSMOS_KEY=<your-cosmos-key>
```

## Project Structure

```
greedy-multiplayer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── contexts/       # React context providers
│   │   ├── engine/         # Game logic (scoring, validation)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API and socket services
│   │   ├── ui/             # Presentational components
│   │   └── types/          # TypeScript types
│   └── ...
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── ai/             # AI opponent logic
│   │   ├── db/             # Database operations
│   │   ├── engine/         # Server-side game logic
│   │   └── socket/         # WebSocket handlers
│   └── ...
└── ...
```

## AI Opponents

The game includes three AI difficulty levels:

- **Easy** - Conservative play, banks early, makes occasional mistakes
- **Medium** - Balanced strategy, reasonable risk assessment
- **Hard** - Optimal play with risk/reward calculations, adapts to game state

AI opponents use a decision engine that evaluates:
- Current turn score vs. risk of busting
- Game position relative to other players
- Entry threshold requirements
- Final round pressure

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## License

MIT
