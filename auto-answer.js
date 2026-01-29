(function() {
  // ═══════════════════════════════════════════════════════════
  // PARTE 1: LÓGICA ORIGINAL (PRESERVADA)
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

  function clicarAlternativa(indice) {
    const radioInput = document.querySelector(`input[type="radio"][id="${indice}"]`);
    if (radioInput) {
      radioInput.click();
      radioInput.dispatchEvent(new Event('change', { bubbles: true }));
      const label = radioInput.closest('label');
      if (label) label.click();
      return true;
    }
    const label = document.querySelector(`label[for="${indice}"]`);
    if (label) { label.click(); return true; }
    const alternativas = document.querySelectorAll('.alternative-box label');
    if (alternativas && alternativas[indice]) { alternativas[indice].click(); return true; }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // PARTE 2: INTERFACE COMPACTA E DISCRETA
  // ═══════════════════════════════════════════════════════════

  function criarInterface() {
    const oldUI = document.getElementById('compact-auto-ui');
    if (oldUI) oldUI.remove();
    
    const ui = document.createElement('div');
    ui.id = 'compact-auto-ui';
    ui.innerHTML = `
      <style>
        #compact-auto-ui {
          position: fixed;
          top: 10px;
          right: 10px;
          background: #1a1a1a;
          color: #d1d1d1;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #333;
          z-index: 2147483647;
          font-family: monospace;
          font-size: 11px;
          width: 160px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.5);
          user-select: none;
        }
        #compact-auto-ui .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #333;
          padding-bottom: 4px;
          margin-bottom: 6px;
          cursor: move;
        }
        #compact-auto-ui .status {
          color: #b8c0ff; /* Pastel Blue */
          margin-bottom: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #compact-auto-ui .progress-bar {
          height: 4px;
          background: #2a2a2a;
          margin-bottom: 8px;
        }
        #compact-auto-ui .progress-fill {
          height: 100%;
          background: #b7e4c7; /* Pastel Green */
          width: 0%;
        }
        #compact-auto-ui button {
          width: 100%;
          background: #2a2a2a;
          border: 1px solid #444;
          color: #d1d1d1;
          padding: 4px;
          cursor: pointer;
          font-family: monospace;
          font-size: 10px;
          margin-bottom: 2px;
        }
        #compact-auto-ui button:hover { background: #333; }
        #compact-auto-ui button:disabled { color: #555; cursor: not-allowed; }
        #compact-auto-ui .close-btn { color: #ffadad; border-color: #553333; }
      </style>
      
      <div class="header" id="compact-header">
        <span>AUTO-V6</span>
        <span id="min-btn" style="cursor:pointer">_</span>
      </div>
      
      <div id="compact-content">
        <div id="status" class="status">BUSCANDO...</div>
        <div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
        <button id="btn-start" disabled>INICIAR</button>
        <button id="btn-close" class="close-btn">FECHAR</button>
      </div>
    `;
    
    document.body.appendChild(ui);

    // Arrastar
    const header = ui.querySelector('#compact-header');
    let isDragging = false, currX, currY, initX, initY, xOff = 0, yOff = 0;
    header.onmousedown = (e) => { initX = e.clientX - xOff; initY = e.clientY - yOff; isDragging = true; };
    document.onmousemove = (e) => {
      if (isDragging) {
        currX = e.clientX - initX; currY = e.clientY - initY;
        xOff = currX; yOff = currY;
        ui.style.transform = `translate3d(${currX}px, ${currY}px, 0)`;
      }
    };
    document.onmouseup = () => { isDragging = false; };

    return ui;
  }

  const ui = criarInterface();
  const statusEl = document.getElementById('status');
  const btnStart = document.getElementById('btn-start');
  const btnClose = document.getElementById('btn-close');
  const progressFill = document.getElementById('progress-fill');
  const content = document.getElementById('compact-content');
  const minBtn = document.getElementById('min-btn');

  let gabarito = null, isRunning = false;

  minBtn.onclick = () => { content.style.display = content.style.display === 'none' ? 'block' : 'none'; };
  btnClose.onclick = () => ui.remove();

  setTimeout(() => {
    gabarito = buscarGabarito();
    if (!gabarito) {
      statusEl.innerText = "OFFLINE";
      statusEl.style.color = "#ffadad";
    } else {
      statusEl.innerText = "PRONTO: " + gabarito.length + "Q";
      btnStart.disabled = false;
    }
  }, 800);

  btnStart.onclick = async () => {
    if (isRunning) return;
    isRunning = true;
    btnStart.disabled = true;
    btnStart.innerText = "RODANDO...";
    
    const modoAtual = localStorage.getItem('tela');
    let currentQuestion = (modoAtual && parseInt(modoAtual) > 0) ? parseInt(modoAtual) - 1 : 0;
    
    for (let i = currentQuestion; i < gabarito.length; i++) {
      statusEl.innerText = `Q${i+1}/${gabarito.length}`;
      progressFill.style.width = ((i + 1) / gabarito.length * 100) + '%';
      
      await new Promise(r => setTimeout(r, 500));
      if (!clicarAlternativa(gabarito[i])) {
        statusEl.innerText = "ERRO Q" + (i+1);
        isRunning = false; btnStart.disabled = false; btnStart.innerText = "RETOMAR";
        return;
      }
      
      await new Promise(r => setTimeout(r, 600));
      if (i < gabarito.length - 1) {
        const next = document.querySelector('.nav_buttons_right');
        if (next) { next.click(); await new Promise(r => setTimeout(r, 1000)); }
        else { statusEl.innerText = "FIM DA TELA"; isRunning = false; btnStart.disabled = false; return; }
      }
    }
    statusEl.innerText = "CONCLUÍDO";
    btnStart.innerText = "FIM";
  };

})();
