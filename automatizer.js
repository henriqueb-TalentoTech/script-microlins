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

  const isPopup = ['sistemas.microlins.com.br', 'appaula.microlins.com.br'].includes(
    window.location.hostname
  );
  const isMain = window.location.hostname === 'portaldoaluno.microlins.com.br';

  const TIPO_POR_TITULO = {
    teórico: 'teorico',
    'mão na massa': 'mao-na-massa',
    'pense e responda': 'pense-responda',
    questionamento: 'questionamento',
    'teste seus conhecimentos': 'quiz',
  };

  let pendingTipo = 'popup';
  let resetPopup = () => {};

  // ─────────────────────────────────────────────────────────────
  // 2. UTILITÁRIOS GERAIS
  // ─────────────────────────────────────────────────────────────

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (msg) => console.log('[ML]', msg);

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 150);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 150));
  }

  function normalizarTexto(txt = '') {
    return txt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function findBtn(...texts) {
    const els = [
      ...document.querySelectorAll(
        'button, a, [role="button"], input[type="button"], input[type="submit"]'
      ),
    ];
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
      if (document.body.innerHTML === ultimoHTML) {
        return;
      }
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

  async function esperarBotaoSumir(btn, timeout = 10000) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeout) {
      if (!document.body.contains(btn)) return;
      await delay(600);
    }
  }

  function existeProgressoIncompleto() {
    return [...document.querySelectorAll('.card-body')]
      .filter((cb) => !cb.querySelector('.badge.bg-danger.circulo'))
      .some((cb) => {
        const bar = cb.querySelector('.progress>.progress-bar');
        return bar && parseFloat(bar.style.width || '0') < 100;
      });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. INTERCEPTAÇÕES, BLOQUEIOS E SCORM
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

    window.addEventListener(
      'beforeunload',
      function (e) {
        e.stopImmediatePropagation();
      },
      true
    );
    window.addEventListener(
      'unload',
      function (e) {
        e.stopImmediatePropagation();
      },
      true
    );

    try {
      Object.defineProperty(window, 'onbeforeunload', {
        configurable: true,
        get() {
          return null;
        },
        set() {
          return true;
        },
      });
    } catch (_) {}

    window.addEventListener(
      'beforeunload',
      (e) => {
        delete e.returnValue;
      },
      true
    );
  }

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
        window.parent.postMessage(
          { func: 'finalizacaoOther', message: 'Você chegou ao final da aula!' },
          '*'
        );
      window.postMessage(
        { func: 'finalizacaoOther', message: 'Você chegou ao final da aula!' },
        '*'
      );
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

  async function fecharEtapaFinalizada() {
    log('Iniciando tentativa de fechar...');
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
  // 4. LÓGICA DE QUIZ (AUTO-ANSWER)
  // ─────────────────────────────────────────────────────────────

  function extrairGabarito() {
    function walk(f, nodes = [], d = 0) {
      if (!f || d > 100) return nodes;
      nodes.push(f);
      let c = f.child;
      while (c) {
        walk(c, nodes, d + 1);
        c = c.sibling;
      }
      return nodes;
    }

    function findRoot(el) {
      for (const k in el)
        if (
          k.startsWith('__reactContainer') ||
          k.startsWith('_reactRootContainer') ||
          k.startsWith('__reactFiber')
        )
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
          if (
            a.length >= 5 &&
            a.length <= 50 &&
            a.every((n) => typeof n === 'number' && n >= 0 && n <= 10)
          )
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
    if (lbl) {
      lbl.click();
      return true;
    }
    const alts = document.querySelectorAll('.alternative-box label');
    if (alts[idx]) {
      alts[idx].click();
      return true;
    }
    return false;
  }

  async function responderQuiz() {
    const gabarito = extrairGabarito();
    if (!gabarito) {
      log('gabarito nao encontrado');
      return false;
    }

    log('quiz: ' + gabarito.length + 'Q');

    for (let i = 0; i < gabarito.length; i++) {
      log('respondendo Q' + (i + 1));

      const alternativasOk = await waitFor(
        () => document.querySelectorAll('input[type="radio"]').length > 0,
        10000
      );
      if (!alternativasOk) {
        log('alternativas nao renderizaram Q' + (i + 1));
        return false;
      }

      if (!clicarAlternativa(gabarito[i])) {
        log('erro ao clicar Q' + (i + 1));
        return false;
      }

      await delay(600);

      if (i < gabarito.length - 1) {
        const next = await waitFor(() => document.querySelector('.nav_buttons_right'), 8000);
        if (!next) {
          log('botao proximo nao encontrado Q' + (i + 1));
          return false;
        }
        next.click();
        await waitFor(() => document.querySelectorAll('input[type="radio"]').length > 0, 10000);
        await delay(400);
      }
    }

    log('avancando para tela de envio...');
    const nextFinal = await waitFor(() => document.querySelector('.nav_buttons_right'), 6000);
    if (nextFinal) {
      nextFinal.click();
      await delay(1000);
    } else {
      log('botao avancar para envio nao encontrado');
    }

    log('buscando botao finalizar...');
    const finalizar = await waitFor(
      () =>
        [...document.querySelectorAll('button')].find((b) =>
          /finalizar|enviar respostas/i.test(b.textContent.trim())
        ),
      10000
    );

    if (!finalizar) {
      log('botao finalizar nao encontrado');
      return false;
    }

    finalizar.click();
    await delay(1500);

    const confirmar = await waitFor(
      () =>
        [...document.querySelectorAll('button')].find((b) =>
          /sim|confirmar|ok/i.test(b.textContent.trim())
        ),
      6000
    );

    if (confirmar) {
      confirmar.click();
      await delay(1500);
    }

    log('quiz finalizado completamente');
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // 5. FLUXOS DE POPUP
  // ─────────────────────────────────────────────────────────────

  async function initPopup() {
    neutralizarBeforeUnload();
    await delay(800);

    if (
      window.location.pathname.includes('EncerramentoAula') ||
      document.body.textContent.includes('Etapa finalizada')
    ) {
      await fecharEtapaFinalizada();
      return;
    }

    const tipo = GM_getValue('ml_tipo_atividade', 'popup');
    log('Tipo recebido via GM_getValue: ' + tipo);

    if (tipo === 'quiz') return await fluxoQuiz();
    if (tipo === 'pense-responda') return await fluxoPenseResponda();
    if (tipo === 'mao-na-massa') return await fluxoMaoNaMassa();
    if (tipo === 'teorico') return await fluxoTeorico();

    log('Tipo não mapeado: ' + tipo);
  }

  async function fluxoTeorico() {
    skipSCORM();
    await delay(1500);
    await fecharEtapaFinalizada();
  }

  async function fluxoMaoNaMassa() {
    const comecar = await waitFor(() => findBtn('começar', 'comecar', 'iniciar'), 8000);
    if (comecar) {
      log('comecar');
      comecar.click();
      await delay(1000);
    }
    await navegarAteOFim();
    await fecharEtapaFinalizada();
  }

  async function fluxoPenseResponda() {
    log('Fluxo Pense e Responda');

    const btnFechar = await waitFor(
      () =>
        [...document.querySelectorAll('button')].find((b) => /fechar/i.test(b.textContent.trim())),
      10000
    );

    if (btnFechar) {
      log('Clicando em FECHAR');
      btnFechar.click();
    } else {
      log('Botão FECHAR não encontrado');
      return;
    }

    await waitFor(() => window.location.pathname.includes('EncerramentoAula'), 10000);
    await delay(1000);
    neutralizarBeforeUnload();

    log('Encerramento após Pense e Responda');
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await delay(500);

    try {
      window.open('', '_self');
      window.close();
    } catch (_) {}
  }

  async function fluxoQuiz() {
    const comecar = await waitFor(() => findBtn('começar', 'comecar', 'iniciar'), 6000);
    if (comecar) {
      log('comecar quiz');
      comecar.click();
      await delay(1000);
    }

    await waitFor(() => document.querySelector('input[type="radio"]'), 8000);
    await delay(500);

    const quizOk = await responderQuiz();
    log('responderQuiz retornou: ' + quizOk);

    await delay(2000);
    await fecharEtapaFinalizada();
  }

  // ─────────────────────────────────────────────────────────────
  // 6. LÓGICA DA PÁGINA PRINCIPAL
  // ─────────────────────────────────────────────────────────────

  function initMainPage() {
    if (document.getElementById('ml-panel')) return;

    let currentPopup = null;
    resetPopup = () => {
      currentPopup = null;
    };

    const _open = window.open;
    window.open = function (...args) {
      if (args[0] && typeof args[0] === 'string') {
        const sep = args[0].includes('?') ? '&' : '?';
        args[0] = args[0] + sep + 'ml_tipo=' + encodeURIComponent(pendingTipo);
      }
      currentPopup = _open.apply(this, args);
      return currentPopup;
    };

    injetarInterface();

    let running = false;
    const setSt = (m) => {
      const e = document.getElementById('ml-status');
      if (e) e.textContent = m;
    };
    const setPct = (p) => {
      const e = document.getElementById('ml-bar');
      if (e) e.style.width = p + '%';
    };

    async function iniciarExecucao() {
      if (running) return;
      running = true;
      GM_setValue('ml_running', Date.now());
      document.getElementById('ml-start').disabled = true;
      document.getElementById('ml-stop').style.display = '';
      setPct(0);

      await runAll(
        setSt,
        setPct,
        () => !running,
        () => currentPopup
      );

      running = false;
      GM_setValue('ml_running', 0);
      document.getElementById('ml-start').disabled = false;
      document.getElementById('ml-stop').style.display = 'none';
    }

    document.getElementById('ml-start').onclick = () => iniciarExecucao();

    document.getElementById('ml-stop').onclick = () => {
      running = false;
      GM_setValue('ml_running', 0);
      setSt('Parado.');
      document.getElementById('ml-start').disabled = false;
      document.getElementById('ml-stop').style.display = 'none';
    };

    const ultimoHeartbeat = GM_getValue('ml_running', 0);
    const segundosAtras = (Date.now() - ultimoHeartbeat) / 1000;

    if (ultimoHeartbeat > 0 && segundosAtras < 30) {
      log(`Retomando após reload (${segundosAtras.toFixed(1)}s atrás)...`);
      setSt('Retomando...');
      setTimeout(() => iniciarExecucao(), 3000);
    }
  }

  async function runAll(setSt, setPct, shouldStop, getPopup) {
    let totalExecutadas = 0;
    let tentativasVazio = 0;
    const MAX_TENTATIVAS_VAZIO = 5;
    const MAX_RETRIES_ATIVIDADE = 3;

    let retriesPorAtividade = {};
    try {
      retriesPorAtividade = JSON.parse(GM_getValue('ml_retries', '{}'));
    } catch (_) {
      retriesPorAtividade = {};
    }

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

        if (!GM_getValue('ml_popup_titulo', '')) {
          log('Popup concluiu normalmente.');
          break;
        }

        const cardDoPopup = [...document.querySelectorAll('.card-body')].find((cb) => {
          const b = cb.querySelector('button.btnAtividades.btn-info');
          return b && b.getAttribute('title') === popupTituloEmAndamento;
        });

        if (!cardDoPopup) {
          log('Card sumiu após reload — concluído.');
          limparEstadoPopup(popupTituloEmAndamento, retriesPorAtividade);
          break;
        }

        if (cardDoPopup.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo')) {
          log('Badge no card correto — concluído.');
          limparEstadoPopup(popupTituloEmAndamento, retriesPorAtividade);
          break;
        }

        log('Card ainda pendente — popup provavelmente ainda aberto, aguardando...');
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

      const aulaNome =
        atividadesPendentes[0].querySelector('h5.card-title')?.textContent.trim().slice(0, 20) ||
        'Aula';
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

  function getTipo(btn) {
    const titulo = (btn.getAttribute('title') || '').toLowerCase().trim();
    const tipo = TIPO_POR_TITULO[titulo];

    if (!tipo) {
      log(`Tipo desconhecido para title="${titulo}" — tratando como popup genérico`);
      return 'popup';
    }

    log(`Tipo identificado: ${tipo}`);
    return tipo;
  }

  async function handlePopup(btn, getPopup) {
    const tipo = getTipo(btn);
    GM_setValue('ml_tipo_atividade', tipo);
    resetPopup();

    const card = btn.closest('.card-body');

    if (tipo === 'questionamento') {
      await handleQuestionamento(btn, getPopup);
      return 'concluida';
    }

    GM_setValue('ml_popup_titulo', btn.getAttribute('title') || '');
    GM_setValue('ml_popup_ts', Date.now());

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
    const end = Date.now() + timeout;
    const tituloAtividade = btn.getAttribute('title') || '';

    while (Date.now() < end) {
      await delay(1500);

      if (document.body.contains(cardEl)) {
        const badge = cardEl.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo');
        if (badge) {
          log(`Badge detectado — concluída: ${tituloAtividade}`);
          return 'concluida';
        }
        if (!cardEl.querySelector('button.btnAtividades.btn-info')) {
          log(`Botão sumiu — concluída: ${tituloAtividade}`);
          return 'concluida';
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

      if (!cardAtualizado) {
        log(`Card não encontrado após reload — concluída: ${tituloAtividade}`);
        return 'concluida';
      }

      if (cardAtualizado.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo')) {
        log(`Badge após reload — concluída: ${tituloAtividade}`);
        return 'concluida';
      }

      log(`Card ainda pendente após reload — continuando monitoramento: ${tituloAtividade}`);
      cardEl = cardAtualizado;
    }

    log(`Timeout aguardando: ${tituloAtividade}`);
    return 'timeout';
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
      return;
    }

    log('Clicando em Sim');
    btnSim.click();
    await delay(1500);
    log('Questionamento concluido');
  }

  function limparEstadoPopup(titulo, retriesLocais) {
    GM_setValue('ml_popup_titulo', '');
    GM_setValue('ml_popup_ts', 0);
    try {
      const r = JSON.parse(GM_getValue('ml_retries', '{}'));
      Object.keys(r).forEach((k) => {
        if (k.includes(titulo)) delete r[k];
      });
      GM_setValue('ml_retries', JSON.stringify(r));
      Object.keys(retriesLocais).forEach((k) => {
        if (k.includes(titulo)) delete retriesLocais[k];
      });
    } catch (_) {}
  }

  // ─────────────────────────────────────────────────────────────
  // 7. INJEÇÃO DE INTERFACE
  // ─────────────────────────────────────────────────────────────

  function injetarInterface() {
    document.head.insertAdjacentHTML(
      'beforeend',
      `<style>
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
    </style>`
    );

    document.body.insertAdjacentHTML(
      'beforeend',
      `
      <div id="ml-panel">
        <header id="ml-hdr"><b>ML AUTO v5.0.0</b><small id="ml-min">-</small></header>
        <div id="ml-body">
          <div id="ml-status">Pronto.</div>
          <div id="ml-bw"><div id="ml-bar"></div></div>
          <button id="ml-start">INICIAR</button>
          <button id="ml-stop" style="display:none">PARAR</button>
        </div>
      </div>`
    );

    makeDraggable(document.getElementById('ml-panel'), document.getElementById('ml-hdr'));

    document.getElementById('ml-min').onclick = () => {
      const b = document.getElementById('ml-body');
      const h = b.style.display === 'none';
      b.style.display = h ? '' : 'none';
      document.getElementById('ml-min').textContent = h ? '-' : '+';
    };
  }

  function makeDraggable(panel, handle) {
    let ox = 0,
      oy = 0;
    handle.onmousedown = (e) => {
      e.preventDefault();
      ox = e.clientX;
      oy = e.clientY;
      document.onmouseup = () => {
        document.onmouseup = null;
        document.onmousemove = null;
      };
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

  // ─────────────────────────────────────────────────────────────
  // 8. INICIALIZAÇÃO
  // ─────────────────────────────────────────────────────────────

  if (isPopup) onReady(initPopup);
  else if (isMain) onReady(initMainPage);
})();
