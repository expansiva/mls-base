# agentReviewSolution

Agente privado do projeto `102035` para revisar uma revisão L4 já selada. Recebe projeto pelo host e
uma invocação estruturada com módulo, base, pasta temporária, pedido e revisão esperada.

Fluxo atual: `entry10` congela identidade, hashes e contexto real; `review20` produz uma proposta
estruturada; `reconcile30` diagnostica dependências; `validate40` executa os gates; `correction45`
pode restaurar somente um escalar exato apontado por erro ao valor da base congelada; `finalize50`
reconstrói os bytes da revisão selada e publica exclusivamente com permit autoritativo.

Correção é privada, determinística e limitada a três tentativas por `requestKey`. O contador aumenta
somente quando uma mutação segura realmente ocorre e fica persistido junto com o draft corrigido nos
resultados da task. Retomada recompõe a cadeia e não zera o contador. Sem alvo seguro, preserva draft
e contador e termina fechado.

Antes de marcar ou publicar, `finalize50` recompõe a cadeia completa até o contador final autoritativo
e reexecuta a validação determinística. Draft, áreas, diagnóstico, contador ou cadeia adulterados são
recusados antes de qualquer escrita.

O agente não edita o L4 original, não chama planners/materializadores, não executa implementação e
não expõe UI ou CLI compartilhado.
