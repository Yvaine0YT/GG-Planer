const supabaseUrl = 'https://jkooajqvdgqzwklmfbxv.supabase.co'; 
const supabaseKey = 'sb_publishable_COo144VrJvkkyvNSzMD6pA_9qRgCkg9';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isPremiumUser = false; // Wird aus der DB geladen

// Beim Laden der Seite direkt den Login-Status prüfen
window.onload = async function() {
    checkUserSession();
    loadTournaments();
    showSection('dashboard');
};

function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// === AUTHENTIFIZIERUNG (DISCORD) ===
async function loginWithDiscord() {
    const { data, error } = await _supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
            // Leitet den User nach dem Login zurück auf deine GitHub Page
            redirectTo: window.location.origin + window.location.pathname
        }
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
        
        // Premium-Status aus der "profiles" Tabelle checken
        checkPremiumStatus(currentUser.id);
    }
}

async function checkPremiumStatus(userId) {
    const { data, error } = await _supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', userId)
        .single();
        
    if (data && data.is_premium) {
        isPremiumUser = true;
        document.getElementById('premium-lock').style.display = 'none';
        document.getElementById('team-manager-ui').style.display = 'block';
    }
}

// === TURNIER LOGIK (ÖFFENTLICH) ===
async function saveTournament() {
    if (!currentUser) return alert("Du musst eingeloggt sein!");
    
    const name = document.getElementById('t-name').value;
    const mode = document.getElementById('t-mode').value;

    const { data, error } = await _supabase
        .from('tournaments')
        .insert([{ name: name, game_mode: mode }]);

    if (error) {
        alert("Fehler: " + error.message);
    } else {
        alert("Turnier '" + name + "' wurde veröffentlicht!");
        document.getElementById('t-name').value = '';
        loadTournaments();
        showSection('dashboard');
    }
}

async function loadTournaments() {
    const { data, error } = await _supabase.from('tournaments').select('*');
    const list = document.getElementById('tournament-list');
    list.innerHTML = '';

    if (data) {
        data.forEach(t => {
            list.innerHTML += `
                <div class="tournament-card">
                    <h3>${t.name}</h3>
                    <p>Modus: ⚽ ${t.game_mode}</p>
                </div>
            `;
        });
    }
}

// === TEAM LOGIK (PREMIUM) ===
async function createTeam() {
    if (!isPremiumUser) return alert("PRO Feature benötigt!");
    
    const teamName = document.getElementById('team-name').value;
    if(!teamName) return;

    const { data, error } = await _supabase
        .from('teams')
        .insert([{ team_name: teamName }]);

    if (error) {
        alert("Fehler: " + error.message);
    } else {
        alert(`Team "${teamName}" erfolgreich gegründet!`);
        document.getElementById('team-name').value = '';
        loadMyTeams();
    }
}

async function loadMyTeams() {
    if (!currentUser) return;
    const { data, error } = await _supabase.from('teams').select('*');
    const list = document.getElementById('my-teams-list');
    list.innerHTML = '';

    if (data) {
        data.forEach(team => {
            list.innerHTML += `<li>🛡️ ${team.team_name}</li>`;
        });
    }
}
