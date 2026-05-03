const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.use('/painel', express.static(path.join(__dirname, '..', 'painel')));
app.use('/downloads', express.static(path.join(__dirname, 'public')));

// =====================
// UPLOAD
// =====================
const uploadDir = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function fileUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/downloads/uploads/${filename}`;
}

function safeName(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = path.basename(originalName || 'arquivo', ext)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 45);

  return `${Date.now()}-${uid()}-${base}${ext}`;
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => cb(null, safeName(file.originalname))
});

const upload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024
  }
});

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function getDevicesSafe() {
  try {
    return db.getDevices();
  } catch {
    return [];
  }
}

function saveDevicesSafe(data) {
  db.saveDevices(Array.isArray(data) ? data : []);
}

function criarFundosPadrao() {
  try {
    const fundos = db.getBackgrounds();

    if (Array.isArray(fundos) && fundos.length > 0) return;

    db.saveBackgrounds([
      {
        id: uid(),
        nome: 'Fundo Azul',
        imagem: 'https://picsum.photos/800/400?1',
        createdAt: new Date().toISOString()
      },
      {
        id: uid(),
        nome: 'Fundo Tech',
        imagem: 'https://picsum.photos/800/400?2',
        createdAt: new Date().toISOString()
      },
      {
        id: uid(),
        nome: 'Fundo Claro',
        imagem: 'https://picsum.photos/800/400?3',
        createdAt: new Date().toISOString()
      }
    ]);
  } catch (e) {
    console.log('Erro ao criar fundos padrão:', e);
  }
}

// =====================
// HOME
// =====================
app.get('/', (req, res) => {
  res.redirect('/painel/index.html');
});

// =====================
// LOGIN
// =====================
app.post('/login', (req, res) => {
  try {
    const settings = db.getSettings();
    const { email, password } = req.body;

    if (email === settings.email && password === settings.masterPassword) {
      return res.json({ ok: true });
    }

    res.status(401).json({ ok: false, message: 'Login inválido' });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro no login' });
  }
});

// =====================
// APPS
// =====================
app.get('/apps', (req, res) => {
  try {
    res.json(db.getApps());
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao carregar aplicativos' });
  }
});

app.post('/apps', (req, res) => {
  try {
    const apps = db.getApps();

    const novo = {
      id: uid(),
      name: req.body.name || 'APP SEM NOME',
      package: req.body.package || '',
      version: req.body.version || '',
      apk: req.body.apk || '',
      icon: req.body.icon || '',
      notes: req.body.notes || '',
      mode: req.body.mode || 'auto',
      active: req.body.active !== false,
      autoInstall: req.body.autoInstall || false,
      createdAt: new Date().toISOString()
    };

    apps.push(novo);
    db.saveApps(apps);

    res.json({ ok: true, app: novo });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao salvar aplicativo' });
  }
});

app.put('/apps/:id', (req, res) => {
  try {
    const apps = db.getApps();
    const index = apps.findIndex(appItem => String(appItem.id) === String(req.params.id));

    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Aplicativo não encontrado' });
    }

    apps[index] = {
      ...apps[index],
      name: req.body.name ?? apps[index].name,
      package: req.body.package ?? apps[index].package,
      version: req.body.version ?? apps[index].version,
      apk: req.body.apk ?? apps[index].apk,
      icon: req.body.icon ?? apps[index].icon,
      notes: req.body.notes ?? apps[index].notes,
      active: req.body.active ?? apps[index].active,
      updatedAt: new Date().toISOString()
    };

    db.saveApps(apps);

    res.json({ ok: true, app: apps[index] });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao editar aplicativo' });
  }
});

app.delete('/apps/:id', (req, res) => {
  try {
    const apps = db.getApps();
    const filtrados = apps.filter(appItem => String(appItem.id) !== String(req.params.id));

    db.saveApps(filtrados);

    res.json({ ok: true });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao excluir aplicativo' });
  }
});

app.post('/upload/apk', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Nenhum APK enviado' });
    }

    const ext = path.extname(req.file.originalname || '').toLowerCase();

    if (ext !== '.apk') {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}

      return res.status(400).json({
        ok: false,
        message: 'Arquivo inválido. Envie somente arquivo .apk'
      });
    }

    res.json({
      ok: true,
      url: fileUrl(req, req.file.filename),
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao enviar APK' });
  }
});

app.post('/upload/icon', upload.single('imagem'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Nenhuma imagem enviada' });
    }

    res.json({
      ok: true,
      url: fileUrl(req, req.file.filename),
      filename: req.file.filename
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao enviar ícone' });
  }
});

// =====================
// FUNDOS
// =====================
app.get('/backgrounds', (req, res) => {
  try {
    criarFundosPadrao();
    res.json(db.getBackgrounds());
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao carregar fundos' });
  }
});

app.post('/backgrounds', upload.single('imagem'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Nenhuma imagem enviada' });
    }

    const fundos = db.getBackgrounds();

    const novo = {
      id: uid(),
      nome: req.body.nome || 'Sem nome',
      imagem: fileUrl(req, req.file.filename),
      createdAt: new Date().toISOString()
    };

    fundos.push(novo);
    db.saveBackgrounds(fundos);

    res.json({ ok: true, fundo: novo });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao salvar fundo' });
  }
});

// =====================
// LAYOUTS
// =====================
app.get('/layouts', (req, res) => {
  try {
    res.json(db.getLayouts());
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao carregar layouts' });
  }
});

app.get('/layouts/:id', (req, res) => {
  try {
    const layouts = db.getLayouts();
    const layout = layouts.find(l => String(l.id) === String(req.params.id));

    if (!layout) {
      return res.status(404).json({ ok: false, message: 'Layout não encontrado' });
    }

    res.json({ ok: true, layout });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao carregar layout' });
  }
});

app.post('/layouts', (req, res) => {
  try {
    const layouts = db.getLayouts();

    const novo = {
      id: uid(),
      name: req.body.name || 'Layout sem nome',
      logo: req.body.logo || '',
      background: req.body.background || '',
      backgroundId: req.body.backgroundId || '',
      logoPosition: req.body.logoPosition || 'left',
      buttonsLocked: req.body.buttonsLocked || false,
      unlockPassword: req.body.unlockPassword || '',
      showAppsButton: req.body.showAppsButton ?? true,
      iconSize: req.body.iconSize || 'default',
      clockSize: req.body.clockSize || 'default',
      expireSize: req.body.expireSize || 'default',
      bannerPosition: req.body.bannerPosition || 'left',
      datePosition: req.body.datePosition || 'left',
      bannerInterval: req.body.bannerInterval || 5,
      autoUpdate: req.body.autoUpdate || false,
      banners: req.body.banners || [],
      apps: req.body.apps || [],
      mainApps: req.body.mainApps || [],
      secondaryApps: req.body.secondaryApps || [],
      links: req.body.links || [],
      createdAt: new Date().toISOString()
    };

    layouts.push(novo);
    db.saveLayouts(layouts);

    res.json({ ok: true, layout: novo });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao salvar layout' });
  }
});

app.put('/layouts/:id', (req, res) => {
  try {
    const layouts = db.getLayouts();
    const index = layouts.findIndex(l => String(l.id) === String(req.params.id));

    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Layout não encontrado' });
    }

    layouts[index] = {
      ...layouts[index],
      name: req.body.name ?? layouts[index].name,
      logo: req.body.logo ?? layouts[index].logo,
      background: req.body.background ?? layouts[index].background,
      backgroundId: req.body.backgroundId ?? layouts[index].backgroundId,
      logoPosition: req.body.logoPosition ?? layouts[index].logoPosition,
      buttonsLocked: req.body.buttonsLocked ?? layouts[index].buttonsLocked,
      unlockPassword: req.body.unlockPassword ?? layouts[index].unlockPassword,
      showAppsButton: req.body.showAppsButton ?? layouts[index].showAppsButton,
      iconSize: req.body.iconSize ?? layouts[index].iconSize,
      clockSize: req.body.clockSize ?? layouts[index].clockSize,
      expireSize: req.body.expireSize ?? layouts[index].expireSize,
      bannerPosition: req.body.bannerPosition ?? layouts[index].bannerPosition,
      datePosition: req.body.datePosition ?? layouts[index].datePosition,
      bannerInterval: req.body.bannerInterval ?? layouts[index].bannerInterval,
      autoUpdate: req.body.autoUpdate ?? layouts[index].autoUpdate,
      banners: req.body.banners ?? layouts[index].banners,
      updatedAt: new Date().toISOString()
    };

    db.saveLayouts(layouts);

    res.json({ ok: true, layout: layouts[index] });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao editar layout' });
  }
});

app.delete('/layouts/:id', (req, res) => {
  try {
    const layouts = db.getLayouts();
    const filtrados = layouts.filter(l => String(l.id) !== String(req.params.id));

    db.saveLayouts(filtrados);

    res.json({ ok: true });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao excluir layout' });
  }
});

// SALVAR APPS NO LAYOUT
app.put('/layouts/:id/apps', (req, res) => {
  try {
    const layouts = db.getLayouts();
    const index = layouts.findIndex(l => String(l.id) === String(req.params.id));

    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Layout não encontrado' });
    }

    layouts[index] = {
      ...layouts[index],
      apps: Array.isArray(req.body.apps) ? req.body.apps : [],
      mainApps: Array.isArray(req.body.mainApps) ? req.body.mainApps : [],
      secondaryApps: Array.isArray(req.body.secondaryApps) ? req.body.secondaryApps : [],
      updatedAt: new Date().toISOString()
    };

    db.saveLayouts(layouts);

    res.json({ ok: true, layout: layouts[index] });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao salvar apps no layout' });
  }
});

// =====================
// DEVICES
// =====================
app.get('/devices', (req, res) => {
  try {
    res.json(getDevicesSafe());
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao carregar dispositivos' });
  }
});

app.get('/launcher/device/:code', (req, res) => {
  try {
    const code = normalizeCode(req.params.code);
    const devices = getDevicesSafe();

    let device = devices.find(d => normalizeCode(d.code) === code);

    if (!device) {
      device = {
        id: uid(),
        code,
        active: false,
        registered: false,
        createdAt: new Date().toISOString()
      };

      devices.push(device);
      saveDevicesSafe(devices);

      return res.json({
        ok: true,
        registered: false,
        active: false,
        activated: false,
        message: 'Dispositivo não registrado',
        device,
        layout: null,
        apps: [],
        mainApps: [],
        secondaryApps: []
      });
    }

    const isActive = device.active === true || device.activated === true;

    const layouts = db.getLayouts();
    const apps = db.getApps();

    const layout = layouts.find(l => String(l.id) === String(device.layoutId)) || null;

    const mainIds = layout && Array.isArray(layout.mainApps) ? layout.mainApps : [];
    const secondaryIds = layout && Array.isArray(layout.secondaryApps) ? layout.secondaryApps : [];
    const allIds = layout && Array.isArray(layout.apps) ? layout.apps : [...mainIds, ...secondaryIds];

    const mainApps = apps.filter(appItem => mainIds.includes(appItem.id) && appItem.active !== false);
    const secondaryApps = apps.filter(appItem => secondaryIds.includes(appItem.id) && appItem.active !== false);
    const layoutApps = apps.filter(appItem => allIds.includes(appItem.id) && appItem.active !== false);

    res.json({
      ok: true,
      registered: true,
      active: isActive,
      activated: isActive,
      message: isActive ? 'Dispositivo ativado' : 'Dispositivo aguardando ativação',
      device,
      client: device.client || null,
      layoutId: device.layoutId || '',
      layout,
      apps: layoutApps,
      mainApps,
      secondaryApps,
      expiresAt: device.expiresAt || device.client?.expiresAt || null
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao verificar dispositivo' });
  }
});

app.post('/devices/:id/complete-activation', (req, res) => {
  try {
    const devices = getDevicesSafe();
    const index = devices.findIndex(d => String(d.id) === String(req.params.id));

    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Dispositivo não encontrado' });
    }

    devices[index] = {
      ...devices[index],
      registered: true,
      active: true,
      activated: true,
      name: req.body.name || devices[index].name || '',
      phone: req.body.phone || '',
      notes: req.body.notes || '',
      planName: req.body.planName || '',
      expiresAt: req.body.expiresAt || null,
      blockOnExpire: req.body.blockOnExpire || 'NÃO',
      forceBlockWrongTime: req.body.forceBlockWrongTime || 'SIM',
      allowDateSettings: req.body.allowDateSettings || 'NÃO',
      layoutId: req.body.layoutId || '',
      type: req.body.type || 'annual',
      activatedAt: new Date().toISOString(),
      client: {
        name: req.body.name || '',
        phone: req.body.phone || '',
        notes: req.body.notes || '',
        plan: req.body.planName || '',
        expiresAt: req.body.expiresAt || null
      }
    };

    saveDevicesSafe(devices);

    res.json({
      ok: true,
      registered: true,
      active: true,
      activated: true,
      device: devices[index]
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao ativar dispositivo' });
  }
});

app.put('/devices/:id', (req, res) => {
  try {
    const devices = getDevicesSafe();
    const index = devices.findIndex(d => String(d.id) === String(req.params.id));

    if (index === -1) {
      return res.status(404).json({ ok: false, message: 'Dispositivo não encontrado' });
    }

    devices[index] = {
      ...devices[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    saveDevicesSafe(devices);

    res.json({ ok: true, device: devices[index] });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao editar dispositivo' });
  }
});

app.delete('/devices/:id', (req, res) => {
  try {
    const devices = getDevicesSafe();
    const filtrados = devices.filter(device => String(device.id) !== String(req.params.id));

    saveDevicesSafe(filtrados);
    res.json({ ok: true });
  } catch (e) {
    console.log(e);
    res.status(500).json({ ok: false, message: 'Erro ao excluir dispositivo' });
  }
});

// =====================
// ERROS DE UPLOAD
// =====================
app.use((err, req, res, next) => {
  console.log('ERRO GLOBAL:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        ok: false,
        message: 'Arquivo muito grande. Limite atual: 300MB.'
      });
    }

    return res.status(400).json({
      ok: false,
      message: 'Erro no upload: ' + err.message
    });
  }

  res.status(500).json({
    ok: false,
    message: err.message || 'Erro interno do servidor'
  });
});

// =====================
// START
// =====================
app.listen(PORT, () => {
  criarFundosPadrao();
  console.log('Servidor rodando na porta:', PORT);
});