/* =========================================================
 * quiz-engine.js —— 刷题引擎
 * 负责：
 *   1. 渲染原创题（选择题 / 填空题 / 主观题）
 *   2. 判分并生成逐题解析
 *   3. 收录错题、更新学习统计与进度
 *   4. 渲染真题答题卡并判分
 * ========================================================= */
(function () {
  "use strict";

  const esc = (s) => Cet4Utils.esc(s);

  /* 答案归一化：转大写、去空格、去句号等干扰 */
  function normalizeAnswer(v) {
    return String(v == null ? "" : v)
      .trim()
      .toUpperCase()
      .replace(/[.\s（）()]/g, "");
  }

  /* ---------- 原创题渲染 ---------- */

  /* 段落里的 [[1]] 占位符渲染为带编号的空格 */
  function renderPassageWithBlanks(text) {
    return esc(text).replace(/\[\[(\d+)\]\]/g, '<span class="blank-slot" data-blank="$1">$1</span>');
  }

  function optionLetter(i) {
    return String.fromCharCode(65 + i);
  }

  function questionHTML(q, index) {
    const no = q.no || index + 1;
    const stem = esc(q.stem);
    let body = "";

    if (q.type === "choice") {
      const options = (q.options || []).map((opt, i) =>
        '<button type="button" class="option" data-q="' + esc(q.id) + '" data-val="' + optionLetter(i) + '">' +
        '<span class="opt-key">' + optionLetter(i) + ")</span><span>" + esc(opt) + "</span></button>"
      ).join("");
      body = '<div class="q-stem">' + no + ". " + stem + "</div>" + options;
    } else if (q.type === "blank") {
      body = '<div class="q-stem">' + no + ". " + stem + "</div>" +
        '<input class="blank-input" data-q="' + esc(q.id) + '" type="text" placeholder="输入答案" autocomplete="off">';
    } else if (q.type === "text") {
      body = '<div class="q-stem">' + no + ". " + stem + "</div>" +
        '<textarea class="blank-input textarea" data-q="' + esc(q.id) + '" rows="4" placeholder="在此作答"></textarea>';
    }

    return '<div class="question-block" data-question="' + esc(q.id) + '">' + body + "</div>";
  }

  /* 渲染整个题库（分节） */
  function bankHTML(bank) {
    const parts = [];
    parts.push(
      '<div class="quiz-timer" id="quiz-timer">' +
      '<span class="quiz-timer-label">⏱ 剩余</span>' +
      '<b class="quiz-timer-value" id="quiz-timer-value">--:--</b>' +
      '<button type="button" class="quiz-timer-toggle" id="quiz-timer-toggle">暂停</button>' +
      "</div>"
    );
    parts.push(
      '<div class="card"><div class="page-title">' + esc(bank.title) + "</div>" +
      '<p class="page-sub">' + esc(bank.description || "") + "</p>" +
      '<div class="quiz-meta"><span class="badge">' + esc(bank.typeLabel || "练习") + "</span>" +
      '<span>' + countQuestions(bank) + " 题</span></div></div>"
    );

    (bank.sections || []).forEach((sec, si) => {
      parts.push('<h3 class="section-title">' + (si + 1) + ". " + esc(sec.name) + "</h3>");

      // 听力题：播放原文（浏览器 TTS）+ 可折叠原文
      if (bank.type === "listening" && sec.script) {
        parts.push(renderScriptBlock(sec));
      }

      if (sec.passage) {
        parts.push('<div class="passage">' + renderPassageWithBlanks(sec.passage) + "</div>");
      }

      if (sec.wordBank && sec.wordBank.length) {
        parts.push('<div class="word-bank">' + sec.wordBank.map((w) =>
          '<span class="word-chip">' + esc(w) + "</span>").join("") + "</div>");
      }

      (sec.questions || []).forEach((q, qi) => {
        parts.push(questionHTML(q, q.no ? q.no - 1 : qi));
      });
    });

    parts.push(
      '<button class="btn btn-block btn-success" id="quiz-submit">提交并查看结果</button>' +
      '<p style="font-size:12px;color:var(--muted);text-align:center;margin-top:8px">主观题（翻译/写作）请对照参考答案自评</p>'
    );
    return parts.join("");
  }

  function renderScriptBlock(sec) {
    return (
      '<div class="card">' +
      '<div class="player-top">' +
      '<button type="button" class="play-btn tts-play" data-sec="' + esc(sec.id || sec.name) + '" aria-label="播放听力原文">▶</button>' +
      '<div class="player-meta"><div class="name">听力原文（浏览器朗读）</div>' +
      '<div class="time">点击播放 · 可调节语速</div></div>' +
      '<button type="button" class="btn btn-sm btn-outline tts-toggle">显示原文</button>' +
      "</div>" +
      '<div class="player-controls" style="margin-top:8px">' +
      '<button type="button" class="speed-btn tts-speed" data-speed="0.75">0.75x</button>' +
      '<button type="button" class="speed-btn tts-speed active" data-speed="1">1x</button>' +
      '<button type="button" class="speed-btn tts-speed" data-speed="1.25">1.25x</button>' +
      "</div>" +
      '<div class="tts-script" hidden><div class="passage" style="margin-bottom:0">' +
      esc(sec.script) + "</div></div>" +
      "</div>"
    );
  }

  function countQuestions(bank) {
    return (bank.sections || []).reduce((n, s) => n + (s.questions || []).length, 0);
  }

  /* 从页面收集答案 */
  function collectAnswers(rootEl) {
    const answers = {};
    rootEl.querySelectorAll(".option.selected").forEach((el) => {
      answers[el.getAttribute("data-q")] = el.getAttribute("data-val");
    });
    rootEl.querySelectorAll(".blank-input").forEach((el) => {
      answers[el.getAttribute("data-q")] = el.value;
    });
    rootEl.querySelectorAll('input[data-q], textarea[data-q]').forEach((el) => {
      answers[el.getAttribute("data-q")] = el.value;
    });
    return answers;
  }

  /* 判分原创题：返回 { score, total, correctCount, results, questions } */
  function gradeBank(bank, answers) {
    let score = 0;
    let total = 0;
    const results = [];
    const questions = [];
    (bank.sections || []).forEach((sec, si) => {
      (sec.questions || []).forEach((q) => {
        total += 1;
        questions.push(q);
        const user = answers[q.id];
        let ok = false;
        if (q.type === "text") {
          // 主观题不自动判分，标记为待自评
          ok = null;
        } else {
          ok = normalizeAnswer(user) === normalizeAnswer(q.answer);
          if (ok) score += 1;
        }
        results.push({
          id: q.id,
          no: q.no,
          section: sec.name,
          sectionIndex: si,
          type: q.type,
          stem: q.stem,
          options: q.options || [],
          user: user == null ? "" : String(user),
          answer: q.answer,
          ok,
          analysis: q.analysis || "",
          script: sec.script || ""
        });
      });
    });
    return { score, total, correctCount: score, results, questions, bankId: bank.id, bankTitle: bank.title };
  }

  /* 渲染判分结果 */
  function resultsHTML(bank, result) {
    const pct = result.total ? Math.round((result.correctCount / result.total) * 100) : 0;
    const parts = [];
    parts.push(
      '<div class="score-hero"><div class="big">' + result.correctCount + " / " + result.total + "</div>" +
      '<div class="sub">正确率 ' + pct + "% · " + esc(bank.title) + "</div></div>"
    );

    // 客观题 + 主观题分组
    const objective = result.results.filter((r) => r.ok !== null);
    const subjective = result.results.filter((r) => r.ok === null);
    const wrong = objective.filter((r) => !r.ok);

    parts.push(
      '<div class="card"><div class="section-title">答题详情</div>' +
      result.results.map((r) => {
        if (r.type === "text") {
          return (
            '<div class="result-row"><span class="no">' + r.no + "</span>" +
            "<span>主观题（已提交，请对照参考答案）</span>" +
            '<span class="ans">待自评</span></div>'
          );
        }
        const cls = r.ok ? "correct" : "wrong";
        const mark = r.ok ? "✓ 正确" : "✗ 错误";
        return (
          '<div class="result-row ' + cls + '"><span class="no">' + r.no + "</span>" +
          "<span>" + esc(r.stem) + "</span>" +
          '<span class="ans">' + mark + " · 答案 " + esc(r.answer) + "</span></div>"
        );
      }).join("") +
      "</div>"
    );

    // 错题解析
    const withAnalysis = result.results.filter((r) => r.analysis && r.ok === false);
    if (withAnalysis.length) {
      parts.push('<div class="section-title">错题解析</div>');
      withAnalysis.forEach((r) => {
        parts.push(
          '<div class="analysis" style="margin-bottom:10px"><b>' + r.no + ". " + esc(r.stem) + "</b>" +
          "<div style=\"margin-top:4px\">你的答案：" + esc(r.user || "未作答") + " · 正确答案：" + esc(r.answer) + "</div>" +
          "<div style=\"margin-top:4px\">" + esc(r.analysis) + "</div></div>"
        );
      });
    }

    if (subjective.length) {
      parts.push('<div class="section-title">主观题参考答案</div>');
      subjective.forEach((r) => {
        parts.push(
          '<div class="analysis" style="margin-bottom:10px"><b>' + r.no + ". " + esc(r.stem) + "</b>" +
          '<div style="margin-top:4px">参考答案：<br>' + esc(r.answer) + "</div></div>"
        );
      });
    }

    parts.push(
      '<button class="btn btn-block" id="quiz-review-mistakes" ' +
      (wrong.length ? "" : "disabled") + ">重练错题（" + wrong.length + "）</button>"
    );
    return parts.join("");
  }

  /* 收录错题 + 统计 + 进度 */
  function recordBankResult(bank, result, minutes) {
    const objectiveWrong = result.results.filter((r) => r.ok === false);
    if (objectiveWrong.length) {
      Cet4Storage.Mistakes.addMany(objectiveWrong.map((r) => ({
        id: "bank:" + bank.id + ":" + r.id,
        source: bank.title,
        question: r.stem,
        yourAnswer: r.user,
        correctAnswer: r.answer,
        analysis: r.analysis,
        kind: r.type === "blank" ? "blank" : "choice"
      })));
    }
    Cet4Storage.Stats.addRecord(result.total, result.correctCount, minutes);
    Cet4Storage.Progress.recordQuiz(bank.id, result);
  }

  /* ---------- 真题答题卡 ---------- */

  /* 渲染真题答题卡：
   * key 存在且含 objective 题号 → 可判分；
   * 否则为自测模式（可填写并“标记完成”）。 */
  function paperSheetHTML(paper, key) {
    const parts = [];
    const graded = !!(key && key.sections);

    parts.push(
      '<div class="quiz-timer" id="quiz-timer">' +
      '<span class="quiz-timer-label">⏱ 剩余</span>' +
      '<b class="quiz-timer-value" id="quiz-timer-value">--:--</b>' +
      '<button type="button" class="quiz-timer-toggle" id="quiz-timer-toggle">暂停</button>' +
      "</div>"
    );

    if (!graded) {
      parts.push(
        '<div class="notice">本套真题暂无答案，无法自动判分。建议先完整做题，再对照解析资料自评；' +
        "答题后点击“标记完成”即可记录学习统计。</div>"
      );
    }

    if (graded) {
      (key.sections || []).forEach((sec) => {
        if (sec.type === "text") {
          parts.push(
            '<div class="sheet-section"><h4>' + esc(sec.name) + "</h4>" +
            '<div class="analysis"><b>参考答案：</b><br>' + esc(sec.reference || "暂无") + "</div></div>"
          );
          return;
        }
        const rows = [];
        for (let n = sec.start; n <= sec.end; n += 1) {
          rows.push(
            "<tr><td>" + n + "</td><td>" +
            '<input class="sheet-input" data-no="' + n + '" maxlength="8" autocomplete="off"></td></tr>'
          );
        }
        parts.push(
          '<div class="sheet-section"><h4>' + esc(sec.name) +
          ' <span class="badge badge-muted">' + sec.start + "–" + sec.end + "</span></h4>" +
          '<table class="answer-sheet-table"><thead><tr><th>题号</th><th>答案</th></tr></thead><tbody>' +
          rows.join("") + "</tbody></table></div>"
        );
      });
    } else {
      // 自测模式：给一个大致的题号范围输入区（听力 1-25、阅读 26-55）
      parts.push(
        '<div class="sheet-section"><h4>客观题答案（1–55）</h4>' +
        '<table class="answer-sheet-table"><thead><tr><th>题号</th><th>答案</th></tr></thead><tbody>' +
        Array.from({ length: 55 }, (_, i) => {
          const n = i + 1;
          return "<tr><td>" + n + "</td><td>" +
            '<input class="sheet-input" data-no="' + n + '" maxlength="8" autocomplete="off"></td></tr>';
        }).join("") + "</tbody></table></div>"
      );
    }

    parts.push(
      '<button class="btn btn-block btn-success" id="sheet-submit">' +
      (graded ? "提交判分" : "标记完成") + "</button>"
    );
    return parts.join("");
  }

  function collectSheet(rootEl) {
    const answers = {};
    rootEl.querySelectorAll(".sheet-input").forEach((el) => {
      answers[el.getAttribute("data-no")] = el.value;
    });
    return answers;
  }

  /* 判分真题答题卡 */
  function gradePaper(paper, key, answers) {
    const results = [];
    let score = 0;
    let total = 0;
    (key.sections || []).forEach((sec) => {
      if (sec.type === "text") return;
      for (let n = sec.start; n <= sec.end; n += 1) {
        total += 1;
        const user = answers[n] || "";
        const keyItem = sec.questions ? sec.questions.find((q) => q.no === n) : null;
        const correct = keyItem ? keyItem.key : "";
        const ok = normalizeAnswer(user) === normalizeAnswer(correct);
        if (ok && correct) score += 1;
        results.push({
          no: n,
          section: sec.name,
          user,
          correct,
          ok: correct ? ok : null,
          analysis: keyItem && keyItem.analysis ? keyItem.analysis : ""
        });
      }
    });
    return { paperId: paper.id, score, total, correctCount: score, results };
  }

  function paperResultsHTML(paper, result) {
    const pct = result.total ? Math.round((result.correctCount / result.total) * 100) : 0;
    const parts = [];
    parts.push(
      '<div class="score-hero"><div class="big">' + result.correctCount + " / " + result.total + "</div>" +
      '<div class="sub">客观题正确率 ' + pct + "% · 主观题请对照参考答案自评</div></div>"
    );
    const wrong = result.results.filter((r) => r.ok === false);
    const skipped = result.results.filter((r) => r.ok === null);
    parts.push(
      '<div class="card"><div class="section-title">答题详情</div>' +
      result.results.map((r) => {
        let cls = "result-row";
        let mark = "未判";
        if (r.ok === true) { cls += " correct"; mark = "✓"; }
        else if (r.ok === false) { cls += " wrong"; mark = "✗"; }
        return (
          '<div class="' + cls + '"><span class="no">' + r.no + "</span>" +
          "<span>" + esc(r.section) + "</span>" +
          '<span class="ans">' + mark + (r.ok === false ? " 答案 " + esc(r.correct) : "") + "</span></div>"
        );
      }).join("") + "</div>"
    );

    const withAnalysis = result.results.filter((r) => r.analysis && r.ok === false);
    if (withAnalysis.length) {
      parts.push('<div class="section-title">错题解析</div>');
      withAnalysis.forEach((r) => {
        parts.push(
          '<div class="analysis" style="margin-bottom:10px"><b>第 ' + r.no + " 题（" + esc(r.section) + "）</b>" +
          '<div style="margin-top:4px">答案：' + esc(r.correct) + "</div>" +
          '<div style="margin-top:4px">' + esc(r.analysis) + "</div></div>"
        );
      });
    }

    parts.push(
      '<button class="btn btn-block" id="quiz-review-mistakes" ' +
      (wrong.length ? "" : "disabled") + ">重练错题（" + wrong.length + "）</button>"
    );
    return parts.join("");
  }

  function recordPaperResult(paper, key, result, minutes) {
    const wrong = result.results.filter((r) => r.ok === false);
    if (wrong.length) {
      Cet4Storage.Mistakes.addMany(wrong.map((r) => ({
        id: "paper:" + paper.id + ":" + r.no,
        source: paper.title,
        question: "第 " + r.no + " 题（" + r.section + "）",
        yourAnswer: r.user,
        correctAnswer: r.correct,
        analysis: r.analysis,
        kind: "sheet"
      })));
    }
    Cet4Storage.Stats.addRecord(result.total, result.correctCount, minutes);
    Cet4Storage.Progress.recordPaper(paper.id, result);
  }

  window.Cet4Quiz = {
    bankHTML,
    collectAnswers,
    gradeBank,
    resultsHTML,
    recordBankResult,
    paperSheetHTML,
    collectSheet,
    gradePaper,
    paperResultsHTML,
    recordPaperResult,
    normalizeAnswer,
    countQuestions
  };
})();
