// O banco preexistente usava DECIMAL(18,6), diferente da migration 008.
// Em setembro isso zerava 3 avanços e 1 meta. Só amplia tipos; nunca apaga
// linhas. Inspeciona antes de ALTER para não reconstruir a tabela a cada boot.
export default async function migrar(conn) {
  const [columns] = await conn.query('SHOW COLUMNS FROM eap_apontamentos');
  const wanted = { qtd: 'VARCHAR(64)', avanco_diario: 'DOUBLE', meta_diaria: 'DOUBLE' };
  const changes = [];
  for (const [name, type] of Object.entries(wanted)) {
    const col = columns.find(c => c.Field === name);
    if (!col) throw new Error(`eap_apontamentos sem coluna ${name}`);
    // VARCHAR maior também serve; não reduzir coluna customizada.
    const varchar = /^varchar\((\d+)\)/i.exec(col.Type);
    if (name === 'qtd' && varchar && Number(varchar[1]) >= 64) continue;
    if (col.Type.toLowerCase() !== type.toLowerCase()) changes.push(`MODIFY COLUMN ${name} ${type} NULL`);
  }
  if (changes.length) await conn.query(`ALTER TABLE eap_apontamentos ${changes.join(', ')}`);
}
