# Guia de CORS e Chamadas HTTP em Mods (Item 779 P1)

## O que é CORS e por que afeta os Mods?

O **Crom Planebox** é uma aplicação web 100% client-side que executa diretamente no navegador do usuário.

Quando um script de mod faz uma chamada de rede para um servidor externo usando `modFetch` / `RedeDeMods`, a requisição parte da origem do navegador. Por padrão, a política de **SOP (Same-Origin Policy)** dos navegadores bloqueia requisições assíncronas (`fetch`) para domínios diferentes, a menos que o servidor remoto responda com os cabeçalhos **CORS (Cross-Origin Resource Sharing)** apropriados.

---

## ⚙ Requisitos para um Endpoint Funcionar em Mods

Para que uma API externa responda com sucesso às chamadas dos mods no Crom Planebox, o servidor remoto **DEVE** incluir no seu cabeçalho HTTP de resposta:

```http
Access-Control-Allow-Origin: *
```
ou especificar a origem exata de onde o jogo está sendo servido.

Se o mod enviar cabeçalhos customizados, o servidor também deve declarar:
```http
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## 🔍 Como Tratar Falhas de CORS em Mods

Se a API não suportar CORS, a requisição falhará no navegador com `TypeError: Failed to fetch`.

O motor de rede do jogo detecta automaticamente esse tipo de erro através de `detectCorsError()` (em `src/net/wire.ts`) e exibe uma mensagem informativa explicativa:

> *"A requisição para [servidor] falhou por restrição de CORS (Cross-Origin Resource Sharing). O navegador impede conexões de páginas locais a APIs que não declarem o cabeçalho 'Access-Control-Allow-Origin'."*

### Soluções Recomendadas para Desenvolvedores de Mods:

1. **Usar Endpoints Públicos com CORS Habilitado**:
   - APIs públicas como OpenWeatherMap, ElevenLabs, etc. já fornecem suporte a CORS por padrão.
2. **Utilizar um Reverse Proxy com CORS**:
   - Caso precise conectar a uma API que não envia cabeçalhos CORS, utilize um proxy intermediário (como Cloudflare Workers ou NGINX) que adicione `Access-Control-Allow-Origin: *`.
3. **Modo Offline com Degradação Elegante**:
   - Utilize o método `chamarComDegradacao` ou envolva a chamada em `try/catch` para garantir que a indisponibilidade da API não interrompa a simulação ou lógica do mod.
