// app.js - shared scripting including Supabase initialization and page logic

// ---------- configuration ------------------------------------------------
const SUPABASE_URL = 'https://btgmrkegxklmlmnvyprp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_a1WTSCUNIFMOVu317oOd-Q_Cm1ajCNH';
// make sure you've created a "packages" bucket and table in your Supabase project
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- auth helpers ---------------------------------------------------
async function checkUser() {
  const user = supabase.auth.user();
  const statusEl = document.getElementById('user-status');
  if (user) {
    statusEl.textContent = `Přihlášen jako ${user.email}`;
  } else {
    statusEl.innerHTML = '<a href="#" id="login-link">Přihlásit</a>';
    document.getElementById('login-link').addEventListener('click', () => {
      // TODO: implement login / signup flow (Supabase auth)
      alert('Přihlášení zatím není implementováno');
    });
  }
}

// ---------- UI helpers -----------------------------------------------------
function showSection(name) {
  const sections = ['home', 'upload', 'map'];
  sections.forEach((sec) => {
    const el = document.getElementById(`${sec}-section`);
    if (el) el.style.display = sec === name ? '' : 'none';
  });
}

// ---------- package listing & search --------------------------------------
async function fetchAndRender(search = '', tags = '') {
  let { data, error } = await supabase.from('packages').select('*');
  if (error) {
    console.error('Chyba při načítání balíčků', error);
    return;
  }
  let pkgs = data || [];
  if (search) {
    const term = search.toLowerCase();
    pkgs = pkgs.filter((p) => p.title && p.title.toLowerCase().includes(term));
  }
  if (tags) {
    const tagList = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t);
    if (tagList.length) {
      pkgs = pkgs.filter((p) => {
        const pTags = (p.tags || '').toLowerCase();
        return tagList.every((t) => pTags.includes(t));
      });
    }
  }
  renderPackages(pkgs);
}

function renderPackages(pkgs) {
  const list = document.getElementById('package-list');
  list.innerHTML = '';
  if (!pkgs.length) {
    list.textContent = 'Žádné balíčky k zobrazení';
    return;
  }
  pkgs.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'package-card';
    card.innerHTML = `
      <h3>${p.title}</h3>
      <p>${p.description || ''}</p>
      <p>Cena: ${p.price != null ? p.price + ' CZK' : 'zdarma'}</p>
      <p>Tagy: ${p.tags || ''}</p>
      <button class="view-btn">Zobrazit</button>
    `;
    card.querySelector('.view-btn').addEventListener('click', () => openPackage(p));
    list.appendChild(card);
  });
}

function openPackage(pkg) {
  // open in new tab/window but reuse the same HTML, passing params
  const url = `index.html?view=map&fileUrl=${encodeURIComponent(
    pkg.file_url
  )}&title=${encodeURIComponent(pkg.title)}`;
  window.open(url, '_blank');
}

// ---------- upload --------------------------------------------------------
let previewMap = null;
let previewLayer = null;

async function handleUpload(e) {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const price = parseFloat(document.getElementById('price').value);
  const tags = document.getElementById('tags').value;
  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];
  if (!file) {
    alert('Vyberte soubor');
    return;
  }

  // upload to storage
  const fileName = `${Date.now()}_${file.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('packages')
    .upload(fileName, file, { upsert: true });
  if (uploadError) {
    console.error(uploadError);
    alert('Chyba při nahrávání souboru');
    return;
  }
  const { data: urlData } = supabase.storage.from('packages').getPublicUrl(fileName);
  const file_url = urlData.publicUrl;

  const { error: insertError } = await supabase.from('packages').insert([
    { title, description, price, tags, file_url },
  ]);
  if (insertError) {
    console.error(insertError);
    alert('Chyba při ukládání metadat');
    return;
  }
  alert('Balíček úspěšně nahrán');
  showSection('home');
  fetchAndRender();
  e.target.reset();
}

function initPreviewMap() {
  if (previewMap) return previewMap;
  previewMap = L.map('preview-map').setView([50.0755, 14.4378], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(previewMap);
  return previewMap;
}

function updateInfoPanel(name, data) {
  const panel = document.getElementById('park-info-panel');
  let count = 0;
  let type = 'Neznámý';
  if (data && data.features) {
    count = data.features.length;
    type = 'GeoJSON';
  } else if (data && data.geometry) {
    count = 1;
    type = 'GeoJSON';
  }
  panel.innerHTML = `
    <strong>Název:</strong> ${name}<br>
    <strong>Prvky:</strong> ${count}<br>
    <strong>Typ:</strong> ${type}
  `;
}

function fitMap(map, layer) {
  if (!layer) return;
  const bounds = layer.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds.pad(0.25));
  }
}

function processFile(file) {
  const name = file.name;
  const ext = name.split('.').pop().toLowerCase();
  initPreviewMap();
  if (previewLayer) {
    previewMap.removeLayer(previewLayer);
    previewLayer = null;
  }
  if (ext === 'geojson' || ext === 'json') {
    file.text().then((text) => {
      const data = JSON.parse(text);
      previewLayer = L.geoJSON(data).addTo(previewMap);
      updateInfoPanel(name, data);
      fitMap(previewMap, previewLayer);
    });
  } else if (ext === 'kml') {
    file.text().then((text) => {
      const layer = omnivore.kml.parse(text);
      previewLayer = layer.addTo(previewMap);
      updateInfoPanel(name, layer.toGeoJSON ? layer.toGeoJSON() : {});
      fitMap(previewMap, previewLayer);
    });
  } else if (ext === 'zip') {
    // shp.js returns geojson object
    shp(file)
      .then((data) => {
        previewLayer = L.geoJSON(data).addTo(previewMap);
        updateInfoPanel(name, data);
        fitMap(previewMap, previewLayer);
      })
      .catch((err) => {
        console.error(err);
        alert('Chyba při čtení shapefile');
      });
  } else {
    alert('Nepodporovaný formát. Použijte GeoJSON, KML nebo ZIP shapefile.');
  }
}

function initDropzone() {
  const dz = document.getElementById('dropzone');
  const fileInput = document.getElementById('file');
  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('hover');
  });
  dz.addEventListener('dragleave', (e) => {
    dz.classList.remove('hover');
  });
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('hover');
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files; // fill underlying input for upload
      processFile(file);
    }
  });
  dz.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processFile(file);
  });
}

// ---------- map view ------------------------------------------------------
function initMap(fileUrl, title) {
  document.getElementById('map-title').textContent = title || 'Vrstva';
  const map = L.map('map').setView([50.0755, 14.4378], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
  }).addTo(map);
  if (fileUrl) {
    if (fileUrl.toLowerCase().endsWith('.geojson')) {
      fetch(fileUrl)
        .then((r) => r.json())
        .then((data) => L.geoJSON(data).addTo(map))
        .catch(console.error);
    } else {
      console.warn('Nepodporovaný formát vrstvy pro zobrazení', fileUrl);
    }
  }
}

// ---------- initialization ------------------------------------------------
function init() {
  checkUser();
  // navigation
  document
    .getElementById('search-btn')
    .addEventListener('click', () => {
      const search = document.getElementById('search-input').value;
      const tags = document.getElementById('tags-input').value;
      fetchAndRender(search, tags);
    });
  document
    .getElementById('home-link')
    .addEventListener('click', (e) => {
      e.preventDefault();
      showSection('home');
      fetchAndRender();
    });
  document
    .getElementById('upload-link')
    .addEventListener('click', (e) => {
      e.preventDefault();
      showSection('upload');
    });

  const uploadForm = document.getElementById('upload-form');
  if (uploadForm) uploadForm.addEventListener('submit', handleUpload);
  if (document.getElementById('dropzone')) initDropzone();

  const params = new URLSearchParams(location.search);
  if (params.get('view') === 'map') {
    showSection('map');
    initMap(params.get('fileUrl'), params.get('title'));
  } else {
    showSection('home');
    fetchAndRender();
  }
}

document.addEventListener('DOMContentLoaded', init);
