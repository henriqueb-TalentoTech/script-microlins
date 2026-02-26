## skip-video
Script JavaScript que **força a conclusão de aulas SCORM**, simulando que o vídeo foi assistido até o final.  
Na prática, **pula aulas** e libera o progresso sem precisar assistir todo o conteúdo.

--- 
## auto-answer
Script JavaScript que **responde automaticamente as perguntas** com base no gabarito real.
Na prática, **responde as perguntas sozinho** com 100% de acerto.

---

## Como usar
1. Abra a aula no navegador  
2. Pressione **F12** para abrir o **console**
3. Cole o script no console
4. Pressione **Enter**

A aula será marcada como concluída em poucos segundos.

---

## automatizer
Script para **Tampermonkey** que automatiza a conclusão de todas as atividades do Portal do Aluno Microlins.  
Detecta e executa automaticamente cada tipo de atividade: teórico, mão na massa, pense e responda, questionamento e teste seus conhecimentos (com gabarito automático).

### Como usar
1. Instale a extensão **Tampermonkey** no navegador
2. Crie um novo script e cole o conteúdo do `automatizer.js`
3. Salve e acesse o **Portal do Aluno** (portaldoaluno.microlins.com.br)
4. Um painel **ML AUTO v5.0.0** aparecerá no canto inferior direito
5. Clique em **INICIAR** — o script abrirá e concluirá todas as atividades automaticamente

O script retoma de onde parou caso a página recarregue durante a execução.
