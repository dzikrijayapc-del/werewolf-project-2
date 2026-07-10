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

// Selektor DOM
const loadingScreen = document.getElementById("loading-screen");
const playerScreen = document.getElementById("player-screen");
const mcScreen = document.getElementById("mc-screen");
const deadScreen = document.getElementById("dead-screen");
const devRoleSelect = document.getElementById("dev-role-select");

// State Global
let currentPlayerId = localStorage.getItem("myPlayerId") || "player_" + Date.now();
let isMcView = new URLSearchParams(window.location.search).get('role') === 'mc';
let currentGameState = "lobby";
let allPlayers = {};
let currentNightActions = {};

// Terjemahan Peran
const rollenUebersetzung = {
    "Werewolf": "Werewolf 🐺",
    "Villager": "Warga Desa 🧑‍🌾",
    "Guardian": "Pelindung 🛡️",
    "Seer": "Penerawang 🔮",
    "Witch": "Penyihir 🧪",
    "Belum ada": "Menunggu pembagian peran..."
};

// DEV MODE LOGIC (Simulasi pindah layar)
devRoleSelect.addEventListener("change", (e) => {
    if (e.target.value === "mc") {
        window.location.href = "?role=mc";
    } else {
        localStorage.setItem("myPlayerId", e.target.value);
        window.location.href = "?";
    }
});

// INITIAL SETUP UI
if (isMcView) {
    devRoleSelect.value = "mc";
    loadingScreen.classList.add("hidden");
    mcScreen.classList.remove("hidden");
} else {
    devRoleSelect.value = "player_1"; // Mock data
    localStorage.setItem("myPlayerId", currentPlayerId);
    loadingScreen.classList.add("hidden");
    playerScreen.classList.remove("hidden");
}

// LOGIKA PEMAIN (LOBBY & GAMEPLAY)
onValue(ref(db, `players/${currentPlayerId}`), (snapshot) => {
    if (isMcView) return; 
    const data = snapshot.val();
    
    document.getElementById("lobby-registration-panel").classList.add("hidden");
    document.getElementById("lobby-waiting-panel").classList.add("hidden");
    document.getElementById("gameplay-role-panel").classList.add("hidden");

    if (!data || !data.name) {
        document.getElementById("lobby-registration-panel").classList.remove("hidden");
    } else if (currentGameState === "lobby") {
        document.getElementById("lobby-waiting-panel").classList.remove("hidden");
        document.getElementById("waiting-player-name").innerText = data.name;
    } else {
        if (data.isDead) {
            deadScreen.classList.remove("hidden");
            playerScreen.classList.add("hidden");
        } else {
            deadScreen.classList.add("hidden");
            document.getElementById("gameplay-role-panel").classList.remove("hidden");
            document.getElementById("player-role").innerText = rollenUebersetzung[data.role] || data.role;
            
            // Logika Visibilitas Aksi Malam
            document.getElementById("action-werwolf").classList.add("hidden");
            document.getElementById("action-guardian").classList.add("hidden");
            const waitMsg = document.getElementById("action-wait-message");
            
            if (currentGameState === "nacht") {
                if (data.role === "Werewolf") document.getElementById("action-werwolf").classList.remove("hidden");
                else if (data.role === "Guardian") document.getElementById("action-guardian").classList.remove("hidden");
                else waitMsg.innerText = "Malam hari tiba. Tunggu peran lain bertindak...";
            } else {
                waitMsg.innerText = "Siang hari! Diskusikan siapa yang mencurigakan.";
            }
        }
    }
});

// LOGIKA DAFTAR
document.getElementById("btn-register-player").addEventListener("click", () => {
    const name = document.getElementById("player-name-input").value;
    if (name) {
        set(ref(db, `players/${currentPlayerId}`), { name: name, role: "Belum ada", isDead: false });
    }
});

// LOGIKA DAFTAR PEMAIN (Dropdown & MC List)
onValue(ref(db, "players"), (snapshot) => {
    allPlayers = snapshot.val() || {};
    
    // Update List MC
    if (isMcView) {
        const mcList = document.getElementById("mc-players-list");
        mcList.innerHTML = "";
        Object.entries(allPlayers).forEach(([id, p]) => {
            mcList.innerHTML += `<li>${p.name} - ${rollenUebersetzung[p.role]} ${p.isDead ? '(💀)' : ''}</li>`;
        });
    }

    // Update Dropdown Target (Hanya pemain hidup)
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

// LOGIKA MC: Game State & Evaluasi Malam
onValue(ref(db, "gameState"), (snap) => {
    currentGameState = snap.val() || "lobby";
    if (isMcView) {
        document.getElementById("mc-lobby-panel").classList.toggle("hidden", currentGameState !== "lobby");
        document.getElementById("mc-controls-panel").classList.toggle("hidden", currentGameState === "lobby");
        document.getElementById("mc-actions-monitor").classList.toggle("hidden", currentGameState === "lobby");
    }
});

onValue(ref(db, "nightActions"), (snap) => {
    currentNightActions = snap.val() || {};
    if (isMcView) {
        const wId = currentNightActions.wolfTarget;
        const gId = currentNightActions.guardianTarget;
        document.getElementById("mc-wolf-target").innerText = wId && allPlayers[wId] ? allPlayers[wId].name : "-";
        document.getElementById("mc-guardian-target").innerText = gId && allPlayers[gId] ? allPlayers[gId].name : "-";
    }
});

document.getElementById("btn-start-game").addEventListener("click", () => {
    const ids = Object.keys(allPlayers);
    const roles = ["Werewolf", "Werewolf", "Seer", "Guardian", "Witch", "Villager", "Villager", "Villager"];
    roles.sort(() => Math.random() - 0.5);
    
    const updates = { gameState: "nacht", nightActions: { wolfTarget: "", guardianTarget: "" } };
    ids.forEach((id, i) => { updates[`players/${id}/role`] = roles[i] || "Villager"; updates[`players/${id}/isDead`] = false; });
    update(ref(db), updates);
});

// Aksi Pemain Malam Hari
document.getElementById("btn-wolf-kill").addEventListener("click", () => {
    update(ref(db, "nightActions"), { wolfTarget: document.getElementById("wolf-target-select").value });
    alert("Target mangsa terkirim!");
});

document.getElementById("btn-guardian-protect").addEventListener("click", () => {
    update(ref(db, "nightActions"), { guardianTarget: document.getElementById("guardian-target-select").value });
    alert("Target lindungan terkirim!");
});

// Evaluasi Kalkulasi Malam
document.getElementById("btn-resolve-night").addEventListener("click", () => {
    const wTarget = currentNightActions.wolfTarget;
    const gTarget = currentNightActions.guardianTarget;
    const updates = { gameState: "tag", nightActions: { wolfTarget: "", guardianTarget: "" } };

    if (wTarget && wTarget !== gTarget) {
        updates[`players/${wTarget}/isDead`] = true;
        alert(`Pemain mati malam ini!`);
    } else {
        alert("Tidak ada yang mati malam ini!");
    }
    update(ref(db), updates);
});

// State Controls
document.getElementById("btn-state-lobby").addEventListener("click", () => update(ref(db), { gameState: "lobby" }));
document.getElementById("btn-state-nacht").addEventListener("click", () => update(ref(db), { gameState: "nacht" }));
document.getElementById("btn-state-tag").addEventListener("click", () => update(ref(db), { gameState: "tag" }));
