import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxwxDkLTyVpXANDJPIpOC-5YHLtoDoqTs",
    authDomain: "tugas-herr-khana.firebaseapp.com",
    databaseURL: "https://tugas-herr-khana-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tugas-herr-khana",
    storageBucket: "tugas-herr-khana.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentPlayerId = localStorage.getItem("myPlayerId");
if (!currentPlayerId || currentPlayerId === "mc") {
    currentPlayerId = "player_" + Math.floor(Math.random() * 1000000);
    localStorage.setItem("myPlayerId", currentPlayerId);
}

const isMC = new URLSearchParams(window.location.search).get('role') === 'mc';
const devRoleSelect = document.getElementById("dev-role-select");

if (isMC) {
    devRoleSelect.value = "mc";
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("mc-screen").classList.remove("hidden");
} else {
    if (devRoleSelect.querySelector(`option[value="${currentPlayerId}"]`)) {
        devRoleSelect.value = currentPlayerId;
    }
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("player-screen").classList.remove("hidden");
}

devRoleSelect.addEventListener("change", (e) => {
    if (e.target.value === "mc") {
        window.location.href = "?role=mc";
    } else {
        localStorage.setItem("myPlayerId", e.target.value);
        window.location.href = "?";
    }
});

const rollenUebersetzung = {
    "Werewolf": "Werewolf 🐺",
    "Villager": "Warga Desa 🧑‍🌾",
    "Guardian": "Pelindung (Guardian) 🛡️",
    "Seer": "Penerawang (Seer) 🔮",
    "Witch": "Penyihir (Witch) 🧪",
    "Belum ada": "Menunggu pembagian peran..."
};

let currentGameState = "lobby";
let allPlayers = {};
let currentNightActions = {};
let currentDayVotes = {};
let currentPlayerData = null;

// GANTI FUNGSI renderPlayerUI dengan versi yang lebih 'bebas' ini:
function renderPlayerUI() {
    if (isMC) return;
    
    document.getElementById("lobby-registration-panel").classList.add("hidden");
    document.getElementById("lobby-waiting-panel").classList.add("hidden");
    document.getElementById("gameplay-role-panel").classList.add("hidden");
    document.getElementById("dead-screen").classList.add("hidden");

    if (!currentPlayerData || !currentPlayerData.name) {
        document.getElementById("lobby-registration-panel").classList.remove("hidden");
        return;
    } 
    
    if (currentGameState === "lobby") {
        document.getElementById("lobby-waiting-panel").classList.remove("hidden");
        document.getElementById("waiting-player-name").innerText = currentPlayerData.name;
    } else {
        if (currentPlayerData.isDead) {
            document.getElementById("dead-screen").classList.remove("hidden");
        } else {
            document.getElementById("gameplay-role-panel").classList.remove("hidden");
            document.getElementById("player-role").innerText = rollenUebersetzung[currentPlayerData.role] || currentPlayerData.role;
            
            const phaseIndicator = document.getElementById("phase-indicator");
            const phaseName = document.getElementById("phase-name");
            phaseIndicator.classList.remove("hidden", "phase-night", "phase-day");
            
            // RESET SEMUA KONTROL
            document.getElementById("action-werwolf").classList.add("hidden");
            document.getElementById("action-guardian").classList.add("hidden");
            document.getElementById("action-day-vote").classList.add("hidden");
            const waitMsg = document.getElementById("action-wait-message");
            waitMsg.classList.remove("hidden");

            // LOGIKA FASE YANG BEBAS (Tidak perlu menunggu kejadian)
            if (currentGameState === "nacht") {
                phaseIndicator.classList.add("phase-night");
                phaseName.innerText = "🌙 Malam Hari";

                if (currentPlayerData.role === "Werewolf") {
                    document.getElementById("action-werwolf").classList.remove("hidden");
                    waitMsg.classList.add("hidden");
                } else if (currentPlayerData.role === "Guardian") {
                    document.getElementById("action-guardian").classList.remove("hidden");
                    waitMsg.classList.add("hidden");
                } else {
                    waitMsg.innerText = "Malam hari... Tetap tenang.";
                }
            } else if (currentGameState === "tag") {
                phaseIndicator.classList.add("phase-day");
                phaseName.innerText = "☀️ Siang Hari - DISKUSI & VOTE";
                waitMsg.classList.add("hidden");
                
                // TOMBOL VOTE SEKARANG MUNCUL OTOMATIS SAAT MC PINDAH KE FASE SIANG
                document.getElementById("action-day-vote").classList.remove("hidden");
            }
        }
    }
}

// --- TAMBAHKAN FUNGSI INI DI SCRIPT.JS ---
// Fungsi untuk memicu kemenangan ke semua orang via Firebase
function triggerWin(winner, subMsg) {
    update(ref(db), { 
        gameState: "ended",
        winData: { winner: winner, subMsg: subMsg } // Simpan data pemenang di DB
    });
}

// --- UPDATE FUNGSI checkWinConditions ---
function checkWinConditions() {
    const players = Object.values(allPlayers);
    const alivePlayers = players.filter(p => !p.isDead);
    
    const aliveWerewolves = alivePlayers.filter(p => p.role === "Werewolf");
    const aliveVillagers = alivePlayers.filter(p => p.role !== "Werewolf");

    if (aliveWerewolves.length === 0) {
        triggerWin("WARGA DESA MENANG! 🧑‍🌾", "Semua Werewolf berhasil disingkirkan.");
    } else if (aliveWerewolves.length >= aliveVillagers.length) {
        triggerWin("WEREWOLF MENANG! 🐺", "Jumlah Werewolf sudah setara dengan penduduk.");
    }
}

// --- UPDATE FUNGSI RESOLVE MALAM (MC) ---
document.getElementById("btn-resolve-night").addEventListener("click", () => {
    const wTarget = currentNightActions.wolfTarget;
    const gTarget = currentNightActions.guardianTarget;
    
    let updates = { gameState: "tag", nightActions: { wolfTarget: "", guardianTarget: "" }, votes: null };

    if (wTarget && wTarget !== gTarget) {
        updates[`players/${wTarget}/isDead`] = true;
        // Panggil pengecekan kemenangan setelah update
    }
    
    update(ref(db), updates).then(() => {
        if (wTarget && wTarget !== gTarget) checkWinConditions();
    });
});

// --- UPDATE FUNGSI EKSEKUSI SIANG (MC) ---
document.getElementById("btn-mc-execute").addEventListener("click", () => {
    const targetId = document.getElementById("mc-execute-select").value;
    if(!targetId) return;

    const updates = {
        [`players/${targetId}/isDead`]: true,
        gameState: "nacht",
        nightActions: { wolfTarget: "", guardianTarget: "" },
        votes: null
    };

    update(ref(db), updates).then(() => {
        checkWinConditions(); // Cek apakah setelah eksekusi permainan berakhir
    });
});
onValue(ref(db, "gameState"), (snap) => {
    currentGameState = snap.val() || "lobby";
    
    // TAMBAHKAN INI: Listener untuk kondisi Menang
    if (currentGameState === "ended") {
        onValue(ref(db, "winData"), (snap) => {
            const data = snap.val();
            if (data) {
                document.getElementById("win-screen").classList.remove("hidden");
                document.getElementById("win-message").innerText = data.winner;
                document.getElementById("win-submessage").innerText = data.subMsg;
            }
        });
        return; // Hentikan proses lain
    }

    if (isMC) {
        // ... (kode MC yang lama tetap di sini)
    } else {
        renderPlayerUI();
    }
});
onValue(ref(db, `players/${currentPlayerId}`), (snapshot) => {
    currentPlayerData = snapshot.val();
    renderPlayerUI();
});

// Update Menu Dropdown untuk Voting & Aksi
onValue(ref(db, "players"), (snapshot) => {
    allPlayers = snapshot.val() || {};
    const playerIds = Object.keys(allPlayers);
    
    if (isMC) {
        document.getElementById("player-count-badge").innerText = playerIds.length;
        const mcList = document.getElementById("mc-players-list");
        mcList.innerHTML = "";
        playerIds.forEach((id) => {
            const p = allPlayers[id];
            mcList.innerHTML += `<li>${p.name} [${rollenUebersetzung[p.role] || p.role}] ${p.isDead ? '💀 (Mati)' : '💚 (Hidup)'}</li>`;
        });
    }

    const wSelect = document.getElementById("wolf-target-select");
    const gSelect = document.getElementById("guardian-target-select");
    const dSelect = document.getElementById("day-vote-select");
    const mcExecSelect = document.getElementById("mc-execute-select");

    if (wSelect && gSelect && dSelect && mcExecSelect) {
        wSelect.innerHTML = ""; gSelect.innerHTML = ""; dSelect.innerHTML = ""; mcExecSelect.innerHTML = "";
        
        Object.entries(allPlayers).forEach(([id, p]) => {
            if (!p.isDead) {
                const opt = `<option value="${id}">${p.name}</option>`;
                
                // Malam: tidak bisa menargetkan diri sendiri
                if (id !== currentPlayerId) {
                    wSelect.innerHTML += opt;
                    gSelect.innerHTML += opt;
                }
                
                // Siang & MC: Bebas pilih siapa saja yang hidup, termasuk diri sendiri
                dSelect.innerHTML += opt;
                mcExecSelect.innerHTML += opt;
            }
        });
    }
});

onValue(ref(db, "gameState"), (snap) => {
    currentGameState = snap.val() || "lobby";
    if (isMC) {
        document.getElementById("mc-lobby-panel").classList.toggle("hidden", currentGameState !== "lobby");
        document.getElementById("mc-controls-panel").classList.toggle("hidden", currentGameState === "lobby");
        
        // Logika tampilan monitor MC (Malam vs Siang)
        document.getElementById("mc-actions-monitor").classList.toggle("hidden", currentGameState !== "nacht");
        document.getElementById("mc-day-monitor").classList.toggle("hidden", currentGameState !== "tag");
    } else {
        renderPlayerUI(); 
    }
});

onValue(ref(db, "nightActions"), (snap) => {
    currentNightActions = snap.val() || {};
    if (isMC) {
        const wId = currentNightActions.wolfTarget;
        const gId = currentNightActions.guardianTarget;
        document.getElementById("mc-wolf-target").innerText = wId && allPlayers[wId] ? allPlayers[wId].name : "-";
        document.getElementById("mc-guardian-target").innerText = gId && allPlayers[gId] ? allPlayers[gId].name : "-";
    }
});

// Rekap Hasil Voting Siang (Hanya dilihat MC)
onValue(ref(db, "votes"), (snap) => {
    currentDayVotes = snap.val() || {};
    if (isMC) {
        const tally = {};
        Object.entries(currentDayVotes).forEach(([voterId, targetId]) => {
            if (!tally[targetId]) tally[targetId] = [];
            tally[targetId].push(allPlayers[voterId]?.name || "Unknown");
        });
        
        const mcVoteList = document.getElementById("mc-vote-results");
        mcVoteList.innerHTML = "";
        
        if (Object.keys(tally).length === 0) {
            mcVoteList.innerHTML = "<li>Belum ada vote yang masuk.</li>";
        } else {
            Object.entries(tally).forEach(([targetId, voters]) => {
                const targetName = allPlayers[targetId]?.name || "Unknown";
                mcVoteList.innerHTML += `<li><strong style="color:#ff3b30">${targetName}</strong> mendapat <strong>${voters.length} suara</strong> (dari: ${voters.join(", ")})</li>`;
            });
        }
    }
});

// --- TOMBOL-TOMBOL & AKSI ---

document.getElementById("btn-register-player").addEventListener("click", () => {
    const nameInput = document.getElementById("player-name-input").value.trim();
    if (!nameInput) return alert("Masukkan nama kamu!");
    const currentPlayersCount = Object.keys(allPlayers).length;
    if (currentPlayersCount >= 8 && !allPlayers[currentPlayerId]) return alert("Maaf, Lobi sudah penuh! (Maks. 8).");
    set(ref(db, `players/${currentPlayerId}`), { name: nameInput, role: "Belum ada", isDead: false });
});

document.getElementById("btn-reset-players").addEventListener("click", () => {
    if(confirm("HAPUS SEMUA PEMAIN dari lobi?")) {
        set(ref(db, "players"), null);
        update(ref(db), { gameState: "lobby", nightActions: { wolfTarget: "", guardianTarget: "" }, votes: null });
    }
});

document.getElementById("btn-start-game").addEventListener("click", () => {
    const ids = Object.keys(allPlayers);
    const count = ids.length;
    if (count < 4 || count > 8) return alert(`Jumlah pemain harus 4-8 orang! (Saat ini: ${count})`);
    
    let rolesPool = [];
    let wwCount = count < 5 ? 1 : 2; 
    for (let i = 0; i < wwCount; i++) rolesPool.push("Werewolf");
    rolesPool.push("Seer"); rolesPool.push("Guardian");
    if (count >= 5) rolesPool.push("Witch");
    while (rolesPool.length < count) rolesPool.push("Villager");
    
    rolesPool.sort(() => Math.random() - 0.5); 
    
    const updates = { gameState: "nacht", nightActions: { wolfTarget: "", guardianTarget: "" }, votes: null };
    ids.forEach((id, i) => { updates[`players/${id}/role`] = rolesPool[i]; updates[`players/${id}/isDead`] = false; });
    update(ref(db), updates).then(() => alert(`Game Dimulai dengan ${count} pemain!`));
});

// Aksi Pemain: Malam
document.getElementById("btn-wolf-kill").addEventListener("click", () => {
    update(ref(db, "nightActions"), { wolfTarget: document.getElementById("wolf-target-select").value });
});
document.getElementById("btn-guardian-protect").addEventListener("click", () => {
    update(ref(db, "nightActions"), { guardianTarget: document.getElementById("guardian-target-select").value });
});

// Aksi Pemain: Voting Siang
document.getElementById("btn-submit-vote").addEventListener("click", () => {
    const target = document.getElementById("day-vote-select").value;
    set(ref(db, `votes/${currentPlayerId}`), target).then(() => {
        const msg = document.getElementById("vote-status-msg");
        msg.classList.remove("hidden");
        setTimeout(() => msg.classList.add("hidden"), 3000);
    });
});

// MC: Eksekusi Hasil Malam
document.getElementById("btn-resolve-night").addEventListener("click", () => {
    const wTarget = currentNightActions.wolfTarget;
    const gTarget = currentNightActions.guardianTarget;
    const updates = { gameState: "tag", nightActions: { wolfTarget: "", guardianTarget: "" }, votes: null };

    if (wTarget && wTarget !== gTarget) {
        updates[`players/${wTarget}/isDead`] = true;
        alert(`Kalkulasi: "${allPlayers[wTarget].name}" MATI dimangsa Werewolf!`);
    } else if (wTarget && wTarget === gTarget) {
        alert("Kalkulasi: Target berhasil dilindungi oleh Guardian.");
    }
    update(ref(db), updates);
});

// MC: Eksekusi Hasil Voting Siang
document.getElementById("btn-mc-execute").addEventListener("click", () => {
    const targetId = document.getElementById("mc-execute-select").value;
    if(!targetId) return alert("Pilih pemain yang akan dieksekusi!");
    
    const targetName = allPlayers[targetId].name;
    const targetRole = rollenUebersetzung[allPlayers[targetId].role] || allPlayers[targetId].role;

    if(confirm(`Anda akan menggantung ${targetName}. Perannya adalah ${targetRole}. Lanjutkan?`)) {
        const updates = {
            [`players/${targetId}/isDead`]: true,
            gameState: "nacht", // Balik lagi ke malam
            nightActions: { wolfTarget: "", guardianTarget: "" },
            votes: null // Reset hasil vote
        };
        update(ref(db), updates).then(() => alert(`${targetName} telah dieksekusi.`));
    }
});

// Kendali Manual MC
document.getElementById("btn-state-lobby").addEventListener("click", () => update(ref(db), { gameState: "lobby", votes: null }));
document.getElementById("btn-state-nacht").addEventListener("click", () => update(ref(db), { gameState: "nacht", votes: null }));
document.getElementById("btn-state-tag").addEventListener("click", () => update(ref(db), { gameState: "tag", votes: null }));
