﻿const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 6037;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const CARD_PAIRS = 8;
let leaderboard = [];

const CHALLENGE_LEVELS = [
  { level: 1, pairs: 6, name: '初级挑战' },
  { level: 2, pairs: 8, name: '中级挑战' },
  { level: 3, pairs: 10, name: '高级挑战' },
  { level: 4, pairs: 12, name: '专家挑战' },
  { level: 5, pairs: 15, name: '大师挑战' }
];

let challengeSessions = {};

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

app.get('/api/shuffle', (req, res) => {
  const pairs = parseInt(req.query.pairs) || CARD_PAIRS;
  const cardIds = [];
  for (let i = 1; i <= pairs; i++) {
    cardIds.push(i, i);
  }
  const shuffled = shuffle(cardIds);
  res.json({ cards: shuffled, pairs });
});

app.get('/api/challenge/levels', (req, res) => {
  res.json({ levels: CHALLENGE_LEVELS });
});

app.post('/api/challenge/start', (req, res) => {
  const { playerName } = req.body;
  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  
  const session = {
    id: sessionId,
    playerName: playerName || '匿名玩家',
    startTime: Date.now(),
    totalTime: 0,
    currentLevel: 1,
    failures: 0,
    winStreak: 0,
    maxWinStreak: 0,
    levelsCompleted: [],
    status: 'in_progress',
    history: []
  };
  
  challengeSessions[sessionId] = session;
  
  const firstLevel = CHALLENGE_LEVELS[0];
  const cardIds = [];
  for (let i = 1; i <= firstLevel.pairs; i++) {
    cardIds.push(i, i);
  }
  
  res.json({
    sessionId: session.id,
    playerName: session.playerName,
    currentLevel: session.currentLevel,
    levelInfo: firstLevel,
    cards: shuffle(cardIds),
    totalLevels: CHALLENGE_LEVELS.length
  });
});

app.post('/api/challenge/:sessionId/level-complete', (req, res) => {
  const { sessionId } = req.params;
  const { levelTime, moves } = req.body;
  const session = challengeSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: '挑战会话不存在' });
  }
  
  if (session.status !== 'in_progress') {
    return res.status(400).json({ error: '挑战已结束' });
  }
  
  const currentLevelInfo = CHALLENGE_LEVELS[session.currentLevel - 1];
  
  const levelResult = {
    level: session.currentLevel,
    levelName: currentLevelInfo.name,
    time: levelTime,
    moves: moves,
    completedAt: new Date().toLocaleString('zh-CN')
  };
  
  session.levelsCompleted.push(levelResult);
  session.totalTime += levelTime;
  session.winStreak += 1;
  session.maxWinStreak = Math.max(session.maxWinStreak, session.winStreak);
  session.history.push({
    type: 'win',
    level: session.currentLevel,
    time: levelTime,
    timestamp: Date.now()
  });
  
  const nextLevelNum = session.currentLevel + 1;
  
  if (nextLevelNum > CHALLENGE_LEVELS.length) {
    session.status = 'completed';
    session.endTime = Date.now();
    
    const entry = {
      id: Date.now(),
      time: session.totalTime,
      playerName: session.playerName,
      date: new Date().toLocaleString('zh-CN'),
      isChallenge: true,
      levelsCompleted: session.levelsCompleted.length,
      failures: session.failures,
      maxWinStreak: session.maxWinStreak
    };
    
    leaderboard.push(entry);
    leaderboard.sort((a, b) => a.time - b.time);
    leaderboard = leaderboard.slice(0, 10);
    
    res.json({
      challengeComplete: true,
      session: {
        id: session.id,
        playerName: session.playerName,
        totalTime: session.totalTime,
        failures: session.failures,
        maxWinStreak: session.maxWinStreak,
        levelsCompleted: session.levelsCompleted
      }
    });
    return;
  }
  
  session.currentLevel = nextLevelNum;
  const nextLevelInfo = CHALLENGE_LEVELS[nextLevelNum - 1];
  
  const cardIds = [];
  for (let i = 1; i <= nextLevelInfo.pairs; i++) {
    cardIds.push(i, i);
  }
  
  res.json({
    challengeComplete: false,
    nextLevel: session.currentLevel,
    levelInfo: nextLevelInfo,
    cards: shuffle(cardIds),
    sessionStats: {
      totalTime: session.totalTime,
      failures: session.failures,
      winStreak: session.winStreak,
      maxWinStreak: session.maxWinStreak,
      levelsCompleted: session.levelsCompleted.length
    }
  });
});

app.post('/api/challenge/:sessionId/fail', (req, res) => {
  const { sessionId } = req.params;
  const session = challengeSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: '挑战会话不存在' });
  }
  
  session.failures += 1;
  session.winStreak = 0;
  session.history.push({
    type: 'fail',
    level: session.currentLevel,
    timestamp: Date.now()
  });
  
  const currentLevelInfo = CHALLENGE_LEVELS[session.currentLevel - 1];
  const cardIds = [];
  for (let i = 1; i <= currentLevelInfo.pairs; i++) {
    cardIds.push(i, i);
  }
  
  res.json({
    retry: true,
    currentLevel: session.currentLevel,
    levelInfo: currentLevelInfo,
    cards: shuffle(cardIds),
    sessionStats: {
      totalTime: session.totalTime,
      failures: session.failures,
      winStreak: session.winStreak,
      maxWinStreak: session.maxWinStreak,
      levelsCompleted: session.levelsCompleted.length
    }
  });
});

app.post('/api/challenge/:sessionId/abandon', (req, res) => {
  const { sessionId } = req.params;
  const session = challengeSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: '挑战会话不存在' });
  }
  
  session.status = 'abandoned';
  session.endTime = Date.now();
  
  res.json({
    success: true,
    session: {
      id: session.id,
      playerName: session.playerName,
      totalTime: session.totalTime,
      failures: session.failures,
      levelsCompleted: session.levelsCompleted.length,
      maxWinStreak: session.maxWinStreak
    }
  });
});

app.get('/api/challenge/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = challengeSessions[sessionId];
  
  if (!session) {
    return res.status(404).json({ error: '挑战会话不存在' });
  }
  
  res.json({
    session: {
      id: session.id,
      playerName: session.playerName,
      status: session.status,
      currentLevel: session.currentLevel,
      totalTime: session.totalTime,
      failures: session.failures,
      winStreak: session.winStreak,
      maxWinStreak: session.maxWinStreak,
      levelsCompleted: session.levelsCompleted,
      totalLevels: CHALLENGE_LEVELS.length
    }
  });
});

app.post('/api/score', (req, res) => {
  const { time, playerName } = req.body;
  
  if (typeof time !== 'number' || time <= 0) {
    return res.status(400).json({ error: '无效的成绩数据' });
  }

  const entry = {
    id: Date.now(),
    time: time,
    playerName: playerName || '匿名玩家',
    date: new Date().toLocaleString('zh-CN')
  };

  leaderboard.push(entry);
  leaderboard.sort((a, b) => a.time - b.time);
  leaderboard = leaderboard.slice(0, 10);

  const rank = leaderboard.findIndex(e => e.id === entry.id) + 1;

  res.json({
    success: true,
    rank: rank,
    leaderboard: leaderboard
  });
});

app.get('/api/leaderboard', (req, res) => {
  res.json({ leaderboard: leaderboard });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
