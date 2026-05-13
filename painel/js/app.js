const API_BASE = window.location.origin;

function authGuard() {
  const page = window.location.pathname.split('/').pop();
  if (page !== 'index.html' && page !== '' && localStorage.getItem('painel_logado') !== '1') {
    window.location.href = 'index.html';
  }
}

function logout() {
  localStorage.removeItem('painel_logado');
  localStorage.removeItem('painel_user');
  localStorage.removeItem('painel_company_name');
  window.location.href = 'index.html';
}

function apiUrl(path) {
  return path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

async function apiGet(path) {
  const res = await fetch(apiUrl(path));
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro GET');
  return data;
}

async function apiPost(path, body = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro POST');
  return data;
}

async function apiPut(path, body = {}) {
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro PUT');
  return data;
}

async function apiDelete(path) {
  const res = await fetch(apiUrl(path), { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro DELETE');
  return data;
}

async function uploadFile(route, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(apiUrl(route), {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro upload');
  return data;
}

function bindDrawer() {
  const menuBtn = document.getElementById('menuBtn');
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('drawerOverlay');
  const close = document.getElementById('drawerClose');

  if (menuBtn && drawer && overlay) {
    menuBtn.onclick = () => {
      drawer.classList.add('open');
      overlay.classList.add('show');
    };
  }

  if (close && drawer && overlay) {
    close.onclick = () => {
      drawer.classList.remove('open');
      overlay.classList.remove('show');
    };
  }

  if (overlay && drawer) {
    overlay.onclick = () => {
      drawer.classList.remove('open');
      overlay.classList.remove('show');
    };
  }
}

function setDrawerUser() {
  const user = JSON.parse(localStorage.getItem('painel_user') || '{}');
  const drawerUserName = document.getElementById('drawerUserName');
  const drawerUserEmail = document.getElementById('drawerUserEmail');
  const drawerAvatar = document.getElementById('drawerAvatar');

  const companyName =
    (user.companyName || '').trim() ||
    localStorage.getItem('painel_company_name') ||
    'LAUNCHER BOX';

  const email =
    (user.email || '').trim() ||
    'Painel administrativo';

  if (drawerUserName) drawerUserName.textContent = companyName;
  if (drawerUserEmail) drawerUserEmail.textContent = email;
  if (drawerAvatar) drawerAvatar.textContent = (companyName[0] || 'L').toUpperCase();
}

function formatCreditsValidity(value) {
  if (!value) return '--/--/----';
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return value;
  }
}

function getCreditsValidity(settings) {
  if (!settings) return null;
  return settings.creditsExpiresAt || settings.expiresAt || settings.validUntil || settings.validadeCreditos || null;
}

function getAnnualCredits(dashboard) {
  const settings = dashboard.settings || {};
  return Number(settings.annualCredits ?? settings.annual ?? dashboard.annualCreditsInUse ?? 0);
}

function getTwoYearsCredits(dashboard) {
  const settings = dashboard.settings || {};
  return Number(settings.twoYearsCredits ?? settings.twoYears ?? dashboard.twoYearsCreditsInUse ?? 0);
}

function getLayoutLimit(dashboard) {
  const settings = dashboard.settings || {};
  return Number(settings.layoutLimit ?? settings.layoutsLimit ?? settings.maxLayouts ?? dashboard.totalLayouts ?? 0);
}

function getAppsLimit(dashboard) {
  const settings = dashboard.settings || {};
  return Number(settings.appLimit ?? settings.appsLimit ?? settings.maxApps ?? dashboard.totalApps ?? 0);
}

function bindThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const saved = localStorage.getItem('painel_dark_mode');
  if (saved === null) {
    themeToggle.checked = true;
    document.body.classList.remove('light-mode');
  } else {
    themeToggle.checked = saved === '1';
    document.body.classList.toggle('light-mode', saved !== '1');
  }

  themeToggle.addEventListener('change', () => {
    const dark = themeToggle.checked;
    localStorage.setItem('painel_dark_mode', dark ? '1' : '0');
    document.body.classList.toggle('light-mode', !dark);
  });
}

function bindDownloadLauncher() {
  const btn = document.getElementById('downloadLauncherBtn');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const data = await apiGet('/launcher/download');
      if (data && data.url) {
        window.open(apiUrl(data.url), '_blank');
      } else {
        alert('Link do launcher não encontrado.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao baixar launcher.');
    }
  });
}

async function loadDashboardHome() {
  const welcomeTitle = document.getElementById('welcomeTitle');
  const annualCreditsValue = document.getElementById('annualCreditsValue');
  const twoYearsCreditsValue = document.getElementById('twoYearsCreditsValue');
  const creditsValidity = document.getElementById('creditsValidity');
  const layoutLimitValue = document.getElementById('layoutLimitValue');
  const appsLimitValue = document.getElementById('appsLimitValue');

  if (!welcomeTitle) return;

  const localUser = JSON.parse(localStorage.getItem('painel_user') || '{}');

  try {
    const dashboard = await apiGet('/dashboard');
    const settings = dashboard.settings || {};

    const companyName =
      (settings.companyName || '').trim() ||
      (localUser.companyName || '').trim() ||
      'LAUNCHER BOX';

    localStorage.setItem('painel_company_name', companyName);

    welcomeTitle.textContent = `Bem vindo(a) ${companyName.toLowerCase()}`;

    if (annualCreditsValue) annualCreditsValue.textContent = String(getAnnualCredits(dashboard));
    if (twoYearsCreditsValue) twoYearsCreditsValue.textContent = String(getTwoYearsCredits(dashboard));
    if (creditsValidity) creditsValidity.textContent = formatCreditsValidity(getCreditsValidity(settings));
    if (layoutLimitValue) layoutLimitValue.textContent = String(getLayoutLimit(dashboard));
    if (appsLimitValue) appsLimitValue.textContent = String(getAppsLimit(dashboard));

    setDrawerUser();
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);

    const fallbackName =
      (localUser.companyName || '').trim() ||
      'LAUNCHER BOX';

    welcomeTitle.textContent = `Bem vindo(a) ${fallbackName.toLowerCase()}`;

    if (annualCreditsValue) annualCreditsValue.textContent = '0';
    if (twoYearsCreditsValue) twoYearsCreditsValue.textContent = '0';
    if (creditsValidity) creditsValidity.textContent = '--/--/----';
    if (layoutLimitValue) layoutLimitValue.textContent = '0';
    if (appsLimitValue) appsLimitValue.textContent = '0';

    setDrawerUser();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  authGuard();
  bindDrawer();
  setDrawerUser();
  bindThemeToggle();
  bindDownloadLauncher();
  await loadDashboardHome();
});