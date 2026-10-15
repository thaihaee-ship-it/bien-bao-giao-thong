// ============================================
// APP BIỂN BÁO GIAO THÔNG
// ============================================

const APP = {
    db: null,
    signs: [],
    editingId: null,
    quiz: null,
    firebaseReady: false,
    currentImageBase64: null
};

// ============================================
// INDEXED DB
// ============================================

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('BienBaoGTDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('signs')) {
                db.createObjectStore('signs', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
        req.onsuccess = () => { APP.db = req.result; resolve(); };
        req.onerror = () => reject(req.error);
    });
}

function dbStore(name, mode) {
    return APP.db.transaction(name, mode).objectStore(name);
}

function dbGetAll(store) {
    return new Promise((resolve, reject) => {
        const req = dbStore(store, 'readonly').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbGet(store, key) {
    return new Promise((resolve, reject) => {
        const req = dbStore(store, 'readonly').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbPut(store, data) {
    return new Promise((resolve, reject) => {
        const req = dbStore(store, 'readwrite').put(data);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function dbDelete(store, id) {
    return new Promise((resolve, reject) => {
        const req = dbStore(store, 'readwrite').delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function dbClear(store) {
    return new Promise((resolve, reject) => {
        const req = dbStore(store, 'readwrite').clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// XỬ LÝ ẢNH
// ============================================

function processImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 600;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = () => reject(new Error('Không đọc được ảnh'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Không đọc được file'));
        reader.readAsDataURL(file);
    });
}

// ============================================
// ĐIỀU HƯỚNG
// ============================================

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    document.getElementById('page-' + page).classList.add('active');
    const navBtn = document.querySelector('.nav-btn[data-page="' + page + '"]');
    if (navBtn) navBtn.classList.add('active');

    const titles = {
        home: 'Biển Báo GT',
        manage: 'Quản lý biển báo',
        quiz: 'Trắc nghiệm',
        settings: 'Cài đặt'
    };
    document.getElementById('header-title').textContent = titles[page] || 'Biển Báo GT';

    if (page === 'home') updateStats();
    if (page === 'manage') renderSignsList();
}

// ============================================
// TOAST
// ============================================

let toastTimer = null;

function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ============================================
// THỐNG KÊ
// ============================================

async function updateStats() {
    const signs = await dbGetAll('signs');
    APP.signs = signs;

    const total = signs.length;
    let correct = 0, wrong = 0;
    signs.forEach(s => {
        correct += s.correctCount || 0;
        wrong += s.wrongCount || 0;
    });
    const rate = (correct + wrong) > 0 ? Math.round(correct / (correct + wrong) * 100) : 0;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-correct').textContent = correct;
    document.getElementById('stat-wrong').textContent = wrong;
    document.getElementById('stat-rate').textContent = rate + '%';

    const btn = document.getElementById('btn-start-quiz');
    btn.disabled = total === 0;
    btn.textContent = total === 0 ? 'Thêm biển báo trước' : 'Bắt đầu trắc nghiệm';

    const el = document.getElementById('data-size');
    if (el) {
        let dataSize = 0;
        signs.forEach(s => { dataSize += (s.image || '').length; });
        const sizeMB = (dataSize / 1024 / 1024).toFixed(1);
        el.textContent = total + ' biển báo — ~' + sizeMB + ' MB dữ liệu';
    }
}

// ============================================
// QUẢN LÝ BIỂN BÁO
// ============================================

async function renderSignsList() {
    const signs = await dbGetAll('signs');
    APP.signs = signs;
    const container = document.getElementById('signs-list');

    if (signs.length === 0) {
        container.innerHTML =
            '<div class="empty-state">' +
                '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>' +
                '<p>Chưa có biển báo nào</p>' +
                '<p>Bấm nút + để thêm biển báo đầu tiên</p>' +
            '</div>';
        return;
    }

    let html = '';
    for (const s of signs) {
        html +=
            '<div class="sign-item" data-testid="sign-item-' + s.id + '">' +
                '<img src="' + s.image + '" alt="' + escapeHtml(s.correctAnswer) + '">' +
                '<div class="sign-info">' +
                    '<div class="sign-name">' + escapeHtml(s.correctAnswer) + '</div>' +
                    '<div class="sign-stats">Đúng: ' + (s.correctCount || 0) + ' | Sai: ' + (s.wrongCount || 0) + '</div>' +
                '</div>' +
                '<div class="sign-actions">' +
                    '<button onclick="openEditModal(' + s.id + ')" data-testid="btn-edit-' + s.id + '" title="Sửa">&#9998;</button>' +
                    '<button onclick="confirmDeleteSign(' + s.id + ')" data-testid="btn-delete-' + s.id + '" title="Xóa">&#128465;</button>' +
                '</div>' +
            '</div>';
    }
    container.innerHTML = html;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// MODAL THÊM/SỬA BIỂN BÁO
// ============================================

function openAddModal() {
    APP.editingId = null;
    APP.currentImageBase64 = null;
    document.getElementById('modal-title').textContent = 'Thêm biển báo';
    document.getElementById('input-correct').value = '';
    document.getElementById('input-wrong1').value = '';
    document.getElementById('input-wrong2').value = '';
    document.getElementById('input-wrong3').value = '';
    document.getElementById('image-preview').innerHTML = '<span>Chạm để chọn ảnh</span>';
    document.getElementById('modal-sign').style.display = 'flex';
}

async function openEditModal(id) {
    const sign = await dbGet('signs', id);
    if (!sign) return;

    APP.editingId = id;
    APP.currentImageBase64 = sign.image;
    document.getElementById('modal-title').textContent = 'Sửa biển báo';
    document.getElementById('input-correct').value = sign.correctAnswer;
    document.getElementById('input-wrong1').value = sign.wrongAnswers[0] || '';
    document.getElementById('input-wrong2').value = sign.wrongAnswers[1] || '';
    document.getElementById('input-wrong3').value = sign.wrongAnswers[2] || '';
    document.getElementById('image-preview').innerHTML = '<img src="' + sign.image + '" alt="Preview">';
    document.getElementById('modal-sign').style.display = 'flex';
}

function closeSignModal() {
    document.getElementById('modal-sign').style.display = 'none';
    document.getElementById('file-image').value = '';
}

async function saveSign() {
    const correct = document.getElementById('input-correct').value.trim();
    const wrong1 = document.getElementById('input-wrong1').value.trim();
    const wrong2 = document.getElementById('input-wrong2').value.trim();
    const wrong3 = document.getElementById('input-wrong3').value.trim();

    if (!APP.currentImageBase64) { showToast('Chưa chọn ảnh!', 'error'); return; }
    if (!correct) { showToast('Chưa nhập đáp án đúng!', 'error'); return; }
    if (!wrong1 || !wrong2 || !wrong3) { showToast('Cần nhập đủ 3 đáp án sai!', 'error'); return; }

    const sign = {
        image: APP.currentImageBase64,
        correctAnswer: correct,
        wrongAnswers: [wrong1, wrong2, wrong3],
        updatedAt: Date.now()
    };

    if (APP.editingId) {
        const existing = await dbGet('signs', APP.editingId);
        sign.id = APP.editingId;
        sign.correctCount = existing ? existing.correctCount || 0 : 0;
        sign.wrongCount = existing ? existing.wrongCount || 0 : 0;
        sign.createdAt = existing ? existing.createdAt : Date.now();
        sign.lastAskedAt = existing ? existing.lastAskedAt : 0;
    } else {
        sign.correctCount = 0;
        sign.wrongCount = 0;
        sign.createdAt = Date.now();
        sign.lastAskedAt = 0;
    }

    await dbPut('signs', sign);
    closeSignModal();
    showToast(APP.editingId ? 'Đã cập nhật!' : 'Đã thêm biển báo!', 'success');
    renderSignsList();
    trySyncFirebase();
}

async function confirmDeleteSign(id) {
    if (!confirm('Xóa biển báo này?')) return;
    await dbDelete('signs', id);
    showToast('Đã xóa!', 'success');
    renderSignsList();
    trySyncFirebase();
}

// ============================================
// TRẮC NGHIỆM
// ============================================

async function startQuiz(mode) {
    const signs = await dbGetAll('signs');
    APP.signs = signs;

    if (signs.length === 0) {
        showToast('Chưa có biển báo nào!', 'error');
        return;
    }

    let selected;
    const countSetting = parseInt(document.getElementById('quiz-count').value);
    const count = countSetting === 0 ? signs.length : Math.min(countSetting, signs.length);

    if (mode === 'review-wrong' && APP.quiz && APP.quiz.wrongIds.length > 0) {
        selected = signs.filter(s => APP.quiz.wrongIds.includes(s.id));
    } else {
        selected = selectSmartSigns(signs, count);
    }

    shuffle(selected);

    APP.quiz = {
        signs: selected,
        current: 0,
        correct: 0,
        wrong: 0,
        wrongIds: [],
        answered: false
    };

    document.getElementById('quiz-container').style.display = 'block';
    document.getElementById('quiz-result').style.display = 'none';
    showQuestion(0);
    navigateTo('quiz');
}

function selectSmartSigns(signs, count) {
    const weighted = signs.map(s => {
        let weight;
        if ((s.correctCount || 0) === 0 && (s.wrongCount || 0) === 0) {
            weight = 3;
        } else {
            weight = Math.max(0.5, ((s.wrongCount || 0) * 2 + 1) / ((s.correctCount || 0) + 1));
        }
        weight *= 0.8 + Math.random() * 0.4;
        return { sign: s, weight: weight };
    });

    weighted.sort((a, b) => b.weight - a.weight);
    return weighted.slice(0, count).map(w => w.sign);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
}

function showQuestion(index) {
    const q = APP.quiz;
    const sign = q.signs[index];
    q.current = index;
    q.answered = false;

    document.getElementById('quiz-current').textContent = index + 1;
    document.getElementById('quiz-total').textContent = q.signs.length;
    document.getElementById('quiz-image').src = sign.image;
    document.getElementById('btn-next').style.display = 'none';

    const answers = [
        { text: sign.correctAnswer, correct: true },
        { text: sign.wrongAnswers[0], correct: false },
        { text: sign.wrongAnswers[1], correct: false },
        { text: sign.wrongAnswers[2], correct: false }
    ];
    shuffle(answers);

    const container = document.getElementById('quiz-answers');
    container.innerHTML = '';
    answers.forEach((a, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.setAttribute('data-testid', 'answer-' + i);
        btn.setAttribute('data-correct', a.correct);
        btn.textContent = a.text;
        btn.addEventListener('click', () => checkAnswer(btn, a.correct, sign.id));
        container.appendChild(btn);
    });
}

async function checkAnswer(btn, isCorrect, signId) {
    if (APP.quiz.answered) return;
    APP.quiz.answered = true;

    const allBtns = document.querySelectorAll('.answer-btn');
    allBtns.forEach(b => {
        b.classList.add('disabled');
        if (b.getAttribute('data-correct') === 'true') b.classList.add('correct');
    });

    if (isCorrect) {
        APP.quiz.correct++;
    } else {
        APP.quiz.wrong++;
        btn.classList.add('wrong');
        APP.quiz.wrongIds.push(signId);
    }

    const sign = await dbGet('signs', signId);
    if (sign) {
        if (isCorrect) sign.correctCount = (sign.correctCount || 0) + 1;
        else sign.wrongCount = (sign.wrongCount || 0) + 1;
        sign.lastAskedAt = Date.now();
        await dbPut('signs', sign);
    }

    if (APP.quiz.current < APP.quiz.signs.length - 1) {
        document.getElementById('btn-next').style.display = 'block';
    } else {
        setTimeout(showQuizResult, 600);
    }
}

function nextQuestion() {
    showQuestion(APP.quiz.current + 1);
}

function showQuizResult() {
    const q = APP.quiz;
    document.getElementById('quiz-container').style.display = 'none';
    document.getElementById('quiz-result').style.display = 'block';

    const total = q.correct + q.wrong;
    const rate = total > 0 ? Math.round(q.correct / total * 100) : 0;
    document.getElementById('result-score').innerHTML =
        q.correct + '/' + total +
        '<span class="rate">' + rate + '% đúng</span>';

    const btnReview = document.getElementById('btn-review-wrong');
    if (q.wrongIds.length > 0) {
        btnReview.style.display = 'block';
        btnReview.textContent = 'Ôn lại ' + q.wrongIds.length + ' biển sai';
    } else {
        btnReview.style.display = 'none';
    }

    trySyncFirebase();
}

// ============================================
// XUẤT / NHẬP DỮ LIỆU
// ============================================

async function exportData() {
    const signs = await dbGetAll('signs');
    if (signs.length === 0) {
        showToast('Không có dữ liệu để xuất!', 'error');
        return;
    }

    const data = {
        app: 'BienBaoGT',
        version: 1,
        exportedAt: new Date().toISOString(),
        count: signs.length,
        signs: signs
    };

    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bien-bao-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Đã xuất ' + signs.length + ' biển báo!', 'success');
}

async function importData(file) {
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.signs || !Array.isArray(data.signs)) {
            showToast('File không hợp lệ!', 'error');
            return;
        }

        if (!confirm('Nhập ' + data.signs.length + ' biển báo?\n(Sẽ thêm vào dữ liệu hiện có)')) return;

        let count = 0;
        for (const sign of data.signs) {
            const newSign = Object.assign({}, sign);
            delete newSign.id;
            newSign.updatedAt = Date.now();
            await dbPut('signs', newSign);
            count++;
        }

        showToast('Đã nhập ' + count + ' biển báo!', 'success');
        await renderSignsList();
        await updateStats();
        trySyncFirebase();
    } catch (e) {
        showToast('Lỗi đọc file: ' + e.message, 'error');
    }
}

async function clearAllData() {
    const signs = await dbGetAll('signs');
    if (signs.length === 0) {
        showToast('Không có dữ liệu!', 'error');
        return;
    }

    if (!confirm('Xóa tất cả ' + signs.length + ' biển báo?\nHành động này không thể hoàn tác!')) return;
    if (!confirm('Bạn chắc chắn muốn xóa hết?')) return;

    await dbClear('signs');
    showToast('Đã xóa tất cả dữ liệu!', 'success');
    await renderSignsList();
    await updateStats();
}

// ============================================
// FIREBASE ĐỒNG BỘ
// ============================================

async function loadFirebaseConfig() {
    try {
        const setting = await dbGet('settings', 'firebaseConfig');
        return setting ? setting.value : null;
    } catch (e) { return null; }
}

async function saveFirebaseConfigToDB(config) {
    await dbPut('settings', { key: 'firebaseConfig', value: config });
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Không tải được: ' + src));
        document.head.appendChild(s);
    });
}

async function initFirebase(config) {
    try {
        await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js');
        await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');

        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                updateFirebaseStatus('Đã đăng nhập: ' + user.email, true);
                document.getElementById('btn-firebase-sync').disabled = false;
            } else {
                updateFirebaseStatus('Đã kết nối. Bấm "Đồng bộ ngay" để đăng nhập.', false);
                document.getElementById('btn-firebase-sync').disabled = false;
            }
        });

        APP.firebaseReady = true;
    } catch (e) {
        updateFirebaseStatus('Lỗi: ' + e.message, false);
    }
}

async function firebaseSignIn() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(provider);
        return true;
    } catch (e) {
        if (e.code !== 'auth/popup-closed-by-user') {
            showToast('Lỗi đăng nhập: ' + e.message, 'error');
        }
        return false;
    }
}

async function syncFirebase() {
    if (!APP.firebaseReady) {
        showToast('Chưa cấu hình Firebase!', 'error');
        return;
    }

    let user = firebase.auth().currentUser;
    if (!user) {
        const ok = await firebaseSignIn();
        if (!ok) return;
        user = firebase.auth().currentUser;
    }

    updateFirebaseStatus('Đang đồng bộ...', false);

    try {
        const db = firebase.firestore();
        const localSigns = await dbGetAll('signs');
        const userRef = db.collection('users').doc(user.uid).collection('signs');

        const snapshot = await userRef.get();
        const remoteSigns = {};
        snapshot.forEach(doc => { remoteSigns[doc.id] = doc.data(); });

        let uploaded = 0, downloaded = 0;

        for (const sign of localSigns) {
            const key = 'local_' + sign.id;
            const remote = remoteSigns[key];

            if (!remote || (sign.updatedAt || 0) > (remote.updatedAt || 0)) {
                const data = Object.assign({}, sign);
                delete data.id;
                await userRef.doc(key).set(data);
                uploaded++;
            }
            delete remoteSigns[key];
        }

        for (const key of Object.keys(remoteSigns)) {
            const remote = remoteSigns[key];
            const newSign = Object.assign({}, remote);
            delete newSign.id;
            newSign.updatedAt = Date.now();
            await dbPut('signs', newSign);
            downloaded++;
        }

        updateFirebaseStatus(
            'Đồng bộ thành công! (' + user.email + ')' +
            (uploaded > 0 ? ' | Lên: ' + uploaded : '') +
            (downloaded > 0 ? ' | Xuống: ' + downloaded : ''),
            true
        );

        if (downloaded > 0) {
            showToast('Đã tải ' + downloaded + ' biển báo từ Firebase!', 'success');
            await renderSignsList();
            await updateStats();
        } else {
            showToast('Đồng bộ thành công!', 'success');
        }
    } catch (e) {
        updateFirebaseStatus('Lỗi đồng bộ: ' + e.message, false);
        showToast('Lỗi đồng bộ!', 'error');
    }
}

function trySyncFirebase() {
    if (APP.firebaseReady && navigator.onLine && typeof firebase !== 'undefined' && firebase.auth().currentUser) {
        syncFirebase();
    }
}

function updateFirebaseStatus(text, connected) {
    const el = document.getElementById('firebase-status');
    el.textContent = text;
    el.className = connected ? 'connected' : '';
}

function openFirebaseModal() {
    document.getElementById('modal-firebase').style.display = 'flex';
}

function closeFirebaseModal() {
    document.getElementById('modal-firebase').style.display = 'none';
}

async function saveFirebaseConfigUI() {
    const input = document.getElementById('firebase-config-input').value.trim();

    let config;
    try {
        const cleaned = input.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/'/g, '"');
        config = JSON.parse(cleaned.includes('{') ? cleaned : '{' + cleaned + '}');
    } catch (e) {
        try { config = JSON.parse(input); } catch (e2) {
            showToast('JSON không hợp lệ!', 'error');
            return;
        }
    }

    if (!config.apiKey || !config.projectId) {
        showToast('Cần có apiKey và projectId!', 'error');
        return;
    }

    await saveFirebaseConfigToDB(config);
    await initFirebase(config);
    closeFirebaseModal();
    showToast('Đã lưu cấu hình Firebase!', 'success');
}

// ============================================
// CÀI ĐẶT
// ============================================

async function loadSettings() {
    try {
        const qc = await dbGet('settings', 'quizCount');
        if (qc) document.getElementById('quiz-count').value = qc.value;
    } catch (e) {}
}

async function saveQuizCount(value) {
    await dbPut('settings', { key: 'quizCount', value: value });
}

// ============================================
// SỰ KIỆN
// ============================================

function setupEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-page')));
    });

    document.getElementById('btn-start-quiz').addEventListener('click', () => startQuiz('normal'));
    document.getElementById('btn-add-sign').addEventListener('click', openAddModal);

    document.getElementById('image-preview').addEventListener('click', () => {
        document.getElementById('file-image').click();
    });

    document.getElementById('file-image').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            APP.currentImageBase64 = await processImage(file);
            document.getElementById('image-preview').innerHTML =
                '<img src="' + APP.currentImageBase64 + '" alt="Preview">';
        } catch (err) {
            showToast('Lỗi xử lý ảnh!', 'error');
        }
    });

    document.getElementById('btn-save-sign').addEventListener('click', saveSign);

    document.getElementById('modal-sign').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSignModal();
    });

    document.getElementById('btn-next').addEventListener('click', nextQuestion);
    document.getElementById('btn-retry').addEventListener('click', () => startQuiz('normal'));
    document.getElementById('btn-review-wrong').addEventListener('click', () => startQuiz('review-wrong'));

    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('file-import').click();
    });
    document.getElementById('file-import').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) importData(file);
        e.target.value = '';
    });

    document.getElementById('btn-clear-data').addEventListener('click', clearAllData);

    document.getElementById('quiz-count').addEventListener('change', (e) => {
        saveQuizCount(e.target.value);
    });

    document.getElementById('btn-firebase-config').addEventListener('click', openFirebaseModal);
    document.getElementById('btn-firebase-sync').addEventListener('click', syncFirebase);
    document.getElementById('btn-firebase-save').addEventListener('click', saveFirebaseConfigUI);
    document.getElementById('modal-firebase').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeFirebaseModal();
    });

    window.addEventListener('online', trySyncFirebase);
}

// ============================================
// KHỞI TẠO
// ============================================

async function init() {
    await openDB();
    await loadSettings();
    await updateStats();
    setupEvents();

    const fbConfig = await loadFirebaseConfig();
    if (fbConfig) {
        initFirebase(fbConfig);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

init();
