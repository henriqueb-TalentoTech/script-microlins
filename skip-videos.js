(function() {
  console.log('🚀 ===== INICIANDO BYPASS DE FINALIZAÇÃO =====');
  
  // 1. Verificar ambiente
  console.log('🔍 Verificando ambiente...');
  console.log('- window.API existe?', !!window.API);
  console.log('- window.parent existe?', !!window.parent);
  console.log('- É iframe?', window !== window.parent);
  
  // 2. Tentar via SCORM API
  if (window.API) {
    console.log('✅ API SCORM encontrada!');
    
    try {
      // Método 1: Status completed
      window.API.LMSSetValue("cmi.core.lesson_status", "completed");
      console.log('✓ Status setado para completed');
      
      // Método 2: Qualquer valor com "Congratulations"
      window.API.LMSSetValue("cmi.core.lesson_location", "Congratulations - Completed");
      console.log('✓ Location setado com Congratulations');
      
      // Método 3: Via outra chave
      window.API.LMSSetValue("cmi.suspend_data", "Congratulations");
      console.log('✓ Suspend data setado');
      
      // Commit as mudanças
      window.API.LMSCommit("");
      console.log('✓ Mudanças commitadas');
      
      // Método 4: Score máximo
      window.API.LMSSetValue("cmi.core.score.raw", "100");
      console.log('✓ Score setado para 100');
      
    } catch(e) {
      console.error('❌ Erro ao usar SCORM API:', e);
    }
  }
  
  // 3. Tentar via localStorage
  console.log('📦 Tentando via localStorage...');
  try {
    localStorage.setItem("cmi.core.lesson_status", "Congratulations - completed");
    localStorage.setItem("cmi.core.lesson_location", "Congratulations");
    localStorage.setItem("bypass", "Congratulations");
    console.log('✓ localStorage atualizado');
  } catch(e) {
    console.error('❌ Erro no localStorage:', e);
  }
  
  // 4. Tentar via postMessage
  console.log('📨 Tentando postMessage...');
  try {
    // Para a janela pai
    if (window.parent !== window) {
      window.parent.postMessage({
        func: "finalizacaoOther",
        message: "Você chegou ao final da aula!"
      }, "*");
      console.log('✓ PostMessage enviado para parent');
    }
    
    // Para a própria janela
    window.postMessage({
      func: "finalizacaoOther",
      message: "Você chegou ao final da aula!"
    }, "*");
    console.log('✓ PostMessage enviado para window');
    
  } catch(e) {
    console.error('❌ Erro no postMessage:', e);
  }
  
  // 5. Procurar e clicar em elementos de finalização
  console.log('🔍 Procurando elementos clicáveis...');
  const possibleIds = [
    'telaFinalizacao',
    'telaFinalizacaoOther1', 
    'telaFinalizacaoOther2',
    'div_requisitar_salvamento_tela'
  ];
  
  possibleIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      console.log(`✓ Elemento encontrado: ${id}`);
      try {
        el.click();
        console.log(`✓ Click executado em: ${id}`);
      } catch(e) {
        console.log(`⚠️ Erro ao clicar em ${id}:`, e.message);
      }
    }
  });
  
  // 6. Verificar estado final
  console.log('');
  console.log('📊 ===== ESTADO FINAL =====');
  if (window.API) {
    console.log('Status:', window.API.LMSGetValue("cmi.core.lesson_status"));
    console.log('Location:', window.API.LMSGetValue("cmi.core.lesson_location"));
    console.log('Score:', window.API.LMSGetValue("cmi.core.score.raw"));
  }
  console.log('LocalStorage:', {...localStorage});
  console.log('');
  console.log('✅ ===== SCRIPT FINALIZADO =====');
  
})();
