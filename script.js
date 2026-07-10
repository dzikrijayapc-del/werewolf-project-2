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
let currentPlayerData = null;

// FUNGSI UTAMA UNTUK MENGGAMBAR ULANG TAMPILAN PEMAIN
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
            
            // Logika Indikator Waktu
            const phaseIndicator = document.getElementById("phase-indicator");
            const phaseName = document.getElementById("phase-name");
            phaseIndicator.classList.remove("hidden", "phase-night", "phase-day");
            
            // Logika Aksi
            document.getElementById("action-werwolf").classList.add("hidden");
            document.getElementById("action-guardian").classList.add("hidden");
            const waitMsg = document.getElementById("action-wait-message");
            waitMsg.classList.remove("hidden");
            
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
                    waitMsg.innerText = "Malam hari telah tiba. Harap tunggu peran lain bergerak...";
                }
            } else if (currentGameState === "tag") {
                phaseIndicator.classList.add("phase-day");
                phaseName.innerText = "☀️ Siang Hari";
                waitMsg.innerText = "Matahari Terbit! Silakan berdiskusi dan voting siapa yang akan digantung.";
            }
        }
    }
}

// PEMBARUAN: Panggil renderPlayerUI() saat data diri pemain berubah
onValue(ref(db, `players/${currentPlayerId}`), (snapshot) => {
    currentPlayerData = snapshot.val();
    renderPlayerUI();
});

// PEMBARUAN: Panggil juga renderPlayerUI() saat MC mengganti Waktu/State Game
onValue(ref(db, "gameState"), (snap) => {
    currentGameState = snap.val() || "lobby";
    if (isMC) {
        document.getElementById("mc-lobby-panel").classList.toggle("hidden", currentGameState !== "lobby");
        document.getElementById("mc-controls-panel").classList.toggle("hidden", currentGameState === "lobby");
        document.getElementById("mc-actions-monitor").classList.toggle("hidden", currentGameState === "lobby");
    } else {
        renderPlayerUI(); // 👈 BUG FIX: Refresh layar pemain tiap waktu berubah
    }
});


document.getElementById("btn-register-player").addEventListener("click", () => {
    const nameInput = document.getElementById("player-name-input").value.trim();
    if (!nameInput) return alert("Masukkan nama kamu!");
    
    const currentPlayersCount = Object.keys(allPlayers).length;
    
    if (currentPlayersCount >= 8 && !allPlayers[currentPlayerId]) {
        return alert("Maaf, Lobi sudah penuh! (Maksimal 8 pemain).");
    }
    
    set(ref(db, `players/${currentPlayerId}`), {
        name: nameInput,
        role: "Belum ada",
        isDead: false
    });
});

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
    if (wSelect && gSelect) {
        wSelect.innerHTML = ""; gSelect.innerHTML = "";
        Object.entries(allPlayers).forEach(([id, p]) => {
            if (!p.isDead && id !== currentPlayerId) {
                const opt = `<option value="${id}">${p.name}</option>`;
                wSelect.innerHTML += opt;
                gSelect.innerHTML += opt;
            }
        });
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

document.getElementById("btn-reset-players").addEventListener("click", () => {
    if(confirm("AWAS! Ini akan MENGHAPUS SEMUA PEMAIN dari lobi. Pemain harus mendaftar ulang. Anda yakin?")) {
        set(ref(db, "players"), null);
        update(ref(db), { gameState: "lobby", nightActions: { wolfTarget: "", guardianTarget: "" } });
    }
});

document.getElementById("btn-start-game").addEventListener("click", () => {
    const ids = Object.keys(allPlayers);
    const count = ids.length;
    
    if (count < 4 || count > 8) {
        return alert(`Game tidak bisa dimulai! Jumlah pemain harus di antara 4 hingga 8 orang. (Saat ini: ${count} pemain)`);
    }

    let rolesPool = [];
    
    let wwCount = count < 5 ? 1 : 2; 
    for (let i = 0; i < wwCount; i++) rolesPool.push("Werewolf");

    rolesPool.push("Seer");
    rolesPool.push("Guardian");

    if (count >= 5) {
        rolesPool.push("Witch");
    }

    while (rolesPool.length < count) {
        rolesPool.push("Villager");
    }

    rolesPool.sort(() => Math.random() - 0.5); 
    
    const updates = { 
        gameState: "nacht", 
        nightActions: { wolfTarget: "", guardianTarget: "" } 
    };

    ids.forEach((id, i) => { 
        updates[`players/${id}/role`] = rolesPool[i]; 
        updates[`players/${id}/isDead`] = false; 
    });

    update(ref(db), updates).then(() => alert(`Game Dimulai dengan ${count} pemain! Peran berhasil diacak.`));
});

document.getElementById("btn-wolf-kill").addEventListener("click", () => {
    const target = document.getElementById("wolf-target-select").value;
    update(ref(db, "nightActions"), { wolfTarget: target }).then(() => alert("Target mangsa dikirim ke MC!"));
});

document.getElementById("btn-guardian-protect").addEventListener("click", () => {
    const target = document.getElementById("guardian-target-select").value;
    update(ref(db, "nightActions"), { guardianTarget: target }).then(() => alert("Target perlindungan dikirim ke MC!"));
});

document.getElementById("btn-resolve-night").addEventListener("click", () => {
    const wTarget = currentNightActions.wolfTarget;
    const gTarget = currentNightActions.guardianTarget;
    
    // Ini yang merubah fase ke "tag" (Siang) secara sistem
    const updates = { 
        gameState: "tag", 
        nightActions: { wolfTarget: "", guardianTarget: "" } 
    };

    if (wTarget && wTarget !== gTarget) {
        updates[`players/${wTarget}/isDead`] = true;
        alert(`Kalkulasi Selesai: Pemain bernama "${allPlayers[wTarget].name}" MATI dimangsa Werewolf!`);
    } else if (wTarget && wTarget === gTarget) {
        alert("Kalkulasi Selesai: Selamat! Target yang diserang Werewolf berhasil dilindungi oleh Guardian.");
    } else {
        alert("Kalkulasi Selesai: Tidak ada data aksi pembunuhan malam ini.");
    }

    // Eksekusi pembaruan ke Database
    update(ref(db), updates);
});

document.getElementById("btn-state-lobby").addEventListener("click", () => {
    if(confirm("Kembali ke Lobi awal? (Nama pemain tetap tersimpan)")) {
        update(ref(db), { gameState: "lobby", nightActions: { wolfTarget: "", guardianTarget: "" } });
    }
});
document.getElementById("btn-state-nacht").addEventListener("click", () => update(ref(db), { gameState: "nacht" }));
document.getElementById("btn-state-tag").addEventListener("click", () => update(ref(db), { gameState: "tag" }));
