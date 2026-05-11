# .mente — Knowledge Base do PortalHotel

Vault Obsidian com todo o conhecimento necessário para desenvolver e manter o PortalHotel.

## Estrutura

```
.mente/
├── dominio/                    # Conhecimento do negócio hoteleiro
│   ├── hotelaria-conceitos.md  # Terminologia, cálculos, boas práticas
│   └── reservas-regras-negocio.md  # Regras de reserva, pricing, status
│
├── tecnico/                    # Decisões e arquitetura do projeto
│   ├── arquitetura-decisoes.md # ADRs — por que construímos assim
│   └── stack-e-bibliotecas.md  # Stack completo, env vars, padrões
│
├── bibliotecas/                # Referências das libs usadas
│   (adicionar notas de uso específico por biblioteca)
│
└── bugs/                       # Bugs conhecidos e workarounds
    └── bugs-conhecidos.md      # Inventário completo com severidade
```

## Como usar

- Antes de implementar uma feature: leia `dominio/` para entender o negócio
- Antes de mudar lógica de reservas: leia `dominio/reservas-regras-negocio.md`
- Ao encontrar um bug: registre em `bugs/bugs-conhecidos.md`
- Ao tomar uma decisão técnica: documente em `tecnico/arquitetura-decisoes.md` como ADR

## Wikilinks

As notas usam wikilinks Obsidian (`[[nota]]`) para se referenciar.

Exemplo: `[[bugs-conhecidos#overbooking]]` linkaa para a seção `overbooking` em `bugs-conhecidos.md`.

---
*Criado: 2026-05-11 | Projeto: PortalHotel*
