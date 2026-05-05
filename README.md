# Organizador de Contas

Aplicação web **100% no navegador** para organizar renda, despesas fixas e pontuais em reais (BRL). Os dados ficam no **armazenamento local** do seu navegador; não há servidor nem conta — use **Exportar JSON** periodicamente como backup.

## O que o projeto faz

- **Visão geral por mês**: navegue entre meses, cadastre **fontes de renda** (com opção de renda só naquele mês), defina **meta de poupança** global ou por mês e veja **receita**, **despesas recorrentes**, **despesas temporárias** e **saldo estimado** do período.
- **Contas**: adicione despesas **recorrentes** (com dia de vencimento) ou **temporárias** (data limite, parcelas ou prazo automático a partir da data final), com **categorias** (moradia, serviços, transporte, etc.). Marque itens como **pagos no mês**, edite ou exclua, e filtre por tipo/categoria.
- **Gráficos**: projeção **mês a mês** (Chart.js) com despesas por categoria, linhas de receita e total em contas; totais de débito e crédito projetados no horizonte escolhido (6 / 12 / 24 meses).
- **Contas vencendo**: lista o que vence nos próximos **1, 7 ou 14 dias** (referência: data de hoje).
- **Investir & reserva**: simulação com percentuais do “sobra mensal” para **reserva de emergência** (referência Caixinha ~CDI) e **investimento**, com cenários de taxa (CDI, renda fixa, poupança) e gráficos de aporte, juros e saldo.
- **Importar / exportar JSON**: leve seus dados para outro computador ou faça cópia de segurança.

## Como usar

Abra o arquivo `index.html` no navegador (duplo clique ou sirva com um servidor estático local se preferir). Não é necessário Node nem build.

## Tecnologias

- HTML, CSS e JavaScript (vanilla)
- [Chart.js](https://www.chartjs.org/) (via CDN) para os gráficos
- Fontes: DM Sans e JetBrains Mono (Google Fonts)

## Licença

Use e adapte conforme a licença do repositório, se houver.
