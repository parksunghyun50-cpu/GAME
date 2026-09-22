// ===== CHOICES & EMOJIS =====
const CHOICES = {
    scissors: { emoji: '✌️', name: '가위', beats: 'paper' },
    rock:     { emoji: '✊', name: '바위', beats: 'scissors' },
    paper:    { emoji: '🖐️', name: '보',   beats: 'rock' },
};

// ===== ADMIN CONFIG (관리자 정보) =====
const ADMIN_ID = 'jake0400';
const ADMIN_PW = '93189318q';

// ===== STATE & LOCAL STORAGE DATABASE =====
let currentUser = null;
let currentBet = 100;
let roomBet = 500;
let currentRoom = null;

// PVP State
let pvpState = {
    p1Name: '',
    p2Name: '상대방',
    betAmount: 500,
    p1Choice: null,
    p2Choice: null,
    isBot: false,
};

// Computer Game State
let isPlaying = false;
let currentStreak = 0;

// Initialize Storage
function getStorageUsers() {
    const data = localStorage.getItem('rps_arena_users');
    let users = data ? JSON.parse(data) : {};

    // 관리자 계정 생성/확인 (jake0400 / 93189318q)
    if (!users[ADMIN_ID] || users[ADMIN_ID].pw !== ADMIN_PW) {
        users[ADMIN_ID] = {
            id: ADMIN_ID,
            nickname: '최고관리자 (Jake)',
            pw: ADMIN_PW,
            coins: 999999,
            wins: 100,
            losses: 0,
            draws: 0,
            isAdmin: true,
            lastDaily: new Date().toDateString(),
            history: []
        };
    }

    // 기본 테스트 샘플 유저가 없으면 추가
    if (!users['pro']) {
        users['pro'] = { id: 'pro', nickname: '승리왕Pro', pw: '123456', coins: 12400, wins: 28, losses: 14, draws: 3, history: [] };
        users['lucky'] = { id: 'lucky', nickname: '행운아', pw: '123456', coins: 5500, wins: 15, losses: 8, draws: 1, history: [] };
    }

    localStorage.setItem('rps_arena_users', JSON.stringify(users));
    return users;
}

function saveStorageUsers(users) {
    localStorage.setItem('rps_arena_users', JSON.stringify(users));
}

function getStorageRooms() {
    const data = localStorage.getItem('rps_arena_rooms');
    if (!data) return [];
    return JSON.parse(data);
}

function saveStorageRooms(rooms) {
    localStorage.setItem('rps_arena_rooms', JSON.stringify(rooms));
}

// ===== UI SCREEN NAVIGATION =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }

    if (screenId === 'screen-lobby') {
        updateLobbyUI();
    } else if (screenId === 'screen-bet') {
        updateBetUI();
    } else if (screenId === 'screen-rooms') {
        renderRoomList();
    } else if (screenId === 'screen-profile') {
        renderProfile();
    } else if (screenId === 'screen-ranking') {
        renderRanking();
    } else if (screenId === 'screen-chat') {
        renderChatMessages();
    } else if (screenId === 'screen-admin') {
        renderAdminDashboard();
    }
}

// ===== CHAT LOGIC (전체 광장 채팅) =====
function getStorageChat() {
    const data = localStorage.getItem('rps_arena_chat');
    if (!data) {
        const defaultChat = [
            { sender: '아레나마스터', text: '가위바위보 아레나 전체 광장에 오신 것을 환영합니다! ⚔️', time: '오전 10:00', isAdmin: true }
        ];
        localStorage.setItem('rps_arena_chat', JSON.stringify(defaultChat));
        return defaultChat;
    }
    return JSON.parse(data);
}

function saveStorageChat(chats) {
    localStorage.setItem('rps_arena_chat', JSON.stringify(chats));
}

function renderChatMessages() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const chats = getStorageChat();
    const isAdmin = currentUser && (currentUser.isAdmin || currentUser.id === ADMIN_ID);

    chatBox.innerHTML = chats.map((c, idx) => {
        const titleBadge = c.title ? `<span class="user-custom-title" style="background:${c.titleBg || 'var(--accent-purple)'}">${escapeHtml(c.title)}</span>` : '';
        const nameColorStyle = c.nameColor ? `style="color:${c.nameColor}"` : '';

        return `
            <div class="chat-message ${c.isAdmin ? 'chat-admin' : ''}">
                <div class="chat-sender">
                    ${titleBadge}
                    <span ${nameColorStyle}>${escapeHtml(c.sender)}</span>
                    ${c.isAdmin ? '<span class="admin-tag">관리자</span>' : ''}
                    <span class="chat-time">${c.time}</span>
                    ${isAdmin ? `<button class="btn-delete-chat" onclick="deleteChatMessage(${idx})" title="메시지 삭제">❌</button>` : ''}
                </div>
                <div class="chat-text">${escapeHtml(c.text)}</div>
            </div>
        `;
    }).join('');

    chatBox.scrollTop = chatBox.scrollHeight;
}

function sendChatMessage(e) {
    e.preventDefault();
    if (!currentUser) return;

    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chats = getStorageChat();
    chats.push({
        sender: currentUser.nickname,
        title: currentUser.title || '',
        titleBg: currentUser.titleBg || '',
        nameColor: currentUser.nameColor || '',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAdmin: currentUser.isAdmin || currentUser.id === ADMIN_ID
    });

    if (chats.length > 50) chats.shift();
    saveStorageChat(chats);

    input.value = '';
    renderChatMessages();
}

function deleteChatMessage(index) {
    if (!currentUser || (!currentUser.isAdmin && currentUser.id !== ADMIN_ID)) return;
    const chats = getStorageChat();
    chats.splice(index, 1);
    saveStorageChat(chats);
    renderChatMessages();
    showToast('채팅 메시지가 삭제되었습니다.');
}

// ===== ADMIN DASHBOARD LOGIC (관리자 전용 기능) =====
function renderAdminDashboard() {
    if (!currentUser || (currentUser.id !== ADMIN_ID && !currentUser.isAdmin)) {
        showToast('관리자 권한이 필요합니다!');
        showScreen('screen-lobby');
        return;
    }

    // 1. 대전방 관리 리스트 렌더링
    const rooms = getStorageRooms();
    const adminRoomList = document.getElementById('admin-room-list');
    if (rooms.length === 0) {
        adminRoomList.innerHTML = '<div class="history-empty">현재 생성된 대전방이 없습니다.</div>';
    } else {
        adminRoomList.innerHTML = rooms.map(r => `
            <div class="admin-user-card glass-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        🏠 ${escapeHtml(r.title)}
                        <span class="status-waiting">${r.status === 'playing' ? '게임 진행 중' : '대기 중'}</span>
                    </div>
                    <div class="admin-user-meta">
                        방장: <strong>${escapeHtml(r.hostName)}</strong> | 배팅금액: 🪙 ${r.bet.toLocaleString()}
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="btn-admin-act btn-delete-user" onclick="adminDeleteRoom(${r.id})">🗑️ 방 강제 삭제</button>
                </div>
            </div>
        `).join('');
    }

    // 2. 유저 계정 리스트 렌더링
    const users = getStorageUsers();
    const adminList = document.getElementById('admin-user-list');

    const userKeys = Object.keys(users);
    if (userKeys.length === 0) {
        adminList.innerHTML = '<div class="history-empty">등록된 유저가 없습니다.</div>';
        return;
    }

    adminList.innerHTML = userKeys.map(id => {
        const u = users[id];
        const isAdminAccount = u.id === ADMIN_ID;
        return `
            <div class="admin-user-card glass-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        ${escapeHtml(u.nickname)} 
                        <span class="admin-user-id">(@${escapeHtml(u.id)})</span>
                        ${isAdminAccount ? '<span class="admin-tag">관리자</span>' : ''}
                    </div>
                    <div class="admin-user-meta">
                        보유 코인: 🪙 <strong>${u.coins.toLocaleString()}</strong> | 전적: ${u.wins}승 ${u.losses}패 ${u.draws}무
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="btn-admin-act btn-edit-nick" onclick="adminEditNickname('${u.id}')">✏️ 닉네임 변경</button>
                    <button class="btn-admin-act btn-add-coin" onclick="adminAddCoins('${u.id}')">🪙 코인 지급/차감</button>
                    ${!isAdminAccount ? `<button class="btn-admin-act btn-delete-user" onclick="adminDeleteUser('${u.id}')">🗑️ 계정 삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 관리자 방 강제 삭제
function adminDeleteRoom(roomId) {
    if (confirm('이 대전방을 강제로 삭제하시겠습니까?')) {
        let rooms = getStorageRooms();
        rooms = rooms.filter(r => r.id !== roomId);
        saveStorageRooms(rooms);

        showToast('대전방이 강제 삭제되었습니다.');
        renderAdminDashboard();
    }
}
function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    if (!toast || !toastText) return;
    toastText.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 2500);
}

// ===== AUTHENTICATION =====
function switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const formLogin = document.getElementById('form-login');
    const formSignup = document.getElementById('form-signup');
    const authError = document.getElementById('auth-error');

    authError.classList.add('hidden');

    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        formLogin.classList.remove('hidden');
        formSignup.classList.add('hidden');
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        formSignup.classList.remove('hidden');
        formLogin.classList.add('hidden');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id').value.trim();
    const pw = document.getElementById('login-pw').value;
    const authError = document.getElementById('auth-error');

    const users = getStorageUsers();
    if (users[id] && users[id].pw === pw) {
        currentUser = users[id];
        authError.classList.add('hidden');
        checkDailyBonus();
        showScreen('screen-lobby');
        if (currentUser.isAdmin) {
            showToast(`👑 관리자(${currentUser.nickname}) 계정으로 로그인했습니다.`);
        } else {
            showToast(`🎉 환영합니다, ${currentUser.nickname}님!`);
        }
    } else {
        authError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
        authError.classList.remove('hidden');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const id = document.getElementById('signup-id').value.trim();
    const nickname = document.getElementById('signup-nickname').value.trim();
    const pw = document.getElementById('signup-pw').value;
    const pw2 = document.getElementById('signup-pw2').value;
    const authError = document.getElementById('auth-error');

    if (pw !== pw2) {
        authError.textContent = '비밀번호가 일치하지 않습니다.';
        authError.classList.remove('hidden');
        return;
    }

    const users = getStorageUsers();
    if (users[id]) {
        authError.textContent = '이미 존재하는 아이디입니다.';
        authError.classList.remove('hidden');
        return;
    }

    users[id] = {
        id: id,
        nickname: nickname,
        pw: pw,
        coins: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        lastDaily: new Date().toDateString(),
        history: []
    };
    saveStorageUsers(users);

    currentUser = users[id];
    authError.classList.add('hidden');
    showScreen('screen-lobby');
    showToast(`✨ 가입을 축하합니다! 1,000 코인 지급 완료!`);
}

function logout() {
    currentUser = null;
    document.getElementById('login-id').value = '';
    document.getElementById('login-pw').value = '';
    showScreen('screen-auth');
    showToast('로그아웃 되었습니다.');
}

// ===== DAILY BONUS =====
function checkDailyBonus() {
    if (!currentUser) return;
    const today = new Date().toDateString();
    if (currentUser.lastDaily !== today) {
        document.getElementById('daily-bonus').classList.remove('hidden');
    } else {
        document.getElementById('daily-bonus').classList.add('hidden');
    }
}

function closeDailyBonus() {
    if (!currentUser) return;
    currentUser.coins += 1000;
    currentUser.lastDaily = new Date().toDateString();
    updateUserData();
    document.getElementById('daily-bonus').classList.add('hidden');
    showToast('🎁 출석 보너스 1,000 코인을 받았습니다!');
    updateLobbyUI();
}

function updateUserData() {
    if (!currentUser) return;
    const users = getStorageUsers();
    users[currentUser.id] = currentUser;
    saveStorageUsers(users);
}

// ===== LOBBY & BET UI =====
function updateLobbyUI() {
    if (!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.nickname;
    document.getElementById('coin-amount').textContent = currentUser.coins.toLocaleString();

    // 관리자 계정일 경우 관리자 대시보드 버튼 노출
    const adminCard = document.getElementById('admin-lobby-card');
    if (currentUser.isAdmin || currentUser.id === ADMIN_ID) {
        adminCard.classList.remove('hidden');
    } else {
        adminCard.classList.add('hidden');
    }
}

function updateBetUI() {
    if (!currentUser) return;
    document.getElementById('bet-coin-display').textContent = currentUser.coins.toLocaleString();
    if (currentBet > currentUser.coins) {
        currentBet = Math.max(10, currentUser.coins);
    }
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
}

function setBet(amount) {
    if (!currentUser) return;
    if (amount > currentUser.coins) {
        showToast('코인이 부족합니다!');
        return;
    }
    currentBet = amount;
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
}

function setBetAll() {
    if (!currentUser) return;
    if (currentUser.coins <= 0) {
        showToast('배팅할 코인이 없습니다!');
        return;
    }
    currentBet = currentUser.coins;
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
    showToast('🔥 ALL IN!');
}

function setBetCustom() {
    if (!currentUser) return;
    const val = parseInt(document.getElementById('bet-custom-input').value, 10);
    if (isNaN(val) || val <= 0) {
        showToast('올바른 배팅 금액을 입력하세요.');
        return;
    }
    if (val > currentUser.coins) {
        showToast('소지 코인을 초과할 수 없습니다.');
        return;
    }
    currentBet = val;
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
    document.getElementById('bet-custom-input').value = '';
}

// ===== COMPUTER GAME LOGIC =====
function startComputerGame() {
    if (!currentUser) return;
    if (currentBet <= 0) {
        showToast('배팅 금액을 설정해주세요!');
        return;
    }
    if (currentBet > currentUser.coins) {
        showToast('코인이 부족합니다!');
        return;
    }

    document.getElementById('game-bet-amount').textContent = currentBet.toLocaleString();
    document.getElementById('game-player-name').textContent = currentUser.nickname;
    document.getElementById('game-player-hand').textContent = '❓';
    document.getElementById('game-opponent-hand').textContent = '❓';
    document.getElementById('game-result-text').textContent = '가위, 바위, 보 중 하나를 클릭하세요!';
    document.getElementById('game-result-coins').textContent = '';
    
    document.getElementById('game-choices').classList.remove('hidden');
    document.getElementById('game-actions').classList.add('hidden');
    
    const pHand = document.getElementById('game-player-hand');
    const oHand = document.getElementById('game-opponent-hand');
    pHand.className = 'arena-hand';
    oHand.className = 'arena-hand';

    showScreen('screen-game');
}

function makeChoice(playerChoice) {
    if (isPlaying || !currentUser) return;
    isPlaying = true;

    if (currentBet > currentUser.coins) {
        showToast('코인이 부족합니다!');
        isPlaying = false;
        return;
    }

    const keys = Object.keys(CHOICES);
    const opponentChoice = keys[Math.floor(Math.random() * keys.length)];

    const pHand = document.getElementById('game-player-hand');
    const oHand = document.getElementById('game-opponent-hand');
    const resultText = document.getElementById('game-result-text');
    const resultCoins = document.getElementById('game-result-coins');
    const clash = document.getElementById('game-clash');

    pHand.textContent = '❓';
    oHand.textContent = '❓';
    pHand.className = 'arena-hand shake';
    oHand.className = 'arena-hand shake';
    resultText.textContent = '두근두근...';

    setTimeout(() => {
        pHand.textContent = CHOICES[playerChoice].emoji;
        oHand.textContent = CHOICES[opponentChoice].emoji;

        pHand.className = 'arena-hand reveal';
        oHand.className = 'arena-hand reveal';

        clash.classList.add('show');
        setTimeout(() => clash.classList.remove('show'), 600);

        let outcome = 'draw';
        if (playerChoice === opponentChoice) {
            outcome = 'draw';
        } else if (CHOICES[playerChoice].beats === opponentChoice) {
            outcome = 'win';
        } else {
            outcome = 'lose';
        }

        if (outcome === 'win') {
            pHand.classList.add('win-glow');
            oHand.classList.add('lose-glow');
            const winCoins = currentBet;
            currentUser.coins += winCoins;
            currentUser.wins++;
            currentStreak++;

            resultText.textContent = '🎉 승리했습니다!';
            resultText.className = 'result-text win pop';
            resultCoins.textContent = `+${winCoins.toLocaleString()} 🪙 획득!`;
            resultCoins.className = 'game-result-coins win';

            showStreakBanner(currentStreak);
        } else if (outcome === 'lose') {
            pHand.classList.add('lose-glow');
            oHand.classList.add('win-glow');
            currentUser.coins -= currentBet;
            currentUser.losses++;
            currentStreak = 0;

            resultText.textContent = '😢 패배했습니다...';
            resultText.className = 'result-text lose pop';
            resultCoins.textContent = `-${currentBet.toLocaleString()} 🪙 차감`;
            resultCoins.className = 'game-result-coins lose';
        } else {
            currentUser.draws++;
            currentStreak = 0;
            resultText.textContent = '🤝 무승부!';
            resultText.className = 'result-text draw pop';
            resultCoins.textContent = '배팅 코인 보존';
            resultCoins.className = 'game-result-coins draw';
        }

        currentUser.history.unshift({
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            vs: '컴퓨터 (AI)',
            playerChoice,
            opponentChoice,
            outcome,
            bet: currentBet
        });
        if (currentUser.history.length > 20) currentUser.history.pop();

        updateUserData();

        document.getElementById('game-choices').classList.add('hidden');
        document.getElementById('game-actions').classList.remove('hidden');
        isPlaying = false;
    }, 600);
}

function playAgain() {
    startComputerGame();
}

function showStreakBanner(streak) {
    if (streak >= 3) {
        const banner = document.getElementById('streak-banner');
        const text = document.getElementById('streak-text');
        text.textContent = `🔥 ${streak}연승 달성!`;
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 2500);
    }
}

// ===== ROOMS & PVP LOGIC =====
function setRoomBet(amount) {
    roomBet = amount;
    document.getElementById('room-bet-value').textContent = roomBet.toLocaleString();
}

function showCreateRoom() {
    document.getElementById('create-room-modal').classList.remove('hidden');
}

function hideCreateRoom() {
    document.getElementById('create-room-modal').classList.add('hidden');
}

function createRoom() {
    if (!currentUser) return;
    const title = document.getElementById('room-name-input').value.trim() || '대전 한 판!';
    if (roomBet > currentUser.coins) {
        showToast('소지 코인이 부족합니다!');
        return;
    }

    const rooms = getStorageRooms();
    const newRoom = {
        id: Date.now(),
        title,
        hostId: currentUser.id,
        hostName: currentUser.nickname,
        bet: roomBet,
        guestId: null,
        guestName: null,
        status: 'waiting'
    };
    rooms.unshift(newRoom);
    saveStorageRooms(rooms);

    hideCreateRoom();
    document.getElementById('room-name-input').value = '';
    renderRoomList();
    showToast('대전방이 성공적으로 생성되었습니다!');

    // 생성된 방에 바로 대기 상태로 입장
    currentRoom = newRoom;
    startPvpGame(newRoom, true);
}

function renderRoomList() {
    const list = document.getElementById('room-list');
    const coinsDisplay = document.getElementById('rooms-coin-display');
    if (currentUser) coinsDisplay.textContent = currentUser.coins.toLocaleString();

    const rooms = getStorageRooms();
    if (rooms.length === 0) {
        list.innerHTML = '<div class="room-empty">생성된 대전방이 없습니다.<br>방을 만들어 다른 플레이어를 기다려보세요!</div>';
        return;
    }

    list.innerHTML = rooms.map(r => {
        const isMyRoom = currentUser && r.hostId === currentUser.id;
        const statusBadge = r.status === 'playing' ? '<span class="status-playing">게임 중</span>' : '<span class="status-waiting">대기 중</span>';
        
        return `
            <div class="room-card glass-card">
                <div class="room-info">
                    <div class="room-card-title">${escapeHtml(r.title)} ${statusBadge}</div>
                    <div class="room-card-meta">방장: ${escapeHtml(r.hostName)} | 배팅: 🪙 ${r.bet.toLocaleString()}</div>
                </div>
                <div class="room-card-btn-group">
                    <button class="btn-primary btn-sm" onclick="joinRoom(${r.id})">${isMyRoom ? '방 입장' : '참가하기'}</button>
                    ${isMyRoom ? `<button class="btn-secondary btn-sm" onclick="deleteRoom(${r.id})">삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function deleteRoom(roomId) {
    let rooms = getStorageRooms();
    rooms = rooms.filter(r => r.id !== roomId);
    saveStorageRooms(rooms);
    renderRoomList();
    showToast('대전방이 삭제되었습니다.');
}

function joinRoom(roomId) {
    if (!currentUser) return;
    const rooms = getStorageRooms();
    const room = rooms.find(r => r.id === roomId);
    if (!room) {
        showToast('존재하지 않는 방입니다.');
        return;
    }
    if (room.bet > currentUser.coins) {
        showToast('코인이 부족하여 입장할 수 없습니다!');
        return;
    }

    currentRoom = room;

    // 내가 방장이 아니고 도전자일 때
    if (room.hostId !== currentUser.id) {
        room.guestId = currentUser.id;
        room.guestName = currentUser.nickname;
        room.status = 'playing';
        saveStorageRooms(rooms);
    }

    startPvpGame(room, room.hostId === currentUser.id);
}

function startPvpGame(room, isHost) {
    pvpState.betAmount = room.bet;
    pvpState.p1Choice = null;
    pvpState.p2Choice = null;

    pvpState.p1Name = room.hostName;
    pvpState.p2Name = room.guestName ? room.guestName : null;

    document.getElementById('pvp-bet-amount').textContent = pvpState.betAmount.toLocaleString();
    document.getElementById('pvp-p1-name').textContent = pvpState.p1Name;
    document.getElementById('pvp-p2-name').textContent = pvpState.p2Name || '도전자 대기 중';
    document.getElementById('pvp-p2-name-pass').textContent = pvpState.p2Name || '도전자';

    document.getElementById('pvp-phase-waiting').classList.add('hidden');
    document.getElementById('pvp-phase-p1').classList.add('hidden');
    document.getElementById('pvp-phase-pass').classList.add('hidden');
    document.getElementById('pvp-phase-p2').classList.add('hidden');
    document.getElementById('pvp-phase-result').classList.add('hidden');

    // 두 명의 플레이어가 모두 갖춰지지 않았을 경우 대기 화면 노출
    if (!room.guestName) {
        document.getElementById('pvp-phase-waiting').classList.remove('hidden');
    } else {
        document.getElementById('pvp-phase-p1').classList.remove('hidden');
    }

    showScreen('screen-pvp');
}

function pvpChoice(playerNum, choice) {
    if (!currentRoom || !currentRoom.guestName) {
        showToast('아직 2번 플레이어가 입장하지 않았습니다!');
        return;
    }

    if (playerNum === 1) {
        pvpState.p1Choice = choice;
        document.getElementById('pvp-phase-p1').classList.add('hidden');
        document.getElementById('pvp-phase-pass').classList.remove('hidden');
    } else if (playerNum === 2) {
        pvpState.p2Choice = choice;
        document.getElementById('pvp-phase-p2').classList.add('hidden');
        showPvpResult();
    }
}

function showP2Phase() {
    document.getElementById('pvp-phase-pass').classList.add('hidden');
    document.getElementById('pvp-phase-p2').classList.remove('hidden');
}

function showPvpResult() {
    document.getElementById('pvp-phase-result').classList.remove('hidden');

    const p1Choice = pvpState.p1Choice;
    const p2Choice = pvpState.p2Choice;

    document.getElementById('pvp-result-p1-name').textContent = pvpState.p1Name;
    document.getElementById('pvp-result-p2-name').textContent = pvpState.p2Name;
    document.getElementById('pvp-result-p1-hand').textContent = CHOICES[p1Choice].emoji;
    document.getElementById('pvp-result-p2-hand').textContent = CHOICES[p2Choice].emoji;

    const resultText = document.getElementById('pvp-result-text');
    const resultCoins = document.getElementById('pvp-result-coins');

    let winner = 0;
    if (p1Choice === p2Choice) {
        winner = 0;
    } else if (CHOICES[p1Choice].beats === p2Choice) {
        winner = 1;
    } else {
        winner = 2;
    }

    if (winner === 1) {
        resultText.textContent = `🎉 ${pvpState.p1Name} 승리!`;
        resultText.className = 'result-text win pop';
        resultCoins.textContent = `승자 🪙 +${pvpState.betAmount.toLocaleString()} 코인 획득`;
        if (currentUser.nickname === pvpState.p1Name) {
            currentUser.coins += pvpState.betAmount;
            currentUser.wins++;
        } else {
            currentUser.coins -= pvpState.betAmount;
            currentUser.losses++;
        }
    } else if (winner === 2) {
        resultText.textContent = `🎉 ${pvpState.p2Name} 승리!`;
        resultText.className = 'result-text win pop';
        resultCoins.textContent = `승자 🪙 +${pvpState.betAmount.toLocaleString()} 코인 획득`;
        if (currentUser.nickname === pvpState.p2Name) {
            currentUser.coins += pvpState.betAmount;
            currentUser.wins++;
        } else {
            currentUser.coins -= pvpState.betAmount;
            currentUser.losses++;
        }
    } else {
        resultText.textContent = '🤝 무승부!';
        resultText.className = 'result-text draw pop';
        resultCoins.textContent = '배팅 코인 보존';
        currentUser.draws++;
    }

    updateUserData();
}

function pvpRematch() {
    pvpState.p1Choice = null;
    pvpState.p2Choice = null;

    document.getElementById('pvp-phase-result').classList.add('hidden');
    document.getElementById('pvp-phase-p1').classList.remove('hidden');
}

function exitRoom() {
    if (currentRoom) {
        // 내가 방장인 경우 방 전체 삭제 처리
        if (currentUser && currentRoom.hostId === currentUser.id) {
            deleteRoom(currentRoom.id);
            showToast('방장이 나갔으므로 대전방이 삭제되었습니다.');
        } else {
            showToast('대전방에서 퇴장하셨습니다.');
        }
        currentRoom = null;
    }
    showScreen('screen-rooms');
}

function endPvp() {
    exitRoom();
}

// ===== PROFILE & RANKING =====
function renderProfile() {
    if (!currentUser) return;
    document.getElementById('profile-nickname').textContent = currentUser.nickname;
    document.getElementById('profile-id').textContent = `@${currentUser.id}`;
    document.getElementById('profile-coins').textContent = currentUser.coins.toLocaleString();

    const total = currentUser.wins + currentUser.losses + currentUser.draws;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-wins').textContent = currentUser.wins;
    document.getElementById('stat-losses').textContent = currentUser.losses;
    document.getElementById('stat-draws').textContent = currentUser.draws;

    const winrate = total > 0 ? Math.round((currentUser.wins / total) * 100) : 0;
    document.getElementById('winrate-fill').style.width = `${winrate}%`;
    document.getElementById('winrate-value').textContent = `${winrate}%`;

    const list = document.getElementById('profile-history-list');
    if (!currentUser.history || currentUser.history.length === 0) {
        list.innerHTML = '<div class="history-empty">전적 기록이 없습니다</div>';
        return;
    }

    list.innerHTML = currentUser.history.map(item => {
        const resultLabel = { win: '승리', lose: '패배', draw: '무승부' };
        return `
            <div class="history-item">
                <span class="history-round">${item.date}</span>
                <div class="history-hands">
                    <span>${CHOICES[item.playerChoice].emoji}</span>
                    <span class="history-vs">VS</span>
                    <span>${CHOICES[item.opponentChoice].emoji}</span>
                </div>
                <span class="history-result ${item.outcome}">${resultLabel[item.outcome]} (${item.bet}🪙)</span>
            </div>
        `;
    }).join('');
}

function renderRanking() {
    const usersObj = getStorageUsers();
    const sorted = Object.values(usersObj).sort((a, b) => b.coins - a.coins).slice(0, 10);
    const list = document.getElementById('ranking-list');

    if (sorted.length === 0) {
        list.innerHTML = '<div class="history-empty">랭킹 정보가 없습니다.</div>';
        return;
    }

    list.innerHTML = sorted.map((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        return `
            <div class="ranking-card glass-card">
                <div class="ranking-rank">${medal}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${escapeHtml(user.nickname)}</div>
                    <div class="ranking-sub">${user.wins}승 ${user.losses}패 ${user.draws}무</div>
                </div>
                <div class="ranking-coins">🪙 ${user.coins.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

// ===== ADMIN DASHBOARD LOGIC (관리자 전용 기능) =====
function renderAdminDashboard() {
    if (!currentUser || (currentUser.id !== ADMIN_ID && !currentUser.isAdmin)) {
        showToast('관리자 권한이 필요합니다!');
        showScreen('screen-lobby');
        return;
    }

    const users = getStorageUsers();
    const adminList = document.getElementById('admin-user-list');

    const userKeys = Object.keys(users);
    if (userKeys.length === 0) {
        adminList.innerHTML = '<div class="history-empty">등록된 유저가 없습니다.</div>';
        return;
    }

    adminList.innerHTML = userKeys.map(id => {
        const u = users[id];
        const isAdminAccount = u.id === ADMIN_ID;
        const titleBadge = u.title ? `<span class="user-custom-title" style="background:${u.titleBg || 'var(--accent-purple)'}">${escapeHtml(u.title)}</span>` : '';
        const nameColorStyle = u.nameColor ? `style="color:${u.nameColor}"` : '';

        return `
            <div class="admin-user-card glass-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        ${titleBadge}
                        <span ${nameColorStyle}>${escapeHtml(u.nickname)}</span>
                        <span class="admin-user-id">(@${escapeHtml(u.id)})</span>
                        ${isAdminAccount ? '<span class="admin-tag">관리자</span>' : ''}
                    </div>
                    <div class="admin-user-meta">
                        보유 코인: 🪙 <strong>${u.coins.toLocaleString()}</strong> | 전적: ${u.wins}승 ${u.losses}패 ${u.draws}무
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="btn-admin-act btn-edit-nick" onclick="adminEditNickname('${u.id}')">✏️ 닉네임</button>
                    <button class="btn-admin-act btn-edit-title" onclick="adminEditTitle('${u.id}')">🏷️ 칭호 설정</button>
                    <button class="btn-admin-act btn-edit-color" onclick="adminEditColor('${u.id}')">🎨 닉네임 색상</button>
                    <button class="btn-admin-act btn-add-coin" onclick="adminAddCoins('${u.id}')">🪙 코인 지급/차감</button>
                    ${!isAdminAccount ? `<button class="btn-admin-act btn-delete-user" onclick="adminDeleteUser('${u.id}')">🗑️ 계정 삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 칭호 설정
function adminEditTitle(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const newTitle = prompt(`[@${userId}] 님에게 부여할 칭호를 입력하세요 (빈칸 입력 시 제거):`, u.title || '전설의 승부사');
    if (newTitle !== null) {
        u.title = newTitle.trim();
        if (u.title) {
            const bg = prompt('칭호 배경 색상 코드(HEX/RGB) 또는 색상이름을 입력하세요:', u.titleBg || '#ff4081');
            if (bg) u.titleBg = bg.trim();
        }
        saveStorageUsers(users);
        if (currentUser.id === userId) currentUser.title = u.title;
        showToast(`[@${userId}] 님의 칭호가 '${u.title || '없음'}'(으)로 설정되었습니다.`);
        renderAdminDashboard();
    }
}

// 닉네임 색상 설정
function adminEditColor(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const newColor = prompt(`[@${userId}] 님의 닉네임 글자 색상을 입력하세요 (예: #00e5ff, #ffab40, yellow, cyan) (빈칸 입력 시 기본값):`, u.nameColor || '#00e5ff');
    if (newColor !== null) {
        u.nameColor = newColor.trim();
        saveStorageUsers(users);
        if (currentUser.id === userId) currentUser.nameColor = u.nameColor;
        showToast(`[@${userId}] 님의 닉네임 색상이 변경되었습니다.`);
        renderAdminDashboard();
    }
}

// 1. 유저 계정 삭제
function adminDeleteUser(userId) {
    if (userId === ADMIN_ID) {
        showToast('관리자 본인 계정은 삭제할 수 없습니다!');
        return;
    }

    if (confirm(`정말로 아이디 [@${userId}] 계정을 삭제하시겠습니까?`)) {
        const users = getStorageUsers();
        delete users[userId];
        saveStorageUsers(users);

        showToast(`계정 [@${userId}] 이(가) 성공적으로 삭제되었습니다.`);
        renderAdminDashboard();
    }
}

// 2. 닉네임 변경
function adminEditNickname(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const newNick = prompt(`[@${userId}] 님의 변경할 새 닉네임을 입력하세요:`, u.nickname);
    if (newNick && newNick.trim() !== '') {
        u.nickname = newNick.trim();
        saveStorageUsers(users);

        if (currentUser.id === userId) {
            currentUser.nickname = u.nickname;
        }

        showToast(`닉네임이 '${u.nickname}'(으)로 변경되었습니다.`);
        renderAdminDashboard();
    }
}

// 3. 코인 추가/차감
function adminAddCoins(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const amountStr = prompt(`[@${userId}] 님에게 추가(지급)할 코인 수량을 입력하세요.\n(차감하려면 음수 입력 ex: -500):`, '1000');
    if (amountStr !== null) {
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount)) {
            showToast('올바른 숫자를 입력하세요.');
            return;
        }

        u.coins = Math.max(0, u.coins + amount);
        saveStorageUsers(users);

        if (currentUser.id === userId) {
            currentUser.coins = u.coins;
        }

        showToast(`[@${userId}] 님의 코인이 ${amount >= 0 ? '+' : ''}${amount.toLocaleString()} 🪙 변경되었습니다.`);
        renderAdminDashboard();
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    getStorageUsers();
    getStorageRooms();
});
