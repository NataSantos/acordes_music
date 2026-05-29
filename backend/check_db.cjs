const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Tables:', tables.map(t => t.name).join(', '));
if (tables.some(t => t.name === 'Usuario')) {
  const rows = db.prepare('SELECT cpf, nome, role FROM Usuario').all();
  console.log('Users:');
  rows.forEach(r => console.log(' ', r.cpf, r.nome, r.role));
}
db.close();
