(function (root) {
  'use strict';
  const textFields = ['class', 'sn', 'question', 'remark', 'felo', 'pic'];
  function key(q) { return q.sourceId || (q.source && q.source.id) || `${q.class}::${q.sn}`; }
  function validate(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 10000) throw new Error('每次匯入須有 1～10,000 題。');
    const seen = new Set();
    return rows.map((row, i) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`第 ${i + 1} 筆不是題目物件。`);
      const q = JSON.parse(JSON.stringify(row));
      q.sn = String(q.sn ?? '');
      for (const field of textFields) {
        if (q[field] == null && ['remark', 'felo', 'pic'].includes(field)) q[field] = '';
        if (typeof q[field] !== 'string' || q[field].length > 50000) throw new Error(`第 ${i + 1} 題的 ${field} 格式不正確。`);
        if (/<\/?[a-z][^>]*>/i.test(q[field])) throw new Error(`第 ${i + 1} 題含 HTML 標籤，請匯出純文字題庫。`);
      }
      if (!q.sn.trim() || !q.class.trim() || !q.question.trim()) throw new Error(`第 ${i + 1} 題缺少題號、類別或題目。`);
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8 || q.options.some(o => !o || typeof o.option !== 'string' || !o.option.trim() || o.option.length > 50000 || typeof o.answer !== 'boolean' || /<\/?[a-z][^>]*>/i.test(o.option))) throw new Error(`第 ${i + 1} 題選項格式不正確。`);
      if (!q.options.some(o => o.answer)) throw new Error(`第 ${i + 1} 題沒有正確答案。`);
      if (new Set(q.options.map(o => o.option)).size !== q.options.length) throw new Error(`第 ${i + 1} 題有相同文字的選項，無法可靠判分。`);
      if (q.answerPolicy && !['any-accepted', 'all-required', 'single'].includes(q.answerPolicy)) throw new Error(`第 ${i + 1} 題的給分規則不支援。`);
      if (q.sourceId && typeof q.sourceId !== 'string') throw new Error(`第 ${i + 1} 題來源編號格式不正確。`);
      if (q.source && (typeof q.source !== 'object' || Array.isArray(q.source) || typeof q.source.id !== 'string')) throw new Error(`第 ${i + 1} 題來源資訊格式不正確。`);
      if (q.sourceId && q.source && q.sourceId !== q.source.id) throw new Error(`第 ${i + 1} 題的兩個來源編號不一致。`);
      if (seen.has(key(q))) throw new Error(`同一檔案重複出現題目 ${q.class}／${q.sn}，請先確認版本。`);
      seen.add(key(q));
      return q;
    });
  }
  function parse(content) {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    return validate(lines.map((line, i) => { try { return JSON.parse(line); } catch { throw new Error(`第 ${i + 1} 行不是有效 JSON。`); } }));
  }
  function fingerprint(q) {
    return JSON.stringify([q.class, q.sn, q.question, q.options, q.answerPolicy || '', q.remark || '', q.felo || '', q.pic || '']);
  }
  function merge(groups, preferImported) {
    const map = new Map(); let duplicates = 0;
    for (const group of groups) for (const q of group.questions) {
      const id = key(q); const existing = map.get(id);
      if (existing) {
        duplicates++;
        if (fingerprint(existing.question) !== fingerprint(q)) {
          if (!preferImported || (!group.imported && !existing.imported)) throw new Error(`同題有不同版本：${q.class}／${q.sn}。取消重複範圍，或勾選「採用我匯入的版本」。`);
          if (!group.imported) continue;
        } else continue;
      }
      map.set(id, {question: q, imported: !!group.imported});
    }
    return {questions: Array.from(map.values(), entry => entry.question), duplicates};
  }
  function serialize(rows) { return rows.map(q => JSON.stringify(q)).join('\n') + '\n'; }
  root.TABFBankCore = {key, validate, parse, fingerprint, merge, serialize};
})(typeof window === 'undefined' ? globalThis : window);
