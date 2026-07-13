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

// 1. BUAT ID BERDASARKAN PILIHAN SLOT
let currentPlayerId = localStorage.getItem("myPlayerId") || "player_1"; 

// 2. SISTEM AKSES OTOMATIS
const isMC = new URLSearchParams(window.location.search).get('role') === 'mc';

if (isMC) {
    document.getElementById("loading-screen")?.classList.add("hidden");
    document.getElementById("mc-screen")?.classList.remove("hidden");
    document.getElementById("mc-access-panel")?.classList.remove("hidden");
    document.getElementById("player-screen")?.remove(); 
    document.getElementById("player-access-panel")?.remove();
} else {
    document.getElementById("loading-screen")?.classList.add("hidden");
    document.getElementById("player-screen")?.classList.remove("hidden");
    document.getElementById("player-access-panel")?.classList.remove("hidden");
    document.getElementById("mc-screen")?.remove();
    document.getElementById("mc-access-panel")?.remove();
    
    const slotSelect = document.getElementById("player-slot-select");
    if (slotSelect) {
        slotSelect.value = currentPlayerId;
        slotSelect.addEventListener("change", (e) => {
            localStorage.setItem("myPlayerId", e.target.value);
            window.location.reload(); 
        });
    }
}

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
    wolfVotes: {},
    seerTarget: "",
    witchHealTarget: "",
    witchPoisonTarget: ""
};

function renderPlayerUI() {
    if (isMC) return;
    
    document.getElementById("lobby-registration-panel")?.classList.add("hidden");
    document.getElementById("lobby-waiting-panel")?.classList.add("hidden");
    document.getElementById("gameplay-role-panel")?.classList.add("hidden");
    document.getElementById("dead-screen")?.classList.add("hidden");

    if (!currentPlayerData || !currentPlayerData.name) {
        document.getElementById("lobby-registration-panel")?.classList.remove("hidden");
        return;
    } 
    
    if (currentGameState === "lobby") {
        document.getElementById("lobby-waiting-panel")?.classList.remove("hidden");
        const waitName = document.getElementById("waiting-player-name");
        if (waitName) waitName.innerText = currentPlayerData.name;
    } else {
        if (currentPlayerData.isDead) {
            document.getElementById("dead-screen")?.classList.remove("hidden");
        } else {
            document.getElementById("gameplay-role-panel")?.classList.remove("hidden");
            const roleEl = document.getElementById("player-role");
            if (roleEl) roleEl.innerText = rollenUebersetzung[currentPlayerData.role] || currentPlayerData.role;
            
            const phaseIndicator = document.getElementById("phase-indicator");
            const phaseName = document.getElementById("phase-name");
            phaseIndicator?.classList.remove("hidden", "phase-night", "phase-day");
            
            document.getElementById("action-werwolf")?.classList.add("hidden");
            document.getElementById("action-guardian")?.classList.add("hidden");
            document.getElementById("action-seer")?.classList.add("hidden");
            document.getElementById("action-witch")?.classList.add("hidden");
            document.getElementById("action-day-vote")?.classList.add("hidden");
            
            const waitMsg = document.getElementById("action-wait-message");
            waitMsg?.classList.remove("hidden");

            if (currentGameState === "nacht") {
                phaseIndicator?.classList.add("phase-night");
                if (phaseName) phaseName.innerText = "🌙 Malam Hari";

                if (currentPlayerData.role === "Werewolf") {
                    document.getElementById("action-werwolf")?.classList.remove("hidden");
                    waitMsg?.classList.add("hidden");
                } else if (currentPlayerData.role === "Guardian") {
                    document.getElementById("action-guardian")?.classList.remove("hidden");
                    waitMsg?.classList.add("hidden");
                } else if (currentPlayerData.role === "Seer") {
                    document.getElementById("action-seer")?.classList.remove("hidden");
                    waitMsg?.classList.add("hidden");
                } else if (currentPlayerData.role === "Witch") {
                    document.getElementById("action-witch")?.classList.remove("hidden");
                    document.getElementById("witch-status-msg")?.classList.add("hidden");
                    waitMsg?.classList.add("hidden");
                } else {
                    if (waitMsg) waitMsg.innerText = "Malam hari... Tetap tenang.";
                }
            } else if (currentGameState === "tag") {
                phaseIndicator?.classList.add("phase-day");
                if (phaseName) phaseName.innerText = "☀️ Siang Hari - DISKUSI & VOTE";
                waitMsg?.classList.add("hidden");
                document.getElementById("action-day-vote")?.classList.remove("hidden");
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

onValue(ref(db, "players"), (snapshot) => {
    allPlayers = snapshot.val() || {};
    const playerIds = Object.keys(allPlayers);
    
    if (isMC) {
        const badge = document.getElementById("player-count-badge");
        if (badge) badge.innerText = playerIds.length;
        
        const mcList = document.getElementById("mc-players-list");
        if (mcList) {
            mcList.innerHTML = "";
            playerIds.forEach((id) => {
                const p = allPlayers[id];
                mcList.innerHTML += `<li>${p.name} [${rollenUebersetzung[p.role] || p.role}] ${p.isDead ? '💀 (Mati)' : '💚 (Hidup)'}</li>`;
            });
        }
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
                
                if (id !== currentPlayerId) {
                    wSelect.innerHTML += opt;
                    seerSelect.innerHTML += opt;
                    witchPSelect.innerHTML += opt;
                }
                
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
        document.getElementById("win-screen")?.classList.add("hidden");
    }

    if (currentGameState === "ended") {
        onValue(ref(db, "winData"), (snapData) => {
            const data = snapData.val();
            if (data) {
                document.getElementById("win-screen")?.classList.remove("hidden");
                
                const winMsg = document.getElementById("win-message");
                if(winMsg) winMsg.innerText = data.winner;
                
                const winSub = document.getElementById("win-submessage");
                if(winSub) winSub.innerText = data.subMsg;
                
                if (isMC) {
                    document.getElementById("mc-win-controls")?.classList.remove("hidden");
                    document.getElementById("player-win-wait")?.classList.add("hidden");
                } else {
                    document.getElementById("mc-win-controls")?.classList.add("hidden");
                    document.getElementById("player-win-wait")?.classList.remove("hidden");
                }
            }
        }, { onlyOnce: true });
        return; 
    }

    if (isMC) {
        document.getElementById("mc-lobby-panel")?.classList.toggle("hidden", currentGameState !== "lobby");
        document.getElementById("mc-controls-panel")?.classList.toggle("hidden", currentGameState === "lobby");
        document.getElementById("mc-actions-monitor")?.classList.toggle("hidden", currentGameState !== "nacht");
        document.getElementById("mc-day-monitor")?.classList.toggle("hidden", currentGameState !== "tag");
        
        // Reset Seer Result UI saat masuk phase baru
        if(currentGameState !== "nacht"){
             document.getElementById("seer-result")?.classList.add("hidden");
        }
    } else {
        renderPlayerUI(); 
    }
});

onValue(ref(db, "nightActions"), (snap) => {
    currentNightActions = snap.val() || emptyNightActions;
    
    const wolfVotesObj = currentNightActions.wolfVotes || {};
    const voteValues = Object.values(wolfVotesObj);
    const uniqueVotes = [...new Set(voteValues)];
    
    let consensusTarget = "";
    if (uniqueVotes.length === 1) {
        consensusTarget = uniqueVotes[0];
    }

    if (currentPlayerData?.role === "Werewolf") {
        const warnEl = document.getElementById("wolf-warning");
        if (warnEl) {
            if (uniqueVotes.length > 1) {
                warnEl.innerText = "⚠️ PERINGATAN: Serigala lain memilih mangsa yang berbeda! Diskusikan dan samakan target kalian.";
                warnEl.style.color = "#ff3b30";
                warnEl.classList.remove("hidden");
            } else if (uniqueVotes.length === 1) {
                warnEl.innerText = "✅ Sepakat menargetkan: " + (allPlayers[consensusTarget]?.name || "...");
                warnEl.style.color = "#32d74b";
                warnEl.classList.remove("hidden");
            }
        }
    }

    if (isMC) {
        const gId = currentNightActions.guardianTarget;
        const sId = currentNightActions.seerTarget;
        const wpId = currentNightActions.witchPoisonTarget;
        const whId = currentNightActions.witchHealTarget;
        
        const mcW = document.getElementById("mc-wolf-target");
        if(mcW) {
            if (uniqueVotes.length > 1) {
                mcW.innerText = "⚠️ BELUM SEPAKAT!";
                mcW.style.color = "#ffcc00";
            } else {
                mcW.innerText = consensusTarget && allPlayers[consensusTarget] ? allPlayers[consensusTarget].name : "-";
                mcW.style.color = "#ff3b30";
            }
        }
        
        const mcG = document.getElementById("mc-guardian-target");
        if(mcG) mcG.innerText = gId && allPlayers[gId] ? allPlayers[gId].name : "-";
        
        const mcS = document.getElementById("mc-seer-target");
        if(mcS) mcS.innerText = sId && allPlayers[sId] ? allPlayers[sId].name : "-";
        
        const mcWP = document.getElementById("mc-witch-poison");
        if(mcWP) mcWP.innerText = wpId && allPlayers[wpId] ? allPlayers[wpId].name : "-";
        
        const mcWH = document.getElementById("mc-witch-heal");
        if(mcWH) mcWH.innerText = whId && allPlayers[whId] ? allPlayers[whId].name : "-";
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
        if (mcVoteList) {
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
    }
});

onValue(ref(db, "voteAlert"), (snap) => {
    const alertTrigger = snap.val();
    if (alertTrigger) {
        alert("⚖️ VOTE SERI! ⚖️\nTidak ada eksekusi. Silakan diskusikan kembali dan VOTE ULANG!!");
    }
});


document.getElementById("btn-register-player")?.addEventListener("click", () => {
    const nameInput = document.getElementById("player-name-input").value.trim();
    if (!nameInput) return alert("Masukkan nama kamu!");
    const currentPlayersCount = Object.keys(allPlayers).length;
    if (currentPlayersCount >= 8 && !allPlayers[currentPlayerId]) return alert("Maaf, Lobi sudah penuh! (Maks. 8).");
    set(ref(db, `players/${currentPlayerId}`), { name: nameInput, role: "Belum ada", isDead: false });
});

document.getElementById("btn-reset-players")?.addEventListener("click", () => {
    if(confirm("HAPUS SEMUA PEMAIN dari lobi?")) {
        set(ref(db, "players"), null);
        update(ref(db), { gameState: "lobby", winData: null, nightActions: emptyNightActions, votes: null, voteAlert: null });
    }
});

document.getElementById("btn-start-game")?.addEventListener("click", () => {
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

// Aksi Serigala - Voting Individual (Telah Diperbaiki)
document.getElementById("btn-wolf-kill")?.addEventListener("click", () => {
    const targetId = document.getElementById("wolf-target-select").value;
    
    if (!currentPlayerId) return alert("Error: ID Pemain tidak ditemukan.");
    if (!targetId) return alert("Pilih target terlebih dahulu!");

    set(ref(db, `nightActions/wolfVotes/${currentPlayerId}`), targetId)
        .then(() => alert("Berhasil memilih target!"))
        .catch((error) => {
            console.error("Gagal mengirim vote ke Firebase:", error);
            alert("Gagal kirim vote, cek koneksi!");
        });
});

document.getElementById("btn-guardian-protect")?.addEventListener("click", () => {
    update(ref(db, "nightActions"), { guardianTarget: document.getElementById("guardian-target-select").value })
        .then(() => alert("Perlindungan diaktifkan!"));
});

// Aksi Penerawang - Anti Spam (Telah Diperbaiki)
document.getElementById("btn-seer-reveal")?.addEventListener("click", () => {
    if (currentNightActions && currentNightActions.seerTarget !== "") {
        return alert("🔮 Kamu hanya bisa menerawang SATU pemain setiap malam!");
    }

    const targetId = document.getElementById("seer-target-select").value;
    if (!targetId) return alert("Pilih pemain terlebih dahulu!");
    
    update(ref(db, "nightActions"), { seerTarget: targetId });
    
    const target = allPlayers[targetId];
    const roleStr = rollenUebersetzung[target.role] || target.role;
    const resEl = document.getElementById("seer-result");
    if(resEl) {
        resEl.innerText = `👁️ Identitas Asli ${target.name} adalah ${roleStr}`;
        resEl.classList.remove("hidden");
    }
});

// Aksi Penyihir
document.getElementById("btn-witch-poison")?.addEventListener("click", () => {
    const targetId = document.getElementById("witch-poison-select").value;
    if (targetId) {
        update(ref(db, "nightActions"), { witchPoisonTarget: targetId, witchHealTarget: "" });
        const msg = document.getElementById("witch-status-msg");
        msg.innerText = "Racun telah disiapkan! (Obat dibatalkan jika ada)";
        msg.style.color = "#ff3b30";
        msg.classList.remove("hidden");
    }
});

document.getElementById("btn-witch-heal")?.addEventListener("click", () => {
    const targetId = document.getElementById("witch-heal-select").value;
    if (targetId) {
        update(ref(db, "nightActions"), { witchHealTarget: targetId, witchPoisonTarget: "" });
        const msg = document.getElementById("witch-status-msg");
        msg.innerText = "Obat telah disiapkan! (Racun dibatalkan jika ada)";
        msg.style.color = "#0a84ff";
        msg.classList.remove("hidden");
    }
});

document.getElementById("btn-submit-vote")?.addEventListener("click", () => {
    const target = document.getElementById("day-vote-select").value;
    set(ref(db, `votes/${currentPlayerId}`), target).then(() => {
        const msg = document.getElementById("vote-status-msg");
        if(msg) {
            msg.classList.remove("hidden");
            setTimeout(() => msg.classList.add("hidden"), 3000);
        }
    });
});

// Kalkulasi Malam (MC)
document.getElementById("btn-resolve-night")?.addEventListener("click", () => {
    const wolfVotesObj = currentNightActions.wolfVotes || {};
    const uniqueVotes = [...new Set(Object.values(wolfVotesObj))];
    
    if (uniqueVotes.length > 1) {
        return alert("⚠️ Serigala belum mencapai kesepakatan! Suruh mereka berdiskusi dan pilih target yang sama.");
    }
    
    const wTarget = uniqueVotes.length === 1 ? uniqueVotes[0] : "";
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

document.getElementById("btn-state-lobby")?.addEventListener("click", () => update(ref(db), { gameState: "lobby", votes: null, voteAlert: null }));
document.getElementById("btn-state-nacht")?.addEventListener("click", () => update(ref(db), { gameState: "nacht", nightActions: emptyNightActions, votes: null, voteAlert: null }));
document.getElementById("btn-state-tag")?.addEventListener("click", () => update(ref(db), { gameState: "tag", votes: null, voteAlert: null }));
