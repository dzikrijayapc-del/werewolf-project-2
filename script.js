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

// --- DETEKSI MC ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('role') === 'mc') {
    document.getElementById("mc-controls").classList.remove("hidden");
}

// 1. Pendaftaran Pemain
window.registerPlayer = function() {
    const name = document.getElementById("player-name").value.trim();
    if (!name) return alert("Masukkan nama terlebih dahulu!");
    
    const playerId = "player_" + Date.now();
    set(ref(db, 'players/' + playerId), {
        name: name,
        joinedAt: Date.now()
    }).then(() => {
        alert("Berhasil bergabung!");
        document.getElementById("player-panel").classList.add("hidden");
    });
};

// 2. Real-time Monitoring Pemain
onValue(ref(db, "players"), (snapshot) => {
    const players = snapshot.val();
    const ul = document.getElementById("players-ul");
    ul.innerHTML = ""; 
    
    if (players) {
        Object.entries(players).forEach(([id, data]) => {
            const li = document.createElement("li");
            li.innerText = data.name;
            ul.appendChild(li);
        });
    }
});

// 3. FUNGSI MC: Reset & Mulai
window.resetGame = function() {
    if(confirm("Hapus semua pemain dan mulai dari awal?")) {
        remove(ref(db, 'players')).then(() => location.reload());
    }
};

window.startGame = function() {
    update(ref(db), { gameState: "nacht" }).then(() => {
        alert("Game dimulai! Status berubah ke Malam (Nacht)");
    });
};

// Loading Screen Logic
onValue(ref(db, "gameState"), () => {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("main-content").classList.remove("hidden");
});
