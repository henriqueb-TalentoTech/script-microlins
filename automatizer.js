// ==UserScript==
// @name         Microlins - Auto Concluir Aulas
// @namespace    http://tampermonkey.net/
// @version      5.0.0
// @description  Automatiza conclusão de todas as atividades no portal Microlins
// @match        *://portaldoaluno.microlins.com.br/*
// @match        *://sistemas.microlins.com.br/*
// @match        *://appaula.microlins.com.br/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 1. CONFIGURAÇÕES E ESTADO GLOBAL
  // ─────────────────────────────────────────────────────────────
  const currentUrl = window.location.href;
  const isDashboard = currentUrl.includes('/formacao/aulas/');
  const isPopupDomain = ['sistemas.microlins.com.br', 'appaula.microlins.com.br'].includes(window.location.hostname);

  const isMain = isDashboard;
  const isPopup = isPopupDomain || (!isDashboard && window.location.hostname === 'portaldoaluno.microlins.com.br' && !currentUrl.includes('/login'));

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log('[ML]', msg);
let pendingTipo = 'popup';
let pendingTitulo = '';
const _open = window.open;
let resetPopup = () => {};

  // ─────────────────────────────────────────────────────────────
  // 2. BLOQUEIOS DE SISTEMA E COMUNICAÇÃO
  // ─────────────────────────────────────────────────────────────
  window.addEventListener('contextmenu', (e) => e.stopImmediatePropagation(), true);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)))
        e.stopImmediatePropagation();
    },
    true
  );

  function neutralizarBeforeUnload() {
    window.onbeforeunload = null;
    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'beforeunload' || type === 'unload') return;
      return originalAdd.call(this, type, listener, options);
    };
    window.addEventListener('beforeunload', function (e) { e.stopImmediatePropagation(); }, true);
    window.addEventListener('unload', function (e) { e.stopImmediatePropagation(); }, true);
    try {
      Object.defineProperty(window, 'onbeforeunload', {
        configurable: true,
        get() { return null; },
        set() { return true; },
      });
    } catch (_) {}
    window.addEventListener('beforeunload', (e) => { delete e.returnValue; }, true);
  }

  function initSinalDeVida() {
    GM_setValue('ml_popup_hb', Date.now());
    setInterval(() => GM_setValue('ml_popup_hb', Date.now()), 2000);
  }

  function limparEstadoPopup(titulo, sucesso, retriesObj) {
    GM_setValue('ml_popup_titulo', '');
    GM_setValue('ml_popup_ts', 0);
    if (sucesso) {
      try {
        const r = JSON.parse(GM_getValue('ml_retries', '{}'));
        Object.keys(r).forEach((k) => { if (k.includes(titulo)) delete r[k]; });
        GM_setValue('ml_retries', JSON.stringify(r));
        if (retriesObj) {
          Object.keys(retriesObj).forEach((k) => { if (k.includes(titulo)) delete retriesObj[k]; });
        }
      } catch (_) {}
    }
  }

  if (isPopup) {
    neutralizarBeforeUnload();
    initSinalDeVida();
  }

  // ─────────────────────────────────────────────────────────────
  // 3. INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────
  if (isPopup) onReady(initPopup);
  else if (isMain) onReady(initMainPage);

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 150);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 150));
  }

  // ─────────────────────────────────────────────────────────────
  // 4. UTILITÁRIOS GERAIS DE DOM E TEXTO
  // ─────────────────────────────────────────────────────────────
  function normalizarTexto(txt = '') {
    return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function findBtn(...texts) {
    const els = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')];
    for (const t of texts) {
      const el = els.find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
      if (el) return el;
    }
    return null;
  }

  async function waitFor(fn, timeout = 10000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const el = fn();
      if (el) return el;
      await delay(300);
    }
    return null;
  }

  async function esperarDOMEstavel(timeout = 8000) {
    const inicio = Date.now();
    let ultimoHTML = document.body.innerHTML;
    while (Date.now() - inicio < timeout) {
      await delay(600);
      if (document.body.innerHTML === ultimoHTML) return;
      ultimoHTML = document.body.innerHTML;
    }
  }

  async function esperarTelaDesbloquear(timeout = 20000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const overlay =
        document.querySelector('.loading') ||
        document.querySelector('.spinner') ||
        document.querySelector('.overlay') ||
        document.querySelector('.swal2-container') ||
        document.querySelector('[aria-busy="true"]');
      const bloqueado =
        document.body.style.pointerEvents === 'none' ||
        document.body.classList.contains('modal-open');
      if (!overlay && !bloqueado) {
        await delay(600);
        return;
      }
      await delay(400);
    }
    log('Tela demorou para desbloquear');
  }

  // ─────────────────────────────────────────────────────────────
  // 5. NAVEGAÇÃO E CONCLUSÃO DE TELA
  // ─────────────────────────────────────────────────────────────
  async function fecharEtapaFinalizada() {
  log('Iniciando tentativa de fechar...');
  GM_setValue('ml_popup_titulo', '');

  const btn = [...document.querySelectorAll('button, a, [role="button"]')].find((b) =>
    /sair|fechar|close|etapa finalizada/i.test(b.textContent.trim())
  );
  if (btn) {
    log('Clicando no botão de fechar: ' + btn.textContent.trim());
    btn.click();
    await delay(1000);
  } else {
    log('Nenhum botão encontrado, verificando apenas texto de conclusão...');
  }

  log('Aguardando 3 segundos antes de fechar...');
  await delay(3000); // ← novo

  log('Finalizando processo e fechando janela.');
  neutralizarBeforeUnload();
  await delay(500);
  window.close();
  setTimeout(() => {
    if (!window.closed) window.location.href = 'about:blank';
  }, 1000);
}


  async function navegarAteOFim() {
    let t = 0;
    while (t++ < 60) {
      const fim = findBtn('finalizar');
      if (fim) {
        fim.click();
        log('finalizou');
        return;
      }
      const next = document.querySelector('.nav_buttons_right');
      if (next) {
        next.click();
        await delay(800);
      } else await delay(800);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SCORM E RESPOSTAS AUTOMÁTICAS (QUIZ)
  // ─────────────────────────────────────────────────────────────
  function skipSCORM() {
    if (window.API) {
      try {
        window.API.LMSSetValue('cmi.core.lesson_status', 'completed');
        window.API.LMSSetValue('cmi.core.lesson_location', 'Congratulations - Completed');
        window.API.LMSSetValue('cmi.suspend_data', 'Congratulations');
        window.API.LMSCommit('');
        window.API.LMSSetValue('cmi.core.score.raw', '100');
      } catch (_) {}
    }
    try {
      if (window.parent !== window)
        window.parent.postMessage({ func: 'finalizacaoOther', message: 'Você chegou ao final da aula!' }, '*');
      window.postMessage({ func: 'finalizacaoOther', message: 'Você chegou ao final da aula!' }, '*');
    } catch (_) {}
    try {
      localStorage.setItem('cmi.core.lesson_status', 'Congratulations - completed');
      localStorage.setItem('cmi.core.lesson_location', 'Congratulations');
    } catch (_) {}
    [
      'telaFinalizacao',
      'telaFinalizacaoOther1',
      'telaFinalizacaoOther2',
      'div_requisitar_salvamento_tela',
    ].forEach((id) => document.getElementById(id)?.click());
  }

  function extrairGabarito() {
    function walk(f, nodes = [], d = 0) {
      if (!f || d > 100) return nodes;
      nodes.push(f);
      let c = f.child;
      while (c) { walk(c, nodes, d + 1); c = c.sibling; }
      return nodes;
    }
    function findRoot(el) {
      for (const k in el)
        if (k.startsWith('__reactContainer') || k.startsWith('_reactRootContainer') || k.startsWith('__reactFiber'))
          return el[k];
      return null;
    }
    const root = findRoot(document.querySelector('#root') || document.body);
    if (!root) return null;
    const nodes = walk(root._internalRoot || root.current || root);
    const cands = [];
    nodes.forEach((f) => {
      if (!f.memoizedState) return;
      let s = f.memoizedState;
      while (s) {
        if (Array.isArray(s.memoizedState)) {
          const a = s.memoizedState;
          if (a.length >= 5 && a.length <= 50 && a.every((n) => typeof n === 'number' && n >= 0 && n <= 10))
            cands.push(a);
        }
        s = s.next;
      }
    });
    if (!cands.length) return null;
    return cands.sort((a, b) => b.length - a.length)[0].map((r) => r - 1);
  }

  function clicarAlternativa(idx) {
    const radio = document.querySelector(`input[type="radio"][id="${idx}"]`);
    if (radio) {
      radio.click();
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      radio.closest('label')?.click();
      return true;
    }
    const lbl = document.querySelector(`label[for="${idx}"]`);
    if (lbl) { lbl.click(); return true; }
    const alts = document.querySelectorAll('.alternative-box label');
    if (alts[idx]) { alts[idx].click(); return true; }
    return false;
  }

  async function responderQuiz() {
    const gabarito = extrairGabarito();
    if (!gabarito) { log('gabarito nao encontrado'); return false; }
    log('quiz: ' + gabarito.length + 'Q');

    for (let i = 0; i < gabarito.length; i++) {
      log('respondendo Q' + (i + 1));
      const alternativasOk = await waitFor(() => document.querySelectorAll('input[type="radio"]').length > 0, 10000);
      if (!alternativasOk) { log('alternativas nao renderizaram Q' + (i + 1)); return false; }
      if (!clicarAlternativa(gabarito[i])) { log('erro ao clicar Q' + (i + 1)); return false; }
      await delay(600);

      if (i < gabarito.length - 1) {
        const next = await waitFor(() => document.querySelector('.nav_buttons_right'), 8000);
        if (!next) { log('botao proximo nao encontrado Q' + (i + 1)); return false; }
        next.click();
        await waitFor(() => document.querySelectorAll('input[type="radio"]').length > 0, 10000);
        await delay(400);
      }
    }

    log('avancando para tela de envio...');
    const nextFinal = await waitFor(() => document.querySelector('.nav_buttons_right'), 6000);
    if (nextFinal) { nextFinal.click(); await delay(1000); }
    else { log('botao avancar para envio nao encontrado'); }

    log('buscando botao finalizar...');
    const finalizar = await waitFor(
      () => [...document.querySelectorAll('button')].find((b) => /finalizar|enviar respostas/i.test(b.textContent.trim())),
      10000
    );
    if (!finalizar) { log('botao finalizar nao encontrado'); return false; }
    finalizar.click();
    await delay(1500);

    const confirmar = await waitFor(
      () => [...document.querySelectorAll('button')].find((b) => /sim|confirmar|ok/i.test(b.textContent.trim())),
      6000
    );
    if (confirmar) { confirmar.click(); await delay(1500); }

    log('quiz finalizado completamente');
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. FLUXO DOS POPUPS
  // ─────────────────────────────────────────────────────────────
  async function initPopup() {
  await delay(800);

  const urlFim = window.location.pathname.includes('EncerramentoAula');
  const textoFimEncontrado = [...document.querySelectorAll('h1,h2,h3,h4,h5,.title,strong.text-success,.swal2-title')]
    .some(el => el.textContent.includes('Etapa finalizada'));

  if (urlFim || textoFimEncontrado) {
    await fecharEtapaFinalizada();
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const tipoUrl   = urlParams.get('ml_tipo');         // vem do pendingTipo via window.open
  const tipoGM    = GM_getValue('ml_tipo_atividade', '');

  // Usa o TIPO_POR_TITULO como fallback — mesmo mapa da página principal
  const tituloUrl = decodeURIComponent(urlParams.get('ml_titulo') || '');
  const tipoDoTitulo = tituloUrl
    ? TIPO_POR_TITULO[tituloUrl.toLowerCase().trim()]
    : null;

  const tipo = tipoUrl || tipoDoTitulo || tipoGM || 'popup';
  log(`Tipo → URL:${tipoUrl} | Título:${tituloUrl}→${tipoDoTitulo} | GM:${tipoGM} → ${tipo}`);

  if (tipo === 'quiz')           { await fluxoQuiz();         return; }
  if (tipo === 'pense-responda') { await fluxoPenseResponda(); return; }
  if (tipo === 'mao-na-massa')   { await fluxoMaoNaMassa();    return; }
  if (tipo === 'teorico')        { await fluxoTeorico();       return; }
  if (tipo === 'questionamento') { await fluxoTeorico();       return; }

  log('Tipo não mapeado: ' + tipo);
}

// Nova função — detecta pelo texto visível na página do popup
function detectarTipoPeloDOM() {
  const mapa = [
    { palavras: ['teste seus conhecimentos'],          tipo: 'quiz'           },
    { palavras: ['pense e responda'],                  tipo: 'pense-responda' },
    { palavras: ['mão na massa', 'mao na massa'],      tipo: 'mao-na-massa'   },
    { palavras: ['questionamento'],                    tipo: 'questionamento' },
    { palavras: ['teórico', 'teorico', 'assistir'],    tipo: 'teorico'        },
  ];

  const textoVisivel = normalizarTexto(
    [...document.querySelectorAll('h1,h2,h3,h4,h5,.title,.card-title,header,nav,[class*="titulo"],[class*="header"]')]
      .map(el => el.textContent)
      .join(' ')
  );

  for (const { palavras, tipo } of mapa) {
    if (palavras.some(p => textoVisivel.includes(normalizarTexto(p)))) {
      log(`Tipo detectado pelo DOM: "${tipo}"`);
      return tipo;
    }
  }
  return null; // não encontrado, cai no GM_getValue como fallback
}


  async function fluxoTeorico() {
    skipSCORM();
    await delay(1500);
    await fecharEtapaFinalizada();
  }

  async function fluxoMaoNaMassa() {
    const comecar = await waitFor(() => findBtn('começar', 'comecar', 'iniciar'), 8000);
    if (comecar) { log('comecar'); comecar.click(); await delay(1000); }
    await navegarAteOFim();
    await fecharEtapaFinalizada();
  }

  async function fluxoPenseResponda() {
    log('Fluxo Pense e Responda');
    const btnFechar = await waitFor(
      () => [...document.querySelectorAll('button')].find((b) => /fechar/i.test(b.textContent.trim())),
      10000
    );

    if (btnFechar) {
        log('Clicando em FECHAR');
        btnFechar.click();
    } else {
        log('Botão FECHAR não encontrado');
        GM_setValue('ml_popup_titulo', '');
        return;
    }

    await waitFor(() => window.location.pathname.includes('EncerramentoAula'), 8000);
    await delay(1000);
    neutralizarBeforeUnload();
    log('Encerramento após Pense e Responda');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await delay(500);

    GM_setValue('ml_popup_titulo', '');
    try { window.open('', '_self'); window.close(); } catch (_) {}
  }

  async function fluxoQuiz() {
    const comecar = await waitFor(() => findBtn('começar', 'comecar', 'iniciar'), 6000);
    if (comecar) { log('comecar quiz'); comecar.click(); await delay(1000); }

    await waitFor(() => document.querySelector('input[type="radio"]'), 8000);
    await delay(500);

    const quizOk = await responderQuiz();
    log('responderQuiz retornou: ' + quizOk);

    if (!quizOk) {
      log('Falha ao concluir quiz. Abortando janela para não travar o painel principal.');
      GM_setValue('ml_popup_titulo', '');
      window.close();
      return;
    }

    await delay(2000);
    await fecharEtapaFinalizada();
  }

  async function handleQuestionamento(btn, getPopup) {
    log('Iniciando Questionamento');
    btn.click();
    await delay(1500);
    const btnSim = await waitFor(() => {
      const modal = document.querySelector('.swal2-popup');
      if (!modal) return null;
      return modal.querySelector('.swal2-confirm');
    }, 10000);
    if (!btnSim) {
      log('Botao Sim nao encontrado');
      GM_setValue('ml_popup_titulo', '');
      return;
    }
    log('Clicando em Sim');
    btnSim.click();
    await delay(1500);
    GM_setValue('ml_popup_titulo', '');
    log('Questionamento concluido');
  }

  const TIPO_POR_TITULO = {
    'teórico': 'teorico',
    'mão na massa': 'mao-na-massa',
    'pense e responda': 'pense-responda',
    'questionamento': 'questionamento',
    'testes seus conhecimentos': 'quiz',
  };

  function getTipo(btn) {
    const titulo = (btn.getAttribute('title') || '').toLowerCase().trim();
    const tipo = TIPO_POR_TITULO[titulo];
    if (!tipo) { log(`Tipo desconhecido para title="${titulo}" — tratando como popup genérico`); return 'popup'; }
    log(`Tipo identificado: ${tipo}`);
    return tipo;
  }

  async function handlePopup(btn, getPopup) {
  const tipo = getTipo(btn);

  GM_setValue('ml_tipo_atividade', tipo);
  pendingTipo   = tipo;
  pendingTitulo = btn.getAttribute('title') || '';

  resetPopup();

  const card = btn.closest('.card-body');

  if (tipo === 'questionamento') {
    await handleQuestionamento(btn, getPopup);
    return 'concluida';
  }

  GM_setValue('ml_popup_titulo', pendingTitulo);
  GM_setValue('ml_popup_ts', Date.now());
  GM_setValue('ml_popup_hb', Date.now());

  btn.click();
  await delay(500);

  if (tipo === 'mao-na-massa') {
    const webBtn = await waitFor(() => document.querySelector('#btnWebAtividades'), 6000);
    if (webBtn) webBtn.click();
  }

  const resultado = await waitAtividadeConcluida(card, btn, tipo === 'quiz' ? 300000 : 120000);
  GM_setValue('ml_popup_titulo', '');
  GM_setValue('ml_popup_ts', 0);
  return resultado;
}

  async function waitAtividadeConcluida(cardEl, btn, timeout = 300000) {
    const startTime = Date.now();
    const end = startTime + timeout;
    const tituloAtividade = btn.getAttribute('title') || '';

    while (Date.now() < end) {
      await delay(1500);

      if (GM_getValue('ml_popup_titulo', '') === '') {
          log(`Sinal de fechamento amigável recebido do popup: ${tituloAtividade}`);
          return 'concluida';
      }

      if (document.body.contains(cardEl)) {
        const badge = cardEl.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo');
        if (badge) { log(`Badge detectado — concluída: ${tituloAtividade}`); return 'concluida'; }
        if (!cardEl.querySelector('button.btnAtividades.btn-info')) { log(`Botão sumiu — concluída: ${tituloAtividade}`); return 'concluida'; }

        const hb = GM_getValue('ml_popup_hb', 0);
        if (Date.now() - startTime > 15000 && Date.now() - hb > 15000) {
           log(`Sinal de vida inativo durante monitoramento de: ${tituloAtividade}.`);
           GM_setValue('ml_popup_titulo', '');
           return 'falha_sinal_vida';
        }
        continue;
      }

      log(`Reload detectado durante: ${tituloAtividade} — aguardando estabilizar...`);
      await delay(4000);
      await esperarDOMEstavel(8000);

      const cardAtualizado = [...document.querySelectorAll('.card-body')].find((cb) => {
        const b = cb.querySelector('button.btnAtividades.btn-info');
        return b && b.getAttribute('title') === tituloAtividade;
      });

      if (!cardAtualizado) { log(`Card não encontrado após reload — concluída: ${tituloAtividade}`); return 'concluida'; }
      if (cardAtualizado.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo')) { log(`Badge após reload — concluída: ${tituloAtividade}`); return 'concluida'; }
      log(`Card ainda pendente após reload — continuando monitoramento: ${tituloAtividade}`);
      cardEl = cardAtualizado;
    }

    log(`Tempo de espera excedido aguardando: ${tituloAtividade}`);
    GM_setValue('ml_popup_titulo', '');
    return 'timeout';
  }

  // ─────────────────────────────────────────────────────────────
  // 8. PÁGINA PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  function initMainPage() {
  if (!document.head || !document.body) {
    setTimeout(initMainPage, 100);
    return;
  }

  if (document.getElementById('ml-panel')) return;

  let currentPopup = null;
  resetPopup = () => { currentPopup = null; };

  window.open = function (...args) {
    if (args[0] && typeof args[0] === 'string') {
      const sep = args[0].includes('?') ? '&' : '?';
      args[0] = args[0]
        + sep + 'ml_tipo='   + encodeURIComponent(pendingTipo)
        + '&ml_titulo='      + encodeURIComponent(pendingTitulo);
    }
    currentPopup = _open.apply(this, args);
    return currentPopup;
  };

  document.head.insertAdjacentHTML('beforeend', `
    <style>
      #ml-panel{position:fixed;bottom:20px;right:20px;background:#1e1e2e;color:#cdd6f4;
        border:1px solid #45475a;border-radius:12px;padding:16px;width:210px;
        font-family:'Courier New',monospace;font-size:12px;z-index:2147483647;
        box-shadow:0 8px 32px rgba(0,0,0,.7);user-select:none;}
      #ml-panel header{display:flex;justify-content:space-between;align-items:center;
        margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #45475a;cursor:move;}
      #ml-panel header b{color:#89b4fa;font-size:13px;}
      #ml-panel header small{color:#6c7086;cursor:pointer;}
      #ml-status{color:#a6e3a1;margin-bottom:8px;min-height:14px;word-break:break-word;line-height:1.4;}
      #ml-bw{height:5px;background:#313244;border-radius:3px;margin-bottom:10px;}
      #ml-bar{height:100%;background:#a6e3a1;border-radius:3px;width:0;transition:width .4s;}
      #ml-panel button{width:100%;padding:7px 0;margin-top:5px;border:1px solid #45475a;
        border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-family:monospace;font-size:11px;}
      #ml-panel button:hover:not(:disabled){background:#45475a;}
      #ml-panel button:disabled{opacity:.35;cursor:not-allowed;}
      #ml-start{background:#89b4fa!important;color:#1e1e2e!important;border-color:#89b4fa!important;font-weight:bold;}
      #ml-stop{border-color:#f38ba8!important;color:#f38ba8!important;}
      #ml-reset{border-color:#fab387!important;color:#fab387!important;}
    </style>
  `);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="ml-panel">
      <header id="ml-hdr"><b>ML AUTO v5.1.0</b><small id="ml-min">-</small></header>
      <div id="ml-body">
        <div id="ml-status">Pronto.</div>
        <div id="ml-bw"><div id="ml-bar"></div></div>
        <button id="ml-start">INICIAR</button>
        <button id="ml-stop"  style="display:none">PARAR</button>
        <button id="ml-reset" style="display:none">RESETAR ESTADO</button>
      </div>
    </div>
  `);

  const setSt = (m) => { const e = document.getElementById('ml-status'); if (e) e.textContent = m; };
  const setPct = (p) => { const e = document.getElementById('ml-bar');   if (e) e.style.width = p + '%'; };

  makeDraggable(document.getElementById('ml-panel'), document.getElementById('ml-hdr'));

  document.getElementById('ml-min').onclick = () => {
    const b = document.getElementById('ml-body');
    const h = b.style.display === 'none';
    b.style.display = h ? '' : 'none';
    document.getElementById('ml-min').textContent = h ? '-' : '+';
  };

  let running = false;

  async function iniciarExecucao() {
    if (running) return;
    running = true;
    GM_setValue('ml_running', Date.now());
    document.getElementById('ml-start').disabled = true;
    document.getElementById('ml-stop').style.display  = '';
    document.getElementById('ml-reset').style.display = 'none';
    setPct(0);

    await runAll(setSt, setPct, () => !running, () => currentPopup);

    running = false;
    GM_setValue('ml_running', 0);
    document.getElementById('ml-start').disabled = false;
    document.getElementById('ml-stop').style.display  = 'none';
    document.getElementById('ml-reset').style.display = 'none';
  }

  document.getElementById('ml-start').onclick = () => iniciarExecucao();

  document.getElementById('ml-stop').onclick = () => {
    running = false;
    GM_setValue('ml_running', 0);
    setSt('Parado.');
    document.getElementById('ml-start').disabled = false;
    document.getElementById('ml-stop').style.display  = 'none';
    document.getElementById('ml-reset').style.display = '';
  };

  document.getElementById('ml-reset').onclick = () => {
    GM_setValue('ml_popup_titulo', '');
    GM_setValue('ml_popup_ts', 0);
    GM_setValue('ml_popup_hb', 0);
    GM_setValue('ml_retries', '{}');
    GM_setValue('ml_running', 0);
    document.getElementById('ml-reset').style.display = 'none';
    setSt('Estado resetado. Pronto.');
    log('Estado GM limpo manualmente.');
  };

  // Limpa estado zumbi deixado por popup fechado manualmente
  const tituloZumbi = GM_getValue('ml_popup_titulo', '');
const hbZumbi     = GM_getValue('ml_popup_hb', 0);
if (tituloZumbi && Date.now() - hbZumbi > 20000) {
  log(`Estado zumbi detectado ("${tituloZumbi}") — limpando.`);
  GM_setValue('ml_popup_titulo', '');
  GM_setValue('ml_popup_ts', 0);
  GM_setValue('ml_popup_hb', 0);
  GM_setValue('ml_retries', '{}'); // ← ADICIONAR ESTA LINHA
}

  const ultimoHeartbeat = GM_getValue('ml_running', 0);
  const segundosAtras   = (Date.now() - ultimoHeartbeat) / 1000;

  if (ultimoHeartbeat > 0 && segundosAtras < 30) {
    log(`Retomando após reload (${segundosAtras.toFixed(1)}s atrás)...`);
    setSt('Retomando...');
    setTimeout(() => iniciarExecucao(), 3000);
  }
}


  function makeDraggable(panel, handle) {
    let ox = 0, oy = 0;
    handle.onmousedown = (e) => {
      e.preventDefault();
      ox = e.clientX;
      oy = e.clientY;
      document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
      document.onmousemove = (e) => {
        panel.style.top = panel.offsetTop - (oy - e.clientY) + 'px';
        panel.style.left = panel.offsetLeft - (ox - e.clientX) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        ox = e.clientX;
        oy = e.clientY;
      };
    };
  }

  async function runAll(setSt, setPct, shouldStop, getPopup) {
    let totalExecutadas = 0;
    let tentativasVazio = 0;
    const MAX_TENTATIVAS_VAZIO = 5;
    const MAX_RETRIES_ATIVIDADE = 3;

    let retriesPorAtividade = {};
    try { retriesPorAtividade = JSON.parse(GM_getValue('ml_retries', '{}')); }
    catch (_) { retriesPorAtividade = {}; }

    const popupTituloEmAndamento = GM_getValue('ml_popup_titulo', '');
    const popupTs = GM_getValue('ml_popup_ts', 0);
    const popupRecente = popupTs > 0 && Date.now() - popupTs < 300000;

    if (popupTituloEmAndamento && popupRecente) {
      log(`Popup em andamento após reload: ${popupTituloEmAndamento} — aguardando...`);
      setSt(`Aguardando popup: ${popupTituloEmAndamento}`);
      const inicio = Date.now();

      while (Date.now() - inicio < 300000) {
        await delay(2000);
        await esperarDOMEstavel(5000);

        if (GM_getValue('ml_popup_titulo', '') === '') {
            log('Sinal de fechamento amigável após reload.');
            limparEstadoPopup(popupTituloEmAndamento, true, retriesPorAtividade);
            break;
        }

        const cardDoPopup = [...document.querySelectorAll('.card-body')].find((cb) => {
          const b = cb.querySelector('button.btnAtividades.btn-info');
          return b && b.getAttribute('title') === popupTituloEmAndamento;
        });

        if (!cardDoPopup) {
          log('Card sumiu após reload — concluído com sucesso.');
          limparEstadoPopup(popupTituloEmAndamento, true, retriesPorAtividade);
          break;
        }

        if (cardDoPopup.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo')) {
          log('Badge de sucesso no card correto — concluído com sucesso.');
          limparEstadoPopup(popupTituloEmAndamento, true, retriesPorAtividade);
          break;
        }

        const hb = GM_getValue('ml_popup_hb', 0);
        if (Date.now() - inicio > 15000 && Date.now() - hb > 15000) {
            log('Sinal de vida inativo. O popup falhou ou foi fechado sem avisar. Cancelando a espera.');
            limparEstadoPopup(popupTituloEmAndamento, false, retriesPorAtividade);
            break;
        }

        log('Card ainda pendente — aguardando atividade (Sinal de vida ativo)...');
      }
    }

    while (!shouldStop()) {
      const cards = [...document.querySelectorAll('.card-body')];
      if (cards.length === 0) {
        setSt('Aguardando carregamento...');
        await delay(2000);
        continue;
      }

      await esperarDOMEstavel(6000);

      const atividadesPendentes = [...document.querySelectorAll('.card-body')].filter((cb) => {
        const concluido = cb.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo');
        if (concluido) return false;
        return !!cb.querySelector('button.btnAtividades.btn-info');
      });

      if (atividadesPendentes.length === 0) {
        tentativasVazio++;
        setSt(`Verificando conclusão... (${tentativasVazio}/${MAX_TENTATIVAS_VAZIO})`);
        log(`Nenhuma pendente — tentativa ${tentativasVazio}/${MAX_TENTATIVAS_VAZIO}`);
        await delay(3000);
        if (tentativasVazio < MAX_TENTATIVAS_VAZIO) continue;

        window.scrollTo({ top: 0, behavior: 'smooth' });
        await delay(2000);
        await esperarDOMEstavel(5000);

        if (!document.querySelector('button.btnAtividades.btn-info')) {
          setSt('✅ Tudo concluído!');
          setPct(100);
          GM_setValue('ml_running', 0);
          GM_setValue('ml_retries', '{}');
          log('Concluído. Encerrando.');
          break;
        }
        tentativasVazio = 0;
        continue;
      }

      tentativasVazio = 0;

      const btn = atividadesPendentes[0].querySelector('button.btnAtividades.btn-info');
      if (!btn) continue;

      const aulaNome = atividadesPendentes[0].querySelector('h5.card-title')?.textContent.trim().slice(0, 20) || 'Aula';
      const atividadeNome = btn.getAttribute('title') || 'Atividade';
      const chave = `${aulaNome}|${atividadeNome}`;

      const tentativas = retriesPorAtividade[chave] || 0;
      if (tentativas >= MAX_RETRIES_ATIVIDADE) {
        log(`Pulando após ${tentativas} falhas: ${chave}`);
        setSt(`Pulando: ${atividadeNome}`);
        retriesPorAtividade[chave] = MAX_RETRIES_ATIVIDADE + 99;
        GM_setValue('ml_retries', JSON.stringify(retriesPorAtividade));
        await delay(2000);
        continue;
      }

      retriesPorAtividade[chave] = tentativas + 1;
      GM_setValue('ml_retries', JSON.stringify(retriesPorAtividade));

      totalExecutadas++;
      setSt(`Executando: ${aulaNome} › ${atividadeNome}`);
      setPct(Math.min(totalExecutadas * 7, 98));
      log(`Iniciando (tentativa ${tentativas + 1}): ${aulaNome} › ${atividadeNome}`);

      GM_setValue('ml_running', Date.now());

      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(1000);

      const resultado = await handlePopup(btn, getPopup);
      log(`Resultado de ${atividadeNome}: ${resultado}`);

      if (resultado === 'concluida') {
        delete retriesPorAtividade[chave];
        GM_setValue('ml_retries', JSON.stringify(retriesPorAtividade));
        setSt('Aguardando portal atualizar...');
        await esperarTelaDesbloquear(15000);
        await esperarDOMEstavel(6000);
        await delay(2000);
      } else {
        setSt(`Aguardando nova tentativa: ${atividadeNome}`);
        await delay(3000);
      }
    }
  }

})();