  <script>
    // URL do backend que faz a ponte com a API SolarMarket
    const backendUrl = 'https://gdissolarproposta.vercel.app/api/proposta';

    // Estado para controlar o tema
    let currentTheme = 'alta_performance';

    // Mapeamento de temas com classes CSS
    const themes = {
      'alta_performance': { bodyClass: '', activeOptionClass: 'active-performance-option' },
      'economico': { bodyClass: 'economic-theme', activeOptionClass: 'active-economic-option' }
    };

    /**
     * Aplica o tema selecionado ao corpo do documento.
     * @param {string} themeName - 'alta_performance' ou 'economico'.
     */
    function applyTheme(themeName) {
      document.body.className = themes[themeName].bodyClass;
      currentTheme = themeName;
      document.querySelectorAll('.option.selected').forEach(option => {
        option.classList.remove('selected', themes['alta_performance'].activeOptionClass, themes['economico'].activeOptionClass);
      });
      document.querySelector(`.${themeName}-option`).closest('.option').classList.add('selected', themes[themeName].activeOptionClass);
    }

    /**
     * Atualiza os valores na interface do usuário com os dados da proposta.
     * @param {Object} proposta - O objeto da proposta retornado pelo backend.
     */
    function atualizarValores(proposta) {
      if (!proposta || !proposta.valor_total) {
        // Se a proposta não for encontrada, limpa os campos e exibe uma mensagem
        // Limpar valores
        document.getElementById('proposta-total-price').textContent = "R$ 0,00";
        document.getElementById('proposta-installment').textContent = "R$ 0,00";
        document.getElementById('payback-years').textContent = "0 anos";
        document.getElementById('total-solar-price').textContent = "R$ 0,00";
        document.getElementById('solar-system-power').textContent = "0 kWp";
        document.getElementById('monthly-savings').textContent = "R$ 0,00";
        document.getElementById('min-monthly-installment').textContent = "R$ 0,00";
        document.getElementById('payback-years-big').textContent = "0 anos";
        
        // Exibe uma mensagem de erro ou sem dados
        const messageBox = document.getElementById('message-box');
        messageBox.textContent = "Proposta não encontrada. Por favor, verifique o ID do projeto ou entre em contato com o suporte.";
        messageBox.classList.remove('hidden', 'success', 'warning');
        messageBox.classList.add('error');

        return;
      }
      
      // Formata os valores monetários em BRL
      const formatCurrency = (value) => `R$ ${parseFloat(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      
      const totalCost = parseFloat(proposta.totalCost);
      const installment = parseFloat(proposta.pricingTable.find(item => item.category === 'Entrada e Parcelas').items.find(subItem => subItem.name === 'Valor da parcela').qnt);
      const paybackYears = proposta.pricingTable.find(item => item.category === 'ROI e Payback').items.find(subItem => subItem.name === 'Payback (Anos)').qnt;
      const totalPower = parseFloat(proposta.pricingTable.find(item => item.category === 'Sistema').items.find(subItem => subItem.name.includes('Potência do Sistema')).qnt);
      const monthlySavings = parseFloat(proposta.pricingTable.find(item => item.category === 'Simulação de Economia').items.find(subItem => subItem.name === 'Economia Mensal').qnt);

      document.getElementById('proposta-total-price').textContent = formatCurrency(totalCost);
      document.getElementById('proposta-installment').textContent = formatCurrency(installment);
      document.getElementById('payback-years').textContent = `${paybackYears} anos`;
      document.getElementById('total-solar-price').textContent = formatCurrency(totalCost);
      document.getElementById('solar-system-power').textContent = `${totalPower} kWp`;
      document.getElementById('monthly-savings').textContent = formatCurrency(monthlySavings);
      document.getElementById('min-monthly-installment').textContent = formatCurrency(installment);
      document.getElementById('payback-years-big').textContent = `${paybackYears} anos`;
    }

    /**
     * Reverte o estado do botão "Consultar" para o seu estado inicial.
     */
    function resetButtonState() {
      const btn = document.getElementById('search-btn');
      btn.textContent = 'Consultar';
      btn.disabled = false;
    }

    /**
     * Exibe uma mensagem na caixa de mensagem do UI.
     * @param {string} message - A mensagem a ser exibida.
     * @param {string} type - O tipo da mensagem ('success', 'error', 'warning').
     */
    function showMessage(message, type) {
      const messageBox = document.getElementById('message-box');
      messageBox.textContent = message;
      messageBox.classList.remove('hidden', 'success', 'error', 'warning');
      messageBox.classList.add(type);
    }
    
    /**
     * Consulta a proposta ativa de um cliente chamando o backend.
     * @param {string} projectId - O ID do projeto.
     */
    async function consultarPropostaPorId(projectId) {
        const btn = document.getElementById('search-btn');
        btn.textContent = 'Aguarde...';
        btn.disabled = true;
        showMessage('Buscando proposta...', 'warning');

        try {
            const res = await fetch(`${backendUrl}?projectId=${projectId}`);
            
            if (!res.ok) {
                // Se a resposta não for 'ok' (por exemplo, 404), lança um erro para o bloco 'catch'
                let errorMessage = `Erro HTTP: ${res.status}`;
                const errorBody = await res.json().catch(() => ({}));
                if (errorBody.error) {
                    errorMessage = `Erro: ${errorBody.error}`;
                } else if (errorBody.message) {
                    errorMessage = `Erro: ${errorBody.message}`;
                }
                throw new Error(errorMessage);
            }
            
            const dados = await res.json();
            
            if (dados) {
                // Se os dados da proposta forem encontrados, atualiza a UI
                atualizarValores(dados);
                showMessage('Proposta encontrada com sucesso!', 'success');
            } else {
                // Se o backend retornar sucesso, mas sem dados, trata como erro
                throw new Error('Proposta não encontrada.');
            }

        } catch (err) {
            // Em caso de qualquer erro, exibe a mensagem de erro.
            console.error("Erro ao consultar proposta:", err);
            showMessage(err.message || 'Erro desconhecido ao consultar a proposta.', 'error');
            
        } finally {
            // Este bloco SEMPRE será executado, garantindo que o botão volte ao normal.
            resetButtonState();
        }
    }

    // Event listener para o formulário
    document.getElementById('search-form').addEventListener('submit', function(e) {
      e.preventDefault();
      const projectId = document.getElementById('project-id-input').value.trim();
      if (projectId) {
        consultarPropostaPorId(projectId);
      } else {
        showMessage('Por favor, insira o ID do projeto.', 'warning');
      }
    });

    // Event listeners para os botões de tema
    document.querySelector('.high-performance-option').closest('.option').addEventListener('click', () => applyTheme('alta_performance'));
    document.querySelector('.economic-theme-option').closest('.option').addEventListener('click', () => applyTheme('economico'));
    
    // Configura o tema padrão na inicialização
    applyTheme('alta_performance');
  </script>
