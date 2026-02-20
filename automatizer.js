// ==UserScript==
// @name         Microlins - Auto Concluir Aulas
// @namespace    http://tampermonkey.net/
// @version      4.4.0
// @description  Automatiza conclusão de todas as atividades no portal Microlins
// @match        *://portaldoaluno.microlins.com.br/*
// @match        *://sistemas.microlins.com.br/*
// @match        *://appaula.microlins.com.br/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const isPopup = ['sistemas.microlins.com.br', 'appaula.microlins.com.br'].includes(
    window.location.hostname
  );
  const isMain = window.location.hostname === 'portaldoaluno.microlins.com.br';

  // ── Desbloqueio de DevTools ───────────────────────────────────
  window.addEventListener('contextmenu', (e) => e.stopImmediatePropagation(), true);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)))
        e.stopImmediatePropagation();
    },
    true
  );

  // ── Suprime diálogos nativos e beforeunload nos popups ────────
  // O "Sair do site?" é gerado pelo evento beforeunload da página.
  // Interceptamos addEventListener ANTES de qualquer código da página
  // para que o handler nunca seja registrado.
  function neutralizarBeforeUnload() {
    // Remove handler direto
    window.onbeforeunload = null;

    // Bloqueia registro futuro
    const originalAdd = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'beforeunload' || type === 'unload') {
        return;
      }
      return originalAdd.call(this, type, listener, options);
    };

    // Cancela qualquer evento já existente (fase capture)
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

    // Impede redefinição via propriedade
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

    // Remove returnValue forçado
    window.addEventListener(
      'beforeunload',
      (e) => {
        delete e.returnValue;
      },
      true
    );
  }

  if (isPopup) {
    neutralizarBeforeUnload();
  }
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (msg) => console.log('[ML]', msg);

  if (isPopup) onReady(initPopup);
  else if (isMain) onReady(initMainPage);

  function onReady(fn) {
    if (document.readyState !== 'loading') setTimeout(fn, 150);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 150));
  }

  // ─────────────────────────────────────────────────────────────
  // UTILITÁRIOS
  // ─────────────────────────────────────────────────────────────

  function normalizarTexto(txt = '') {
  return txt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
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

  async function fecharEtapaFinalizada() {
  log('Iniciando tentativa de fechar...');

  // 1. Tenta encontrar um botão real primeiro
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

  // 2. Independente de achar botão, se a URL for Encerramento ou o texto existir, fecha
  log('Finalizando processo e fechando janela.');
  neutralizarBeforeUnload();

  await delay(500);
  window.close();

  // Backup caso o window.close() falhe (alguns navegadores bloqueiam)
  setTimeout(() => {
    if (!window.closed) window.location.href = "about:blank";
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

  async function esperarTelaDesbloquear(timeout = 20000) {
    const end = Date.now() + timeout;

    while (Date.now() < end) {
      // 1️⃣ overlay comum
      const overlay =
        document.querySelector('.loading') ||
        document.querySelector('.spinner') ||
        document.querySelector('.overlay') ||
        document.querySelector('.swal2-container') ||
        document.querySelector('[aria-busy="true"]');

      // 2️⃣ body bloqueado
      const bloqueado =
        document.body.style.pointerEvents === 'none' ||
        document.body.classList.contains('modal-open');

      if (!overlay && !bloqueado) {
        await delay(600); // pequena margem pós-render
        return;
      }

      await delay(400);
    }

    log('Tela demorou para desbloquear');
  }

  // ─────────────────────────────────────────────────────────────
  // SCORM SKIP
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

  // ─────────────────────────────────────────────────────────────
  // AUTO-ANSWER
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
        log('alternativas nao renderizaram');
        return false;
      }

      if (!clicarAlternativa(gabarito[i])) {
        log('erro ao clicar Q' + (i + 1));
        return false;
      }

      await delay(600);

      const next = await waitFor(() => document.querySelector('.nav_buttons_right'), 8000);

      if (!next) {
        log('botao proximo nao encontrado');
        return false;
      }

      next.click();
      await delay(900);
    }

    // 🔹 FINALIZAR QUIZ

    log('todas questoes respondidas');

    const finalizar = await waitFor(
      () =>
        [...document.querySelectorAll('button')].find((b) =>
          /finalizar|enviar respostas/i.test(b.textContent.trim())
        ),
      10000
    );
    if (finalizar) {
      finalizar.click();
      await delay(1500);
    } else {
      log('botao finalizar nao encontrado');
      return false;
    }

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
  // ═════════════════════════════════════════════════════════════
  //  POPUP — fluxo por atividade
  // ═════════════════════════════════════════════════════════════

  async function initPopup() {
  await delay(800);
  log('popup host=' + window.location.hostname);

  // Verificação específica para a URL de encerramento ou texto de finalização
  if (window.location.pathname.includes('EncerramentoAula') ||
      document.body.textContent.includes('Etapa finalizada')) {
    log('Tela de encerramento detectada via URL/Texto');
    await fecharEtapaFinalizada();
    return;
  }

  // Se não for encerramento, tenta achar o título normal das atividades
  const tituloEl = await waitFor(() => {
    const el = document.querySelector('.course-name-title-tc, .course-name-title');
    const btn = document.querySelector('button');
    // Só prossegue se encontrar o título E o botão "Começar"
    return (el && btn) ? el : null;
  }, 15000);

  if (!tituloEl) {
    log('titulo nao encontrado');
    return;
  }

  const titulo = normalizarTexto(tituloEl.textContent);
  log('Titulo normalizado: ' + titulo);

  // 🔴 Encerramento
  if (window.location.pathname.includes('EncerramentoAula')) {
    log('Encerramento detectado');
    neutralizarBeforeUnload();
    await delay(500);
    try { window.open('', '_self'); window.close(); } catch (_) {}
    return;
  }

  // Agora as verificações vão funcionar corretamente:
  if (titulo.includes('teste seus conhecimentos')) {
    await fluxoQuiz();
    return;
  }

  if (titulo.includes('pense e responda')) {
    await fluxoPenseResponda();
    return;
  }

  if (titulo.includes('mao na massa')) {
    await fluxoMaoNaMassa();
    return;
  }

  // 🟡 SCORM
  if (window.API) {
    log('Detectado SCORM');
    await fluxoTeorico();
    return;
  }

  log('Tipo não identificado');
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

    // espera botão FECHAR aparecer
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

    // aguarda redirecionamento para EncerramentoAula
    await waitFor(() => window.location.pathname.includes('EncerramentoAula'), 10000);

    await delay(1000);

    // neutraliza beforeunload novamente por segurança
    neutralizarBeforeUnload();

    log('Encerramento após Pense e Responda');

    // simula interação humana
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
    await waitFor(() => document.querySelector('input[type="radio"]'), 5000);
    await delay(500);
    await responderQuiz();
    await delay(500);
    const fim = await waitFor(() => findBtn('finalizar'), 5000);
    if (fim) {
      fim.click();
      await delay(600);
    }
    await fecharEtapaFinalizada();
  }

  // ═════════════════════════════════════════════════════════════
  //  PÁGINA PRINCIPAL
  // ═════════════════════════════════════════════════════════════

  function initMainPage() {
    if (document.getElementById('ml-panel')) return;

    let currentPopup = null;
    const _open = window.open;
    window.open = function (...args) {
      currentPopup = _open.apply(this, args);
      return currentPopup;
    };

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
        <header id="ml-hdr"><b>ML AUTO v4.4</b><small id="ml-min">-</small></header>
        <div id="ml-body">
          <div id="ml-status">Pronto.</div>
          <div id="ml-bw"><div id="ml-bar"></div></div>
          <button id="ml-start">INICIAR</button>
          <button id="ml-stop" style="display:none">PARAR</button>
        </div>
      </div>`
    );

    const setSt = (m) => {
      const e = document.getElementById('ml-status');
      if (e) e.textContent = m;
    };
    const setPct = (p) => {
      const e = document.getElementById('ml-bar');
      if (e) e.style.width = p + '%';
    };

    makeDraggable(document.getElementById('ml-panel'), document.getElementById('ml-hdr'));

    document.getElementById('ml-min').onclick = () => {
      const b = document.getElementById('ml-body');
      const h = b.style.display === 'none';
      b.style.display = h ? '' : 'none';
      document.getElementById('ml-min').textContent = h ? '-' : '+';
    };

    let running = false;
    document.getElementById('ml-start').onclick = async () => {
      if (running) return;
      running = true;
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
      document.getElementById('ml-start').disabled = false;
      document.getElementById('ml-stop').style.display = 'none';
    };
    document.getElementById('ml-stop').onclick = () => {
      running = false;
      setSt('Parado.');
    };
  }

  async function runAll(setSt, setPct, shouldStop, getPopup) {
    let totalExecutadas = 0;
    let tentativasVazio = 0;

    while (!shouldStop()) {
      await delay(2000); // Aumentado para dar tempo ao portal

      // 1️⃣ Verifica se os cards existem (evita parar enquanto a página carrega)
      const cards = [...document.querySelectorAll('.card-body')];

      if (cards.length === 0) {
        setSt('Aguardando carregamento...');
        await delay(2000);
        continue;
      }

      // 2️⃣ Filtra atividades pendentes
      const atividadesPendentes = cards.filter((cb) => {
        // Verifica se tem o selo vermelho de concluído
        const concluido = cb.querySelector('.badge.bg-danger.circulo, .badge.bg-success.circulo');
        if (concluido) return false;

        // Verifica se tem o botão de iniciar
        const btn = cb.querySelector('button.btnAtividades.btn-info');
        return !!btn;
      });

      // 3️⃣ Lógica de Finalização Real
      if (atividadesPendentes.length === 0) {
        tentativasVazio++;
        setSt(`Verificando conclusão... (${tentativasVazio}/3)`);

        await delay(3000);

        if (tentativasVazio >= 3) {
          // Se realmente não tiver nada, tenta dar um scroll para o topo para ver se algo carrega
          window.scrollTo(0, 0);
          await delay(2000);

          // Re-checa uma última vez
          const checkFinal = document.querySelector('button.btnAtividades.btn-info');
          if (!checkFinal) {
            setSt('Tudo concluído!');
            setPct(100);
            break;
          }
        }
        continue;
      }

      // Reset de tentativas se achou algo
      tentativasVazio = 0;

      // 4️⃣ Execução da Atividade
      const btn = atividadesPendentes[0].querySelector('button.btnAtividades.btn-info');
      if (!btn) continue;

      totalExecutadas++;
      const aulaNome = atividadesPendentes[0].querySelector('h5.card-title')?.textContent.trim().slice(0, 20) || 'Aula';
      const atividadeNome = btn.getAttribute('title') || 'Atividade';

      setSt(`Executando: ${aulaNome} > ${atividadeNome}`);
      setPct(Math.min(totalExecutadas * 7, 98));

      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await delay(1000);

      // Dispara o popup
      await handlePopup(btn, getPopup);

      // 5️⃣ Pós-Popup: O segredo da estabilidade
      log('Popup fechado, aguardando portal atualizar...');
      setSt('Aguardando portal atualizar...');

      // Espera o bloqueio de tela (loading) sumir
      await esperarTelaDesbloquear(15000);

      // Espera o DOM estabilizar (o React redesenhar os badges)
      await esperarDOMEstavel(5000);

      await delay(2000); // Margem de segurança final
    }
  }

  function getTipo(btn) {
  const card = btn.closest('.card-body');
  if (!card) return 'popup';

  // 🔎 Pega o nome oficial buscando pelas duas classes possíveis
  const nomeAtividade =
    card.querySelector('.course-name-title-tc')?.textContent ||
    card.querySelector('.course-name-title')?.textContent ||
    btn.getAttribute('title') ||
    '';

  const titulo = normalizarTexto(nomeAtividade);
  log('Identificando tipo para: ' + titulo);

  if (titulo.includes('teste seus conhecimentos')) return 'quiz';
  if (titulo.includes('questionamento')) return 'questionamento';
  if (titulo.includes('pense e responda')) return 'pense-responda';
  if (titulo.includes('mao na massa')) return 'mao-na-massa';
  if (titulo.includes('teorico')) return 'teorico';

  return 'popup';
}

  async function handlePopup(btn, getPopup) {
    const tipo = getTipo(btn);

    // 🔵 QUESTIONAMENTO (SweetAlert "Sim")
    if (tipo === 'questionamento') {
      await handleQuestionamento(btn, getPopup);
      return;
    }

    // 🟢 MÃO NA MASSA
    if (tipo === 'mao-na-massa') {
      btn.click();
      const webBtn = await waitFor(() => document.querySelector('#btnWebAtividades'), 6000);
      if (webBtn) webBtn.click();

      await waitPopupClose(getPopup, 120000);
      return;
    }

    // 🔵 QUIZ
    if (tipo === 'quiz') {
      btn.click();
      await delay(1500);
      await waitPopupClose(getPopup, 180000);
      return;
    }

    // 🟡 padrão
    btn.click();
    await delay(1800);
    await waitPopupClose(getPopup, 120000);
  }

  async function waitPopupClose(getPopup, timeout = 300000) {
    const end = Date.now() + timeout;
    log('Aguardando fechamento da atividade...');

    while (Date.now() < end) {
      await delay(1000);
      const p = getPopup();

      // Verifica se a janela foi fechada ou se perdeu o acesso a ela
      try {
        if (!p || p.closed) {
          log('Popup detectado como fechado.');
          return true;
        }
      } catch (e) {
        log('Erro ao acessar popup (provavelmente fechado/redirecionado).');
        return true;
      }
    }
    log('Timeout atingido ao esperar popup.');
    return false;
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

  async function esperarBotaoSumir(btn, timeout = 10000) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
      if (!document.body.contains(btn)) {
        return;
      }
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
})();
