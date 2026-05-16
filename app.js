const supabaseUrl = 'https://jkooajqvdgqzwklmfbxv.supabase.co'; 
const supabaseKey = 'sb_publishable_COo144VrJvkkyvNSzMD6pA_9qRgCkg9';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let myProfileData = null;

window.onload = async function() {
    await checkUserSession();
    
    // Erstes Laden der Turniere beim Starten der Seite
    loadTournaments();
    
    // AUTOMATISCHER REFRESH: Läuft alle 5000 Millisekunden (5 Sekunden) im Hintergrund
    setInterval(function() {
        loadTournaments();
        if (currentUser) {
            loadMyTeams(); // Aktualisiert auch die Teams, falls sich da was ändert
        }
    }, 5000);
};

function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// === ALERTS ERSETZEN ===
function showMessage(text, isError = false) {
    const msgBox = document.getElementById('status-message');
    msgBox.innerText = text;
    msgBox.style.background = isError ? '#ff4444' : '#00c851';
    msgBox.style.display = 'block';
    setTimeout(() => { msgBox.style.display = 'none'; }, 4000);
}

// === DISCORD LOGIN & PROFIL-SYNC ===
async function loginWithDiscord() {
    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) console.error("Login Fehler:", error.message);
}

async function logout() {
    await _supabase.auth.signOut();
    window.location.reload();
}

async function checkUserSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('nav-create').style.display = 'block';
        document.getElementById('nav-teams').style.display = 'block';
        document.getElementById('nav-profile').style.display = 'block';
        
        await syncAndLoadProfile();
        loadMyTeams();
    }
}

async function syncAndLoadProfile() {
    // 1. Schauen ob Profil existiert
    let { data: profile } = await _supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    
    // Discord Metadaten auslesen
    const discordName = currentUser.user_metadata.full_name || currentUser.user_metadata.name;
    const discordAvatar = currentUser.user_metadata.avatar_url;

    if (!profile) {
        // Falls neu, mit Discord-Daten erstellen
        const { data: newProfile } = await _supabase.from('profiles').insert([{ 
            id: currentUser.id, 
            username: discordName, 
            avatar_url: discordAvatar 
        }]).select().single();
        profile = newProfile;
    } else if (!profile.username) {
        // Falls Profil da, aber leer, updaten
        await _supabase.from('profiles').update({ username: discordName, avatar_url: discordAvatar }).eq('id', currentUser.id);
        profile.username = discordName;
        profile.avatar_url = discordAvatar;
    }

    myProfileData = profile;

    // UI befüllen
    if (profile.avatar_url) {
        const img = document.getElementById('profile-avatar');
        img.src = profile.avatar_url;
        img.style.display = 'inline-block';
    }
    document.getElementById('profile-username').value = profile.username || '';
    document.getElementById('profile-platform').value = profile.gaming_platform || 'epic';
    document.getElementById('profile-gaming-name').value = profile.gaming_username || '';
}

async function updateProfile() {
    const newName = document.getElementById('profile-username').value;
    const platform = document.getElementById('profile-platform').value;
    const gName = document.getElementById('profile-gaming-name').value;

    const { error } = await _supabase.from('profiles').update({
        username: newName,
        gaming_platform: platform,
        gaming_username: gName
    }).eq('id', currentUser.id);

    if (error) {
        showMessage("Fehler beim Speichern: " + error.message, true);
    } else {
        showMessage("Profil erfolgreich aktualisiert!");
        myProfileData.username = newName;
        myProfileData.gaming_platform = platform;
        myProfileData.gaming_username = gName;
        loadTournaments(); // Dashboard refreshen wegen Anmelde-Buttons
    }
}

// === TURNIER LOGIK & REGISTRIERUNG ===
async function saveTournament() {
    const name = document.getElementById('t-name').value;
    const mode = document.getElementById('t-mode').value;
    if(!name) return showMessage("Bitte Gib einen Namen ein!", true);

    const { error } = await _supabase.from('tournaments').insert([{ name, game_mode: mode }]);

    if (error) { showMessage(error.message, true); } 
    else {
        showMessage("Turnier veröffentlicht!");
        document.getElementById('t-name').value = '';
        loadTournaments();
        showSection('dashboard');
    }
}

async function loadTournaments() {
    const { data: tournaments } = await _supabase.from('tournaments').select('*');
    const { data: participants } = await _supabase.from('tournament_participants').select('*');
    
    const list = document.getElementById('tournament-list');
    list.innerHTML = '';

    if (tournaments) {
        tournaments.forEach(t => {
            // Filtern, wer für dieses Turnier angemeldet ist
            const tParts = participants ? participants.filter(p => p.tournament_id === t.id) : [];
            let partsListHTML = tParts.map(p => `<li>🚗 [${p.gaming_platform.toUpperCase()}] ${p.gaming_username} ${p.team_name ? `(Team: ${p.team_name})` : ''}</li>`).join('');

            // Prüfen ob User schon angemeldet ist
            const isRegistered = currentUser ? tParts.some(p => p.user_id === currentUser.id) : false;

            list.innerHTML += `
                <div class="tournament-card">
                    <h3>${t.name}</h3>
                    <p>Modus: ⚽ <strong>${t.game_mode}</strong></p>
                    
                    ${currentUser ? `
                        ${isRegistered ? 
                            `<button class="action-btn" style="background:#555;" disabled>Bereits angemeldet</button>` : 
                            `<button class="action-btn" onclick="joinTournament(${t.id}, '${t.game_mode}')">Jetzt Anmelden</button>`
                        }
                    ` : '<p><i>Logge dich ein, um beizutreten</i></p>'}

                    <div class="participant-box">
                        <h4>Teilnehmer (${tParts.length}):</h4>
                        <ul>${partsListHTML || '<li>Noch keine Anmeldungen</li>'}</ul>
                    </div>
                </div>
            `;
        });
    }
}

async function joinTournament(tournamentId, gameMode) {
    if (!currentUser) return showMessage("Bitte logge dich ein!", true);
    
    // Prüfen ob Tracker-Daten im Profil hinterlegt sind
    if (!myProfileData || !myProfileData.gaming_username) {
        showMessage("Bitte trage zuerst deine Epic/Steam Daten im Profil ein!", true);
        showSection('profile');
        return;
    }

    let chosenTeam = null;

    // Automatische Beachtung der Team Size
    if (gameMode === '2v2' || gameMode === '3v3') {
        chosenTeam = prompt("Für 2v2/3v3 Turniere: Bitte gib deinen Teamnamen ein:");
        if (!chosenTeam) return showMessage("Anmeldung abgebrochen. Teamname wird für diesen Modus benötigt.", true);
    }

    const { error } = await _supabase.from('tournament_participants').insert([{
        tournament_id: tournamentId,
        user_id: currentUser.id,
        team_name: chosenTeam,
        gaming_username: myProfileData.gaming_username,
        gaming_platform: myProfileData.gaming_platform
    }]);

    if (error) {
        showMessage("Fehler bei Anmeldung: " + error.message, true);
    } else {
        showMessage("Erfolgreich für das Turnier angemeldet!");
        loadTournaments();
    }
}

// === TEAMS (REST) ===
async function createTeam() {
    const teamName = document.getElementById('team-name').value;
    if(!teamName) return showMessage("Bitte Teamnamen eingeben!", true);
    await _supabase.from('teams').insert([{ team_name: teamName }]);
    document.getElementById('team-name').value = '';
    loadMyTeams();
}

async function loadMyTeams() {
    const { data } = await _supabase.from('teams').select('*');
    const list = document.getElementById('my-teams-list');
    list.innerHTML = data ? data.map(team => `<li>🛡️ ${team.team_name}</li>`).join('') : '';
}
