(function () {
  'use strict';
  const data = window.TABF_QUESTION_BANKS;
  const core = window.TABFBankCore;
  const selected = new Set();
  const importKey = 'tabf-hub:imports:v1';
  let imported = [];
  const $ = id => document.getElementById(id);
  const message = value => { $('message').textContent = value; };
  function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
  function button(text, action) { const el = element('button', text); el.type = 'button'; el.addEventListener('click', action); return el; }
  function getStack() {
    const groups = data.catalog.papers.filter(b => selected.has(b.id)).map(b => ({questions: data.banks[b.id]}));
    imported.filter(b => selected.has(b.id)).forEach(b => groups.push({questions: b.questions, imported: true}));
    return core.merge(groups, $('prefer-imported').checked);
  }
  function update() {
    try {
      const result = getStack();
      $('stack-count').textContent = `已選 ${result.questions.length} 題`;
      $('stack-detail').textContent = `${selected.size} 份題庫${result.duplicates ? ` · 已合併 ${result.duplicates} 筆相同來源` : ' · 可直接進入原工具'}`;
      document.querySelectorAll('[data-launch],#export-stack').forEach(el => { el.disabled = !result.questions.length; });
    } catch (error) {
      $('stack-count').textContent = '請先處理題目版本'; $('stack-detail').textContent = error.message;
      document.querySelectorAll('[data-launch],#export-stack').forEach(el => { el.disabled = true; });
    }
  }
  function launch(page, questions) {
    try {
      const rows = questions || getStack().questions;
      if (!rows.length) throw new Error('請先選取題庫。');
      sessionStorage.setItem('TABF_STACK', JSON.stringify(rows));
      location.href = `${page}?tabfBank=stack`;
    } catch (error) { message(`無法開啟：${error.message} 若瀏覽器儲存空間不足，請減少範圍或先匯出題庫。`); }
  }
  function download(rows) {
    const url = URL.createObjectURL(new Blob([core.serialize(rows)], {type: 'text/plain;charset=utf-8'}));
    const a = element('a'); a.href = url; a.download = `研訓院_合併題庫_${rows.length}題.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function checkbox(id, title, description) {
    const row = element('div', undefined, 'paper'); const input = element('input'); input.type = 'checkbox'; input.id = `bank-${id}`; input.checked = selected.has(id);
    input.addEventListener('change', () => { if (input.checked) selected.add(id); else selected.delete(id); update(); });
    const label = element('label', title); label.htmlFor = input.id; if (description) label.appendChild(element('small', description)); row.append(input, label); return row;
  }
  function renderImports() {
    $('imported').replaceChildren();
    imported.forEach(bank => {
      const row = checkbox(bank.id, bank.name, `${bank.questions.length} 題 · 瀏覽器內保存`);
      row.appendChild(button('移除', () => {
        const next = imported.filter(b => b.id !== bank.id);
        try { localStorage.setItem(importKey, JSON.stringify(next)); imported = next; selected.delete(bank.id); renderImports(); update(); message('已移除此瀏覽器內的匯入副本；原始檔案仍保留。'); } catch (error) { message(`未移除：${error.message}`); }
      })); $('imported').appendChild(row);
    });
  }
  if (!data || !core) { message('無法載入題庫資料。請先執行「更新研訓院題庫.ps1」，再重新開啟此頁。'); document.querySelectorAll('button,input').forEach(el => { el.disabled = true; }); return; }
  try { imported = JSON.parse(localStorage.getItem(importKey) || '[]'); if (!Array.isArray(imported)) throw new Error('格式錯誤'); imported.forEach(b => { if (!b.id || !b.name) throw new Error('缺少題庫名稱'); b.questions = core.validate(b.questions); }); }
  catch (error) { imported = []; message(`已保存的匯入資料無法讀取：${error.message}。請重新匯入備份；原儲存資料未刪除。`); }
  data.catalog.papers.forEach(bank => selected.add(bank.id));
  $('total-count').replaceChildren(document.createTextNode(String(data.catalog.questionCount)), element('small', '今年已整理題數'));
  $('exams').replaceChildren();
  for (const exam of data.catalog.exams) {
    const card = element('article', undefined, 'exam'); const top = element('div', undefined, 'exam-top'); const heading = element('div'); heading.append(element('h3', `${exam.code} ${exam.name}`), element('small', `${exam.sessions.join('、')} · ${exam.questionCount} 題`)); top.append(heading, element('span', String(exam.questionCount), 'number')); card.appendChild(top);
    const papers = element('div', undefined, 'papers');
    for (const bank of data.catalog.papers.filter(b => b.examCode === exam.code)) {
      const row = checkbox(bank.id, `${bank.session} · ${bank.subject}`, `${bank.questionCount} 題 · 已配對官方答案`);
      row.appendChild(button('複習', () => launch('複習.html', data.banks[bank.id]))); papers.appendChild(row);
    }
    card.appendChild(papers); const actions = element('div', undefined, 'actions');
    actions.append(button('複習全科', () => launch('複習.html', data.banks[exam.combinedId])), button('全科模擬考', () => launch('考試.html', data.banks[exam.combinedId])), button('匯出全科', () => download(data.banks[exam.combinedId]))); card.appendChild(actions); $('exams').appendChild(card);
  }
  for (const plan of data.catalog.planned) {
    const card = element('article'); card.append(element('div', plan.confirmed ? '明年規劃' : '口述名稱待確認', 'status'), element('h3', `${plan.code} ${plan.name}`), element('p', plan.description, 'muted'));
    if (plan.note) card.appendChild(element('small', plan.note));
    const links = element('div', undefined, 'actions'); const a = element('a', '查看官方原卷'); a.href = plan.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; links.appendChild(a); card.appendChild(links); $('future').appendChild(card);
  }
  renderImports(); update();
  $('select-all').addEventListener('click', () => { data.catalog.papers.forEach(b => selected.add(b.id)); imported.forEach(b => selected.add(b.id)); document.querySelectorAll('.paper input').forEach(el => { el.checked = true; }); update(); });
  $('select-none').addEventListener('click', () => { selected.clear(); document.querySelectorAll('.paper input').forEach(el => { el.checked = false; }); update(); });
  $('prefer-imported').addEventListener('change', update);
  document.querySelectorAll('[data-launch]').forEach(el => el.addEventListener('click', () => launch(el.dataset.launch)));
  $('export-stack').addEventListener('click', () => { try { download(getStack().questions); } catch (error) { message(error.message); } });
  $('import-files').addEventListener('change', async event => {
    try {
      const next = [...imported]; let added = 0; let skipped = 0; const chosen = [];
      for (const file of event.target.files) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} 超過 20 MB，請分批匯出。`);
        const questions = core.parse(await file.text()); const content = core.serialize(questions);
        const old = next.find(b => core.serialize(b.questions) === content);
        if (old) { skipped++; chosen.push(old.id); continue; }
        const id = `import-${Date.now()}-${next.length}`; next.push({id, name:file.name, questions}); chosen.push(id); added++;
      }
      localStorage.setItem(importKey, JSON.stringify(next)); imported = next; chosen.forEach(id => selected.add(id)); renderImports(); update(); message(`已匯入 ${added} 份題庫${skipped ? `，略過 ${skipped} 份相同檔案` : ''}。`);
    } catch (error) { message(`本次未匯入：${error.message} 原有題庫保留。`); }
    event.target.value = '';
  });
})();
