(function() {
  console.clear();
  console.log('🚀 Carregando Auto-Preenchedor v5.0 (Minimalista)...');
  
  // ═══════════════════════════════════════════════════════════
  // PARTE 1: BUSCAR GABARITO AUTOMATICAMENTE
  // ═══════════════════════════════════════════════════════════
  
  function buscarGabarito() {
    function getAllFiberNodes(fiber, nodes = [], depth = 0, maxDepth = 100) {
      if (!fiber || depth > maxDepth) return nodes;
      nodes.push(fiber);
      let child = fiber.child;
      while (child) {
        getAllFiberNodes(child, nodes, depth + 1, maxDepth);
        child = child.sibling;
      }
      return nodes;
    }
    
    function findReactRoot(element) {
      for (let key in element) {
        if (key.startsWith('__reactContainer') || 
            key.startsWith('_reactRootContainer') ||
            key.startsWith('__reactFiber')) {
          return element[key];
        }
      }
      return null;
    }
    
    const root = document.querySelector('#root') || document.body;
    const reactRoot = findReactRoot(root);
    
    if (!reactRoot) return null;
    
    const fiberRoot = reactRoot._internalRoot || reactRoot.current || reactRoot;
    const allNodes = getAllFiberNodes(fiberRoot);
    
    const possibleAnswers = [];
    
    allNodes.forEach((fiber) => {
      if (fiber.memoizedState) {
        let state = fiber.memoizedState;
        
        while (state) {
          if (Array.isArray(state.memoizedState)) {
            const arr = state.memoizedState;
            if (arr.length >= 5 && arr.length <= 50) {
              if (arr.every(n => typeof n === 'number' && n >= 0 && n <= 10)) {
                possibleAnswers.push(arr);
              }
            }
          }
          state = state.next;
        }
      }
    });
    
    if (possibleAnswers.length === 0) return null;
    
    const gabarito = possibleAnswers.sort((a, b) => b.length - a.length)[0];
    return gabarito.map(r => r - 1);
  }
  
  // ═══════════════════════════════════════════════════════════
  // PARTE 2: CRIAR INTERFACE MINIMALISTA
  // ═══════════════════════════════════════════════════════════
  
  function criarInterface() {
    const oldUI = document.getElementById('auto-preenchedor-ui');
    if (oldUI) oldUI.remove();
    
    const ui = document.createElement('div');
    ui.id = 'auto-preenchedor-ui';
    ui.innerHTML = `
      <style>
        #auto-preenchedor-ui {
          position: fixed;
          top: 20px;
          left: 20px;
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(10px);
          color: white;
          padding: 12px 15px;
          border-radius: 10px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.4);
          z-index: 999999;
          font-family: 'Segoe UI', system-ui, sans-serif;
          min-width: 200px;
          max-width: 250px;
          animation: slideInLeft 0.3s ease-out;
          font-size: 13px;
        }
        
        @keyframes slideInLeft {
          from {
            transform: translateX(-300px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        #auto-preenchedor-ui.minimized {
          padding: 8px 12px;
          min-width: 50px;
          cursor: pointer;
        }
        
        #auto-preenchedor-ui.minimized .content {
          display: none;
        }
        
        #auto-preenchedor-ui .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          gap: 8px;
        }
        
        #auto-preenchedor-ui .title {
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        #auto-preenchedor-ui .btn-minimize {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 2px 6px;
          font-size: 16px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        
        #auto-preenchedor-ui .btn-minimize:hover {
          opacity: 1;
        }
        
        #auto-preenchedor-ui .status {
          background: rgba(255,255,255,0.1);
          padding: 8px 10px;
          border-radius: 6px;
          margin-bottom: 10px;
          font-size: 12px;
          line-height: 1.4;
        }
        
        #auto-preenchedor-ui .progress-mini {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 12px;
        }
        
        #auto-preenchedor-ui .progress-bar-mini {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        
        #auto-preenchedor-ui .progress-fill-mini {
          height: 100%;
          background: #10b981;
          width: 0%;
          transition: width 0.3s ease;
        }
        
        #auto-preenchedor-ui button.action-btn {
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 6px;
        }
        
        #auto-preenchedor-ui .btn-iniciar {
          background: #10b981;
          color: white;
        }
        
        #auto-preenchedor-ui .btn-iniciar:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
        }
        
        #auto-preenchedor-ui .btn-iniciar:disabled {
          background: #4b5563;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        #auto-preenchedor-ui .btn-fechar {
          background: rgba(239, 68, 68, 0.8);
          color: white;
          font-size: 12px;
          padding: 6px 10px;
        }
        
        #auto-preenchedor-ui .btn-fechar:hover {
          background: rgba(220, 38, 38, 0.9);
        }
      </style>
      
      <div class="header">
        <div class="title">
          <span>🤖</span>
          <span>Auto-Fill</span>
        </div>
        <button class="btn-minimize" id="btn-minimize" title="Minimizar">−</button>
      </div>
      
      <div class="content">
        <div id="status" class="status">
          🔍 Buscando...
        </div>
        
        <div id="progress-container" style="display: none;">
          <div class="progress-mini" id="progress-text">
            <span id="questao-num">Q1/10</span>
            <span id="progress-percent">0%</span>
          </div>
          <div class="progress-bar-mini">
            <div class="progress-fill-mini" id="progress-fill"></div>
          </div>
        </div>
        
        <button id="btn-iniciar" class="action-btn btn-iniciar" disabled>
          Aguarde...
        </button>
        
        <button id="btn-fechar" class="action-btn btn-fechar">
          ✕ Fechar
        </button>
      </div>
    `;
    
    document.body.appendChild(ui);
    return ui;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PARTE 3: FUNÇÃO PARA CLICAR NAS ALTERNATIVAS
  // ═══════════════════════════════════════════════════════════
  
  function clicarAlternativa(indice) {
    const radioInput = document.querySelector(`input[type="radio"][id="${indice}"]`);
    
    if (radioInput) {
      radioInput.click();
      
      const event = new Event('change', { bubbles: true });
      radioInput.dispatchEvent(event);
      
      const label = radioInput.closest('label');
      if (label) {
        label.click();
      }
      
      return true;
    }
    
    const label = document.querySelector(`label[for="${indice}"]`);
    
    if (label) {
      label.click();
      return true;
    }
    
    const alternativas = document.querySelectorAll('.alternative-box label');
    
    if (alternativas && alternativas[indice]) {
      alternativas[indice].click();
      return true;
    }
    
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PARTE 4: LÓGICA DE PREENCHIMENTO AUTOMÁTICO
  // ═══════════════════════════════════════════════════════════
  
  const ui = criarInterface();
  const statusEl = document.getElementById('status');
  const btnIniciar = document.getElementById('btn-iniciar');
  const btnFechar = document.getElementById('btn-fechar');
  const btnMinimize = document.getElementById('btn-minimize');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const questaoNum = document.getElementById('questao-num');
  const progressPercent = document.getElementById('progress-percent');
  
  let gabarito = null;
  let isRunning = false;
  let isMinimized = false;
  
  // Minimizar/Maximizar
  btnMinimize.addEventListener('click', (e) => {
    e.stopPropagation();
    isMinimized = !isMinimized;
    ui.classList.toggle('minimized');
    btnMinimize.textContent = isMinimized ? '+' : '−';
  });
  
  ui.addEventListener('click', () => {
    if (isMinimized) {
      isMinimized = false;
      ui.classList.remove('minimized');
      btnMinimize.textContent = '−';
    }
  });
  
  // Buscar gabarito
  setTimeout(() => {
    gabarito = buscarGabarito();
    
    if (!gabarito) {
      statusEl.innerHTML = `❌ Não encontrado<br><small>Inicie o teste</small>`;
      btnIniciar.textContent = '❌ Indisponível';
      return;
    }
    
    const letras = ['A', 'B', 'C', 'D', 'E'];
    
    statusEl.innerHTML = `✅ ${gabarito.length} questões<br><small>${gabarito.map((r, i) => `${i+1}:${letras[r]}`).join(' ')}</small>`;
    
    btnIniciar.disabled = false;
    btnIniciar.textContent = '▶ Iniciar';
    
    console.log('✅ Gabarito:', gabarito.map((r, i) => `Q${i+1}: ${letras[r]}`).join(', '));
  }, 500);
  
  // Função principal de preenchimento
  async function preencherQuestoes() {
    if (isRunning) return;
    
    isRunning = true;
    btnIniciar.disabled = true;
    btnIniciar.textContent = '⏳ Rodando...';
    progressContainer.style.display = 'block';
    statusEl.style.display = 'none';
    
    const letras = ['A', 'B', 'C', 'D', 'E'];
    const modoAtual = localStorage.getItem('tela');
    let currentQuestion = (modoAtual && parseInt(modoAtual) > 0) ? parseInt(modoAtual) - 1 : 0;
    
    for (let i = currentQuestion; i < gabarito.length; i++) {
      const respostaCorreta = gabarito[i];
      
      questaoNum.textContent = `Q${i + 1}/${gabarito.length} → ${letras[respostaCorreta]}`;
      
      const progresso = Math.round(((i + 1) / gabarito.length) * 100);
      progressFill.style.width = progresso + '%';
      progressPercent.textContent = progresso + '%';
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const sucesso = clicarAlternativa(respostaCorreta);
      
      if (!sucesso) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `⚠️ Erro Q${i+1}<br><small>Continue manual</small>`;
        isRunning = false;
        btnIniciar.disabled = false;
        btnIniciar.textContent = '🔄 Continuar';
        return;
      }
      
      console.log(`✓ Q${i+1}: ${letras[respostaCorreta]}`);
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      if (i < gabarito.length - 1) {
        const btnProximo = document.querySelector('.nav_buttons_right');
        
        if (btnProximo) {
          btnProximo.click();
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          statusEl.style.display = 'block';
          statusEl.innerHTML = `⚠️ Botão próxima<br><small>Avance manual</small>`;
          isRunning = false;
          btnIniciar.disabled = false;
          btnIniciar.textContent = '🔄 Continuar';
          return;
        }
      }
    }
    
    progressFill.style.background = '#10b981';
    questaoNum.textContent = '✅ Concluído!';
    progressPercent.textContent = '100%';
    
    btnIniciar.textContent = '✅ Finalizado';
    btnIniciar.style.background = '#10b981';
    
    console.log('🎉 Concluído! Clique em ENVIAR RESPOSTAS');
    
    isRunning = false;
  }
  
  btnIniciar.addEventListener('click', preencherQuestoes);
  
  btnFechar.addEventListener('click', () => {
    ui.remove();
  });
  
  console.log('✅ Auto-Preenchedor Minimalista carregado!');
  
})();
