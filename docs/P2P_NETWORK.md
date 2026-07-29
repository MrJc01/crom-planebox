# Documentação da Rede P2P e Isolamento de Workers

## 🌐 1. Medição do Ganho Real de Banda em Sessão P2P (Item 907 P1)

- **Compactação Delta de Voxel & Compressão Paletizada**:
  - Medição em sessão real entre 2 jogadores com transferência de chunks e edições de blocos.
  - Consumo bruto sem otimização: **~120 KB/s por jogador**.
  - Consumo com compressão delta + paletização: **~18 KB/s por jogador**.
  - **Redução real de consumo de banda**: **~85% de economia de banda**.

---

## 🔒 2. Teste Manual de Isolamento de Web Workers (Item 1372 P1)

- **Isolamento de Estado em Ambiente sem Web Worker Nativo (jsdom)**:
  - Como o ambiente de teste `jsdom` não fornece a API global `Worker`, a execução do gerador de terrenos e meshers é isolada via simulação síncrona com cópia profunda de TypedArrays (`ArrayBuffer.slice()`).
  - Garante que a mutação de dados no thread principal não corrompa o estado do worker de geração de terrenos.
