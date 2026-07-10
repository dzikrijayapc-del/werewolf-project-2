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

const emptyNightActions = {
    guardianTarget: "",
    wolfTarget: "",
    seerTarget: "",
    witchHealTarget: "",
    witchPoisonTarget: ""
};

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
            
            document.getElementById("action-werwolf").classList.add("hidden");
            document.getElementById("action-guardian").classList.add("hidden");
            document.getElementById("action-seer").classList.add("hidden");
            document.getElementById("action-witch").classList.add("hidden");
            document.getElementById("action-day-vote").classList.add("hidden");
            
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
                } else if (currentPlayerData.role === "Seer") {
                    document.getElementById("action-seer").classList.remove("hidden");
                    document.getElementById("seer-result").classList.add("hidden");
                    waitMsg.classList.add("hidden");
                } else if (currentPlayerData.role === "Witch") {
                    document.getElementById("action-witch").classList.remove("hidden");
                    document.getElementById("witch-status-msg").classList.add("hidden");
                    waitMsg.classList.add("hidden");
                } else {
                    waitMsg.innerText = "Malam hari... Tetap tenang.";
                }
            } else if (currentGameState === "tag") {
                phaseIndicator.classList.add("phase-day");
                phaseName.innerText = "☀️ Siang Hari - DISKUSI & VOTE";
                waitMsg.classList.add("hidden");
                document.getElementById("action-day-vote").classList.remove("hidden");
            }
        }
    }
}

function triggerWin(winner, subMsg) {
    update(ref(db), { 
        gameState: "ended",
        winData: { winner: winner, subMsg: subMsg }
    });
}

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

onValue(ref(db, `players/${currentPlayerId}`), (snapshot) => {
    currentPlayerData = snapshot.val();
    renderPlayerUI();
});

// LOGIKA PEMBAGIAN NAMA DI DROPDOWN (DIPERBARUI)
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
    const seerSelect = document.getElementById("seer-target-select");
    const witchPSelect = document.getElementById("witch-poison-select");
    const witchHSelect = document.getElementById("witch-heal-select");
    const dSelect = document.getElementById("day-vote-select");

    if (wSelect && gSelect && dSelect && seerSelect && witchPSelect && witchHSelect) {
        wSelect.innerHTML = ""; gSelect.innerHTML = ""; dSelect.innerHTML = ""; seerSelect.innerHTML = "";
        witchPSelect.innerHTML = '<option value="">-- Tidak Meracun --</option>';
        witchHSelect.innerHTML = '<option value="">-- Tidak Menyembuhkan --</option>';
        
        Object.entries(allPlayers).forEach(([id, p]) => {
            if (!p.isDead) {
                const opt = `<option value="${id}">${p.name}</option>`;
                
                // Werewolf, Seer, dan Racun Witch TIDAK bisa pilih diri sendiri
                if (id !== currentPlayerId) {
                    wSelect.innerHTML += opt;
                    seerSelect.innerHTML += opt;
                    witchPSelect.innerHTML += opt;
                }
                
                // Guardian, Obat Witch, dan Voting Siang BISA pilih diri sendiri
                gSelect.innerHTML += opt;
                witchHSelect.innerHTML += opt;
                dSelect.innerHTML += opt;
            }
        });
    }
});

onValue(ref(db, "gameState"), (snap) => {
    currentGameState = snap.val() || "lobby";
    
    if (currentGameState !== "ended") {
        document.getElementById("win-screen").classList.add("hidden");
    }

    if (currentGameState === "ended") {
        onValue(ref(db, "winData"), (snapData) => {
            const data = snapData.val();
            if (data) {
                document.getElementById("win-screen").classList.remove("hidden");
                document.getElementById("win-message").innerText = data.winner;
                document.getElementById("win-submessage").innerText = data.subMsg;
                
                if (isMC) {
                    document.getElementById("mc-win-controls").classList.remove("hidden");
                    document.getElementById("player-win-wait").classList.add("hidden");
                } else {
                    document.getElementById("mc-win-controls").classList.add("hidden");
                    document.getElementById("player-win-wait").classList.remove("hidden");
                }
            }
        }, { onlyOnce: true });
        return; 
    }

    if (isMC) {
        document.getElementById("mc-lobby-panel").classList.toggle("hidden", currentGameState !== "lobby");
        document.getElementById("mc-controls-panel").classList.toggle("hidden", currentGameState === "lobby");
        document.getElementById("mc-actions-monitor").classList.toggle("hidden", currentGameState !== "nacht");
        document.getElementById("mc-day-monitor").classList.toggle("hidden", currentGameState !== "tag");
    } else {
        renderPlayerUI(); 
    }
});

onValue(ref(db, "nightActions"), (snap) => {
    currentNightActions = snap.val() || emptyNightActions;
    if (isMC) {
        const wId = currentNightActions.wolfTarget;
        const gId = currentNightActions.guardianTarget;
        const sId = currentNightActions.seerTarget;
        const wpId = currentNightActions.witchPoisonTarget;
        const whId = currentNightActions.witchHealTarget;
        
        document.getElementById("mc-wolf-target").innerText = wId && allPlayers[wId] ? allPlayers[wId].name : "-";
        document.getElementById("mc-guardian-target").innerText = gId && allPlayers[gId] ? allPlayers[gId].name : "-";
        document.getElementById("mc-seer-target").innerText = sId && allPlayers[sId] ? allPlayers[sId].name : "-";
        document.getElementById("mc-witch-poison").innerText = wpId && allPlayers[wpId] ? allPlayers[wpId].name : "-";
        document.getElementById("mc-witch-heal").innerText = whId && allPlayers[whId] ? allPlayers[whId].name : "-";
    }
});

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

onValue(ref(db, "voteAlert"), (snap) => {
    const alertTrigger = snap.val();
    if (alertTrigger) {
        alert("⚖️ VOTE SERI! ⚖️\nTidak ada eksekusi. Silakan diskusikan kembali dan VOTE ULANG!!");
    }
});

// ==============================
// KUMPULAN EVENT LISTENER KLIK
// ==============================

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
        update(ref(db), { gameState: "lobby", winData: null, nightActions: emptyNightActions, votes: null, voteAlert: null });
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
    
    const updates = { gameState: "nacht", nightActions: emptyNightActions, votes: null, winData: null, voteAlert: null };
    ids.forEach((id, i) => { updates[`players/${id}/role`] = rolesPool[i]; updates[`players/${id}/isDead`] = false; });
    update(ref(db), updates).then(() => alert(`Game Dimulai dengan ${count} pemain!`));
});

document.getElementById("btn-wolf-kill").addEventListener("click", () => {
    update(ref(db, "nightActions"), { wolfTarget: document.getElementById("wolf-target-select").value });
});

document.getElementById("btn-guardian-protect").addEventListener("click", () => {
    update(ref(db, "nightActions"), { guardianTarget: document.getElementById("guardian-target-select").value });
});

document.getElementById("btn-seer-reveal").addEventListener("click", () => {
    const targetId = document.getElementById("seer-target-select").value;
    if (!targetId) return;
    
    update(ref(db, "nightActions"), { seerTarget: targetId });
    
    const target = allPlayers[targetId];
    const roleStr = rollenUebersetzung[target.role] || target.role;
    const resEl = document.getElementById("seer-result");
    resEl.innerText = `👁️ Identitas Asli ${target.name} adalah ${roleStr}`;
    resEl.classList.remove("hidden");
});

document.getElementById("btn-witch-poison").addEventListener("click", () => {
    update(ref(db, "nightActions"), { witchPoisonTarget: document.getElementById("witch-poison-select").value });
    document.getElementById("witch-status-msg").classList.remove("hidden");
});

document.getElementById("btn-witch-heal").addEventListener("click", () => {
    update(ref(db, "nightActions"), { witchHealTarget: document.getElementById("witch-heal-select").value });
    document.getElementById("witch-status-msg").classList.remove("hidden");
});

document.getElementById("btn-submit-vote").addEventListener("click", () => {
    const target = document.getElementById("day-vote-select").value;
    set(ref(db, `votes/${currentPlayerId}`), target).then(() => {
        const msg = document.getElementById("vote-status-msg");
        msg.classList.remove("hidden");
        setTimeout(() => msg.classList.add("hidden"), 3000);
    });
});

document.getElementById("btn-resolve-night").addEventListener("click", () => {
    const wTarget = currentNightActions.wolfTarget;
    const gTarget = currentNightActions.guardianTarget;
    const wpTarget = currentNightActions.witchPoisonTarget;
    const whTarget = currentNightActions.witchHealTarget;
    
    let updates = { gameState: "tag", nightActions: emptyNightActions, votes: null, voteAlert: null };
    let deadList = [];

    if (wTarget && wTarget !== gTarget && wTarget !== whTarget) {
        deadList.push(wTarget);
    }
    
    if (wpTarget && wpTarget !== whTarget) {
        if (!deadList.includes(wpTarget)) deadList.push(wpTarget);
    }

    if (deadList.length === 0) {
        alert("🌅 Pagi yang damai! Tidak ada korban jiwa semalam.");
    } else {
        let msg = "🌅 Tragedi Terjadi!\nPemain berikut terbunuh semalam:\n\n";
        deadList.forEach(id => {
            updates[`players/${id}/isDead`] = true;
            const targetName = allPlayers[id]?.name || "Unknown";
            const targetRole = rollenUebersetzung[allPlayers[id]?.role] || allPlayers[id]?.role;
            msg += `💀 ${targetName} (Peran: ${targetRole})\n`;
        });
        alert(msg);
    }
    
    update(ref(db), updates).then(() => {
        if (deadList.length > 0) checkWinConditions();
    });
});

document.getElementById("btn-mc-tally-vote")?.addEventListener("click", () => {
    const votes = Object.values(currentDayVotes);
    
    if (votes.length === 0) {
        return alert("Belum ada pemain yang memberikan suara!");
    }

    const tally = {};
    votes.forEach(targetId => {
        tally[targetId] = (tally[targetId] || 0) + 1;
    });

    let maxVotes = 0;
    let topTargets = [];

    Object.entries(tally).forEach(([targetId, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            topTargets = [targetId]; 
        } else if (count === maxVotes) {
            topTargets.push(targetId);
        }
    });

    if (topTargets.length === 1) {
        const targetId = topTargets[0];
        const targetName = allPlayers[targetId].name;
        const targetRole = rollenUebersetzung[allPlayers[targetId].role] || allPlayers[targetId].role;
        
        alert(`⚖️ HASIL VOTING:\n\n"${targetName}" resmi dieksekusi mati oleh warga dengan ${maxVotes} suara!\n\nPeran dia yang sebenarnya adalah: ${targetRole}`);

        const updates = {
            [`players/${targetId}/isDead`]: true,
            gameState: "nacht", 
            nightActions: emptyNightActions,
            votes: null,
            voteAlert: null 
        };
        
        update(ref(db), updates).then(() => {
            checkWinConditions(); 
        });

    } else {
        update(ref(db), {
            votes: null, 
            voteAlert: Date.now() 
        });
    }
});

document.getElementById("btn-play-again")?.addEventListener("click", () => {
    const updates = { gameState: "lobby", winData: null, nightActions: emptyNightActions, votes: null, voteAlert: null };
    Object.keys(allPlayers).forEach(id => {
        updates[`players/${id}/role`] = "Belum ada";
        updates[`players/${id}/isDead`] = false;
    });
    update(ref(db), updates);
});

document.getElementById("btn-restart-all")?.addEventListener("click", () => {
    if(confirm("Yakin ingin mereset semua pemain? Mereka harus registrasi nama ulang.")) {
        set(ref(db, "players"), null);
        update(ref(db), { gameState: "lobby", winData: null, nightActions: emptyNightActions, votes: null, voteAlert: null });
    }
});

document.getElementById("btn-state-lobby").addEventListener("click", () => update(ref(db), { gameState: "lobby", votes: null, voteAlert: null }));
document.getElementById("btn-state-nacht").addEventListener("click", () => update(ref(db), { gameState: "nacht", nightActions: emptyNightActions, votes: null, voteAlert: null }));
document.getElementById("btn-state-tag").addEventListener("click", () => update(ref(db), { gameState: "tag", votes: null, voteAlert: null }));
