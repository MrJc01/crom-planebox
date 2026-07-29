# Protocolo de Rede — Crom-Planebox

> Documentação do formato de quadro e limiar de fragmentação — item 913 P2.

## Formato de Quadro (Frame Format)

Cada quadro P2P enviado entre pares segue esta estrutura:

| Offset (bytes) | Campo            | Tipo      | Descrição                                    |
|-----------------|------------------|-----------|----------------------------------------------|
| 0               | `magic`          | `u16`     | Identificador do protocolo (`0xCB01`)        |
| 2               | `version`        | `u8`      | Versão do protocolo (atualmente `2`)         |
| 3               | `flags`          | `u8`      | Bit 0: comprimido, Bit 1: fragmentado        |
| 4               | `sequenceId`     | `u32`     | ID de sequência para reordenação             |
| 8               | `payloadLength`  | `u32`     | Tamanho do payload em bytes                  |
| 12              | `payload`        | `u8[N]`   | Dados (bloco, entidade, voz, etc.)           |

## Limiar de Fragmentação

- **MTU padrão WebRTC DataChannel**: 16 KB (16.384 bytes)
- **Limiar de fragmentação**: Quadros com `payloadLength > 14.000 bytes` são fragmentados automaticamente.
- **Estratégia**: Split-and-reassemble com `sequenceId` incremental e flag `fragmented`.

## Tipos de Payload

| Tipo   | Código | Descrição                              |
|--------|--------|----------------------------------------|
| BLOCK  | `0x01` | Atualização de bloco                   |
| ENTITY | `0x02` | Sincronização de entidade              |
| VOICE  | `0x03` | Quadro de áudio de voz P2P            |
| CHAT   | `0x04` | Mensagem de chat                       |
| SYNC   | `0x05` | Full sync (regeneração por semente)    |
| MOD    | `0x06` | Dados de mod (código, assets)          |

## Segurança

- Segredos e dados públicos trafegam em **fluxos comprimidos distintos** (prevenção de ataques CRIME/BREACH).
- Cada mod possui escopo de segredo isolado.
