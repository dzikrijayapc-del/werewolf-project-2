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

// Ambil ID Akun dari LocalStorage atau default ke player_1
let currentPlayerId = localStorage.getItem("myPlayerId");
if (!currentPlayerId || currentPlayerId === "mc") {
    currentPlayerId = "player_1";
    localStorage.setItem("myPlayerId", "player_1");
}

const isMC = new URLSearchParams(window.location.search).get('role') === 'mc';
const devRoleSelect = document.getElementById("dev-role-select");

// Sinkronisasi Selektor Mode Dev dengan URL/Status Akun Saat Ini
if (isMC) {
    devRoleSelect.value = "mc";
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("mc-screen").removeClassName = ""; 
    document.getElementById("mc-screen").classList.remove("hidden");
} else {
    devRoleSelect.value = currentPlayerId;
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("player-screen").classList.remove("hidden");
}

// Event ganti akun di Mode Developer
devRoleSelect.addEventListener("change", (e) => {
    if (e.target.value === "mc") {
        window.location.href = "?role=mc";
    } else {
        localStorage.setItem("myPlayerId", e.target.value);
        window.location.href = "?";
    }
});

// Kamus Terjemahan Peran
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

// SINKRONISASI TAMPILAN PEMAIN INDIVIDUAL
onValue(ref(db, `players/${currentPlayerId}`), (snapshot) => {
    if (isMC) return;
    const data = snapshot.val();
    
    document.getElementById("lobby-registration-panel").classList.add("hidden");
    document.getElementById("lobby-waiting-panel").classList.add("hidden");
    document.getElementById("gameplay-role-panel").classList.add("hidden");
    document.getElementById("dead-screen").classList.add("hidden");

    if (!data || !data.name) {
        document.getElementById("lobby-registration-panel").classList.remove("hidden");
    } else if (currentGameState === "lobby") {
        document.getElementById("lobby-waiting-panel").classList.remove("hidden");
        document.getElementById("waiting-player-name").innerText = data.name;
    } else {
        if (data.isDead) {
            document.getElementById("dead-screen").classList.remove("hidden");
        } else {
            document.getElementById("gameplay-role-panel").classList.remove("hidden");
            document.getElementById("player-role").innerText = rollenUebersetzung[data.role] || data.role;
            
            // Atur Visibilitas Panel Aksi Malam Hari
            document.getElementById("action-werwolf").classList.add("hidden");
            document.getElementById("action-guardian").classList.add("hidden");
            const waitMsg = document.getElementById("action-wait-message");
            
            if (currentGameState === "nacht") {
                waitMsg.classList.remove("hidden");
                if (data.role === "Werewolf") {
                    document.getElementById("action-werwolf").classList.remove("hidden");
                    waitMsg.classList.add("hidden");
                } else if (data.role === "Guardian") {
                    document.getElementById("action-guardian").classList.remove("hidden");
                    waitMsg.classList.add("hidden");
                } else {
                    waitMsg.innerText = "Malam hari telah tiba. Harap tunggu peran lain bergerak...";
                }
            } else {
                waitMsg.classList.remove("hidden");
                waitMsg.innerText = "Siang hari! Silakan berdiskusi dan pilih siapa yang digantung.";
            }
        }
    }
});

// EVENT REGISTRASI PEMAIN
document.getElementById("btn-register-player").addEventListener("click", () => {
    const nameInput = document.getElementById("player-name-input").value.trim();
    if (!nameInput) return alert("Masukkan nama kamu!");
    
    set(ref(db, `players/${currentPlayerId}`), {
        name: nameInput,
        role: "Belum ada",
        isDead: false
    }).then(() => alert("Berhasil mendaftar ke lobi!"));
});

// MONITOR DATA SEMUA PEMAIN (UNTUK MC & DROPDOWN AKSI)
onValue(ref(db, "players"), (snapshot) => {
    allPlayers = snapshot.val() || {};
    const playerIds = Object.keys(allPlayers);
    
    // Update daftar di layar MC
    if (isMC) {
        document.getElementById("player-count-badge").innerText = playerIds.length;
        const mcList = document.getElementById("mc-players-list");
        mcList.innerHTML = "";
        playerIds.forEach((id) => {
            const p = allPlayers[id];
            mcList.innerHTML += `<li><strong>${id.replace('_', ' ')}:</strong> ${p.name} [${rollenUebersetzung[p.role] || p.role}] ${p.isDead ? '💀 (Mati)' : '💚 (Hidup)'}</li>`;
        });
    }

    // Update Dropdown Pilihan Target Malam Hari (Hanya Pemain Hidup)
    const wSelect = document.getElementById("wolf-target-select");
    const gSelect = document.getElementById("guardian-target-select");
    if (wSelect && gSelect) {
        wSelect.innerHTML = ""; gSelect.innerHTML = "";
        Object.entries(allPlayers).forEach(([id, p]) => {
            if (!p.isDead) {
                const opt = `<option value="${id}">${p.name} (${id.replace('_', ' ')})</option>`;
                wSelect.innerHTML += opt;
                gSelect.innerHTML += opt;
            }
        });
    }
});

// MONITOR UTAMA STATUS GAME (GAME STATE)
onValue(ref(db, "gameState"), (snap) => {
    currentGameState = snap.val() || "lobby";
    if (isMC) {
        document.getElementById("mc-lobby-panel").classList.toggle("hidden", currentGameState !== "lobby");
        document.getElementById("mc-controls-panel").classList.toggle("hidden", currentGameState === "lobby");
        document.getElementById("mc-actions-monitor").classList.toggle("hidden", currentGameState === "lobby");
    }
});

// MONITOR AKSI MALAM HARI OLEH MC
onValue(ref(db, "nightActions"), (snap) => {
    currentNightActions = snap.val() || {};
    if (isMC) {
        const wId = currentNightActions.wolfTarget;
        const gId = currentNightActions.guardianTarget;
        document.getElementById("mc-wolf-target").innerText = wId && allPlayers[wId] ? `${allPlayers[wId].name} (${wId.replace('_', ' ')})` : "-";
        document.getElementById("mc-guardian-target").innerText = gId && allPlayers[gId] ? `${allPlayers[gId].name} (${gId.replace('_', ' ')})` : "-";
    }
});

// TOMBOL START GAME: VALIDASI TEPAT 8 PEMAIN & ACAK PERAN
document.getElementById("btn-start-game").addEventListener("click", () => {
    const ids = Object.keys(allPlayers);
    
    // Kunci Validasi Tepat 8 Orang
    if (ids.length !== 8) {
        return alert(`Game tidak bisa dimulai! Jumlah pemain harus tepat 8 orang. (Saat ini baru ada: ${ids.length} pemain)`);
    }

    // Pola Peran Sesuai Permintaan Anda: 2 Werewolf, 1 Seer, 1 Guardian, 1 Witch, 3 Villager
    const rolesPool = ["Werewolf", "Werewolf", "Seer", "Guardian", "Witch", "Villager", "Villager", "Villager"];
    rolesPool.sort(() => Math.random() - 0.5); // Pengacakan acak rahasia
    
    const updates = { 
        gameState: "nacht", 
        nightActions: { wolfTarget: "", guardianTarget: "" } 
    };

    ids.forEach((id, i) => { 
        updates[`players/${id}/role`] = rolesPool[i]; 
        updates[`players/${id}/isDead`] = false; 
    });

    update(ref(db), updates).then(() => alert("Game Dimulai! Peran 8 pemain berhasil diacak secara otomatis."));
});

// PROSES PENGIRIMAN AKSI MALAM PEMAIN
document.getElementById("btn-wolf-kill").addEventListener("click", () => {
    const target = document.getElementById("wolf-target-select").value;
    update(ref(db, "nightActions"), { wolfTarget: target }).then(() => alert("Target mangsa dikirim ke MC!"));
});

document.getElementById("btn-guardian-protect").addEventListener("click", () => {
    const target = document.getElementById("guardian-target-select").value;
    update(ref(db, "nightActions"), { guardianTarget: target }).then(() => alert("Target perlindungan dikirim ke MC!"));
});

// LOGIKA EVALUASI KALKULASI MALAM HARI OLEH MC
document.getElementById("btn-resolve-night").addEventListener("click", () => {
    const wTarget = currentNightActions.wolfTarget;
    const gTarget = currentNightActions.guardianTarget;
    
    const updates = { 
        gameState: "tag", 
        nightActions: { wolfTarget: "", guardianTarget: "" } 
    };

    if (wTarget && wTarget !== gTarget) {
        updates[`players/${wTarget}/isDead`] = true;
        alert(`Kalkulasi Selesai: Pemain di slot (${wTarget.replace('_', ' ')}) bernama "${allPlayers[wTarget].name}" MATI dimangsa Werewolf!`);
    } else if (wTarget && wTarget === gTarget) {
        alert("Kalkulasi Selesai: Selamat! Target yang diserang Werewolf berhasil dilindungi oleh Guardian. Tidak ada korban jiwa.");
    } else {
        alert("Kalkulasi Selesai: Tidak ada data aksi pembunuhan malam ini.");
    }

    update(ref(db), updates);
});

// PENGONTROL MANUAL FASE OLEH MC
document.getElementById("btn-state-lobby").addEventListener("click", () => {
    if(confirm("Reset seluruh game kembali ke Lobi awal?")) {
        update(ref(db), { gameState: "lobby", nightActions: { wolfTarget: "", guardianTarget: "" } });
    }
});
document.getElementById("btn-state-nacht").addEventListener("click", () => update(ref(db), { gameState: "nacht" }));
document.getElementById("btn-state-tag").addEventListener("click", () => update(ref(db), { gameState: "tag" }));
