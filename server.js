const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.urlencoded({ extended: false }));

const config = {
  host: process.env.DB_HOST || 'database',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let pool;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function initDb() {
  for (let i = 1; i <= 30; i++) {
    try {
      pool = mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 5 });
      await pool.query(`CREATE TABLE IF NOT EXISTS notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      console.log('Database siap.');
      return;
    } catch (e) {
      console.log(`Database belum siap (${i}/30): ${e.message}`);
      await sleep(2000);
    }
  }
  process.exit(1);
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT id, content, created_at FROM notes ORDER BY id DESC');
  const items = rows
    .map(
      (n) => `<li>${esc(n.content)} <small>(${new Date(n.created_at).toLocaleString('id-ID')})</small>
      <form method="post" action="/notes/${n.id}/delete" style="display:inline"><button>Hapus</button></form></li>`
    )
    .join('');
  res.send(`<!doctype html><html lang="id"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1"><title>Catatan Docker</title>
  <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 16px}
  input{padding:8px;width:65%}button{padding:8px 12px}li{margin:10px 0}</style></head><body>
  <h1>Catatan Docker</h1>
  <p>Aplikasi Express + MySQL yang berjalan di Docker (Azure VM).</p>
  <form method="post" action="/notes"><input name="content" maxlength="255" placeholder="Tulis catatan..." required>
  <button>Tambah</button></form>
  <ul>${items || '<li>Belum ada catatan.</li>'}</ul></body></html>`);
});

app.post('/notes', async (req, res) => {
  const content = (req.body.content || '').trim().slice(0, 255);
  if (content) await pool.query('INSERT INTO notes (content) VALUES (?)', [content]);
  res.redirect('/');
});

app.post('/notes/:id/delete', async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
  res.redirect('/');
});

initDb().then(() => app.listen(3000, () => console.log('Server jalan di port 3000')));
