const modules = [
  {
    id: "prepare",
    icon: "备",
    name: "备课资源舱",
    title: "生成课前任务单与备课资源",
    summary: "资料整理、活动流程、分层学习任务",
    assistedRatio: 0.34,
    outputLabel: "课前任务单",
    value: "用于说明课外备课从资料搜集、任务设计到评价证据的减负过程。"
  },
  {
    id: "homework",
    icon: "作",
    name: "命题与作业舱",
    title: "生成分层作业与评分细则",
    summary: "目标对齐、难度分层、错因分析",
    assistedRatio: 0.30,
    outputLabel: "分层作业包",
    value: "用于说明作业设计从统一布置转向分层支持和评价闭环。"
  },
  {
    id: "diagnosis",
    icon: "诊",
    name: "学情诊断舱",
    title: "生成班级学情报告与干预建议",
    summary: "薄弱点归纳、学生分层、补救建议",
    assistedRatio: 0.28,
    outputLabel: "学情诊断报告",
    value: "用于说明分散数据如何转化为学生分层和个别干预。"
  },
  {
    id: "communication",
    icon: "沟",
    name: "沟通协同舱",
    title: "生成家校沟通文本与谈心提纲",
    summary: "温和表达、风险检查、后续跟踪",
    assistedRatio: 0.26,
    outputLabel: "沟通协同稿",
    value: "用于说明家校沟通和师生谈心如何兼顾效率、温度与安全边界。"
  },
  {
    id: "archive",
    icon: "档",
    name: "资料归档与班级管理舱",
    title: "生成班级周报与归档清单",
    summary: "会议记录、活动记录、育人案例",
    assistedRatio: 0.24,
    outputLabel: "归档材料包",
    value: "用于说明零散材料如何沉淀为可追溯、可复用的过程记录。"
  }
];

const moduleChain = [
  {
    name: "学情诊断",
    flow: "从数据到关注名单",
    input: "Excel 画像、出勤、心理、消费、违纪",
    process: "风险分层与干预优先级",
    output: "班级画像、重点学生、干预重点"
  },
  {
    name: "备课资源",
    flow: "从画像到教学支架",
    input: "班级画像、高/中关注原因",
    process: "调整活动难度与课堂支持",
    output: "课前任务、活动脚本、支架卡"
  },
  {
    name: "命题作业",
    flow: "从支架到分层练习",
    input: "备课目标、活动支架、学生差异",
    process: "设计基础/提升/挑战任务",
    output: "分层作业、评分细则、补救任务"
  },
  {
    name: "沟通协同",
    flow: "从任务表现到协同支持",
    input: "作业反馈、关注原因、谈话需求",
    process: "生成谈心与家校沟通方案",
    output: "谈心提纲、沟通文本、跟进约定"
  },
  {
    name: "资料归档",
    flow: "从过程到复盘材料",
    input: "对策建议、复核、沟通、跟踪数据",
    process: "整理周报和育人案例",
    output: "归档清单、案例提纲、下一轮依据"
  }
];

const workflowOrder = ["diagnosis", "prepare", "homework", "communication", "archive"];

const rubric = [
  { key: "value", name: "价值立意", full: 15, tip: "是否有真实痛点、具体对象和清晰边界。" },
  { key: "genai", name: "GenAI 应用", full: 35, tip: "是否嵌入真实流程，而不是只生成几段文字。" },
  { key: "effect", name: "实施成效", full: 30, tip: "是否有耗时、学情、复核、应用记录等数据支撑。" },
  { key: "demo", name: "示范推广", full: 20, tip: "是否形成模板、流程、数据表和可迁移材料。" }
];

const state = {
  activeModuleId: "diagnosis",
  records: safeJson(localStorage.getItem("qinghang-records"), []),
  analytics: safeJson(localStorage.getItem("qinghang-analytics"), null),
  currentDraft: null,
  lastOutput: "",
  workflowStep: 1,
  exportedOnce: safeJson(localStorage.getItem("qinghang-exported"), false)
};

const $ = (id) => document.getElementById(id);
const moduleList = $("moduleList");
const taskForm = $("taskForm");
const output = $("output");
const reviewList = $("reviewList");
const evidenceRows = $("evidenceRows");
const toast = $("toast");

function renderModuleChain() {
  const doneCount = Math.max(0, state.workflowStep - 1);
  $("moduleChain").innerHTML = moduleChain.map((item, index) => {
    const status = index < doneCount ? "is-done" : index === doneCount ? "is-current" : "is-waiting";
    return `
    <article class="chain-item ${status}">
      <strong>${item.name}</strong>
      <p>${item.flow}</p>
      <div class="chain-mini">
        <span>输入：${item.input}</span>
        <span>处理：${item.process}</span>
        <span>输出：${item.output}</span>
      </div>
    </article>
  `;
  }).join("");
}

function safeJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

function getActiveModule() {
  return modules.find((item) => item.id === state.activeModuleId) || modules[0];
}

function getWorkflowModules() {
  return workflowOrder.map((id) => modules.find((item) => item.id === id)).filter(Boolean);
}

function collectForm() {
  return {
    grade: $("grade").value.trim() || "未填写学段",
    subject: $("subject").value.trim() || "未填写课程",
    topic: $("topic").value.trim() || "未填写主题",
    studentProfile: $("studentProfile").value.trim() || "未填写班级/学生情况",
    goal: $("goal").value.trim() || "未填写任务目标",
    originalMinutes: Number($("originalMinutes").value || 0),
    assistedMinutes: Number($("assistedMinutes").value || 0)
  };
}

function signoffReady() {
  return ["checkFact", "checkPrivacy", "checkTone", "checkTeacher"].every((id) => $(id).checked);
}

function setReviewChecks(checked) {
  ["checkFact", "checkPrivacy", "checkTone", "checkTeacher"].forEach((id) => {
    $(id).checked = checked;
  });
}

function resetReviewState(note = "") {
  setReviewChecks(false);
  $("reviewNote").value = note;
  renderSignoff();
}

function buildDefaultReviewNote(moduleName = "当前对策建议") {
  return `${moduleName}已形成教师定稿：已核查事实、课程要求和班级真实情境；涉及学生的信息已脱敏；已根据本班学生基础调整任务难度、表达语气和后续跟进方式。保存后将作为本次应用记录，不把系统生成内容直接等同于最终成果。`;
}

function setWorkflowStep(step, message) {
  state.workflowStep = Math.max(1, Math.min(5, step));
  renderWorkflow(message);
  renderModuleChain();
}

function renderWorkflow(customMessage = "") {
  const hints = {
    1: "当前：请先导入或填写学生情况，完成学情分析。",
    2: "当前：学情画像已形成，可以基于真实学生情况生成对策建议。",
    3: "当前：对策建议已生成，请进行教师修订、定稿与复核。",
    4: "当前：复核已完成，请确认采用并保存记录。",
    5: "当前：应用记录已保存，可以导出过程材料或继续下一轮。"
  };
  $("workflowHint").textContent = customMessage || hints[state.workflowStep];
  document.querySelectorAll(".flow-step").forEach((stepEl) => {
    const step = Number(stepEl.dataset.step);
    stepEl.classList.remove("is-done", "is-current", "is-waiting");
    if (step < state.workflowStep) {
      stepEl.classList.add("is-done");
      if (!stepEl.textContent.includes("✓")) stepEl.textContent = `✓ ${stepEl.textContent.replace(/^✓\s*/, "")}`;
    } else if (step === state.workflowStep) {
      stepEl.classList.add("is-current");
      stepEl.textContent = stepEl.textContent.replace(/^✓\s*/, "");
    } else {
      stepEl.classList.add("is-waiting");
      stepEl.textContent = stepEl.textContent.replace(/^✓\s*/, "");
    }
  });
}

function setAssistedEstimate() {
  const module = getActiveModule();
  const original = Number($("originalMinutes").value || 0);
  $("assistedMinutes").value = Math.max(3, Math.round(original * module.assistedRatio));
}

function renderModules() {
  moduleList.innerHTML = getWorkflowModules().map((item) => `
    <button class="module-button" type="button" data-module="${item.id}" aria-pressed="${item.id === state.activeModuleId}">
      <span class="module-icon">${item.icon}</span>
      <span>
        <strong>${item.name}</strong>
        <small>${item.summary}</small>
      </span>
    </button>
  `).join("");

  moduleList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeModuleId = button.dataset.module;
      renderModules();
      renderActiveModule();
      setAssistedEstimate();
    });
  });
}

function renderActiveModule() {
  const module = getActiveModule();
  $("activeModuleType").textContent = module.name;
  $("activeModuleTitle").textContent = module.title;
  $("activeModuleBadge").textContent = state.analytics ? `${module.outputLabel} · 基于学情生成` : "等待学情分析";
}

function renderGenerationGate() {
  const ready = Boolean(state.analytics);
  const generateButton = $("generateModuleBtn");
  const pipelineButton = $("runPipelineBtn");
  const hint = $("generationGateHint");
  if (generateButton) {
    generateButton.disabled = !ready;
    generateButton.title = ready ? "已接入学情画像，可以生成对策建议" : "请先完成第一步学情分析";
  }
  if (pipelineButton) {
    pipelineButton.disabled = !ready;
    pipelineButton.title = ready ? "基于当前学情画像生成五舱对策建议" : "请先完成第一步学情分析";
  }
  if (hint) {
    hint.textContent = ready
      ? "已接入学情画像，后续生成将基于学生情况、关注等级和干预优先级展开。"
      : "请先完成第一步学情分析，再生成备课、作业、沟通和归档任务。";
    hint.classList.toggle("ready", ready);
  }
  const module = getActiveModule();
  $("activeModuleBadge").textContent = ready ? `${module.outputLabel} · 基于学情生成` : "等待学情分析";
}

function calculateRubricScores() {
  const context = getRubricContext();
  const moduleCoverage = context.moduleCoverage;
  const savedMinutes = context.savedMinutes;
  const signed = context.signed;
  const hasAnalytics = context.hasAnalytics;
  const hasGenaiTrace = context.hasGenaiTrace;

  return {
    value: Math.min(15, 7 + Math.min(4, moduleCoverage) + (state.records.length >= 3 ? 2 : 0) + (hasAnalytics ? 2 : 0)),
    genai: Math.min(35, 8 + moduleCoverage * 4 + (hasGenaiTrace ? 6 : 0) + (state.records.length >= 5 ? 3 : 0) + (state.currentDraft ? 2 : 0)),
    effect: Math.min(30, 6 + Math.min(9, Math.round(savedMinutes / 30)) + (hasAnalytics ? 8 : 0) + Math.min(7, signed)),
    demo: Math.min(20, 6 + moduleCoverage * 2 + (state.records.length >= 5 ? 3 : 0) + (hasAnalytics ? 3 : 0) + (state.exportedOnce ? 1 : 0))
  };
}

function getRubricContext() {
  const moduleIds = new Set();
  let hasPipelineRecord = false;
  state.records.forEach((record) => {
    if (record.moduleId === "pipeline") {
      hasPipelineRecord = true;
      return;
    }
    if (workflowOrder.includes(record.moduleId)) moduleIds.add(record.moduleId);
  });
  const moduleCoverage = hasPipelineRecord ? Math.max(moduleIds.size, workflowOrder.length) : moduleIds.size;
  const savedMinutes = state.records.reduce((sum, record) => sum + record.savedMinutes, 0);
  const signed = state.records.filter((record) => record.reviewStatus.includes("已复核")).length;
  const hasAnalytics = Boolean(state.analytics);
  const hasGenaiTrace = Boolean(state.currentDraft?.aiPrompt || state.records.some((record) => record.aiPrompt));
  const allSavedReviewed = state.records.length > 0 && signed === state.records.length;

  return {
    moduleCoverage,
    savedMinutes,
    signed,
    hasAnalytics,
    hasGenaiTrace,
    allSavedReviewed,
    hasPipelineRecord,
    recordCount: state.records.length,
    analytics: state.analytics
  };
}

function buildRubricDiagnostics(item) {
  const context = getRubricContext();
  const analyticsText = context.hasAnalytics
    ? `已导入 ${context.analytics.analysisCount} 名学生数据，形成高关注 ${context.analytics.highCount} 人、中关注 ${context.analytics.mediumCount} 人和主要风险判断。`
    : "尚未完成第一步学情分析，后续材料缺少真实学生画像依据。";
  const recordText = context.recordCount
    ? `已保存 ${context.recordCount} 条应用记录，覆盖 ${context.moduleCoverage} 个工作舱，完成复核 ${context.signed} 条。`
    : "尚未保存应用记录，无法证明材料已经从“生成”走到“采用”。";

  const map = {
    value: {
      checks: [
        { label: "有真实学情输入，不凭空生成", done: context.hasAnalytics },
        { label: "能说明教师课外事务痛点", done: context.hasAnalytics || context.recordCount > 0 },
        { label: "至少形成 3 条可追溯应用记录", done: context.recordCount >= 3 }
      ],
      basis: analyticsText,
      gap: context.hasAnalytics ? "还可补充教师原始需求、手写要点或任务来源，让价值立意更有现场感。" : "缺少班级人数、学生画像、出勤/心理/行为等输入，价值立意容易变成口号。",
      action: context.hasAnalytics ? "继续保存 3 条以上真实应用记录，并在记录中写明原始耗时和使用场景。" : "先到第一步导入 xlsx 或填入样例数据，再点击“分析学情数据”。"
    },
    genai: {
      checks: [
        { label: "有系统提示词和 AI 初稿证据", done: context.hasGenaiTrace },
        { label: "形成“学情→对策→复核→保存”闭环", done: context.recordCount > 0 && context.signed > 0 },
        { label: "覆盖至少 3 个课外工作舱", done: context.moduleCoverage >= 3 },
        { label: "未复核内容不直接进入记录", done: context.allSavedReviewed }
      ],
      basis: context.hasGenaiTrace ? `${recordText} 已形成可展示的提示词、系统初稿和教师复核链条。` : "当前只有页面框架或待生成内容，还没有可证明的 GenAI 流程记录。",
      gap: context.hasGenaiTrace ? "可以继续补齐五舱之间的连续案例，突出 GenAI 不是单点写作工具。" : "缺少“系统如何组织提示词、AI 如何生成初稿、教师如何定稿”的过程证据。",
      action: context.hasGenaiTrace ? "按“学情诊断→备课资源→命题作业→沟通协同→资料归档”的顺序，各保存一条经过教师复核的记录。" : "先生成一个工作舱对策建议，查看并保存 GenAI 过程证据，再完成教师复核。"
    },
    effect: {
      checks: [
        { label: "有应用前后耗时对比", done: context.savedMinutes > 0 },
        { label: "有教师复核与定稿记录", done: context.signed > 0 },
        { label: "有学情数据支撑干预效果", done: context.hasAnalytics },
        { label: "至少形成 5 条过程记录", done: context.recordCount >= 5 }
      ],
      basis: context.savedMinutes > 0 ? `当前累计记录节约 ${context.savedMinutes} 分钟，并有 ${context.signed} 条复核记录。` : "尚未形成耗时对比，成效还停留在描述层面。",
      gap: context.savedMinutes > 0 ? "还可补充后续一周或两周的出勤、作业、谈话反馈变化，增强提质证据。" : "缺少“原预计耗时—系统辅助后耗时—教师复核后采用”的数据链。",
      action: "保存记录时填写原始耗时和 AI 辅助后耗时；后续把出勤、作业完成、谈话反馈作为下一轮追踪数据。"
    },
    demo: {
      checks: [
        { label: "五个工作舱均有材料", done: context.moduleCoverage >= workflowOrder.length },
        { label: "已导出申报或过程材料", done: state.exportedOnce },
        { label: "证据包清单能自动提示缺口", done: true },
        { label: "课程名称和任务主题可替换", done: true },
        { label: "有可复用的数据表和记录包", done: context.recordCount > 0 && context.hasAnalytics }
      ],
      basis: context.moduleCoverage >= workflowOrder.length ? "五舱链条已基本打通，可展示从学情到归档的完整流转。" : `当前覆盖 ${context.moduleCoverage}/5 个工作舱，示范推广材料还不完整。`,
      gap: state.exportedOnce ? "可继续补充不同课程或不同班级的样例，证明不是单一场景模板。" : "尚未导出过程材料或申报报告，别人拿到后不容易复用。",
      action: "完成五舱记录后，点击导出应用记录包和申报报告定稿，形成可移交、可复盘的材料。"
    }
  };

  return map[item.key];
}

function renderRubric() {
  const scores = calculateRubricScores();
  $("rubricGrid").innerHTML = rubric.map((item) => {
    const score = scores[item.key];
    const percent = Math.round((score / item.full) * 100);
    const diagnostic = buildRubricDiagnostics(item);
    const checks = diagnostic.checks.map((check) => `
      <li class="${check.done ? "done" : "todo"}">
        <span>${check.done ? "✓" : "○"}</span>
        <b>${check.label}</b>
      </li>
    `).join("");
    return `
      <article class="rubric-item">
        <div class="rubric-top">
          <div>
            <h3>${item.name}</h3>
            <small>${item.tip}</small>
          </div>
          <strong class="rubric-score"><span>准备度</span>${score}/${item.full}</strong>
        </div>
        <div class="bar"><span style="width:${percent}%"></span></div>
        <ul class="rubric-checks">${checks}</ul>
        <dl class="rubric-diagnostics">
          <div>
            <dt>当前依据</dt>
            <dd>${diagnostic.basis}</dd>
          </div>
          <div>
            <dt>待补强</dt>
            <dd>${diagnostic.gap}</dd>
          </div>
          <div class="rubric-next">
            <dt>下一步</dt>
            <dd>${diagnostic.action}</dd>
          </div>
        </dl>
      </article>
    `;
  }).join("");
}

function renderDashboard() {
  const saved = state.records.reduce((sum, record) => sum + record.savedMinutes, 0);
  const scores = calculateRubricScores();
  const completeness = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const attentionRate = state.analytics ? state.analytics.attentionRate : 0;
  $("savedHours").textContent = `${(saved / 60).toFixed(1)}h`;
  $("taskCount").textContent = state.records.length;
  $("improvementRate").textContent = `${attentionRate}%`;
  $("maturityScore").textContent = completeness;
  renderRubric();
  renderGenaiEvidence();
  renderEffectTracker();
  renderCaseLoop();
}

function renderEvidence() {
  if (state.records.length === 0) {
    evidenceRows.innerHTML = `<tr><td colspan="6" class="empty-row">暂无应用记录。生成对策建议并完成复核后，可手动保存到这里。</td></tr>`;
    return;
  }

  evidenceRows.innerHTML = state.records.slice().reverse().map((record) => `
    <tr>
      <td>${record.time}</td>
      <td>${record.moduleName}</td>
      <td>${record.topic}</td>
      <td>${record.savedMinutes} 分钟</td>
      <td>${record.reviewStatus}</td>
      <td>${record.value}</td>
    </tr>
  `).join("");
}

function latestRecord() {
  return state.records[state.records.length - 1] || null;
}

function htmlEscape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderGenaiEvidence() {
  const container = $("genaiEvidence");
  if (!container) return;
  const badge = $("genaiTraceBadge");
  const draft = state.currentDraft;
  const record = latestRecord();
  const source = draft || record;

  if (!source) {
    badge.textContent = "待生成";
    badge.className = "badge warn";
    container.innerHTML = `
      <div class="genai-step">
        <strong>待补强</strong>
        <p>完成学情分析并生成任一工作舱对策后，这里会自动显示“系统组织给 GenAI 的提示词、AI 初稿、教师复核要求和定稿去向”。</p>
      </div>
      <div class="genai-step">
        <strong>建议动作</strong>
        <p>先点击“分析学情数据”，再生成本舱对策建议；如果要展示真实 GenAI 使用过程，可复制提示词到通用大模型，再把生成结果粘贴回教师定稿。</p>
      </div>
    `;
    return;
  }

  const prompt = source.aiPrompt || buildAiPromptEvidence({
    moduleName: source.moduleName,
    topic: source.topic,
    originalMinutes: source.originalMinutes,
    assistedMinutes: source.assistedMinutes
  });
  const reviewed = Boolean(record && record.id === source.id) || source.reviewStatus?.includes("已复核") || signoffReady();
  badge.textContent = reviewed ? "已形成证据" : "待复核";
  badge.className = reviewed ? "badge safe" : "badge warn";
  container.innerHTML = `
    <div class="genai-step">
      <strong>1. 任务输入</strong>
      <p>${htmlEscape(source.moduleName || "当前工作舱")}围绕“${htmlEscape(source.topic || "当前任务")}”生成材料，已接入学情画像、关注分层和任务目标。</p>
    </div>
    <div class="genai-step">
      <strong>2. 提示词</strong>
      <pre>${htmlEscape(prompt)}</pre>
    </div>
    <div class="genai-step">
      <strong>3. AI 初稿</strong>
      <p>${draft ? "当前成果工作台中的对策建议即为系统初稿，尚需教师复核后才能保存为应用记录。" : "最近一条应用记录已保存系统初稿和教师定稿说明，可在导出的应用记录包中查看。"}</p>
    </div>
    <div class="genai-step">
      <strong>4. 教师定稿</strong>
      <p>${reviewed ? "已完成事实核查、隐私脱敏、语气调整和教师最终判断。" : "请完成教师复核签核，补充定稿说明，再保存为应用记录。"}</p>
    </div>
  `;
}

function renderEffectTracker() {
  const container = $("effectTracker");
  if (!container) return;
  const badge = $("effectTraceBadge");
  if (!state.records.length) {
    badge.textContent = "待记录";
    badge.className = "badge warn";
    container.innerHTML = `
      <div class="effect-row">
        <strong>待补证据</strong>
        <div class="effect-bar"><span class="effect-fill" style="width:18%"></span></div>
        <small>0 分钟</small>
        <p>保存记录时填写“原始耗时”和“AI 辅助后耗时”，这里会自动形成应用前后对比。</p>
      </div>
      <div class="effect-row">
        <strong>提质证据</strong>
        <div class="effect-bar"><span class="effect-fill" style="width:12%"></span></div>
        <small>待补</small>
        <p>建议后续补充一周或两周后的出勤、作业完成、谈话反馈变化。</p>
      </div>
    `;
    return;
  }

  const groups = new Map();
  state.records.forEach((record) => {
    const key = record.moduleName;
    if (!groups.has(key)) groups.set(key, { count: 0, original: 0, assisted: 0, saved: 0 });
    const item = groups.get(key);
    item.count += 1;
    item.original += record.originalMinutes;
    item.assisted += record.assistedMinutes;
    item.saved += record.savedMinutes;
  });
  const maxSaved = Math.max(...Array.from(groups.values()).map((item) => item.saved), 1);
  const totalSaved = state.records.reduce((sum, item) => sum + item.savedMinutes, 0);
  badge.textContent = `已记录 ${state.records.length} 条`;
  badge.className = "badge safe";
  container.innerHTML = Array.from(groups.entries()).map(([name, item]) => {
    const width = Math.max(8, Math.round((item.saved / maxSaved) * 100));
    const avgOriginal = Math.round(item.original / item.count);
    const avgAssisted = Math.round(item.assisted / item.count);
    return `
      <div class="effect-row">
        <strong>${htmlEscape(name)}</strong>
        <div class="effect-bar" aria-label="${htmlEscape(name)} 节约 ${item.saved} 分钟"><span class="effect-fill" style="width:${width}%"></span></div>
        <small>${item.saved} 分钟</small>
        <p>${item.count} 条记录；平均原始耗时 ${avgOriginal} 分钟，AI 辅助后 ${avgAssisted} 分钟。质量证据：${qualityEvidenceForModule(name)}</p>
      </div>
    `;
  }).join("") + `
    <div class="effect-row">
      <strong>累计</strong>
      <div class="effect-bar"><span class="effect-fill" style="width:100%"></span></div>
      <small>${totalSaved} 分钟</small>
      <p>当前可作为“减负”证据；下一步建议补充后续变化，增强“提质”证据。</p>
    </div>
  `;
}

function qualityEvidenceForModule(moduleName) {
  if (moduleName.includes("学情")) return "形成关注分层、干预优先级和后续追踪指标。";
  if (moduleName.includes("备课")) return "备课任务能承接学情画像，输出支架和评价证据。";
  if (moduleName.includes("作业") || moduleName.includes("命题")) return "作业从统一布置转向分层任务和错因反馈。";
  if (moduleName.includes("沟通")) return "沟通文本按事实、理解、建议、跟进组织，减少标签化表达。";
  if (moduleName.includes("归档")) return "零散过程材料沉淀为周报、案例和下一轮诊断依据。";
  return "形成五舱连续材料，可拆分复核后用于不同课外事务。";
}

function renderCaseLoop() {
  const caseBox = $("caseLoop");
  const checklist = $("evidenceChecklist");
  if (!caseBox || !checklist) return;
  const record = latestRecord();
  const analytics = state.analytics;
  const focus = analytics ? getFocusStudentSummary(3) : "待导入学情数据后生成。";
  const saved = state.records.reduce((sum, item) => sum + item.savedMinutes, 0);

  const nodes = [
    {
      title: "学情来源",
      text: analytics
        ? `已纳入 ${analytics.analysisCount} 名学生脱敏画像，识别高关注 ${analytics.highCount} 人、中关注 ${analytics.mediumCount} 人。重点参考：${focus}`
        : "尚未完成学情分析。先导入 Excel 或填入样例数据，案例链才有真实起点。"
    },
    {
      title: "AI 辅助",
      text: record
        ? `最近一次围绕“${record.topic}”生成 ${record.moduleName}，节约 ${record.savedMinutes} 分钟。`
        : state.currentDraft
          ? `已生成 ${state.currentDraft.moduleName} 系统初稿，等待教师复核后保存。`
          : "尚未生成对策建议。"
    },
    {
      title: "教师定稿",
      text: record
        ? `最近记录已保存教师定稿说明：${record.reviewNote.slice(0, 70)}${record.reviewNote.length > 70 ? "……" : ""}`
        : "完成四项复核后，系统才允许保存为应用记录。"
    },
    {
      title: "成效追踪",
      text: saved
        ? `当前累计节约 ${saved} 分钟。建议继续补充一到两周后的出勤、任务完成、谈话反馈变化。`
        : "尚未形成耗时对比，成效证据仍需补充。"
    }
  ];

  caseBox.innerHTML = nodes.map((node, index) => `
    <article class="case-node">
      <span>${index + 1}</span>
      <div>
        <h3>${node.title}</h3>
        <p>${htmlEscape(node.text)}</p>
      </div>
    </article>
  `).join("");

  const evidenceItems = buildEvidenceChecklist();
  checklist.innerHTML = evidenceItems.map((item) => `
    <article class="evidence-item ${item.done ? "done" : ""}">
      <span class="mark">${item.done ? "✓" : "!"}</span>
      <div>
        <strong>${item.title}</strong>
        <small>${item.desc}</small>
      </div>
      <em>${item.done ? "已具备" : "待补充"}</em>
    </article>
  `).join("");
}

function buildEvidenceChecklist() {
  const coverage = getRubricContext().moduleCoverage;
  const saved = state.records.reduce((sum, item) => sum + item.savedMinutes, 0);
  const hasPrompt = Boolean(state.currentDraft?.aiPrompt || state.records.some((item) => item.aiPrompt));
  return [
    { title: "脱敏学情数据", desc: "Excel 模板或手动录入的班级画像、学生编号和关注分层。", done: Boolean(state.analytics) },
    { title: "GenAI 提示词与初稿", desc: "证明系统不是只填表，而是组织任务背景并生成初稿。", done: hasPrompt },
    { title: "教师复核定稿", desc: "包含事实核查、隐私脱敏、语气调整和教师判断。", done: state.records.some((item) => item.reviewStatus.includes("已复核")) },
    { title: "应用前后耗时对比", desc: "用真实分钟数说明重复性事务减少。", done: saved > 0 },
    { title: "五舱闭环案例", desc: "至少覆盖学情、备课、作业、沟通、归档五个课外场景。", done: coverage >= workflowOrder.length },
    { title: "后续效果追踪", desc: "补充一到两周后的出勤、作业、谈心或家校反馈变化。", done: state.records.length >= 5 && saved > 0 }
  ];
}

function persist() {
  localStorage.setItem("qinghang-records", JSON.stringify(state.records));
  localStorage.setItem("qinghang-analytics", JSON.stringify(state.analytics));
  localStorage.setItem("qinghang-exported", JSON.stringify(state.exportedOnce));
  renderDashboard();
  renderEvidence();
  renderGenerationGate();
}

function makeSharedHeader(module, data) {
  return `【${module.outputLabel}·对策建议】
工作舱：${module.name}
学段/年级：${data.grade}
学科/课程：${data.subject}
主题任务：${data.topic}

一、生成依据
班级/学生情况：
${data.studentProfile}

本次课外任务目标：
${data.goal}`;
}

function buildAiPromptEvidence(module, data = {}) {
  const analytics = state.analytics
    ? `班级总人数 ${state.analytics.classTotal} 人，纳入分析 ${state.analytics.analysisCount} 人；高关注 ${state.analytics.highCount} 人，中关注 ${state.analytics.mediumCount} 人；主要风险：${state.analytics.topRiskText}。`
    : "尚未接入学情数据。";
  const moduleName = module.name || module.moduleName || "当前工作舱";
  const topic = data.topic || module.topic || "当前任务";
  const subject = data.subject || "当前课程";
  const grade = data.grade || "当前年级";
  return `你是一名熟悉教师课外事务减负增效的教育智能助手。
请基于以下真实背景，生成“${moduleName}”的对策建议初稿。

【学段/年级】${grade}
【学科/课程】${subject}
【主题任务】${topic}
【学情依据】${analytics}
【班级/学生情况】${data.studentProfile || "使用当前已导入的班级画像与学生脱敏数据。"}
【任务目标】${data.goal || "减少教师重复性整理、起草、沟通和归档时间，同时提高干预建议的可执行性。"}

输出要求：
1. 只生成可供教师复核的初稿，不直接作为最终结论。
2. 必须体现“承接上一环节—本环节产出—流向下一环节”。
3. 干预建议要包含问题信号、可能原因、教师行动和跟踪指标。
4. 涉及学生信息使用编号，不出现姓名、联系方式和敏感身份。
5. 最后给出教师复核重点：事实核查、隐私脱敏、语气适配、课程目标对齐。`;
}

function getModuleLinkage(moduleId) {
  const linkage = {
    prepare: {
      input: "承接学情诊断中的风险分层、关注名单和班级总体画像。",
      output: "输出课前导学任务、课堂活动支架、分层学习任务和评价证据。",
      next: "进入命题与作业舱，转化为分层作业和补救任务。"
    },
    homework: {
      input: "承接备课资源舱中的教学目标、活动设计和分层支持策略。",
      output: "输出基础、提升、挑战三层作业，附评分细则和共性反馈模板。",
      next: "进入学情诊断舱，利用作业完成情况继续识别薄弱点和关注对象。"
    },
    diagnosis: {
      input: "承接 Excel 学情模板、班级画像、出勤、心理、消费和违纪数据。",
      output: "输出班级综合画像、风险分层、重点关注学生和干预优先级。",
      next: "进入备课资源舱和沟通协同舱，用于调整任务难度和沟通方式。"
    },
    communication: {
      input: "承接学情诊断舱中的关注原因、学生特点和干预建议。",
      output: "输出师生谈心提纲、家校沟通文本、沟通风险检查和跟进安排。",
      next: "进入资料归档与班级管理舱，形成谈心记录、家校协同记录和后续跟踪。"
    },
    archive: {
      input: "承接前四个工作舱的对策建议、复核记录、干预过程和应用反馈。",
      output: "输出班级周报、育人案例、过程材料目录和应用记录包。",
      next: "回到学情诊断舱，作为下一轮分析的过程数据。"
    },
    pipeline: {
      input: "承接当前任务背景和已导入的学情画像。",
      output: "一次性输出五个工作舱的连续对策建议。",
      next: "教师可拆分复核后分别保存到对应应用记录。"
    }
  };
  return linkage[moduleId] || linkage.prepare;
}

function getFocusStudentSummary(limit = 5) {
  if (!state.analytics || !state.analytics.rows?.length) return "暂无重点学生摘要。";
  return state.analytics.rows
    .filter((row) => row.level !== "低关注")
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => `${row.id}（${row.level}）：${row.reasons.slice(0, 3).join("；") || "需继续观察"}`)
    .join("\n") || "当前没有高/中关注学生，可按常规支持推进。";
}

function getModuleOperationalAdvice(moduleId) {
  const focus = getFocusStudentSummary();
  const advice = {
    prepare: `操作建议：
1. 先查看学情诊断中的高/中关注学生，确定本节课需要降低门槛还是增加挑战。
2. 对高关注学生准备“可完成的小步骤”，对中关注学生准备“同伴互审任务”。
3. 备课产出必须留下给作业舱使用的目标、活动支架和评价证据。
重点参考学生：
${focus}`,
    homework: `操作建议：
1. 先承接备课资源舱中的学习目标和活动支架，不重新从零设计作业。
2. 作业必须分为基础、提升、挑战三层，并标明哪些学生优先完成基础层。
3. 作业结果要能回流到学情诊断舱，形成下一轮风险判断依据。
重点参考学生：
${focus}`,
    diagnosis: `操作建议：
1. 先导入 Excel 学情模板，确认班级总人数、分析人数和脱敏数据一致。
2. 不只看单项指标，要综合家庭、出勤、心理、消费、违纪和班级角色判断。
3. 输出结果要能直接推送到备课、作业、沟通和归档四个舱。
重点参考学生：
${focus}`,
    communication: `操作建议：
1. 先看学情诊断舱中的关注原因，再决定是师生谈话、家校沟通还是班委协助。
2. 沟通文本按“事实-理解-建议-跟进”组织，避免评价化和标签化。
3. 沟通后的约定要进入资料归档舱，作为后续复盘依据。
重点参考学生：
${focus}`,
    archive: `操作建议：
1. 汇总前四个舱的对策建议、教师复核、使用情况和跟踪变化。
2. 每条归档材料都标明来源：学情诊断、备课资源、作业反馈或沟通协同。
3. 归档结果要能反向支持下一轮学情诊断，而不是只作为期末材料。
重点参考学生：
${focus}`
  };
  return advice[moduleId] || advice.prepare;
}

function formatInterventionPlanForDraft(data) {
  if (!data) return "暂无基于分析结果的干预对策。";
  const sections = buildClassInterventionPlan(data);
  return sections.map((section) => {
    const items = section.items.map((item, index) => `${index + 1}. ${item}`).join("\n");
    return `${section.title}\n${items}`;
  }).join("\n\n");
}

function generateArtifact(module, data) {
  const header = makeSharedHeader(module, data);
  const focus = getFocusStudentSummary();
  const analyticsNote = state.analytics
    ? `已参考当前学情数据：班级总人数 ${state.analytics.classTotal} 人，纳入分析 ${state.analytics.analysisCount} 人；高关注 ${state.analytics.highCount} 人，中关注 ${state.analytics.mediumCount} 人，重点关注比例 ${state.analytics.attentionRate}%。主要风险来自：${state.analytics.topRiskText}。`
    : "当前未接入学情数据；如需更精准建议，请先在“学情数据导入与干预建议”中填写班级总人数、分析人数、班级画像和学生脱敏数据。";
  const interventionNote = formatInterventionPlanForDraft(state.analytics);

  const templates = {
    prepare: `${header}

二、学情判断
${analyticsNote}

三、备课资源对策
1. 目标拆解：围绕“${data.topic}”，把本次课外任务拆成“基础理解、方法练习、迁移应用”三类目标，避免所有学生完成同一难度任务。
2. 支架设计：为高关注学生准备步骤卡、关键词提示和示例；为中关注学生准备同伴互助清单；为低关注学生准备拓展任务或展示任务。
3. 材料组织：课前资料不宜过多，建议控制为“1 个核心概念、1 个典型案例、1 张任务单、1 个反馈问题”。
4. 课堂衔接：把课外任务结果带回课堂，用 5-8 分钟做共性问题反馈，再进入课程重点。

四、基于分析结果的干预对策
${interventionNote}

五、重点学生参考
${focus}`,

    homework: `${header}

二、学情判断
${analyticsNote}

三、分层作业对策
作业主题：${data.topic}
1. 基础层：完成核心概念、基本步骤或基础题，目标是让高关注学生能够完成并建立信心。
2. 提升层：完成情境分析、方法说明或变式练习，目标是让中关注学生形成稳定的学习路径。
3. 挑战层：完成综合应用、展示表达或开放问题，目标是给低关注及优势学生提供拓展空间。
4. 反馈方式：批改时优先标注共性问题，不只给分数；对高关注学生给一条可执行改进建议。

四、基于分析结果的干预对策
${interventionNote}

五、结果回流建议
1. 记录各层作业完成情况、典型错因和未完成学生名单。
2. 对连续两次未完成基础层的学生，回流到学情诊断舱。
3. 对同时存在出勤、心理或家庭支持风险的学生，推送到沟通协同舱生成谈话提纲。`,

    diagnosis: `${header}

二、诊断结果摘要
${analyticsNote}

三、基于分析结果的干预对策
${interventionNote}

四、分层支持建议
1. 高关注学生：先做安全性和稳定性支持，重点核实出勤、情绪、家庭支持和行为规范，不直接把学习任务加重。
2. 中关注学生：先给学习支架和两周观察，不急于扩大沟通范围，重点看任务完成、课堂参与和迟到晚归是否改善。
3. 低关注学生：给予正向角色，如同伴互审员、资料整理员、学习小组提醒员，帮助班级形成支持氛围。

五、重点学生参考
${focus}`,

    communication: `${header}

二、学情判断
${analyticsNote}

三、沟通协同对策
1. 师生谈心：围绕“最近哪里最困难、哪一步最容易卡住、下一周能完成哪一个小目标”展开，不用评价性语言。
2. 家校沟通：先说明事实表现，再说明学校已采取的支持措施，最后协商一项家庭可配合的小行动。
3. 班级支持：对中低风险学生安排同伴提醒、学习小组、资料整理等正向角色，减少单纯批评和单向通知。
4. 跟进约定：每次沟通都形成“一个目标、一个时间点、一个观察指标”，便于下一轮复盘。

四、基于分析结果的干预对策
${interventionNote}

五、沟通话术示例
学生谈话：我注意到你最近在“${data.topic}”相关任务中完成不太稳定，我们先不急着评价对错，先一起找出卡住的一步，并约定本周先完成一个小目标。
家校沟通：近期我们关注到孩子在学习任务或到课状态上有一些波动，学校会先提供任务支架和跟进提醒，也想了解家中是否有可以配合的一项具体支持。`,

    archive: `${header}

二、学情判断
${analyticsNote}

三、归档与班级管理对策
1. 归档主线：围绕“${data.topic}”，把学情诊断、备课支架、分层作业、沟通记录、后续变化放在同一条案例链中。
2. 周报结构：本周学情变化、已采取措施、学生反馈、家校协同、下周跟进重点。
3. 案例沉淀：选择 1-2 名脱敏学生，记录“问题表现—干预措施—过程变化—下一步计划”，避免只保存截图。
4. 数据回流：把出勤、任务完成、谈话记录、家校反馈作为下一轮学情诊断依据。

四、基于分析结果的干预对策
${interventionNote}
`
  };

  return templates[module.id];
}

function generateReviewItems(module, data) {
  return [
    `目标对齐：确认对策建议是否真正服务“${data.topic}”的课外任务，而不是泛泛而谈。`,
    "事实核查：核对概念、数据、制度要求、课程要求和班级情况，删除不确定内容。",
    "隐私安全：学生姓名、联系方式、家庭情况等敏感信息必须脱敏后再保存或展示。",
    `本班适配：根据 ${data.grade} ${data.subject} 的真实学生基础，对任务难度和表达方式进行调整。`,
    "应用记录：只有完成教师复核并确认采用后，才保存到应用记录。"
  ];
}

function showDraft(module, data, artifact) {
  const aiPrompt = buildAiPromptEvidence(module, data);
  state.currentDraft = {
    moduleId: module.id,
    moduleName: module.name,
    topic: data.topic,
    originalMinutes: data.originalMinutes,
    assistedMinutes: data.assistedMinutes,
    savedMinutes: Math.max(0, data.originalMinutes - data.assistedMinutes),
    value: module.value,
    aiPrompt,
    artifact
  };
  state.lastOutput = artifact;
  output.classList.remove("empty");
  output.textContent = artifact;
  reviewList.innerHTML = generateReviewItems(module, data).map((item) => `<li>${item}</li>`).join("");
  resetReviewState(`${module.name}对策建议已生成：请进入教师定稿环节。可点击“一键常规复核通过”，也可退回修改并填写原因。`);
  setWorkflowStep(3, `当前：${module.name}对策建议已生成，请完成教师修订、定稿与复核。`);
  renderDashboard();
}

function ensureAnalyticsReady() {
  if (state.analytics) return true;
  $("analyticsSummary").innerHTML = `<span class="error-note">请先完成第一步：导入或填写学生情况，并点击“分析学情数据”。后续备课、作业、沟通和归档必须建立在真实学情基础上。</span>`;
  $("analyticsKpis").innerHTML = "";
  $("heatmap").innerHTML = "";
  $("interventionPlan").innerHTML = "";
  setWorkflowStep(1, "当前：请先完成学情数据导入与分析，再生成后续工作舱任务。");
  const dataCard = document.querySelector(".data-card");
  if (dataCard) dataCard.scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("请先完成学情分析");
  return false;
}

function runGeneration() {
  if (!ensureAnalyticsReady()) return;
  const module = getActiveModule();
  const data = collectForm();
  const artifact = generateArtifact(module, data);
  showDraft(module, data, artifact);
  showToast("对策建议已生成，请先完成教师定稿与复核");
}

function runPipeline() {
  if (!ensureAnalyticsReady()) return;
  const data = collectForm();
  const drafts = getWorkflowModules().map((module) => {
    const adjusted = {
      ...data,
      assistedMinutes: Math.max(3, Math.round(data.originalMinutes * module.assistedRatio))
    };
    return generateArtifact(module, adjusted);
  });
  const artifact = `【五舱综合对策建议】\n\n${drafts.join("\n\n----------------------------------------\n\n")}`;
  showDraft({
    id: "pipeline",
    name: "五舱综合对策建议",
    value: "用于一次性查看五个工作舱的连贯材料，确认后可作为综合应用记录保存。"
  }, data, artifact);
  showToast("五舱对策建议已生成，尚未保存到应用记录");
}

function saveCurrentDraft() {
  if (!state.currentDraft) {
    showToast("请先生成对策建议");
    return;
  }
  if (!signoffReady()) {
    showToast("请先点击“一键常规复核通过”或完成四项复核");
    return;
  }
  const draft = state.currentDraft;
  const reviewNote = $("reviewNote").value.trim() || buildDefaultReviewNote(draft.moduleName);
  state.records.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    moduleId: draft.moduleId,
    moduleName: draft.moduleName,
    topic: draft.topic,
    originalMinutes: draft.originalMinutes,
    assistedMinutes: draft.assistedMinutes,
    savedMinutes: draft.savedMinutes,
    reviewStatus: "已复核并保存",
    reviewNote,
    value: draft.value,
    aiPrompt: draft.aiPrompt,
    artifact: `${draft.artifact}\n\n【教师定稿说明】\n${reviewNote}`
  });
  persist();
  setWorkflowStep(5, "当前：记录已保存，可导出过程材料，或继续生成下一轮对策建议。");
  showToast("已保存为应用记录");
}

function parsePercent(value) {
  const text = String(value ?? "").replace("%", "").trim();
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function parseNumber(value) {
  const text = String(value ?? "").replace(/[^\d.-]/g, "");
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}

function parseStudentRows(text) {
  return text.split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, grade, gender, family, income, attendance, consults, mental, consumption, discipline, role, ...otherParts] = line.split(",").map((item) => item.trim());
      const row = {
        id,
        grade,
        gender,
        family,
        income: parseNumber(income),
        attendance: parsePercent(attendance),
        consults: parseNumber(consults),
        mental,
        consumption: parseNumber(consumption),
        discipline,
        role,
        other: otherParts.join("，")
      };
      return addRiskProfile(row);
    });
}

function addRiskProfile(row) {
  const reasons = [];
  let score = 0;
  const familyText = `${row.family || ""}${row.other || ""}`;
  const mentalText = row.mental || "";
  const disciplineText = row.discipline || "";

  if (row.attendance && row.attendance < 90) {
    score += 20;
    reasons.push("近30天课堂出勤低于90%");
  } else if (row.attendance && row.attendance < 95) {
    score += 10;
    reasons.push("近30天课堂出勤略低");
  }

  if (row.consults >= 4) {
    score += 20;
    reasons.push("心理咨询预约次数较多");
  } else if (row.consults >= 2) {
    score += 10;
    reasons.push("有多次心理咨询预约");
  }

  if (/情绪波动|厌学|敏感|害羞|焦虑|失眠|压力|不喜欢上课|适应.*一般|失落/.test(mentalText)) {
    score += 22;
    reasons.push("自述心理状态需要关注");
  }

  if (/单亲|重组|患病|负担|压力|债务|沟通较少|多子女/.test(familyText)) {
    score += 12;
    reasons.push("家庭支持或经济压力需关注");
  }

  if (row.income && row.income < 30000) {
    score += 14;
    reasons.push("家庭年收入偏低");
  } else if (row.income && row.income < 50000) {
    score += 7;
    reasons.push("家庭经济压力可能存在");
  }

  if (row.consumption && row.consumption < 500) {
    score += 10;
    reasons.push("近30天食堂消费偏低");
  } else if (row.consumption && row.consumption > 1200) {
    score += 6;
    reasons.push("近30天食堂消费偏高，建议核实生活状态");
  }

  if (disciplineText && !/^无$/.test(disciplineText)) {
    score += /违纪/.test(disciplineText) ? 14 : 9;
    reasons.push(`存在${disciplineText}`);
  }

  if (row.role && !/^无$/.test(row.role)) {
    score = Math.max(0, score - 4);
    reasons.push(`担任${row.role}，具备一定班级连接点`);
  }

  let level = "低关注";
  if (score >= 58) level = "高关注";
  else if (score >= 32) level = "中关注";

  const suggestion = level === "高关注"
    ? "建议班主任或辅导员开展一对一谈话，结合出勤、心理、家庭与消费情况持续跟踪。"
    : level === "中关注"
      ? "建议纳入阶段性观察名单，采用同伴支持、学习提醒和必要的家校沟通。"
      : "保持常规关注，可通过班级活动和学习任务继续增强连接。";

  return { ...row, score, level, reasons, suggestion };
}

function buildStudentIntervention(row) {
  const actions = [];
  const followups = [];
  if (row.level === "高关注") {
    actions.push("48小时内完成一次一对一谈话，先核实近期出勤、情绪、生活消费和家庭支持情况。");
    actions.push("建立两周跟踪台账，每周至少记录一次出勤变化、课堂状态、同伴互动和作业完成情况。");
  } else if (row.level === "中关注") {
    actions.push("纳入阶段性观察名单，安排一次简短谈话或课后问询，确认主要困难来源。");
    actions.push("给予可完成的小任务和明确提醒，避免一次性提出过多要求。");
  } else {
    actions.push("保持常规关注，可通过班级活动、学习小组和正向反馈增强连接感。");
  }

  if (row.attendance < 90) {
    actions.push("出勤支持：核对缺勤原因，设置到课提醒，必要时联系宿舍长或班委协助提醒。");
    followups.push("近两周出勤率是否回升到90%以上");
  }
  if (row.consults >= 2 || /情绪波动|焦虑|失眠|敏感|厌学|压力|失落|不喜欢上课/.test(row.mental || "")) {
    actions.push("心理支持：谈话中避免直接贴标签，以倾听和事实核实为主；必要时建议继续预约专业心理咨询。");
    followups.push("情绪自述是否趋于稳定，是否愿意主动求助");
  }
  if (/单亲|重组|患病|负担|压力|债务|沟通较少|多子女/.test(`${row.family || ""}${row.other || ""}`)) {
    actions.push("家庭支持：沟通时先肯定学生表现，再了解家庭支持条件，避免把家庭情况作为负面评价。");
    followups.push("家校沟通后学生学习状态是否改善");
  }
  if (row.consumption < 500 || row.consumption > 1200) {
    actions.push("生活状态核实：结合食堂消费、宿舍反馈和本人说明判断是否存在饮食、经济或作息异常。");
    followups.push("消费和作息是否恢复到较稳定区间");
  }
  if (row.discipline && !/^无$/.test(row.discipline)) {
    actions.push("行为规范：明确一次具体改进目标，例如一周内无迟到、无晚归，并安排班委或宿舍长正向提醒。");
    followups.push("违纪或迟到记录是否减少");
  }
  if (row.role && !/^无$/.test(row.role)) {
    actions.push(`优势利用：其担任${row.role}，可把班级角色转化为正向连接点，但避免额外压担。`);
  }

  return {
    immediate: actions.slice(0, 2),
    support: actions.slice(2, 5),
    communication: [
      "沟通文本坚持“事实描述-理解处境-共同约定-后续跟进”四步，不使用标签化语言。",
      "涉及家庭、心理和消费信息时，只做必要核实，不在班级公开讨论。"
    ],
    followups: followups.length ? followups : ["课堂参与是否稳定", "任务完成是否按时", "是否愿意主动沟通"]
  };
}

function buildClassInterventionPlan(data) {
  const highRows = data.rows.filter((row) => row.level === "高关注");
  const mediumRows = data.rows.filter((row) => row.level === "中关注");
  const highRate = Math.round((highRows.length / data.analysisCount) * 100);
  const mediumRate = Math.round((mediumRows.length / data.analysisCount) * 100);
  const lowAttendance = data.rows.filter((row) => row.attendance < 90).length;
  const mentalConcern = data.rows.filter((row) => row.consults >= 2 || /情绪波动|焦虑|失眠|敏感|厌学|压力|失落|不喜欢上课/.test(row.mental || "")).length;
  const familyConcern = data.rows.filter((row) => /单亲|重组|患病|负担|压力|债务|沟通较少|多子女/.test(`${row.family || ""}${row.other || ""}`)).length;
  const disciplineConcern = data.rows.filter((row) => row.discipline && !/^无$/.test(row.discipline)).length;

  return [
    {
      title: "1. 先判读：确定干预优先级",
      items: [
        `高关注 ${highRows.length} 人，占 ${highRate}%：不宜平均用力，先建立“红色优先台账”，按心理信号、出勤异常、违纪记录、家庭支持四类原因排序处理。`,
        `中关注 ${mediumRows.length} 人，占 ${mediumRate}%：建立“两周观察名单”，先给任务支架和课后提醒，暂不直接扩大为家校沟通，避免过度干预。`,
        "低关注学生：保持常规正向反馈和班级活动连接，安排同伴互助角色，避免班级管理只围绕风险学生转。"
      ]
    },
    {
      title: "2. 再处置：按风险来源选择方法",
      items: [
        lowAttendance ? `出勤方面：${lowAttendance} 人出勤低于 90%，采用“原因核实—到课提醒—同伴结对—一周复盘”四步法，不只记录缺勤次数，还要记录缺勤原因。` : "出勤方面：整体较稳定，可保持常规提醒，并把偶发缺勤作为观察项。",
        mentalConcern ? `心理状态方面：${mentalConcern} 人存在心理或情绪关注信号，采用“低压力谈话—事实核实—支持资源告知—必要时转介”路径，谈话中不追问隐私、不贴标签。` : "心理状态方面：暂无集中异常，继续保留求助渠道提醒和班级支持氛围。",
        "学习任务方面：对高关注学生使用“小步任务卡”，把一次性大任务拆成 15 分钟内可完成的小目标；对中关注学生使用同伴互审和完成提醒。"
      ]
    },
    {
      title: "3. 后协同：明确谁参与、说什么、留什么",
      items: [
        familyConcern ? `家庭支持方面：${familyConcern} 人涉及家庭压力或沟通不足，家校沟通先说事实表现和支持需要，再协商一项家中可执行配合，不直接归因家庭问题。` : "家庭支持方面：可采用常规家校反馈，重点反馈学生具体进步和下一步任务。",
        disciplineConcern ? `行为规范方面：${disciplineConcern} 人有迟到、晚归或违纪记录，建议设置“一周一个行为目标”，如无迟到、按时归寝、按时提交任务，并用周记录跟踪。` : "行为规范方面：整体较平稳，可用班级公约和正向榜样继续强化。",
        "沟通留痕只保存脱敏编号、事实表现、采取措施、学生/家长反馈和下一次复盘时间，不保存情绪化评价。"
      ]
    },
    {
      title: "4. 最后追踪：用数据判断是否有效",
      items: [
        "每周更新一次：出勤率、迟到/晚归次数、任务完成率、谈话记录、心理咨询跟进情况。",
        "每两周复盘一次：高关注学生是否降为中关注，中关注学生是否稳定，未改善学生是否需要调整干预方式。",
        "把追踪数据回流到下一轮：学情诊断 → 干预任务 → 沟通协同 → 归档复盘 → 下一轮诊断，形成可证明的提质闭环。"
      ]
    }
  ];
}

function validateAnalyticsInput(rows) {
  const classTotal = Number($("classTotal").value || 0);
  const analysisCount = Number($("analysisCount").value || 0);
  const classPortrait = $("classPortrait").value.trim();
  if (!classTotal || !analysisCount || !classPortrait) {
    return "请先填写班级总人数、本次纳入分析人数和班级总体画像。";
  }
  if (analysisCount > classTotal) {
    return "本次纳入分析人数不能大于班级总人数。";
  }
  if (rows.length === 0) {
    return "请粘贴学生脱敏数据，或先导入 xlsx 模板。";
  }
  if (rows.length !== analysisCount) {
    return `当前数据行数为 ${rows.length}，与“本次纳入分析人数” ${analysisCount} 不一致，请核对后再分析。`;
  }
  const invalid = rows.find((row) => !row.id || !row.grade || !row.gender || !row.family || !Number.isFinite(row.income) || !Number.isFinite(row.attendance) || !Number.isFinite(row.consults) || !row.mental || !Number.isFinite(row.consumption) || !row.discipline);
  if (invalid) {
    return "学生数据格式不完整。请按页面提示的模板字段填写。";
  }
  return "";
}

function analyzeData() {
  const rows = parseStudentRows($("studentData").value);
  const error = validateAnalyticsInput(rows);
  if (error) {
    state.analytics = null;
    $("analyticsSummary").innerHTML = `<span class="error-note">${error}</span>`;
    $("analyticsKpis").innerHTML = "";
    $("heatmap").innerHTML = "";
    $("interventionPlan").innerHTML = "";
    persist();
    showToast("学情数据还不完整");
    return;
  }

  const classTotal = Number($("classTotal").value);
  const analysisCount = Number($("analysisCount").value);
  const classPortrait = $("classPortrait").value.trim();
  const avgAttendance = Math.round(rows.reduce((sum, row) => sum + row.attendance, 0) / rows.length);
  const avgConsults = Number((rows.reduce((sum, row) => sum + row.consults, 0) / rows.length).toFixed(1));
  const avgConsumption = Math.round(rows.reduce((sum, row) => sum + row.consumption, 0) / rows.length);
  const highCount = rows.filter((row) => row.level === "高关注").length;
  const mediumCount = rows.filter((row) => row.level === "中关注").length;
  const attentionRate = Math.round(((highCount + mediumCount) / rows.length) * 100);
  const reasonCounts = {};
  rows.forEach((row) => row.reasons.forEach((reason) => {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  }));
  const topRisks = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topRiskText = topRisks.length ? topRisks.map(([reason, count]) => `${reason}${count}人`).join("；") : "整体暂无明显集中风险";

  state.analytics = { rows, classTotal, analysisCount, classPortrait, avgAttendance, avgConsults, avgConsumption, highCount, mediumCount, attentionRate, topRiskText };
  $("studentProfile").value = `班级总人数 ${classTotal} 人，本次纳入分析 ${analysisCount} 人。${classPortrait} 当前高关注 ${highCount} 人，中关注 ${mediumCount} 人，重点关注比例 ${attentionRate}%。主要风险：${topRiskText}。后续备课、作业、沟通和归档任务需围绕这些真实学情展开。`;
  renderAnalytics();
  persist();
  setWorkflowStep(2, "当前：学情画像已形成，后续任务将基于学生情况生成对策建议。");
  showToast("学情诊断已生成");
}

function renderAnalytics() {
  if (!state.analytics) {
    $("analyticsSummary").textContent = "请先导入你提供的 xlsx 模板，或手动填写班级画像与学生脱敏数据。系统会基于出勤、心理咨询、自述心理、家庭情况、消费和违纪情况生成关注分层，再驱动后续工作舱任务。";
    $("analyticsKpis").innerHTML = "";
    $("heatmap").innerHTML = "";
    $("interventionPlan").innerHTML = "";
    return;
  }
  const data = state.analytics;
  $("analyticsKpis").innerHTML = `
    <article class="analytics-kpi"><span>高关注</span><strong>${data.highCount}人</strong></article>
    <article class="analytics-kpi"><span>中关注</span><strong>${data.mediumCount}人</strong></article>
    <article class="analytics-kpi"><span>重点关注比例</span><strong>${data.attentionRate}%</strong></article>
  `;
  $("analyticsSummary").innerHTML = `
    <strong>班级总人数 ${data.classTotal} 人，本次纳入分析 ${data.analysisCount} 人。</strong><br>
    班级画像：${data.classPortrait}<br>
    平均出勤 ${data.avgAttendance}%，心理咨询预约均值 ${data.avgConsults} 次，食堂消费均值 ${data.avgConsumption} 元。高关注 ${data.highCount} 人，中关注 ${data.mediumCount} 人，重点关注比例 ${data.attentionRate}%。<br>
    主要风险：${data.topRiskText}。
  `;
  $("heatmap").innerHTML = data.rows.map((row) => {
    const width = Math.min(100, Math.max(8, row.score));
    const plan = buildStudentIntervention(row);
    return `
      <div class="heat-row">
        <strong>${row.id}</strong>
        <div class="heat-track" aria-label="${row.id} 关注分 ${row.score}"><span class="heat-fill" style="width:${width}%"></span></div>
        <small>${row.level}</small>
        <p>${row.grade}，${row.gender}；出勤 ${row.attendance}%，咨询 ${row.consults} 次，消费 ${row.consumption} 元；${row.reasons.join("；") || "暂无明显风险"}。建议：${plan.immediate[0]}</p>
      </div>
    `;
  }).join("");
  const classPlan = buildClassInterventionPlan(data);
  $("interventionPlan").innerHTML = classPlan.map((section) => `
    <article class="intervention-card">
      <h3>${section.title}</h3>
      <ul>${section.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");
}

function sampleData() {
  $("classTotal").value = 8;
  $("analysisCount").value = 8;
  $("classPortrait").value = "本班样例数据包含家庭情况、出勤、心理咨询、自述心理状态、食堂消费和违纪记录，适合用于班级管理、个别关怀和课外支持任务分析。";
  $("studentData").value = `S001,2023级,女,重组家庭，沟通较少,52977,96%,3,情绪波动较大，人际关系敏感,1135,晚归1次,生活委员,
S002,2023级,男,多子女家庭，经济压力较大,18205,97%,4,情绪波动较大，人际关系敏感，害羞,1104,无,团支书助理,
S003,2023级,女,父亲患病，家庭负担较重,70557,93%,4,存在轻度厌学倾向,1125,迟到2次,生活委员,
S004,2023级,女,重组家庭，沟通较少,22546,95%,5,心理状态稳定，不喜欢上课,320,迟到2次,团支书助理,
S005,2023级,男,单亲家庭，长期与祖辈共同生活,52949,98%,0,存在轻度厌学倾向,874,迟到2次,宿舍长,
S006,2023级,男,家庭成员负债较多，压力大,50867,85%,1,适应情况一般，偶尔失落,995,违纪1次,团支书助理,
S007,2023级,女,普通家庭，沟通较顺畅,64000,99%,0,心理状态稳定,920,无,无,
S008,2023级,男,多子女家庭，经济压力较大,28000,91%,2,学习压力较大，睡眠一般,680,晚归1次,无,`;
  showToast("样例数据已填入，点击分析后才会计算");
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("当前浏览器不支持本地解压 xlsx，请使用新版 Chrome/Edge 打开。");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (readUint32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("未识别到有效 xlsx 文件结构。");

  const entryCount = readUint16(view, eocd + 10);
  let offset = readUint32(view, eocd + 16);
  const entries = {};

  for (let i = 0; i < entryCount; i++) {
    if (readUint32(view, offset) !== 0x02014b50) break;
    const method = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localOffset = readUint32(view, offset + 42);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const name = new TextDecoder().decode(nameBytes);

    const localNameLength = readUint16(view, localOffset + 26);
    const localExtraLength = readUint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (data) entries[name] = data;
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function xmlText(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

function parseXml(bytes) {
  return new DOMParser().parseFromString(xmlText(bytes), "application/xml");
}

function parseSharedStrings(entries) {
  const file = entries["xl/sharedStrings.xml"];
  if (!file) return [];
  const xml = parseXml(file);
  return Array.from(xml.getElementsByTagName("si")).map((si) =>
    Array.from(si.getElementsByTagName("t")).map((node) => node.textContent || "").join("")
  );
}

function columnIndex(cellRef) {
  const letters = String(cellRef || "").match(/[A-Z]+/i)?.[0] || "A";
  return letters.toUpperCase().split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function cellValue(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") {
    return Array.from(cell.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
  }
  const valueNode = cell.getElementsByTagName("v")[0];
  const raw = valueNode ? valueNode.textContent || "" : "";
  if (type === "s") return sharedStrings[Number(raw)] || "";
  return raw;
}

function parseFirstWorksheet(entries) {
  const sheetName = Object.keys(entries).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error("未找到工作表。");
  const sharedStrings = parseSharedStrings(entries);
  const xml = parseXml(entries[sheetName]);
  const rows = [];
  Array.from(xml.getElementsByTagName("row")).forEach((rowNode) => {
    const row = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach((cell) => {
      row[columnIndex(cell.getAttribute("r"))] = cellValue(cell, sharedStrings);
    });
    rows.push(row);
  });
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").replace(/\s/g, "");
}

function workbookRowsToStudentLines(rows) {
  const headerIndex = rows.findIndex((row) => row.some((value) => normalizeHeader(value) === "姓名") && row.some((value) => normalizeHeader(value) === "近30天课堂出勤情况"));
  if (headerIndex < 0) {
    throw new Error("未识别到模板表头，请确认使用的是“学情分析.xlsx”格式。");
  }
  const headers = rows[headerIndex].map(normalizeHeader);
  const indexOf = (name) => headers.indexOf(name);
  const get = (row, name) => {
    const idx = indexOf(name);
    return idx >= 0 ? String(row[idx] ?? "").trim() : "";
  };
  const dataRows = rows.slice(headerIndex + 1).filter((row) => get(row, "姓名") || get(row, "序号"));
  const lines = dataRows.map((row, index) => {
    const id = `S${String(index + 1).padStart(3, "0")}`;
    return [
      id,
      get(row, "所在年级"),
      get(row, "性别"),
      get(row, "家庭情况"),
      get(row, "家庭经济年收入"),
      get(row, "近30天课堂出勤情况"),
      get(row, "近30天预约心理咨询次数"),
      get(row, "自述心理情况"),
      get(row, "近30天食堂消费情况（元）"),
      get(row, "近30天违纪情况"),
      get(row, "学生干部任职"),
      get(row, "其他")
    ].join(",");
  });
  return lines;
}

function buildClassPortraitFromRows(rows) {
  const analyzed = rows.map(addRiskProfile);
  const high = analyzed.filter((row) => row.level === "高关注").length;
  const medium = analyzed.filter((row) => row.level === "中关注").length;
  const avgAttendance = Math.round(analyzed.reduce((sum, row) => sum + row.attendance, 0) / analyzed.length);
  const avgConsults = Number((analyzed.reduce((sum, row) => sum + row.consults, 0) / analyzed.length).toFixed(1));
  return `从 Excel 模板导入 ${analyzed.length} 名学生画像。数据包含家庭情况、出勤、心理咨询、自述心理、消费和违纪情况；平均出勤 ${avgAttendance}%，心理咨询预约均值 ${avgConsults} 次，高关注 ${high} 人，中关注 ${medium} 人。`;
}

async function importXlsxFile() {
  const file = $("xlsxFile").files && $("xlsxFile").files[0];
  if (!file) {
    showToast("请先选择 xlsx 文件");
    return;
  }
  try {
    const entries = await unzipEntries(await file.arrayBuffer());
    const workbookRows = parseFirstWorksheet(entries);
    const lines = workbookRowsToStudentLines(workbookRows);
    if (!lines.length) throw new Error("模板中没有可分析的学生数据。");
    $("classTotal").value = lines.length;
    $("analysisCount").value = lines.length;
    $("studentData").value = lines.join("\n");
    $("classPortrait").value = buildClassPortraitFromRows(parseStudentRows($("studentData").value));
    analyzeData();
    setWorkflowStep(2, `当前：已从 xlsx 导入并分析 ${lines.length} 名学生画像，请基于学情生成对策建议。`);
    showToast(`已导入 ${lines.length} 名学生，并完成脱敏分析`);
  } catch (error) {
    console.error(error);
    $("analyticsSummary").innerHTML = `<span class="error-note">${error.message || "读取 xlsx 失败，请检查模板格式。"}</span>`;
    $("heatmap").innerHTML = "";
    showToast("读取 xlsx 失败");
  }
}

function loadDemo() {
  $("grade").value = "高职一年级";
  $("subject").value = "人工智能基础";
  $("topic").value = "生成式人工智能在学习中的规范使用";
  $("studentProfile").value = "班级学生数字工具使用兴趣较高，但资料检索、观点表达和自我管理差异明显。部分学生容易直接复制 AI 输出，需要通过事实核查、同伴互审、修改理由说明等方式建立规范使用意识。";
  $("goal").value = "减少教师课外资料整理、作业反馈、学情分析和沟通归档时间，形成可编辑、可复核、可追踪的课外事务材料。";
  $("originalMinutes").value = 90;
  ["checkFact", "checkPrivacy", "checkTone", "checkTeacher"].forEach((id) => $(id).checked = true);
  setAssistedEstimate();
  sampleData();
  analyzeData();
  runGeneration();
  showToast("完整演示样例已载入，可生成对策建议");
}

function clearRecords() {
  state.records = [];
  state.analytics = null;
  state.currentDraft = null;
  state.lastOutput = "";
  output.classList.add("empty");
  output.textContent = "请先在第一步完成学情数据导入与分析，再选择工作舱生成对策建议。右侧完成教师复核后，保存为教师定稿与应用记录。";
  reviewList.innerHTML = "<li>等待生成后自动给出审核项。</li>";
  resetReviewState("");
  renderAnalytics();
  persist();
  setWorkflowStep(1, "当前：已清空，请重新导入或填写学情数据。");
  showToast("演示记录已清空");
}

function renderSignoff() {
  const ready = signoffReady();
  const badge = $("reviewStatusBadge");
  badge.textContent = ready ? "已完成教师复核" : "待复核";
  badge.className = ready ? "badge safe" : "badge warn";
  if (ready && state.currentDraft && state.workflowStep < 4) {
    setWorkflowStep(4, "当前：教师复核已完成，请点击“确认采用并保存记录”。");
  }
}

function quickApproveReview() {
  if (!state.currentDraft) {
    showToast("请先生成对策建议");
    return;
  }
  setReviewChecks(true);
  $("reviewNote").value = buildDefaultReviewNote(state.currentDraft.moduleName);
  renderSignoff();
  setWorkflowStep(4, "当前：教师复核已完成，请点击“确认采用并保存记录”。");
  showToast("已完成常规复核，可保存记录");
}

function returnDraftForRevision() {
  if (!state.currentDraft) {
    showToast("请先生成对策建议");
    return;
  }
  setReviewChecks(false);
  $("reviewNote").value = `${state.currentDraft.moduleName}退回修改：请补充本班真实情况、核对数据来源，并检查是否存在表述过泛、干预措施不够具体或学生信息未充分脱敏的问题。`;
  renderSignoff();
  setWorkflowStep(3, "当前：对策建议已退回修改，请调整内容后重新复核。");
  showToast("已标记为退回修改");
}

function resetReviewManually() {
  resetReviewState("复核状态已重置，请重新确认对策建议是否采用。");
  setWorkflowStep(state.currentDraft ? 3 : 1);
  showToast("复核状态已重置");
}

async function copyOutput() {
  if (!state.lastOutput) {
    showToast("暂无可复制内容");
    return;
  }
  try {
    await navigator.clipboard.writeText(state.lastOutput);
    showToast("内容已复制");
  } catch {
    showToast("浏览器限制复制，请手动选中文本复制");
  }
}

function makeEvidenceMarkdown() {
  const saved = state.records.reduce((sum, item) => sum + item.savedMinutes, 0);
  const analytics = state.analytics
    ? `班级总人数 ${state.analytics.classTotal}，纳入分析 ${state.analytics.analysisCount}；高关注 ${state.analytics.highCount} 人，中关注 ${state.analytics.mediumCount} 人，重点关注比例 ${state.analytics.attentionRate}%；主要风险：${state.analytics.topRiskText}。`
    : "尚未形成学情分析记录。";
  const promptEvidence = state.records.filter((item) => item.aiPrompt).slice(-5);
  const checklist = buildEvidenceChecklist();
  return [
    "# 课外智辅轻航应用记录包",
    "",
    `导出时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "## 一、减负增效概览",
    "",
    `- 已保存应用记录：${state.records.length} 条`,
    `- 预计节约总时间：${saved} 分钟`,
    `- 学情分析：${analytics}`,
    "",
    "## 二、应用记录",
    "",
    "| 时间 | 工作舱 | 主题 | 原始耗时 | AI 辅助后 | 节约时间 | 复核状态 | 复核意见 |",
    "|---|---|---|---:|---:|---:|---|---|",
    ...state.records.map((item) => `| ${item.time} | ${item.moduleName} | ${item.topic} | ${item.originalMinutes} | ${item.assistedMinutes} | ${item.savedMinutes} | ${item.reviewStatus} | ${(item.reviewNote || "").replace(/\|/g, "，")} |`),
    "",
    "## 三、GenAI 过程证据",
    "",
    ...(promptEvidence.length
      ? promptEvidence.map((item, index) => `### ${index + 1}. ${item.moduleName}提示词\n\n\`\`\`text\n${item.aiPrompt}\n\`\`\`\n`)
      : ["尚未保存 GenAI 提示词证据。建议先生成对策建议并完成教师复核后保存记录。"]),
    "",
    "## 四、证据包清单",
    "",
    ...checklist.map((item) => `- ${item.done ? "已具备" : "待补充"}：${item.title}。${item.desc}`),
    "",
    "## 五、已确认采用材料",
    "",
    ...state.records.slice(-5).map((item, index) => `### ${index + 1}. ${item.moduleName}\n\n${item.artifact}\n`)
  ].join("\n");
}

function makeReportDraft() {
  const saved = state.records.reduce((sum, item) => sum + item.savedMinutes, 0);
  const moduleCoverage = new Set(state.records.map((item) => item.moduleId)).size;
  const signedCount = state.records.filter((item) => item.reviewStatus.includes("已复核")).length;
  const latestRecords = state.records.slice(-5);
  const analyticsText = state.analytics
    ? `本次纳入分析 ${state.analytics.analysisCount} 名学生，平均出勤 ${state.analytics.avgAttendance}%，心理咨询预约均值 ${state.analytics.avgConsults} 次，食堂消费均值 ${state.analytics.avgConsumption} 元；其中高关注 ${state.analytics.highCount} 人，中关注 ${state.analytics.mediumCount} 人，重点关注比例 ${state.analytics.attentionRate}%。主要风险集中在：${state.analytics.topRiskText}。`
    : "项目后续将继续补充班级总人数、学生画像、出勤、心理咨询、消费、违纪和教师复核记录。";
  const recordText = latestRecords.length
    ? latestRecords.map((item, index) => `${index + 1}. ${item.moduleName}：围绕“${item.topic}”形成对策建议，节约 ${item.savedMinutes} 分钟，复核状态为“${item.reviewStatus}”。`).join("\n")
    : "当前尚未保存应用记录，正式提交前建议至少保存学情诊断、备课资源、命题作业、沟通协同、资料归档五类记录。";

  return `# 课外智辅轻航：基于 GenAI 的教师课外全场景减负增效闭环实践

## 摘要

本项目聚焦教师课外高频事务，构建“学情先行、对策生成、教师定稿、应用记录、成效追踪”的 GenAI 应用流程。系统覆盖学情诊断、备课资源、命题作业、沟通协同、资料归档五个工作舱，强调以真实学生情况驱动后续任务，避免脱离学情直接生成材料。项目定位不是让 AI 替代教师判断，而是辅助教师完成重复性整理、分析、归纳和起草，再由教师完成专业复核与定稿。

## 一、报告背景

教师课外工作常见痛点包括：备课资料整理耗时、作业设计难以分层、学情数据分散、家校沟通容易重复起草、过程材料难以沉淀。传统处理方式往往依赖教师个人经验和手工记录，容易出现“有工作、缺证据；有数据、难转化；有沟通、难追踪”的问题。本项目以课外全场景事务为对象，探索如何在保证教师主导和数据安全的前提下，提高非课堂教学工作的处理效率和质量。

## 二、方法与措施

项目设置五个工作舱，并形成固定流程：

1. 学情数据导入与分析：先导入班级总人数、学生脱敏画像、出勤、心理咨询、自述心理、消费、违纪等数据。
2. 对策建议生成：围绕当前课程、主题任务和学情结果，生成备课、作业、沟通、归档等课外事务对策。
3. 教师复核定稿：教师完成事实核查、隐私脱敏、语气调整、课程适配和最终判断。
4. 应用记录保存：只有完成复核并确认采用的内容才进入应用记录。
5. 成效追踪导出：记录节约时间、复核意见、应用材料和后续变化，形成可追溯证据链。

这一流程保证了“先学情、后任务”，避免对策建议凭空生成。

## 三、取得成效

当前已保存应用记录 ${state.records.length} 条，覆盖工作舱 ${moduleCoverage} 类，完成教师复核 ${signedCount} 条，预计节约教师课外事务处理时间 ${saved} 分钟。${analyticsText}

近期应用记录如下：

${recordText}

## 四、特色与创新

1. 学情驱动，而不是模板驱动：所有后续对策必须先经过学情数据导入和分析。
2. 全场景覆盖，而不是单点工具：覆盖备课、命题、作业、学情、沟通、归档和班级管理等高频事务。
3. 教师主导，而不是 AI 代替：系统只生成对策建议，最终采用必须经过教师复核定稿。
4. 过程可证，而不是口头描述：每条记录都包含耗时对比、复核状态、应用价值和导出材料。
5. 可迁移推广，而不是个别案例：同一流程可迁移到不同课程、不同班级和不同课外任务。

## 五、数据安全与伦理边界

项目坚持三条边界：第一，学生姓名和敏感信息使用脱敏编号；第二，系统分析结果不直接作为学生评价结论；第三，涉及心理、家庭、消费和违纪信息时，必须由教师核实后再决定是否沟通或转介。

## 六、过程证据建议

正式提交时建议配套保留以下材料：

1. 原始学情数据模板或脱敏样例。
2. 学情分析结果截图。
3. 五个工作舱生成的对策建议。
4. 教师复核定稿说明。
5. 应用前后耗时对比表。
6. 学生或家长反馈片段，需脱敏。
7. 一到两周后的跟踪变化记录。

## 七、推广价值

本项目不依赖单一课程内容，教师只需替换课程名称、主题任务和班级学情，即可生成对应场景下的课外事务对策建议。后续可继续扩展校本模板、跨学科任务库、Word/PDF 导出和教师修改痕迹对比，形成可复制、可培训、可推广的课外事务智能化工作流。`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportMarkdown() {
  if (state.records.length === 0) return showToast("请先保存至少一条应用记录");
  downloadFile("课外智辅轻航-应用记录包.md", makeEvidenceMarkdown(), "text/markdown;charset=utf-8");
  state.exportedOnce = true;
  persist();
  setWorkflowStep(5, "当前：应用记录包已导出，可继续补充下一轮应用记录。");
  showToast("应用记录包已导出");
}

function exportReport() {
  downloadFile("课外智辅轻航-申报报告定稿.md", makeReportDraft(), "text/markdown;charset=utf-8");
  state.exportedOnce = true;
  persist();
  setWorkflowStep(5, "当前：申报报告定稿已导出，可继续补充真实案例和跟踪数据。");
  showToast("申报报告定稿已导出");
}

function exportJson() {
  if (state.records.length === 0) return showToast("请先保存至少一条应用记录");
  downloadFile("课外智辅轻航-自动化数据.json", JSON.stringify({ records: state.records, analytics: state.analytics }, null, 2), "application/json;charset=utf-8");
  state.exportedOnce = true;
  persist();
  setWorkflowStep(5, "当前：数据已导出，可用于后续复盘或二次加工。");
  showToast("数据已导出");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runGeneration();
});

$("originalMinutes").addEventListener("input", setAssistedEstimate);
$("runPipelineBtn").addEventListener("click", runPipeline);
$("loadDemoBtn").addEventListener("click", loadDemo);
$("clearBtn").addEventListener("click", clearRecords);
$("copyOutputBtn").addEventListener("click", copyOutput);
$("saveDraftBtn").addEventListener("click", saveCurrentDraft);
$("quickApproveBtn").addEventListener("click", quickApproveReview);
$("returnDraftBtn").addEventListener("click", returnDraftForRevision);
$("resetReviewBtn").addEventListener("click", resetReviewManually);
$("exportMarkdownBtn").addEventListener("click", exportMarkdown);
$("exportReportBtn").addEventListener("click", exportReport);
$("exportJsonBtn").addEventListener("click", exportJson);
$("analyzeDataBtn").addEventListener("click", analyzeData);
$("sampleDataBtn").addEventListener("click", sampleData);
$("importXlsxBtn").addEventListener("click", importXlsxFile);
["checkFact", "checkPrivacy", "checkTone", "checkTeacher"].forEach((id) => $(id).addEventListener("change", renderSignoff));

renderModules();
renderWorkflow();
renderModuleChain();
renderActiveModule();
renderAnalytics();
renderSignoff();
renderDashboard();
renderEvidence();
setAssistedEstimate();
renderGenerationGate();
