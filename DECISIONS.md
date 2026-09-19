# DECISIONS.md — NIT

> Índice das decisões arquiteturais do NIT.
>
> Este arquivo é deliberadamente curto. A justificativa, contexto e consequências de cada decisão ficam em `docs/adr/`.

## Status

Os ADRs abaixo registram retroativamente **contratos arquiteturais já consolidados pela auditoria**. Eles não transformam itens apenas observados (`CONFIRMADO`) ou ainda abertos (`VALIDAR`) em decisões.

| ADR | Decisão | Status |
|---|---|---|
| [ADR-001](docs/adr/0001-identidade-da-ocorrencia-eventoid.md) | `eventoId` é a identidade forte da ocorrência | Aceita |
| [ADR-002](docs/adr/0002-firebase-como-estado-operacional.md) | Firebase RTDB mantém o estado operacional persistente | Aceita |
| [ADR-003](docs/adr/0003-frontend-resolve-identidade.md) | Frontend resolve identidade e continuidade antes da exportação | Aceita |
| [ADR-004](docs/adr/0004-separacao-estado-ocorrencia-operacional.md) | Estado da ocorrência e estado operacional são dimensões distintas | Aceita |
| [ADR-005](docs/adr/0005-reboques-dominio-independente.md) | Reboques permanece como domínio operacional independente | Aceita |
| [ADR-006](docs/adr/0006-google-sheets-destino-exportacao.md) | Google Sheets é destino de exportação, não banco operacional | Aceita |
| [ADR-007](docs/adr/0007-snapshot-mais-historico.md) | Semáforo usa modelo snapshot atual + histórico operacional | Aceita |

## Questões que NÃO são ADRs aceitos

Continuam abertas e não devem ser tratadas como decisão:

- `NORMALIZADO → PENDENTE`;
- histórico permanente de Reboques;
- política de persistência de Reboques entre plantões;
- executor automático de rendição agendada;
- scheduler/infraestrutura atual de `cron_export.py`;
- remoção definitiva de componentes marcados como legado/compatibilidade.

Quando uma dessas questões for decidida conscientemente, deve receber ADR próprio se tiver impacto arquitetural significativo.

## Regra de manutenção

ADRs aceitos não devem ser silenciosamente reescritos para combinar com uma mudança futura.

Se uma decisão arquitetural mudar:

1. criar novo ADR;
2. registrar a nova decisão e suas consequências;
3. marcar o ADR anterior como `Superseded`/substituído;
4. atualizar este índice;
5. atualizar os documentos estruturais afetados.

## Próxima etapa documental

`AI-INSTRUCTIONS.md`.
