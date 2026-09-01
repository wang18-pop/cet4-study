/* =========================================================
 * views.js —— 核心视图：首页 / 刷题区 / 真题详情 / 答题页 / 听力区
 * 每个视图返回 { html, bind }，由 app.js 渲染后调用 bind 绑定事件。
 * ========================================================= */
(function () {
  "use strict";

  const esc = (s) => Cet4Utils.esc(s);
  const Data = Cet4Data;
  const Storage = Cet4Storage;
  const Quiz = Cet4Quiz;
  const Listening = Cet4Listening;

  /* ================= 首页 ================= */
  async function home() {
    const settings = Storage.Settings.get();
    const stats = Storage.Stats.get();
    const streak = Storage.calcStreak(stats);
    const mistakes = Storage.Mistakes.all();
    const day = Storage.todayStr();
    const today = stats.days[day] || { questions: 0, correct: 0 };
    const accuracy = stats.totalQuestions ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0;
    const daysLeft = Cet4Utils.daysUntil(settings.examDate);
    const hour = new Date().getHours();
    const greeting = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
    const name = settings.userName ? "，" + esc(settings.userName) : "";

    let suggestion = "";
    if (today.questions > 0) {
      suggestion = "今天已完成 " + today.questions + " 题，正确 " + today.correct + " 题，继续保持！";
    } else if (mistakes.length > 0) {
      suggestion = "先复习 " + mistakes.length + " 道错题，再开始新练习，效果最好。";
    } else {
      suggestion = "零基础起步：先背 20 个核心词汇，再做一套阅读练习。";
    }

    const entries = [
      { href: "#/practice", emoji: "✍️", name: "刷题区", desc: "真题 + 原创题" },
      { href: "#/listening", emoji: "🎧", name: "听力区", desc: "真题听力训练" },
      { href: "#/vocab", emoji: "📖", name: "词汇区", desc: "背词 + 自测" },
      { href: "#/writing", emoji: "📝", name: "写作区", desc: "模板 + 范文" },
      { href: "#/translation", emoji: "🌐", name: "翻译区", desc: "高频句式练习" },
      { href: "#/grammar", emoji: "🧩", name: "语法区", desc: "零基础讲义" },
      { href: "#/mistakes", emoji: "❌", name: "错题本", desc: mistakes.length ? mistakes.length + " 道待复习" : "暂无错题" },
      { href: "#/stats", emoji: "📊", name: "学习统计", desc: "打卡 + 正确率" },
      { href: "#/settings", emoji: "⚙️", name: "设置", desc: "考试日期等" }
    ];

    const html =
      '<div class="hero"><h1>' + greeting + name + "，开始学习吧 🎓</h1>" +
      "<p>零基础备考英语四级 · 每天进步一点点</p>" +
      '<div class="countdown"><span>距考试还有</span><b>' + Math.max(daysLeft, 0) + "</b><span>天</span>" +
      "<span style=\"margin-left:auto;font-size:12px\">" + Cet4Utils.fmtDate(settings.examDate) + "</span></div></div>" +
      '<div class="stat-strip">' +
      '<div class="stat-box"><div class="num">' + today.questions + "</div><div class=\"label\">今日做题</div></div>" +
      '<div class="stat-box"><div class="num">' + streak + "</div><div class=\"label\">连续打卡</div></div>" +
      '<div class="stat-box"><div class="num">' + accuracy + "%</div><div class=\"label\">累计正确率</div></div>" +
      "</div>" +
      '<div class="card"><div class="section-title">💡 今日建议</div><p style="font-size:14px">' + suggestion + "</p></div>" +
      '<div class="section-title">学习板块</div>' +
      '<div class="grid-3">' +
      entries.map((e) =>
        '<a class="entry-card" href="' + e.href + '"><span class="emoji">' + e.emoji + "</span>" +
        '<span class="name">' + e.name + "</span><span class=\"desc\">" + e.desc + "</span></a>"
      ).join("") +
      "</div>";

    return { html };
  }

  /* ================= 刷题区 ================= */
  async function practice() {
    const papers = await Data.papers();
    const groups = groupPapers(papers);
    const mistakes = Storage.Mistakes.all();
    const wrongCount = mistakes.length;

    const html =
      '<div class="page-title">刷题区</div>' +
      '<p class="page-sub">先做真题熟悉题型，再用原创题巩固；错题自动进错题本。</p>' +
      '<a class="card entry-card" href="#/practice/original" style="display:block">' +
      '<div class="player-top"><span class="emoji" style="font-size:30px">🧠</span>' +
      '<div class="player-meta"><div class="name">原创模拟练习</div>' +
      '<div class="time">听力 · 阅读 · 翻译 · 写作，全部带解析</div></div>' +
      '<span class="arrow">›</span></div></a>' +
      (wrongCount ? '<a class="card entry-card" href="#/mistakes" style="display:block;border-color:var(--danger)">' +
        '<div class="player-top"><span class="emoji" style="font-size:30px">❌</span>' +
        '<div class="player-meta"><div class="name">错题本（' + wrongCount + "）</div>" +
        '<div class="time">先复习错题，再做新题</div></div>' +
        '<span class="arrow">›</span></div></a>' : "") +
      '<div class="section-title">📄 历年真题（' + papers.length + "套）</div>" +
      groups.map((g) =>
        '<div class="group-title">' + esc(g.label) + "</div>" +
        g.papers.map((p) =>
          '<a class="list-item" href="#/paper/' + p.id + '">' +
          '<div class="main"><div class="title">' + esc(p.title) + "</div>" +
          '<div class="sub">' + (p.audioUrl ? "含听力 🎧 · " : "") +
          (p.answerStatus === "graded" ? '<span class="badge badge-success">已判分</span>' : '<span class="badge badge-warn">自测</span>') +
          "</div></div><span class=\"arrow\">›</span></a>"
        ).join("")
      ).join("") +
      '<div class="notice" style="margin-top:14px">真题资源来自开源仓库 cet4-download（2021–2025），媒体文件通过 CDN 加载，' +
      "首次打开需联网；如需离线自托管，可运行 tools/download-media.ps1。</div>";

    return { html };
  }

  function groupPapers(papers) {
    const map = {};
    papers.forEach((p) => {
      const key = p.year + "-" + p.month;
      if (!map[key]) map[key] = { label: p.year + " 年 " + p.month + " 月", papers: [] };
      map[key].papers.push(p);
    });
    return Object.values(map).sort((a, b) => (a.label < b.label ? 1 : -1));
  }

  /* ================= 真题详情 ================= */
  async function paper(id) {
    const p = await Data.paper(id);
    if (!p) return { html: '<div class="empty">未找到该套真题</div>' };

    const pdfUrl = await Data.media(p.pdfUrl);
    const audioUrl = p.audioUrl ? await Data.media(p.audioUrl) : "";
    const key = await Data.answers(p.id);
    const prev = Storage.Progress.get().papers[p.id];

    const html =
      '<div class="page-title">' + esc(p.title) + "</div>" +
      '<p class="page-sub">' +
      (p.answerStatus === "graded" ? '<span class="badge badge-success">已配答案，可自动判分</span>' : '<span class="badge badge-warn">暂无答案，自测模式</span>') +
      " · 建议计时 " + (p.audioUrl ? "125" : "100") + " 分钟</p>" +
      '<div class="grid-2">' +
      '<a class="btn btn-block" href="' + esc(pdfUrl) + '" target="_blank" rel="noopener">📄 在线预览</a>' +
      '<a class="btn btn-secondary btn-block" href="' + esc(pdfUrl) + '" download="' + esc(p.title) + '.pdf">⬇ 下载 PDF</a>' +
      "</div>" +
      (audioUrl ?
        '<a class="card entry-card" href="#/listening/' + p.id + '" style="display:block;margin-top:10px">' +
        '<div class="player-top"><span class="emoji" style="font-size:26px">🎧</span>' +
        '<div class="player-meta"><div class="name">听力训练</div><div class="time">倍速播放 · 区间循环</div></div>' +
        '<span class="arrow">›</span></div></a>' : "") +
      '<div class="section-title">答题卡</div>' +
      '<div class="card" id="sheet-wrap">' +
      (prev ? '<div class="notice">上次作答：' + Cet4Utils.fmtDate(prev.date) + "，客观题 " + prev.score + " / " + prev.total + "。</div>" : "") +
      Quiz.paperSheetHTML(p, key) +
      "</div>";

    return {
      html,
      bind: (root) => bindPaperSheet(root, p, key, audioUrl ? true : false)
    };
  }

  function bindPaperSheet(root, paper, key, hasAudio) {
    const wrap = root.querySelector("#sheet-wrap");
    const submit = root.querySelector("#sheet-submit");
    if (!submit || !wrap) return;

    let submitted = false;
    let timer = null;

    function submitSheet() {
      if (submitted) return;
      submitted = true;
      if (timer) timer.stop();
      const answers = Quiz.collectSheet(wrap);
      if (key && key.sections) {
        const result = Quiz.gradePaper(paper, key, answers);
        Quiz.recordPaperResult(paper, key, result, 1);
        wrap.innerHTML = Quiz.paperResultsHTML(paper, result);
        bindReviewMistakes(wrap);
        Cet4Utils.toast("已判分并更新统计");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // 自测模式：标记完成
        const answered = Object.values(answers).filter((v) => String(v).trim()).length;
        Storage.Stats.addRecord(Math.max(answered, 1), 0, 1);
        Storage.Progress.recordPaper(paper.id, { answers, score: 0, total: 55 });
        wrap.innerHTML = '<div class="score-hero"><div class="big">✓</div>' +
          '<div class="sub">已记录完成（' + answered + " 题作答）· 待对照答案自评</div></div>" +
          '<a class="btn btn-block btn-secondary" href="#/paper/' + paper.id + '">返回答题卡</a>';
        Cet4Utils.toast("已标记完成");
      }
    }

    submit.addEventListener("click", submitSheet);
    const suggestMinutes = hasAudio ? 125 : 100;
    timer = initCountdown(root, suggestMinutes * 60, submitSheet);
  }

  /* ================= 原创题库列表 ================= */
  async function originalHub() {
    const banks = [
      { id: "original-listening", emoji: "🎧", name: "听力理解", desc: "短篇新闻 · 长对话 · 短文理解", typeLabel: "听力" },
      { id: "original-reading", emoji: "📖", name: "阅读理解", desc: "选词填空 · 信息匹配 · 仔细阅读", typeLabel: "阅读" },
      { id: "original-translation", emoji: "🌐", name: "翻译练习", desc: "中译英高频句式，附参考译文", typeLabel: "翻译" },
      { id: "original-writing", emoji: "📝", name: "写作练习", desc: "高频话题 + 模板 + 范文", typeLabel: "写作" }
    ];
    const html =
      '<div class="page-title">原创模拟练习</div>' +
      '<p class="page-sub">按四级真实题型仿制，全部带答案与中文解析；客观题自动判分，主观题对照参考答案自评。</p>' +
      banks.map((b) => {
        const prog = Storage.Progress.get().quizzes[b.id];
        return (
          '<a class="list-item" href="#/quiz/' + b.id + '">' +
          '<span style="font-size:26px">' + b.emoji + "</span>" +
          '<div class="main"><div class="title">' + b.name + "</div>" +
          '<div class="sub">' + b.desc + "</div></div>" +
          '<div style="text-align:right">' +
          (prog ? '<span class="badge badge-success">最高 ' + prog.best + " 分</span><br>" : "") +
          '<span class="arrow">›</span></div></a>'
        );
      }).join("") +
      '<div class="notice">建议顺序：先做「阅读理解」熟悉题型，再做「听力理解」锻炼耳朵，最后练「翻译」和「写作」。</div>';
    return { html };
  }

  /* ================= 答题页 ================= */
  async function quiz(bankId) {
    const bank = await Data.practice(bankId);
    if (!bank) return { html: '<div class="empty">未找到该练习</div>' };

    // 首屏：简介 + 开始按钮
    const startTime = Date.now();
    const html =
      '<div class="card"><div class="page-title">' + esc(bank.title) + "</div>" +
      '<p class="page-sub">' + esc(bank.description || "") + "</p>" +
      '<div class="quiz-meta">' +
      '<span class="badge">' + esc(bank.typeLabel || "练习") + "</span>" +
      '<span>' + Quiz.countQuestions(bank) + " 题</span>" +
      '<span>建议 ' + esc(String(bank.suggestMinutes || 20)) + " 分钟</span></div>" +
      (bank.sections || []).map((s, i) =>
        "<div style=\"font-size:13px;color:var(--muted)\">" + (i + 1) + ". " + esc(s.name) + "（" + (s.questions || []).length + " 题）</div>"
      ).join("") +
      '<button class="btn btn-block" style="margin-top:14px" id="quiz-start">开始作答</button></div>';

    return {
      html,
      bind: (root) => {
        const start = root.querySelector("#quiz-start");
        start.addEventListener("click", () => {
          const wrap = document.getElementById("app");
          wrap.innerHTML = Quiz.bankHTML(bank);
          bindQuizBody(wrap, bank, startTime, null);
        });
      }
    };
  }

  /* 绑定答题主体（含错题重练模式） */
  function bindQuizBody(root, bank, startTime, reviewIds) {
    const currentBank = reviewIds ? filterBank(bank, reviewIds) : bank;
    if (reviewIds) {
      // 重练错题：标题注明
      const title = root.querySelector(".page-title");
      if (title) title.textContent = "重练错题：" + bank.title;
    }
    Listening.initTTS(root);

    // 选择题点击交互
    root.querySelectorAll(".option").forEach((opt) => {
      opt.addEventListener("click", () => {
        if (opt.disabled) return;
        const q = opt.getAttribute("data-q");
        root.querySelectorAll('.option[data-q="' + q + '"]').forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
      });
    });

    let submitted = false;
    let timer = null;

    function submitQuiz() {
      if (submitted) return;
      submitted = true;
      if (timer) timer.stop();
      const answers = Quiz.collectAnswers(root);
      const result = Quiz.gradeBank(currentBank, answers);
      const minutes = Math.max(1, Math.round((Date.now() - startTime) / 60000));
      Quiz.recordBankResult(currentBank, result, minutes);
      const view = document.getElementById("app");
      view.innerHTML = Quiz.resultsHTML(currentBank, result);
      bindResults(view, currentBank, result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    const submit = root.querySelector("#quiz-submit");
    if (submit) submit.addEventListener("click", submitQuiz);

    const totalSeconds = Math.max(1, (bank.suggestMinutes || 20) * 60);
    timer = initCountdown(root, totalSeconds, submitQuiz);
  }

  function filterBank(bank, reviewIds) {
    const filtered = Object.assign({}, bank, {
      sections: (bank.sections || [])
        .map((s) => Object.assign({}, s, { questions: (s.questions || []).filter((q) => reviewIds.includes(q.id)) }))
        .filter((s) => s.questions.length)
    });
    return filtered;
  }

  function bindResults(root, bank, result) {
    const btn = root.querySelector("#quiz-review-mistakes");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const wrongIds = result.results.filter((r) => r.ok === false).map((r) => r.id);
      const view = document.getElementById("app");
      view.innerHTML = Quiz.bankHTML(bank);
      bindQuizBody(view, bank, Date.now(), wrongIds);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ================= 听力区 ================= */
  async function listening() {
    const papers = await Data.papers();
    const withAudio = papers.filter((p) => p.audioUrl);
    const html =
      '<div class="page-title">听力区</div>' +
      '<p class="page-sub">真题听力带倍速和区间循环，听不懂就反复听；原创听力用浏览器朗读原文。</p>' +
      '<a class="card entry-card" href="#/quiz/original-listening" style="display:block">' +
      '<div class="player-top"><span class="emoji" style="font-size:28px">🗣️</span>' +
      '<div class="player-meta"><div class="name">原创听力练习</div>' +
      '<div class="time">新闻 · 对话 · 短文，可朗读原文</div></div>' +
      '<span class="arrow">›</span></div></a>' +
      '<div class="section-title">🎧 真题听力（' + withAudio.length + "套）</div>" +
      withAudio.map((p) =>
        '<a class="list-item" href="#/listening/' + p.id + '">' +
        '<div class="main"><div class="title">' + esc(p.title) + "</div>" +
        '<div class="sub">完整听力音频 · 原文见真题 PDF 末尾</div></div>' +
        '<span class="arrow">›</span></a>'
      ).join("") +
      '<div class="notice">技巧：第一遍完整听，第二遍看原文听，第三遍盲听检查。每天 20 分钟，坚持一个月进步明显。</div>';
    return { html };
  }

  async function listeningPlayer(paperId) {
    const p = await Data.paper(paperId);
    if (!p || !p.audioUrl) return { html: '<div class="empty">该套真题暂无听力音频</div>' };
    const audioUrl = await Data.media(p.audioUrl);
    const pdfUrl = await Data.media(p.pdfUrl);
    const html =
      '<div class="page-title">' + esc(p.title) + "</div>" +
      '<p class="page-sub">听力播放器 · 原文在真题 PDF 末尾</p>' +
      Listening.playerHTML(p.title + "（听力）", audioUrl) +
      '<div class="grid-2">' +
      '<a class="btn btn-block btn-secondary" href="#/paper/' + p.id + '">答题卡</a>' +
      '<a class="btn btn-block btn-outline" href="' + esc(audioUrl) + '" target="_blank" rel="noopener">打开音频源</a>' +
      "</div>" +
      '<div class="card" style="margin-top:12px"><div class="section-title">训练步骤</div>' +
      "<ol style=\"font-size:14px;margin-left:20px\"><li>先盲听一遍，记录听懂的内容；</li>" +
      "<li>打开真题 PDF，对照末尾的听力原文再听一遍；</li>" +
      "<li>用 A-B 循环反复听没听懂的部分；</li>" +
      "<li>最后盲听检查，再看原文查漏。</li></ol></div>";
    return {
      html,
      bind: (root) => {
        Listening.initPlayer(root, audioUrl);
      }
    };
  }

  /* 重练错题按钮绑定（真题结果页） */
  function bindReviewMistakes(root) {
    const btn = root.querySelector("#quiz-review-mistakes");
    if (!btn) return;
    btn.addEventListener("click", () => {
      // 真题错题没有题干数据，跳转到错题本复习
      location.hash = "#/mistakes";
    });
  }

  /* 倒计时计时器：到 0 自动提交，可暂停/继续 */
  function initCountdown(root, totalSeconds, onTimeUp) {
    const bar = root.querySelector("#quiz-timer");
    const valueEl = root.querySelector("#quiz-timer-value");
    const toggle = root.querySelector("#quiz-timer-toggle");
    if (!bar || !valueEl || !toggle) return { stop() {} };

    let remaining = Math.max(0, Math.floor(totalSeconds));
    let running = true;
    let timerId = null;
    let stopped = false;

    function fmt(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
    }

    function render() {
      valueEl.textContent = fmt(remaining);
      bar.classList.toggle("low", running && remaining <= 60);
      bar.classList.toggle("time-up", running && remaining <= 0);
    }

    function tick() {
      if (!running) return;
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        render();
        stop();
        onTimeUp();
        return;
      }
      render();
    }

    function stop() {
      stopped = true;
      if (timerId) clearInterval(timerId);
    }

    render();
    timerId = setInterval(tick, 1000);

    toggle.addEventListener("click", () => {
      if (stopped) return;
      running = !running;
      toggle.textContent = running ? "暂停" : "继续";
      render();
    });

    return { stop };
  }

  window.Cet4Views = Object.assign({}, window.Cet4Views || {}, {
    home,
    practice,
    paper,
    originalHub,
    quiz,
    listening,
    listeningPlayer
  });
})();
