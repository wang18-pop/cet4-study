/* =========================================================
 * vocabulary.js —— 词汇背词与自测
 * 背词：卡片显示单词 → 点击翻面显示释义 → 标记“认识/不认识”
 * 自测：单词→释义 四选一，20 题一轮，自动判分并收录错词
 * 进度保存在 localStorage：seen / mastered 数组（词表索引）
 * ========================================================= */
(function () {
  "use strict";

  const esc = (s) => Cet4Utils.esc(s);

  function getVocabState() {
    return Cet4Storage.Progress.get().vocab || { seen: [], mastered: [], quizAnswers: {} };
  }

  function saveVocabState(v) {
    const p = Cet4Storage.Progress.get();
    p.vocab = v;
    Cet4Storage.Progress.save(p);
    return v;
  }

  /* 背词卡片 HTML */
  function cardHTML(words, idx, state) {
    const w = words[idx];
    const mastered = state.mastered.includes(idx);
    const remaining = Math.max(words.length - idx, 0);
    const meanings = meaningLines(w.meaning);
    return (
      '<div class="card vocab-card">' +
      '<div class="vocab-header"><span>需学习 <b>' + remaining + "</b></span>" +
      (mastered ? '<span class="badge badge-success">已掌握</span>' : "") + "</div>" +
      '<div class="word-row">' +
      '<div class="word" id="vocab-word">' + esc(w.word) + "</div>" +
      "</div>" +
      '<div class="phonetic">' + esc(w.phonetic || "") + "</div>" +
      '<div class="example">' + esc(w.example || "") + "</div>" +
      (w.exampleCn ? '<div class="example-cn">' + esc(w.exampleCn) + "</div>" : "") +
      '<div class="meaning">' +
      (w.pos ? '<span class="tag">' + esc(w.pos) + "</span>" : "") +
      meanings.map((m) => '<div class="meaning-line">' + esc(m) + "</div>").join("") +
      "</div>" +
      '<div class="vocab-actions">' +
      '<button type="button" class="action-btn" id="vocab-listen">听</button>' +
      '<button type="button" class="action-btn" id="vocab-speak">说</button>' +
      '<button type="button" class="action-btn" id="vocab-write">写</button>' +
      "</div>" +
      '<div style="margin-top:12px;display:flex;gap:10px">' +
      '<button class="btn btn-secondary" style="flex:1" id="vocab-no">还不熟</button>' +
      '<button class="btn btn-success" style="flex:1" id="vocab-yes">已掌握</button>' +
      "</div>" +
      '<div style="margin-top:8px;display:flex;gap:10px">' +
      '<button type="button" class="btn btn-outline" style="flex:1" id="vocab-prev">上一次</button>' +
      '<button type="button" class="btn btn-outline" style="flex:1" id="vocab-next">下一个</button>' +
      "</div>" +
      '<div class="progress-bar"><div style="width:' + Math.round(((idx + 1) / words.length) * 100) + '%"></div></div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:6px">' +
      (idx + 1) + " / " + words.length + " · 已掌握 " + state.mastered.length + " · 已见过 " + state.seen.length +
      "</div></div>"
    );
  }

  /* 释义按分号拆成多行，方便逐条阅读 */
  function meaningLines(text) {
    return String(text || "").split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  }

  /* 自测题 HTML（20 题） */
  function quizHTML(words, questions) {
    const parts = ['<div class="card"><div class="page-title">词汇自测</div><p class="page-sub">本轮 ' + questions.length + " 题 · 选择正确的中文释义</p></div>"];
    questions.forEach((q, i) => {
      const opts = q.options.map((opt, oi) =>
        '<button type="button" class="option" data-q="vq' + i + '" data-val="' + oi + '">' +
        '<span class="opt-key">' + String.fromCharCode(65 + oi) + ")</span><span>" + esc(opt) + "</span></button>"
      ).join("");
      parts.push(
        '<div class="question-block"><div class="q-stem">' + (i + 1) + ". " + esc(q.word) + "</div>" +
        '<div class="phonetic" style="font-size:13px;color:var(--muted)">' + esc(q.phonetic || "") + "</div>" + opts + "</div>"
      );
    });
    parts.push('<button class="btn btn-block btn-success" id="vocab-submit">提交判分</button>');
    return parts.join("");
  }

  window.Cet4Vocab = {
    getVocabState,
    saveVocabState,
    cardHTML,
    quizHTML
  };
})();
