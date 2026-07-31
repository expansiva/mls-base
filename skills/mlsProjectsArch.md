## Arquitetura aplicativo cliente em produção 

mls-base/
    mls-102033/
        // master frontend, rotinas comuns para todos os aplicativos em produção 
    mls-102034/
        // master backend , rotinas comuns para todos os aplicativos em produção
    mls-102030/
        // app final gerado, pode ser o 102051, etc

        l1/
            // back-end, hexagonal model
            petshop/
                layer_1_external/
                layer_2_application/
                layer_3_domain/
            stripe/
                // um plugin irá ter um endpoint e pode atender a vários módulos 
                // como o módulo stripe é criado após o módulo petshop, além de definir as funcionalidades deve ter um arquivo de configuração para o plugin saber quais módulos, etc 
        l2/
            // front-end
            petshop/
                // nome do módulo = petshop, um projeto pode ter vários módulos
                web/
                    contracts/
                    shared/
                    desktop/
                        page11/
                            // dispositivo = web / desktop
                            // page11 = layout 1 , DS 1 

            plugins/ 
                stripe/
                    // rotinas para conexão com este plugin
                    // a criação de um novo plugin pode ser feito pelo agentNewSolution após ajustes
            financeiro/
                // módulo horizontal 
        l3/
            // assets
        l4/
            // business
            petshop/
        l5/
            // admin
            config.json
            project.json -> plan, lista de módulos, etc, seguir modelo 
            petshop/

        