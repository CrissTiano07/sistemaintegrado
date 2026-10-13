# testes/ — Bateria do motor do NIT

Roda o `index.html` e o `nit.js` **reais** deste repositório num navegador simulado, com um Firebase falso em memória.
**Não acessa o Firebase de produção nem nenhum dado real.**

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão LTS).

```bash
cd testes
npm install      # só na primeira vez (baixa o jsdom)
npm test         # roda os cenários T01–T21
```

O resultado aparece na tela e é salvo em `testes/bateria-resultado.json`.

## Como ler o resultado

Cada cenário mostra `PASSOU`, `PARCIAL`, `FALHOU` ou `NÃO IMPLEMENTADO`, o que foi observado e a regra do contrato (`CONTRATO-ENTRADA-CEMOB.md`).

**Linha de base em 13/10/2026:**

```text
RESUMO { PASSOU: 8, PARCIAL: 3, FALHOU: 7, 'NÃO IMPLEMENTADO': 4 }
```

As falhas são **defeitos conhecidos do motor**, documentados no `HANDOFF.md` e no `TODO.md` — não são erros da bateria.

**Regra de uso:** antes de publicar uma mudança no `nit.js`, rode `npm test`.
- O resumo **igual ou melhor** que a linha de base → pode seguir.
- Algum cenário que **passava e passou a falhar** → a mudança quebrou algo. Não publique.

## Arquivos

| Arquivo | Função |
|---|---|
| `harness.js` | sobe o NIT simulado (navegador + Firebase falso + login de teste) |
| `bateria.js` | define e executa os cenários T01–T21 |
| `package.json` | fixa a versão do `jsdom` usada |

Ao corrigir um defeito, atualize a linha de base acima.
