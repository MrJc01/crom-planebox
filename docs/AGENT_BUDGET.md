# Diretrizes de Orçamento de Blocos e Tempo para Agentes IA (Item 893 P1)

## Propósito

Durante tarefas longas de geração e construção no **Crom Planebox**, os agentes de IA devem estimar e respeitar o **orçamento de blocos** e o **orçamento de tempo de execução** para dividir tarefas complexas em etapas menores e manter a fluidez do jogo.

---

## 📊 Limites Recomendados por Chamada

| Tipo de Operação | Limite Máximo Recomendado | Comportamento ao Exceder |
| :--- | :--- | :--- |
| `fill_box` (Preenchimento) | **50.000 voxels** por chamada | Dividir a estrutura em múltiplos volumes ou sub-volumes. |
| `execute_voxel_script` | **100.000 alterações de blocos** | Dividir em lotes com `yield`/frames intermediários. |
| Tempo de Execução por Script | **5.000 ms** (5 segundos) | Script é abortado com erro de timeout para não travar a UI. |
| Alterações por Sessão de Chat | **500 operacoes de escrita** | Notificar aviso de orçamento (`check_session_budget`). |

---

## 💡 Melhores Práticas para Divisão de Tarefas

1. **Construção em Camadas**:
   - Edifícios grandes (como castelos ou vilas) devem ser construídos por etapas: **Fundações → Paredes Externas → Telhado → Interiores/Detalhes**.
2. **Snapshot Visual por Etapa**:
   - Chamar `capture_snapshot` após concluir cada etapa importante para verificar a qualidade visual antes de prosseguir para a próxima.
3. **Uso de Estruturas Pré-Modeladas**:
   - Para elementos repetitivos (árvores, torres, casas pequenas), utilizar templates registrados (`STRUCTURE_TEMPLATES`) em vez de gerar cada bloco individualmente por loops.
