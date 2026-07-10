import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = { /* MASUKKAN DATA CONFIG FIREBASE ANDA DI SINI */ };
const db = getDatabase(initializeApp(firebaseConfig));
const myId = localStorage.getItem("myPlayerId");

// Register
window.registerPlayer = function() {
    const name = document.getElementById("player-name").value;
    const id = "p_" + Date.now();
    set(ref(db, 'players/' + id), { name, role: "Villager" });
    localStorage.setItem("myPlayerId", id);
    document.getElementById("player-panel").classList.add("hidden");
    document.getElementById("game-ui").classList.remove("hidden");
};

// Update UI
onValue(ref(db, "players"), (snap) => {
    const players = snap.val() || {};
    const list = document.getElementById("players-list");
    const targetDiv = document.getElementById("target-buttons");
    list.innerHTML = ""; targetDiv.innerHTML = "";

    Object.entries(players).forEach(([id, p], i) => {
        list.innerHTML += `<li>Pemain ${i+1}: ${p.name} ${p.role ? '('+p.role+')' : ''}</li>`;
        if (id !== myId) {
            targetDiv.innerHTML += `<button onclick="performAction('${id}')">Pilih Pemain ${i+1}</button>`;
        }
        if (id === myId) document.getElementById("my-role-display").innerText = "Peran Anda: " + p.role;
    });
});

// Aksi
window.performAction = function(targetId) {
    update(ref(db, 'actions/' + myId), { target: targetId });
    alert("Target dipilih!");
};

// Logic MC
const isMC = new URLSearchParams(window.location.search).get('role') === 'mc';
if (isMC) document.getElementById("mc-controls").classList.remove("hidden");

window.startGame = function() {
    const roles = ["Werewolf", "Werewolf", "Seer", "Guardian", "Witch", "Villager", "Villager", "Villager"];
    roles.sort(() => Math.random() - 0.5);
    onValue(ref(db, 'players'), (snap) => {
        const updates = {};
        Object.keys(snap.val()).forEach((id, i) => updates['players/'+id+'/role'] = roles[i]);
        updates['gameState'] = 'nacht';
        update(ref(db), updates);
    }, { onlyOnce: true });
};

window.resetGame = () => remove(ref(db, 'players')).then(() => location.reload());

onValue(ref(db, "gameState"), (snap) => {
    if (snap.val() === "nacht") document.getElementById("action-panel").classList.remove("hidden");
});
