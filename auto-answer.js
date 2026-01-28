(function() {
  console.clear();
  console.log('🚀 Carregando Auto-Preenchedor v4.0 (CORRIGIDO)...');
  
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
  // PARTE 2: CRIAR INTERFACE VISUAL
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
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          z-index: 999999;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          min-width: 320px;
          max-width: 400px;
          animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        #auto-preenchedor-ui h3 {
          margin: 0 0 15px 0;
          font-size: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        #auto-preenchedor-ui .status {
          background: rgba(255,255,255,0.2);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 15px;
          font-size: 14px;
          line-height: 1.6;
        }
        
        #auto-preenchedor-ui .gabarito-preview {
          background: rgba(0,0,0,0.2);
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 15px;
          max-height: 200px;
          overflow-y: auto;
          font-size: 13px;
          line-height: 1.8;
        }
        
        #auto-preenchedor-ui .gabarito-preview::-webkit-scrollbar {
          width: 6px;
        }
        
        #auto-preenchedor-ui .gabarito-preview::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.3);
          border-radius: 3px;
        }
        
        #auto-preenchedor-ui button {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 8px;
        }
        
        #auto-preenchedor-ui .btn-iniciar {
          background: #10b981;
          color: white;
        }
        
        #auto-preenchedor-ui .btn-iniciar:hover {
          background: #059669;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(16,185,129,0.4);
        }
        
        #auto-preenchedor-ui .btn-iniciar:disabled {
          background: #6b7280;
          cursor: not-allowed;
          transform: none;
        }
        
        #auto-preenchedor-ui .btn-fechar {
          background: rgba(255,255,255,0.2);
          color: white;
          font-size: 14px;
        }
        
        #auto-preenchedor-ui .btn-fechar:hover {
          background: rgba(255,255,255,0.3);
        }
        
        #auto-preenchedor-ui .progress-bar {
          width: 100%;
          height: 25px;
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 10px;
          position: relative;
        }
        
        #auto-preenchedor-ui .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #34d399);
          width: 0%;
          transition: width 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
        }
        
        #auto-preenchedor-ui .questao-atual {
          text-align: center;
          font-size: 14px;
          margin-bottom: 15px;
          padding: 8px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }
        
        .questao-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
        }
        
        .questao-item.current {
          background: rgba(255,255,255,0.2);
          padding: 4px 8px;
          border-radius: 4px;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      </style>
      
      <h3>
        <span>🤖</span>
        <span>Auto-Preenchedor</span>
      </h3>
      
      <div id="status" class="status">
        🔍 Buscando gabarito...
      </div>
      
      <div id="gabarito-preview" class="gabarito-preview" style="display: none;"></div>
      
      <div id="progress-container" style="display: none;">
        <div class="questao-atual" id="questao-atual"></div>
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill">0%</div>
        </div>
      </div>
      
      <button id="btn-iniciar" class="btn-iniciar" disabled>
        Carregando...
      </button>
      
      <button id="btn-fechar" class="btn-fechar">
        Fechar
      </button>
    `;
    
    document.body.appendChild(ui);
    return ui;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PARTE 3: FUNÇÃO PARA CLICAR NAS ALTERNATIVAS (CORRIGIDA!)
  // ═══════════════════════════════════════════════════════════
  
  function clicarAlternativa(indice) {
    // Método 1: Procurar pelo input radio
    const radioInput = document.querySelector(`input[type="radio"][id="${indice}"]`);
    
    if (radioInput) {
      // Clicar no input
      radioInput.click();
      
      // Disparar evento change
      const event = new Event('change', { bubbles: true });
      radioInput.dispatchEvent(event);
      
      // Também clicar no label
      const label = radioInput.closest('label');
      if (label) {
        label.click();
      }
      
      console.log(`✓ Alternativa ${indice} clicada (método 1: input)`);
      return true;
    }
    
    // Método 2: Procurar pelo label com for="${indice}"
    const label = document.querySelector(`label[for="${indice}"]`);
    
    if (label) {
      label.click();
      console.log(`✓ Alternativa ${indice} clicada (método 2: label)`);
      return true;
    }
    
    // Método 3: Procurar por índice na lista de alternativas
    const alternativas = document.querySelectorAll('.alternative-box label');
    
    if (alternativas && alternativas[indice]) {
      alternativas[indice].click();
      console.log(`✓ Alternativa ${indice} clicada (método 3: índice)`);
      return true;
    }
    
    console.error(`❌ Não conseguiu clicar na alternativa ${indice}`);
    return false;
  }
  
  // ═══════════════════════════════════════════════════════════
  // PARTE 4: LÓGICA DE PREENCHIMENTO AUTOMÁTICO
  // ═══════════════════════════════════════════════════════════
  
  const ui = criarInterface();
  const statusEl = document.getElementById('status');
  const gabaritoPreviewEl = document.getElementById('gabarito-preview');
  const btnIniciar = document.getElementById('btn-iniciar');
  const btnFechar = document.getElementById('btn-fechar');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');
  const questaoAtualEl = document.getElementById('questao-atual');
  
  let gabarito = null;
  let isRunning = false;
  
  // Buscar gabarito
  setTimeout(() => {
    gabarito = buscarGabarito();
    
    if (!gabarito) {
      statusEl.innerHTML = `
        ❌ Gabarito não encontrado<br>
        <small>Clique em COMEÇAR o teste primeiro</small>
      `;
      btnIniciar.textContent = '❌ Gabarito não disponível';
      return;
    }
    
    const letras = ['A', 'B', 'C', 'D', 'E'];
    
    statusEl.innerHTML = `
      ✅ Gabarito encontrado!<br>
      <small>${gabarito.length} questões detectadas</small>
    `;
    
    gabaritoPreviewEl.style.display = 'block';
    gabaritoPreviewEl.innerHTML = gabarito.map((resp, i) => 
      `<div class="questao-item" id="q-item-${i}">
        <span>Q${i+1}:</span>
        <strong>${letras[resp]}</strong>
      </div>`
    ).join('');
    
    btnIniciar.disabled = false;
    btnIniciar.textContent = '🚀 Iniciar Preenchimento Automático';
    
    console.log('✅ Gabarito carregado:', gabarito);
    console.log('✅ Gabarito em letras:', gabarito.map((r, i) => `Q${i+1}: ${letras[r]}`));
  }, 500);
  
  // Função principal de preenchimento
  async function preencherQuestoes() {
    if (isRunning) return;
    
    isRunning = true;
    btnIniciar.disabled = true;
    btnIniciar.textContent = '⏳ Preenchendo...';
    progressContainer.style.display = 'block';
    
    const letras = ['A', 'B', 'C', 'D', 'E'];
    
    // Verificar questão atual
    const modoAtual = localStorage.getItem('tela');
    let currentQuestion = (modoAtual && parseInt(modoAtual) > 0) ? parseInt(modoAtual) - 1 : 0;
    
    console.log(`📍 Iniciando da questão ${currentQuestion + 1}`);
    
    for (let i = currentQuestion; i < gabarito.length; i++) {
      const respostaCorreta = gabarito[i];
      
      // Atualizar UI
      questaoAtualEl.innerHTML = `
        📝 Preenchendo questão <strong>${i + 1}</strong> de <strong>${gabarito.length}</strong><br>
        Resposta: <strong>${letras[respostaCorreta]}</strong>
      `;
      
      const progresso = Math.round(((i + 1) / gabarito.length) * 100);
      progressFill.style.width = progresso + '%';
      progressFill.textContent = progresso + '%';
      
      // Destacar questão atual
      document.querySelectorAll('.questao-item').forEach(el => el.classList.remove('current'));
      const itemEl = document.getElementById(`q-item-${i}`);
      if (itemEl) itemEl.classList.add('current');
      
      // Aguardar um pouco para UI atualizar
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Clicar na alternativa correta
      const sucesso = clicarAlternativa(respostaCorreta);
      
      if (!sucesso) {
        console.error(`❌ Falha ao marcar questão ${i+1}`);
        statusEl.innerHTML = `
          ⚠️ Erro na questão ${i+1}<br>
          <small>Continue manualmente ou recarregue</small>
        `;
        isRunning = false;
        btnIniciar.disabled = false;
        btnIniciar.textContent = '🔄 Tentar Novamente';
        return;
      }
      
      console.log(`✅ Q${i+1}: Marcada alternativa ${letras[respostaCorreta]}`);
      
      // Aguardar antes de avançar
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Avançar para próxima questão (se não for a última)
      if (i < gabarito.length - 1) {
        const btnProximo = document.querySelector('.nav_buttons_right');
        
        if (btnProximo) {
          btnProximo.click();
          console.log('⏭️ Avançando para próxima questão...');
          await new Promise(resolve => setTimeout(resolve, 800));
        } else {
          console.error('❌ Botão "Próxima" não encontrado');
          statusEl.innerHTML = `
            ⚠️ Botão próxima não encontrado<br>
            <small>Avance manualmente e clique em Continuar</small>
          `;
          isRunning = false;
          btnIniciar.disabled = false;
          btnIniciar.textContent = '🔄 Continuar Preenchimento';
          return;
        }
      }
    }
    
    // Concluído!
    questaoAtualEl.innerHTML = `
      ✅ <strong>Todas as questões preenchidas!</strong><br>
      <small>Clique em "ENVIAR RESPOSTAS"</small>
    `;
    
    statusEl.innerHTML = `
      🎉 <strong>Concluído com sucesso!</strong><br>
      <small>Agora clique em ENVIAR RESPOSTAS</small>
    `;
    
    progressFill.style.background = 'linear-gradient(90deg, #10b981, #10b981)';
    
    btnIniciar.textContent = '✅ Concluído!';
    btnIniciar.style.background = '#10b981';
    
    console.log('');
    console.log('%c🎉 PREENCHIMENTO AUTOMÁTICO CONCLUÍDO!', 'color: green; font-size: 20px; font-weight: bold;');
    console.log('%c👉 Clique em "ENVIAR RESPOSTAS" para finalizar', 'color: orange; font-size: 16px;');
    
    isRunning = false;
  }
  
  // Event listeners
  btnIniciar.addEventListener('click', preencherQuestoes);
  
  btnFechar.addEventListener('click', () => {
    ui.remove();
    console.log('Interface fechada');
  });
  
  console.log('✅ Auto-Preenchedor v4.0 carregado com sucesso!');
  console.log('📋 Estrutura HTML detectada e mapeada');
  console.log('🎯 Pronto para preencher automaticamente');
  
})();
