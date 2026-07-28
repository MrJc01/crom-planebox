# Receitas Prontas de Mods (Item 892 P1)

Este documento contém receitas de código prontas e modelos executáveis para autores de mods e agentes de IA criarem funcionalidades comuns no **Crom Planebox**.

---

## 📋 1. Reagir a Bloco Quebrado
*Executa um efeito ou concede recompensas quando o jogador quebra um determinado bloco.*

```javascript
mod.on('block_break', (evt) => {
  // evt = { x, y, z, blockId, player }
  if (evt.blockId === B.GOLD_BLOCK) {
    console.log(`[Mod] Bloco de ouro quebrado em (${evt.x}, ${evt.y}, ${evt.z})!`);
    mod.setBlock(evt.x, evt.y + 1, evt.z, B.GLOWSTONE);
  }
});
```

---

## 🌲 2. Gerar Estrutura Procedural ao Redor do Jogador
*Cria uma pequena cabana de madeira procedural.*

```javascript
mod.on('player_spawn', (evt) => {
  const px = Math.floor(evt.x);
  const py = Math.floor(evt.y);
  const pz = Math.floor(evt.z);

  // Base de madeira
  mod.fillBox(px - 2, py - 1, pz - 2, px + 2, py - 1, pz + 2, B.WOOD);
  // Paredes ocas de tábua
  mod.fillBox(px - 2, py, pz - 2, px + 2, py + 2, pz + 2, B.PLANK);
  mod.fillBox(px - 1, py, pz - 1, px + 1, py + 2, pz + 1, B.AIR);
  // Porta
  mod.setBlock(px, py, pz - 2, B.AIR);
  mod.setBlock(px, py + 1, pz - 2, B.AIR);
});
```

---

## ☀️ 3. Reagir ao Ciclo do Dia / Noite
*Troca iluminação de ilhas ou spawner quando a noite chega.*

```javascript
mod.on('time_change', (evt) => {
  // evt = { hora, faseDoDia }
  if (evt.faseDoDia === 'noite') {
    console.log('[Mod] A noite caiu! Ativando feitiços de proteção...');
  }
});
```
