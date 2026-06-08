## Arquitetura aplicativo cliente em produção 

legenda:
    plan , gerado no planejamento , geralmente .defs.ts
    mat1 , gerado no materialize planejamento, geralmente .defs.ts mais específico
    mat2 , gerado no materialize, arquivos .ts , etc 
    adefinir , ainda não decidido

mls-base/
    mls-102033/
        // master frontend, rotinas comuns para todos os aplicativos em produção 
    mls-102034/
        // master backend , rotinas comuns para todos os aplicativos em produção
    mls-102030/
        config.json -> mat2, conexões com o master frontend e master backend , de uma forma a publicar o que é necessário para o menu e endpoints

        l1/
            // parcial back-end, estrutura inicial no master backend 
            petshop/
                layer_1_external/
                    // um componente para cada tabela real no módulo
                    // somente o layer_3 pode chamar estas tabelas, passando o contexto
                    // o contexto define a implementação da tabela , pode ser memória, postgres, etc , através de funções de acesso
                    product.defs.ts -> plan, definição da tabela externa
                layer_2_controllers/
                    updateProduct.defs.ts -> mat1, definição dos endpoints, contract
                    stripe.defs.ts -> adecidir, opcional, pode ficar em um folder acima , um endpoint para vários módulos ou aqui
                layer_3_usecases/
                    agendamento.defs.ts -> plan
                mock/
                    agendamento.ts -> mat1, melhor o mock ficar no backend, package.json deve ter comando para migrar e preencher as tabelas
            stripe/
                // um plugin irá ter um endpoint e pode atender a vários módulos 
                // como o módulo stripe é criado após o módulo petshop, além de definir as funcionalidades deve ter um arquivo de configuração para o plugin saber quais módulos, etc 
        l2/
            // front-end
            petshop/
                // nome do módulo = petshop, um projeto pode ter vários módulos

                updateProduct.defs.ts -> plan, definição da página e contrato BFF
                web/
                    shared/
                        updateProduct.defs.ts -> mat1, rotinas para BFF cliente, rotinas comuns na web
                    desktop/
                        page11/
                            // dispositivo = web / desktop
                            // page11 = layout 1 , DS 1 
                            updateProduct.defs.ts -> mat1, definição final da página com layout , moléculas (web componentes), etc
                assets/
                    image1.jpg
                plugins/
                    stripe.defs.ts -> plan, definição de conexão com o módulo plugin (conector)
                trace/
                    // assets intermediário gerado pelo agente, pode ser deletado

            plugins/ 
                stripe/
                    // rotinas para conexão com este plugin
                    // a criação de um novo plugin pode ser feito pelo agentNewSolution após ajustes
            financeiro/
                // módulo horizontal 
        l4/
            workflows/
                agendamentoPet.defs.ts -> plan, um workflow pode ser passar por vários módulos
        l5/
            // admin
            project.json -> plan, lista de módulos, etc, seguir modelo 
            petshop/
                module.defs.ts -> plan, definição geral do módulo 
                rules.defs.ts -> plan, rules que devem ser seguidos por l1 e l2

        