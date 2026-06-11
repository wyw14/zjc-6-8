const API_BASE_URL = 'http://localhost:6037/api';

const CARD_EMOJIS = {
  1: '🍎', 2: '🍊', 3: '🍋', 4: '🍇', 5: '🍓',
  6: '🍒', 7: '🍑', 8: '🥝', 9: '🍍', 10: '🥭',
  11: '🍌', 12: '🍉', 13: '🥥', 14: '🍐', 15: '🫐'
};

const gameBoard = document.getElementById('gameBoard');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const matchedEl = document.getElementById('matched');
const restartBtn = document.getElementById('restartBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const winModal = document.getElementById('winModal');
const leaderboardModal = document.getElementById('leaderboardModal');
const finalTimeEl = document.getElementById('finalTime');
const finalMovesEl = document.getElementById('finalMoves');
const playerNameInput = document.getElementById('playerName');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const closeLeaderboardBtn = document.getElementById('closeLeaderboardBtn');
const leaderboardList = document.getElementById('leaderboardList');

const challengeInfo = document.getElementById('challengeInfo');
const challengeTitle = document.getElementById('challengeTitle');
const startChallengeBtn = document.getElementById('startChallengeBtn');
const abandonChallengeBtn = document.getElementById('abandonChallengeBtn');
const startChallengeModal = document.getElementById('startChallengeModal');
const confirmStartChallengeBtn = document.getElementById('confirmStartChallengeBtn');
const cancelStartChallengeBtn = document.getElementById('cancelStartChallengeBtn');
const challengePlayerName = document.getElementById('challengePlayerName');
const levelsPreview = document.getElementById('levelsPreview');
const progressFill = document.getElementById('progressFill');
const progressSteps = document.getElementById('progressSteps');
const totalTimeEl = document.getElementById('totalTimeEl');
const failuresEl = document.getElementById('failuresEl');
const winStreakEl = document.getElementById('winStreakEl');

const levelTransitionModal = document.getElementById('levelTransitionModal');
const transitionTitle = document.getElementById('transitionTitle');
const transitionContent = document.getElementById('transitionContent');
const nextLevelBtn = document.getElementById('nextLevelBtn');

const challengeCompleteModal = document.getElementById('challengeCompleteModal');
const challengeCompleteContent = document.getElementById('challengeCompleteContent');
const backToNormalBtn = document.getElementById('backToNormalBtn');
const restartChallengeBtn = document.getElementById('restartChallengeBtn');

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = null;
let startTime = null;
let elapsedTime = 0;
let gameStarted = false;
let isProcessing = false;
let currentPairs = 8;

let isChallengeMode = false;
let challengeSessionId = null;
let challengeTotalLevels = 5;
let challengeCurrentLevel = 1;
let challengeLevels = [];
let pendingLevelData = null;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimeMs(ms) {
  return formatTime(Math.floor(ms / 1000));
}

async function initGame(pairs = 8, preShuffledCards = null) {
  resetGameState(pairs);
  let cardIds;
  if (preShuffledCards) {
    cardIds = preShuffledCards;
  } else {
    cardIds = await fetchShuffledCards(pairs);
  }
  renderCards(cardIds);
}

function resetGameState(pairs = 8) {
  cards = [];
  flippedCards = [];
  matchedPairs = 0;
  moves = 0;
  elapsedTime = 0;
  gameStarted = false;
  isProcessing = false;
  currentPairs = pairs;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  updateTimerDisplay();
  movesEl.textContent = '0';
  matchedEl.textContent = `0/${pairs}`;
  gameBoard.innerHTML = '';

  gameBoard.className = 'game-board';
  if (isChallengeMode) {
    gameBoard.classList.add(`level-${challengeCurrentLevel}`);
  }
}

async function fetchShuffledCards(pairs = 8) {
  try {
    const response = await fetch(`${API_BASE_URL}/shuffle?pairs=${pairs}`);
    const data = await response.json();
    return data.cards;
  } catch (error) {
    console.error('获取洗牌数据失败:', error);
    const fallbackCards = [];
    for (let i = 1; i <= pairs; i++) {
      fallbackCards.push(i, i);
    }
    for (let i = fallbackCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fallbackCards[i], fallbackCards[j]] = [fallbackCards[j], fallbackCards[i]];
    }
    return fallbackCards;
  }
}

function renderCards(cardIds) {
  cardIds.forEach((cardId, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = cardId;
    card.dataset.index = index;

    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';

    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.textContent = CARD_EMOJIS[cardId] || '★';

    card.appendChild(cardBack);
    card.appendChild(cardFront);

    card.addEventListener('click', () => handleCardClick(card));

    gameBoard.appendChild(card);
    cards.push(card);
  });
}

function handleCardClick(card) {
  if (isProcessing) return;
  if (card.classList.contains('flipped')) return;
  if (card.classList.contains('matched')) return;
  if (flippedCards.length >= 2) return;

  if (!gameStarted) {
    startTimer();
    gameStarted = true;
  }

  flipCard(card);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

function flipCard(card) {
  card.classList.add('flipped');
}

function unflipCard(card) {
  card.classList.remove('flipped');
}

function checkMatch() {
  isProcessing = true;

  const [card1, card2] = flippedCards;
  const id1 = parseInt(card1.dataset.id);
  const id2 = parseInt(card2.dataset.id);

  if (id1 === id2) {
    setTimeout(() => {
      card1.classList.add('matched');
      card2.classList.add('matched');
      matchedPairs++;
      matchedEl.textContent = `${matchedPairs}/${currentPairs}`;
      flippedCards = [];
      isProcessing = false;

      if (matchedPairs === currentPairs) {
        endGame();
      }
    }, 500);
  } else {
    setTimeout(() => {
      unflipCard(card1);
      unflipCard(card2);
      flippedCards = [];
      isProcessing = false;
    }, 1000);
  }
}

function startTimer() {
  startTime = Date.now() - elapsedTime;
  timer = setInterval(() => {
    elapsedTime = Date.now() - startTime;
    updateTimerDisplay();
  }, 100);
}

function updateTimerDisplay() {
  timerEl.textContent = formatTimeMs(elapsedTime);
}

function endGame() {
  clearInterval(timer);
  timer = null;

  if (isChallengeMode) {
    handleChallengeLevelComplete();
  } else {
    finalTimeEl.textContent = timerEl.textContent;
    finalMovesEl.textContent = moves;
    setTimeout(() => {
      winModal.classList.remove('hidden');
    }, 500);
  }
}

async function handleChallengeLevelComplete() {
  const levelTime = Math.floor(elapsedTime / 1000);
  const levelMoves = moves;

  try {
    const response = await fetch(`${API_BASE_URL}/challenge/${challengeSessionId}/level-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelTime, moves: levelMoves })
    });

    const data = await response.json();

    if (data.challengeComplete) {
      showChallengeComplete(data.session);
    } else {
      pendingLevelData = data;
      updateChallengeStats(data.sessionStats);
      showLevelTransition(levelTime, levelMoves, data);
    }
  } catch (error) {
    console.error('提交关卡成绩失败:', error);
    alert('网络错误，请稍后重试');
  }
}

function showLevelTransition(levelTime, levelMoves, data) {
  transitionTitle.textContent = `🎉 第 ${challengeCurrentLevel} 关通过！`;

  const nextLevelInfo = data.levelInfo;
  const stats = data.sessionStats;

  transitionContent.innerHTML = `
    <div class="level-complete-stats">
      <div class="stat-row">
        <span class="label">本关用时</span>
        <span class="value">${formatTime(levelTime)}</span>
      </div>
      <div class="stat-row">
        <span class="label">本关步数</span>
        <span class="value">${levelMoves}</span>
      </div>
      <div class="stat-row">
        <span class="label">当前连胜</span>
        <span class="value">🔥 ${stats.winStreak}</span>
      </div>
    </div>
    <div class="next-level-preview">
      <h4>下一关：${nextLevelInfo.name}</h4>
      <p>卡片对数：${nextLevelInfo.pairs} 对</p>
    </div>
  `;

  levelTransitionModal.classList.remove('hidden');
}

function goToNextLevel() {
  levelTransitionModal.classList.add('hidden');

  if (pendingLevelData) {
    challengeCurrentLevel = pendingLevelData.nextLevel;
    challengeTitle.textContent = `🎯 挑战模式 - ${pendingLevelData.levelInfo.name}`;
    updateProgressBar();
    initGame(pendingLevelData.levelInfo.pairs, pendingLevelData.cards);
    pendingLevelData = null;
  }
}

function updateProgressBar() {
  const completed = challengeCurrentLevel - 1;
  const percent = (completed / challengeTotalLevels) * 100;
  progressFill.style.width = `${percent}%`;

  progressSteps.innerHTML = '';
  for (let i = 1; i <= challengeTotalLevels; i++) {
    const step = document.createElement('div');
    step.className = 'progress-step';

    const dot = document.createElement('div');
    dot.className = 'step-dot';
    if (i < challengeCurrentLevel) {
      dot.classList.add('completed');
      dot.textContent = '✓';
    } else if (i === challengeCurrentLevel) {
      dot.classList.add('current');
      dot.textContent = i;
    } else {
      dot.textContent = i;
    }

    const label = document.createElement('span');
    label.className = 'step-label';
    if (challengeLevels[i - 1]) {
      label.textContent = challengeLevels[i - 1].name;
    }

    step.appendChild(dot);
    step.appendChild(label);
    progressSteps.appendChild(step);
  }
}

function updateChallengeStats(stats) {
  totalTimeEl.textContent = formatTime(stats.totalTime);
  failuresEl.textContent = stats.failures;
  winStreakEl.textContent = stats.winStreak;
}

function showChallengeComplete(session) {
  updateProgressBar();
  progressFill.style.width = '100%';

  let breakdownHtml = '<div class="level-breakdown">';
  session.levelsCompleted.forEach((level, idx) => {
    breakdownHtml += `
      <div class="breakdown-item">
        <span>第${level.level}关 - ${level.levelName}</span>
        <span>${formatTime(level.time)} (${level.moves}步)</span>
      </div>
    `;
  });
  breakdownHtml += '</div>';

  challengeCompleteContent.innerHTML = `
    <div class="challenge-summary">
      <div class="summary-item">
        <span class="label">👤 玩家</span>
        <span class="value">${session.playerName}</span>
      </div>
      <div class="summary-item">
        <span class="label">⏱️ 总用时</span>
        <span class="value">${formatTime(session.totalTime)}</span>
      </div>
      <div class="summary-item">
        <span class="label">💔 失败次数</span>
        <span class="value">${session.failures}</span>
      </div>
      <div class="summary-item">
        <span class="label">🔥 最高连胜</span>
        <span class="value">${session.maxWinStreak}</span>
      </div>
    </div>
    ${breakdownHtml}
    <p style="color: #10b981; font-weight: bold; margin-top: 15px;">🏆 成绩已提交至排行榜！</p>
  `;

  challengeCompleteModal.classList.remove('hidden');
}

async function startChallenge() {
  try {
    const levelsResponse = await fetch(`${API_BASE_URL}/challenge/levels`);
    const levelsData = await levelsResponse.json();
    challengeLevels = levelsData.levels;
    challengeTotalLevels = challengeLevels.length;

    levelsPreview.innerHTML = '';
    challengeLevels.forEach((level) => {
      const item = document.createElement('div');
      item.className = 'level-preview-item';
      item.innerHTML = `
        <span class="level-preview-name">第${level.level}关 - ${level.name}</span>
        <span class="level-preview-pairs">${level.pairs}对卡片</span>
      `;
      levelsPreview.appendChild(item);
    });

    startChallengeModal.classList.remove('hidden');
  } catch (error) {
    console.error('加载关卡信息失败:', error);
    alert('加载失败，请稍后重试');
  }
}

async function confirmStartChallenge() {
  const playerName = challengePlayerName.value.trim() || '匿名玩家';

  try {
    const response = await fetch(`${API_BASE_URL}/challenge/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });

    const data = await response.json();

    isChallengeMode = true;
    challengeSessionId = data.sessionId;
    challengeCurrentLevel = data.currentLevel;
    challengeTotalLevels = data.totalLevels;

    challengeInfo.classList.remove('hidden');
    startChallengeBtn.classList.add('hidden');
    challengeTitle.textContent = `🎯 挑战模式 - ${data.levelInfo.name}`;

    updateProgressBar();
    updateChallengeStats({
      totalTime: 0,
      failures: 0,
      winStreak: 0,
      maxWinStreak: 0,
      levelsCompleted: 0
    });

    startChallengeModal.classList.add('hidden');
    initGame(data.levelInfo.pairs, data.cards);
  } catch (error) {
    console.error('开始挑战失败:', error);
    alert('开始挑战失败，请稍后重试');
  }
}

async function abandonChallenge() {
  if (!confirm('确定要放弃当前挑战吗？进度将不会保存到排行榜。')) {
    return;
  }

  try {
    await fetch(`${API_BASE_URL}/challenge/${challengeSessionId}/abandon`, {
      method: 'POST'
    });
  } catch (error) {
    console.error('放弃挑战请求失败:', error);
  }

  exitChallengeMode();
}

function exitChallengeMode() {
  isChallengeMode = false;
  challengeSessionId = null;
  challengeCurrentLevel = 1;
  pendingLevelData = null;

  challengeInfo.classList.add('hidden');
  startChallengeBtn.classList.remove('hidden');
  challengeTitle.textContent = '🎯 挑战模式';

  levelTransitionModal.classList.add('hidden');
  challengeCompleteModal.classList.add('hidden');

  initGame(8);
}

async function submitScore() {
  const playerName = playerNameInput.value.trim() || '匿名玩家';
  const timeInSeconds = Math.floor(elapsedTime / 1000);

  try {
    const response = await fetch(`${API_BASE_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        time: timeInSeconds,
        playerName: playerName
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`恭喜！你排名第 ${data.rank} 名！`);
      winModal.classList.add('hidden');
      showLeaderboard();
    }
  } catch (error) {
    console.error('提交成绩失败:', error);
    alert('提交成绩失败，请稍后重试');
  }
}

async function showLeaderboard() {
  try {
    const response = await fetch(`${API_BASE_URL}/leaderboard`);
    const data = await response.json();
    renderLeaderboard(data.leaderboard);
  } catch (error) {
    console.error('获取排行榜失败:', error);
    leaderboardList.innerHTML = '<li>加载排行榜失败</li>';
  }

  leaderboardModal.classList.remove('hidden');
}

function renderLeaderboard(leaderboard) {
  if (!leaderboard || leaderboard.length === 0) {
    leaderboardList.innerHTML = '<li class="empty-message">暂无记录，快来挑战吧！</li>';
    return;
  }

  leaderboardList.innerHTML = '';

  leaderboard.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'rank-item';

    const timeStr = formatTime(entry.time);

    const isChallenge = entry.isChallenge;
    const badgeHtml = isChallenge
      ? `<span class="challenge-badge">🎯挑战</span>`
      : '';

    let extraInfo = '';
    if (isChallenge) {
      extraInfo = `<span style="color:#999; font-size:0.8em;">(${entry.levelsCompleted}关 · ${entry.failures}败 · 🔥${entry.maxWinStreak})</span>`;
    }

    li.innerHTML = `
      <span class="rank-name">
        <span class="rank">#${index + 1}</span>
        <span class="name">${entry.playerName}${badgeHtml}</span>
        ${extraInfo}
      </span>
      <span class="time">${timeStr}</span>
    `;

    leaderboardList.appendChild(li);
  });
}

restartBtn.addEventListener('click', () => {
  if (isChallengeMode) {
    if (confirm('重新开始当前关卡？本关进度将重置。')) {
      initGame(challengeLevels[challengeCurrentLevel - 1].pairs);
    }
  } else {
    initGame(8);
  }
});

playAgainBtn.addEventListener('click', () => {
  winModal.classList.add('hidden');
  initGame(8);
});

leaderboardBtn.addEventListener('click', showLeaderboard);
closeLeaderboardBtn.addEventListener('click', () => {
  leaderboardModal.classList.add('hidden');
});
submitScoreBtn.addEventListener('click', submitScore);

startChallengeBtn.addEventListener('click', startChallenge);
cancelStartChallengeBtn.addEventListener('click', () => {
  startChallengeModal.classList.add('hidden');
});
confirmStartChallengeBtn.addEventListener('click', confirmStartChallenge);
abandonChallengeBtn.addEventListener('click', abandonChallenge);
nextLevelBtn.addEventListener('click', goToNextLevel);

backToNormalBtn.addEventListener('click', () => {
  challengeCompleteModal.classList.add('hidden');
  exitChallengeMode();
});

restartChallengeBtn.addEventListener('click', () => {
  challengeCompleteModal.classList.add('hidden');
  startChallenge();
});

initGame(8);
