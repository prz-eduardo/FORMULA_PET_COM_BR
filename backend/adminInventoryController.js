// adminInventoryController.js
// Inventory and units controller for admin
const db = require('./db');

function toPaged(rows, page, pageSize, total) {
  return { data: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

module.exports = {
  async listUnits(req, res) {
    try {
      const [rows] = await db.query('SELECT code, name, kind, factor_to_base FROM units ORDER BY kind, code');
      res.json({ data: rows });
    } catch (e) { console.error(e); res.status(500).json({ error: 'units_list_failed' }); }
  },

  async listEstoque(req, res) {
    try {
      const q = (req.query.q || '').trim();
      const page = Math.max(parseInt(req.query.page || '1'), 1);
      const pageSize = Math.max(parseInt(req.query.pageSize || '20'), 1);
      const offset = (page - 1) * pageSize;

      const where = [];
      const params = [];
      if (q) { where.push('(ea.lote LIKE ? OR ea.location LIKE ? OR a.nome LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [countRows] = await db.query(
        `SELECT COUNT(*) as c FROM estoque_ativos ea LEFT JOIN ativos a ON a.id = ea.ativo_id ${whereSql}`,
        params
      );
      const total = countRows[0]?.c || 0;

      const [rows] = await db.query(
        `SELECT ea.*, a.nome AS ativo_nome, u.name AS unit_name
         FROM estoque_ativos ea
         LEFT JOIN ativos a ON a.id = ea.ativo_id
         LEFT JOIN units u ON u.code = ea.unit_code
         ${whereSql}
         ORDER BY ea.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      res.json(toPaged(rows, page, pageSize, total));
    } catch (e) { console.error(e); res.status(500).json({ error: 'estoque_list_failed' }); }
  },

  async createEstoque(req, res) {
    const { ativo_id, quantity, unit_code, lote, validade, location } = req.body || {};
    if (!ativo_id || !quantity || !unit_code) return res.status(400).json({ error: 'missing_fields' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [ins] = await conn.query(
        `INSERT INTO estoque_ativos (ativo_id, quantity, unit_code, lote, validade, location) VALUES (?,?,?,?,?,?)`,
        [ativo_id, quantity, unit_code, lote || null, validade || null, location || null]
      );
      const estoqueId = ins.insertId;
      await conn.query(
        `INSERT INTO estoque_movimentos (estoque_id, tipo, quantity, unit_code, reason) VALUES (?,?,?,?,?)`,
        [estoqueId, 'entrada', quantity, unit_code, 'entrada_inicial']
      );
      await conn.commit();
      const [[created]] = await conn.query(`SELECT * FROM estoque_ativos WHERE id = ?`, [estoqueId]);
      res.status(201).json(created);
    } catch (e) {
      await conn.rollback();
      console.error(e); res.status(500).json({ error: 'estoque_create_failed' });
    } finally { conn.release(); }
  },

  async getEstoque(req, res) {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    try {
      const [[lote]] = await db.query(
        `SELECT ea.*, a.nome AS ativo_nome, u.name AS unit_name FROM estoque_ativos ea
         LEFT JOIN ativos a ON a.id = ea.ativo_id
         LEFT JOIN units u ON u.code = ea.unit_code
         WHERE ea.id = ?`, [id]
      );
      if (!lote) return res.status(404).json({ error: 'not_found' });
      const [movs] = await db.query(
        `SELECT * FROM estoque_movimentos WHERE estoque_id = ? ORDER BY id DESC`, [id]
      );
      res.json({ ...lote, movimentos: movs });
    } catch (e) { console.error(e); res.status(500).json({ error: 'estoque_get_failed' }); }
  },

  async updateEstoque(req, res) {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const fields = ['quantity','unit_code','lote','validade','location','active'];
    const sets = [];
    const params = [];
    for (const f of fields) if (f in req.body) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });
    params.push(id);
    try {
      await db.query(`UPDATE estoque_ativos SET ${sets.join(', ')} WHERE id = ?`, params);
      const [[row]] = await db.query(`SELECT * FROM estoque_ativos WHERE id = ?`, [id]);
      res.json(row);
    } catch (e) { console.error(e); res.status(500).json({ error: 'estoque_update_failed' }); }
  },

  async consumirEstoque(req, res) {
    const id = parseInt(req.params.id);
    const { quantity, unit_code, reason } = req.body || {};
    if (!id || !quantity || !unit_code) return res.status(400).json({ error: 'missing_fields' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[lote]] = await conn.query(`SELECT * FROM estoque_ativos WHERE id = ? FOR UPDATE`, [id]);
      if (!lote) { await conn.rollback(); return res.status(404).json({ error: 'not_found' }); }
      // naive unit conversion using factor_to_base of same kind
      const [[uFrom]] = await conn.query(`SELECT * FROM units WHERE code = ?`, [unit_code]);
      const [[uTo]] = await conn.query(`SELECT * FROM units WHERE code = ?`, [lote.unit_code]);
      if (!uFrom || !uTo || uFrom.kind !== uTo.kind) { await conn.rollback(); return res.status(400).json({ error: 'incompatible_units' }); }
      const qtyInBase = Number(quantity) * Number(uFrom.factor_to_base);
      const lotUnitInBase = Number(uTo.factor_to_base);
      const converted = qtyInBase / lotUnitInBase;
      const newQty = Number(lote.quantity) - converted;
      if (newQty < -1e-9) { await conn.rollback(); return res.status(400).json({ error: 'insufficient_stock', available: lote.quantity, unit_code: lote.unit_code }); }
      await conn.query(`UPDATE estoque_ativos SET quantity = ? WHERE id = ?`, [newQty, id]);
      await conn.query(
        `INSERT INTO estoque_movimentos (estoque_id, tipo, quantity, unit_code, reason) VALUES (?,?,?,?,?)`,
        [id, 'saida', quantity, unit_code, reason || 'consumo']
      );
      await conn.commit();
      const [[updated]] = await conn.query(`SELECT * FROM estoque_ativos WHERE id = ?`, [id]);
      res.json(updated);
    } catch (e) {
      await conn.rollback();
      console.error(e); res.status(500).json({ error: 'estoque_consume_failed' });
    } finally { conn.release(); }
  }
};
