// adminCompoundingProductsController.js
const db = require('./db');

module.exports = {
  async listFormas(req, res) {
    try {
      const [rows] = await db.query('SELECT id, name FROM product_forms ORDER BY name');
      res.json({ data: rows });
    } catch (e) { console.error(e); res.status(500).json({ error: 'formas_list_failed' }); }
  },

  async createFormula(req, res) {
    const { name, form_id, dose_amount, dose_unit_code, output_unit_code, output_quantity_per_batch, price, notes } = req.body || {};
    if (!name || !form_id || !output_unit_code) return res.status(400).json({ error: 'missing_fields' });
    try {
      const [ins] = await db.query(
        `INSERT INTO formulas (name, form_id, dose_amount, dose_unit_code, output_unit_code, output_quantity_per_batch, price, notes)
         VALUES (?,?,?,?,?,?,?,?)`,
        [name, form_id, dose_amount ?? null, dose_unit_code ?? null, output_unit_code, output_quantity_per_batch ?? null, price ?? null, notes ?? null]
      );
      const id = ins.insertId;
      const [[row]] = await db.query('SELECT * FROM formulas WHERE id = ?', [id]);
      res.status(201).json(row);
    } catch (e) { console.error(e); res.status(500).json({ error: 'formula_create_failed' }); }
  },

  async getFormula(req, res) {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    try {
      const [[formula]] = await db.query('SELECT * FROM formulas WHERE id = ?', [id]);
      if (!formula) return res.status(404).json({ error: 'not_found' });
      const [items] = await db.query(
        `SELECT fi.*, u.name AS unit_name, a.nome AS ativo_nome
         FROM formula_items fi
         LEFT JOIN units u ON u.code = fi.unit_code
         LEFT JOIN ativos a ON a.id = fi.ativo_id
         WHERE fi.formula_id = ?
         ORDER BY fi.id`, [id]
      );
      res.json({ ...formula, items });
    } catch (e) { console.error(e); res.status(500).json({ error: 'formula_get_failed' }); }
  },

  async updateFormula(req, res) {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const allowed = ['name','form_id','dose_amount','dose_unit_code','output_unit_code','output_quantity_per_batch','price','notes','active'];
    const sets = [];
    const params = [];
    for (const f of allowed) if (f in req.body) { sets.push(`${f} = ?`); params.push(req.body[f]); }
    if (!sets.length) return res.status(400).json({ error: 'no_fields' });
    params.push(id);
    try {
      await db.query(`UPDATE formulas SET ${sets.join(', ')} WHERE id = ?`, params);
      const [[row]] = await db.query('SELECT * FROM formulas WHERE id = ?', [id]);
      res.json(row);
    } catch (e) { console.error(e); res.status(500).json({ error: 'formula_update_failed' }); }
  },

  async deleteFormula(req, res) {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    try {
      await db.query('DELETE FROM formulas WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'formula_delete_failed' }); }
  },

  async upsertItems(req, res) {
    const id = parseInt(req.params.id);
    const { items } = req.body || {};
    if (!id || !Array.isArray(items)) return res.status(400).json({ error: 'invalid_payload' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM formula_items WHERE formula_id = ?', [id]);
      for (const it of items) {
        if (!it || !it.tipo || !it.quantity || !it.unit_code) { await conn.rollback(); return res.status(400).json({ error: 'invalid_item' }); }
        await conn.query(
          `INSERT INTO formula_items (formula_id, tipo, ativo_id, insumo_nome, quantity, unit_code)
           VALUES (?,?,?,?,?,?)`,
          [id, it.tipo, it.ativo_id ?? null, it.insumo_nome ?? null, it.quantity, it.unit_code]
        );
      }
      await conn.commit();
      const [rows] = await conn.query('SELECT * FROM formula_items WHERE formula_id = ? ORDER BY id', [id]);
      res.json({ items: rows });
    } catch (e) {
      await conn.rollback();
      console.error(e); res.status(500).json({ error: 'items_upsert_failed' });
    } finally { conn.release(); }
  },

  async estimate(req, res) {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    try {
      const [[formula]] = await db.query('SELECT * FROM formulas WHERE id = ?', [id]);
      if (!formula) return res.status(404).json({ error: 'not_found' });
      const [items] = await db.query('SELECT * FROM formula_items WHERE formula_id = ?', [id]);

      let producible = Infinity;
      let limiting = null;

      for (const it of items) {
        if (it.tipo !== 'ativo' || !it.ativo_id) continue; // only ativos constrain production
        // required per unit -> convert to base
        const [[uItem]] = await db.query('SELECT * FROM units WHERE code = ?', [it.unit_code]);
        const reqBase = Number(it.quantity) * Number(uItem.factor_to_base);
        // sum estoque for ativo -> convert each lot to base and sum
        const [lots] = await db.query('SELECT quantity, unit_code FROM estoque_ativos WHERE ativo_id = ? AND active = 1', [it.ativo_id]);
        let availableBase = 0;
        for (const lot of lots) {
          const [[uLot]] = await db.query('SELECT * FROM units WHERE code = ?', [lot.unit_code]);
          if (!uLot || uLot.kind !== uItem.kind) continue; // skip incompatible
          availableBase += Number(lot.quantity) * Number(uLot.factor_to_base);
        }
        const unitsForThis = availableBase / reqBase;
        if (unitsForThis < producible) {
          producible = unitsForThis;
          limiting = { ativo_id: it.ativo_id, required_per_unit: it.quantity, available: availableBase / Number(uItem.factor_to_base) };
        }
      }

      const resUnits = Number.isFinite(producible) ? Math.floor(producible) : 0;
      res.json({ formula_id: id, producible_units: resUnits, limiting });
    } catch (e) { console.error(e); res.status(500).json({ error: 'estimate_failed' }); }
  }
};
