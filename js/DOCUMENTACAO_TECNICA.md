# Documentação Técnica e Contextual - BelEnergy

## 1. Visão Geral e Objetivo
A aplicação **BelEnergy** é um sistema híbrido de **Gestão de Engenharia Solar (CRM/ERP)** e **Apresentação de Propostas Comerciais**.

*   **Objetivo:** Permitir que engenheiros cadastrem clientes, dimensionem sistemas fotovoltaicos complexos (com seleção de inversores Huawei, cálculo de perdas, ROI, Payback) e gerem propostas comerciais interativas e visualmente ricas para o cliente final.
*   **Estado Atual:** Aplicação SPA (Single Page Application) funcional baseada em JavaScript Vanilla (ES Modules). A persistência de dados administrativa é feita via `localStorage` (simulando um banco de dados), enquanto a visualização de propostas consome dados de uma API externa (Cloudflare Workers).
*   **Futuro:** Migração completa da persistência local para Cloudflare D1 (SQLite), implementação de autenticação robusta e refinamento da UX.

---

## 2. Arquitetura e Fluxo de Dados

### Frontend (MVC Simplificado)
A aplicação não usa frameworks (React/Vue), baseando-se em **Controladores JavaScript** que manipulam o DOM diretamente.

*   **Model:** `model.js` (Regras de negócio, cálculos financeiros/engenharia), `databaseService.js` (Persistência Local), `api.js` (Comunicação Externa).
*   **View:** Arquivos HTML estáticos que servem de esqueleto. O conteúdo real é injetado dinamicamente pelos Controllers.
*   **Controller:** Arquivos `*Controller.js` que unem a lógica e a interface.

### Estratégia de CSS (DIRETRIZ CRÍTICA)
*   **Arquivos CSS:**
    *   `style.css`: Estilos gerais, layout da proposta comercial e componentes visuais públicos.
    *   `engenharia.css`: Estilos específicos do painel administrativo (Dashboard, Gerador, Tabelas Técnicas).
*   **Regra de Ouro:** **NUNCA** criar blocos `<style>` dentro de arquivos HTML. Todo CSS estático deve residir nos arquivos `.css` acima, que já estão linkados nos HTMLs correspondentes.
*   **Exceção (CSS-in-JS):** Os Controllers (`geradorController.js`, etc.) **PODEM** gerar HTML dinâmico contendo estilos inline (`style="..."`) ou manipular `element.style` quando a lógica exigir (ex: cálculos de largura baseados em dados, cores condicionais de alerta, ocultação/exibição dinâmica). Preferencialmente, o JS deve alternar **classes CSS** pré-definidas.

---

## 3. Mapa de Arquivos e Responsabilidades

### Núcleo de Engenharia e Admin
1.  **`dashboardController.js`**:
    *   Controla a "Home" do engenheiro.
    *   Renderiza KPIs, listas de projetos recentes e navegação entre módulos (SPA).
    *   Gerencia a aba de "Premissas Globais" (configurações de custos, impostos, variáveis técnicas).

2.  **`geradorController.js` (O Cérebro):**
    *   **Função:** Motor de dimensionamento e geração de propostas.
    *   **Fluxo:** Recebe Cliente/Projeto -> Define Premissas -> Seleciona Módulos -> Dimensiona Inversores (Algoritmo de Sugestão Huawei) -> Calcula Financeiro (Markup, ROI).
    *   **Destaque:** Possui lógica complexa de "Carrinho de Inversores", validação de Overloading e suporte a propostas duplas (Standard vs Premium).

3.  **`clientesController.js`**:
    *   CRUD de clientes. Listagem, filtragem e cadastro.

4.  **`projetoController.js` & `projetoDetalhesController.js`**:
    *   Criação e visualização de projetos. Um Cliente pode ter N Projetos. Um Projeto pode ter N Propostas.

### Núcleo de Apresentação (Cliente Final)
5.  **`propostaController.js`**:
    *   Renderiza a proposta Solar final.
    *   **Funcionalidades:** Storytelling visual (scroll animations), simulação de financiamento em tempo real, alternância de temas (Premium/Standard), carrossel de imagens.
    *   Consome dados tratados pelo `model.js`.

6.  **`propostaServicosController.js`**:
    *   Variação do controlador acima focada exclusivamente em propostas de Serviços (sem equipamentos fotovoltaicos).

7.  **`indexController.js`**:
    *   Tela de login/consulta pública da proposta pelo cliente (input de ID e Nome).

### Serviços e Utilitários (Shared)
8.  **`databaseService.js`**:
    *   Abstração do `localStorage`. Simula um banco de dados com métodos `listar`, `salvar`, `buscarPorId`, `excluir`.
    *   Armazena: `db_clientes`, `db_projetos`, `db_propostas`, `config_premissas_globais`.

9.  **`model.js`**:
    *   Contém a "Inteligência" pura.
    *   Cálculos: `calcularFinanciamento` (Tabela Price), `dimensionarSistema`, `calcularRendimentoCientifico` (Perdas/PR).
    *   Dados Estáticos: Catálogo de Inversores Huawei, Base de Irradiação (Alagoas).
    *   Tratamento de Dados: Converte o JSON bruto da API/Storage para o formato de exibição da View.

10. **`api.js`**:
    *   Wrapper para `fetch`. Comunica-se com o Cloudflare Worker (`WORKER_URL`).
    *   Endpoints principais: `/solarmarket/...`, `/selic`, `/security/validate-hardware`.

11. **`utils.js`**:
    *   Funções de UI genéricas: Loading overlay, formatação de moeda, máscaras de input, animações de scroll (`IntersectionObserver`).

12. **`authController.js`**:
    *   Login administrativo simples (atualmente mockado/bypass).

---

## 4. Relacionamentos Críticos

*   **Cliente -> Projeto -> Proposta:**
    *   O fluxo de criação é estrito: Cria Cliente -> Cria Projeto (vinculado ao Cliente) -> Gera Proposta (vinculada ao Projeto).
    *   `sessionStorage` é usado para passar o contexto (`cliente_ativo_id`, `projeto_ativo_id`) entre as páginas durante a navegação.

*   **Gerador -> Model -> Database:**
    *   O `geradorController` usa funções matemáticas do `model.js` para calcular a engenharia, mas salva o resultado final (JSON da proposta) via `databaseService.js`.

*   **Proposta -> API/Model:**
    *   A visualização da proposta (`proposta.html`) não lê do `databaseService` (localStorage do admin). Ela lê da API (ou de um JSON exportado/simulado) processado pelo `model.js` (`buscarETratarProposta`).

---

## 5. Diretrizes para Manutenção e Expansão

1.  **CSS:**
    *   Ao criar novos elementos visuais no JS, atribua `className` e defina o estilo no `.css` correspondente.
    *   Use estilos inline via JS **apenas** para valores calculados (ex: `width: ${percentual}%`) ou estados transitórios (ex: `display: none`).

2.  **Lógica de Negócio:**
    *   Cálculos financeiros ou de engenharia devem ficar no `model.js`, não espalhados nos controllers.

3.  **Segurança:**
    *   O sistema possui validação de *Fingerprint* (`verificarAcessoDispositivo` em `model.js`) para restringir o acesso às propostas. Não remova essa lógica sem autorização explícita.

4.  **Persistência:**
    *   Atualmente, `databaseService.js` é síncrono (localStorage). Futuras implementações devem prepará-lo para ser assíncrono (Promises) visando a migração para D1.

---

## 6. Glossário de Variáveis Importantes

*   `hspBruto`: Horas de Sol Pleno (Irradiação) sem perdas.
*   `prFinal` / `rendimentoFinal`: Performance Ratio (Eficiência global do sistema após perdas).
*   `potenciaKwp`: Potência de pico do sistema (Soma dos módulos).
*   `overloading`: Relação Potência DC / Potência AC do inversor.
*   `tipoEscopo`: Define se a proposta é 'STANDARD', 'PREMIUM' ou 'AMBAS'.

---

*Este documento deve ser consultado antes de qualquer alteração estrutural ou estilização.*