import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxwxDkLTyVpXANDJPIpOC-5YHLtoDoqTs",
    authDomain: "tugas-herr-khana.firebaseapp.com",
    databaseURL: "https://tugas-herr-khana-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tugas-herr-khana",
    storageBucket: "tugas-herr-khana.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const urlParams = new URLSearchParams(window.location.search);
const isMC = urlParams.get('role') === 'mc';

// Tampilan awal & MC
if (isMC) {
    document.getElementById("mc-controls").classList.remove("hidden");
    document.getElementById("player-panel").classList.add("hidden");
}

window.registerPlayer = function() {
    const name = document.getElementById("player-name").value.trim();
    if (!name) return alert("Masukkan nama!");
    const playerId = "player_" + Date.now();
    set(ref(db, 'players/' + playerId), { name: name, role: "Belum ada" });
    document.getElementById("player-panel").classList.add("hidden");
    localStorage.setItem("myPlayerId", playerId);
};

onValue(ref(db, "players"), (snapshot) => {
    const players = snapshot.val();
    const ul = document.getElementById("players-ul");
    ul.innerHTML = "";
    if (players) {
        Object.entries(players).forEach(([id, data]) => {
            const li = document.createElement("li");
            li.innerText = `${data.name} ${data.role !== "Belum ada" ? '- ' + data.role : ''}`;
            ul.appendChild(li);
            
            // Tampilkan peran ke pemain sendiri
            if (id === localStorage.getItem("myPlayerId")) {
                document.getElementById("role-display").innerText = "Peran Anda: " + data.role;
            }
        });
    }
});

window.startGame = function() {
    const playersRef = ref(db, 'players');
    onValue(playersRef, (snapshot) => {
        const players = snapshot.val();
        if (!players) return;
        const ids = Object.keys(players);
        if (ids.length !== 8) return alert("Butuh 8 pemain! Sekarang: " + ids.length);

        const roles = ["Werewolf", "Werewolf", "Seer", "Guardian", "Witch", "Villager", "Villager", "Villager"];
        roles.sort(() => Math.random() - 0.5);

        const updates = {};
        ids.forEach((id, index) => { updates['players/' + id + '/role'] = roles[index]; });
        updates['gameState'] = "nacht";
        update(ref(db), updates);
    }, { onlyOnce: true });
};

window.resetGame = function() {
    remove(ref(db, 'players')).then(() => location.reload());
};

onValue(ref(db, "gameState"), () => {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("main-content").classList.remove("hidden");
});
