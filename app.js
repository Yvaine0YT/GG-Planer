const _supabase = supabase.createClient('DEINE_SUPABASE_URL', 'DEIN_ANON_KEY');

// Sektionen umschalten
function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// Turnier in Datenbank speichern
async function saveTournament() {
    const name = document.getElementById('t-name').value;
    const mode = document.getElementById('t-mode').value;

    const { data, error } = await _supabase
        .from('tournaments')
        .insert([{ name: name, game_mode: mode }]);

    if (error) {
        alert("Fehler: " + error.message);
    } else {
        alert("Turnier '" + name + "' wurde erstellt!");
        loadTournaments();
        showSection('dashboard');
    }
}

// Turniere laden
async function loadTournaments() {
    const { data, error } = await _supabase.from('tournaments').select('*');
    const list = document.getElementById('tournament-list');
    list.innerHTML = '';

    data.forEach(t => {
        list.innerHTML += `
            <div class="tournament-card">
                <h3>${t.name}</h3>
                <p>Modus: ${t.game_mode}</p>
            </div>
        `;
    });
}

// Initial laden
loadTournaments();
