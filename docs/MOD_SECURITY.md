# Modelo de Ameaça e Segurança de Mods em Rede (Item 778 P1)

## Visão Geral

O **Crom Planebox** permite que mods façam chamadas HTTP externas controladas para integração com serviços terceiros (como APIs de clima ou sintetizadores de voz). Por premissa de arquitetura, o jogo é **100% client-side** e roda inteiramente dentro do navegador do usuário.

Este documento formaliza o **Modelo de Ameaça de Rede de Mods** e o conjunto de mitigações de segurança aplicadas no motor (`src/mods/RedeDeMods.ts` e `src/mods/capacidades.ts`).

---

## 🛡 Princípios de Segurança

### 1. Manifesto Declarativo de Capacidades
- Nenhum mod pode realizar chamadas de rede arbitrárias.
- Cada host de destino deve ser explicitamente declarado no campo `capabilities.network.allow` do pacote do mod (`ModPackage`).

### 2. Consentimento Host-a-Host do Jogador
- Declarar o host no manifesto **não autoriza** o envio automático de dados.
- O jogador precisa aceitar explicitamente cada host para cada mundo em uma caixa de diálogo interativa.
- A revogação é imediata: remover o registro do banco de dados cancela o acesso ao host.

### 3. Redirecionamento e Credenciais Bloqueados
- **`redirect: 'error'`**: Impede que um servidor autorizado redirecione a requisição para um endpoint não autorizado de forma oculta.
- **`credentials: 'omit'`**: Impede o envio de cookies de sessão ou credenciais de navegação junto com a requisição do mod.
- **`referrerPolicy: 'no-referrer'`**: Remove o cabeçalho Referer para proteger a privacidade da URL do jogador.

### 4. Isolamento de Segredos e Redação
- Segredos (chaves de API, tokens) são mantidos em um cofre cifrado/isolado (`SecretVault`) e nunca viajam nos pacotes exportados ou sincronizações P2P.
- A função `redactSecrets()` mascara automaticamente qualquer padrão parecido com token (`sk-`, `Bearer`, `ghp_`, JWT) nos logs de auditoria e mensagens de erro.

### 5. Respostas de API Externa São Não-Confiáveis (Item 776 P1)
- Respostas recebidas de APIs remotas são tratadas como texto bruto não-confiável.
- As respostas passam por `sanitizeExternalApiResponse()` (remoção de HTML/scripts) e **nunca** são executadas como cÓdigo JavaScript nem injetadas diretamente como instruções de sistema para o agente IA.

---

## 🚫 Superfícies de Riscos Mitigados

| Risco / Ameaça | Vetor de Ataque | Mitigação Aplicada |
| :--- | :--- | :--- |
| **Exfiltração de dados** | Mod lê dados do mundo e envia via `POST` | `enviaDados` exige autorização explícita `rede.envia: true` |
| **Ataque CSRF/Session Hijacking** | Mod envia requisição para banco/serviço local | `credentials: 'omit'` (sem cookies do navegador) |
| **Contorno de Allowlist via HTTP 302** | Host `api.ok.com` redireciona para `malicious.com` | `redirect: 'error'` no `fetch` nativo |
| **Vazamento de Chaves de API** | Exportar mod com chave colada | Bloqueio `looksLikeSecret()` ao tentar gravar literal |
| **Ataques de Injeção de Prompt via API** | API retorna prompt contendo instrução nociva | Respostas tratadas como dados isolados, sanitizados |
| **Sobrecarga / Denial of Service** | Loop infinito de chamadas HTTP em script de mod | Rate-limiting por sessão + Timeout de 10s + Cache com TTL |
