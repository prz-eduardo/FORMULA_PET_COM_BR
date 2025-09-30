const db = require("../config/db.js");

async function salvarLog(erro, origem = "geral", dados = null) {
  try {
    const query = `
      INSERT INTO logs_erros (origem, tipo_erro, mensagem, stack, dados)
      VALUES (?, ?, ?, ?, ?)
    `;
    const tipo = erro.code || "GENERIC";
    const stack = erro.stack || "";
    const mensagem = erro.message || String(erro);

    await db.query(query, [origem, tipo, mensagem, stack, JSON.stringify(dados)]);
  } catch (e) {
    console.error("❌ Falha ao salvar log no banco:", e);
  }
}

module.exports = { salvarLog };
