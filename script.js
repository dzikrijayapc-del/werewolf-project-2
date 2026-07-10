import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBxwxDkLTyVpXANDJPIpOC-5YHLtoDoqTs",
    authDomain: "tugas-herr-khana.firebaseapp.com",
    databaseURL: "https://tugas-herr-khana-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tugas-herr-khana",
    storageBucket: "tugas-herr-khana.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 1. Pendaftaran Pemain
window.registerPlayer = function() {
    const name = document.getElementById("player-name").value.trim();
    if (!name) return alert("Masukkan nama terlebih dahulu!");
    
    // ID unik berdasarkan waktu
    const playerId = "player_" + Date.now();
    set(ref(db, 'players/' + playerId), {
        name: name,
        joinedAt: Date.now()
    }).then(() => {
        alert("Berhasil bergabung, " + name + "!");
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

// 3. Reset Game
window.resetGame = function() {
    if(confirm("Yakin ingin mereset permainan? Semua pemain akan dihapus.")) {
        remove(ref(db, 'players')).then(() => {
            alert("Game direset. Halaman akan dimuat ulang.");
            location.reload();
        });
    }
};

// Loading Screen Logic
onValue(ref(db, "gameState"), () => {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("main-content").classList.remove("hidden");
});