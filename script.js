import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const db = getDatabase(initializeApp({ /* MASUKKAN CONFIG FIREBASE ANDA DI SINI */ }));
const myId = localStorage.getItem("myPlayerId");

// Fungsi Aksi
window.performAction = function(targetId, actionType) {
    const updates = {};
    updates['actions/' + myId] = { target: targetId, type: actionType };
    update(ref(db), updates);
    alert("Aksi " + actionType + " dikirim!");
};

// UI Update
onValue(ref(db, "players"), (snapshot) => {
    const players = snapshot.val();
    const list = document.getElementById("players-list");
    const targetDiv = document.getElementById("target-buttons");
    list.innerHTML = "";
    targetDiv.innerHTML = "";

    Object.entries(players || {}).forEach(([id, p], index) => {
        const num = index + 1;
        list.innerHTML += `<li>Pemain ${num}: ${p.name} ${p.role ? '('+p.role+')' : ''}</li>`;
        
        // Tombol target aksi
        if (id !== myId) {
            targetDiv.innerHTML += `<button onclick="performAction('${id}', 'kill')">Bunuh ${num}</button>`;
            targetDiv.innerHTML += `<button onclick="performAction('${id}', 'protect')">Lindungi ${num}</button>`;
        }
    });
});

window.startGame = function() {
    const roles = ["Werewolf", "Werewolf", "Seer", "Guardian", "Witch", "Villager", "Villager", "Villager"];
    roles.sort(() => Math.random() - 0.5);
    // Logika update ke DB...
    update(ref(db), { gameState: "nacht" });
};

// Deteksi Malam
onValue(ref(db, "gameState"), (snap) => {
    if (snap.val() === "nacht") {
        document.getElementById("action-panel").classList.remove("hidden");
    }
});
