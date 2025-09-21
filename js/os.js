import { addDoc, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, osCollectionRef, allServiceOrders, allTechnicians } from './main.js';
import { callGeminiApi, generateDocument, statusColors, activeStatuses } from './utils.js';

const osForm = document.getElementById('os-form');
const osTableBody = document.querySelector('#os-table tbody');
const emptyState = document.getElementById('empty-state');
const modal = document.getElementById('details-modal');
const modalContentMain = document.getElementById('modal-content-main');
const modalContentClosed = document.getElementById('modal-content-closed');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalForm = document.getElementById('modal-form');
const defeitoTextarea = document.getElementById('defeito_relatado');
const btnDiagnostico = document.getElementById('btn-diagnostico');
const diagnosticoSugestaoDiv = document.getElementById('diagnostico-sugestao');
const searchInput = document.getElementById('search-os');
const filterAbertasBtn = document.getElementById('filter-abertas');
const filterFechadasBtn = document.getElementById('filter-fechadas');
const btnGerarLaudo = document.getElementById('btn-gerar-laudo');
const btnGerarResumo = document.getElementById('btn-gerar-resumo');
const resumoClienteDiv = document.getElementById('resumo-cliente');
const btnGerarMensagem = document.getElementById('btn-gerar-mensagem');
const mensagemStatusContainer = document.getElementById('mensagem-status-container');
const mensagemStatusTexto = document.getElementById('mensagem-status-texto');
const btnCopiarMensagem = document.getElementById('btn-copiar-mensagem');
let currentOsFilter = 'abertas';

export function setupOsEventListeners() {
    osForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        const formData = new FormData(osForm);
        const dataEntrada = new Date();
        const novaOS = {
            nome_cliente: formData.get('nome_cliente'),
            contato_cliente: formData.get('contato_cliente'),
            tipo_equipamento: formData.get('tipo_equipamento'),
            equipamento: formData.get('equipamento'),
            defeito_relatado: formData.get('defeito_relatado'),
            status: 'A Aguardar Análise',
            data_entrada: dataEntrada.toLocaleString('pt-BR'),
            servico_executado: '',
            timestamp: serverTimestamp(),
            tecnicoId: user.uid,
            tecnicoNome: user.displayName,
            status_final: null,
            data_saida: null,
            pecas: [],
            mao_de_obra: ''
        };
        try {
            await addDoc(osCollectionRef, novaOS);
            osForm.reset();
        } catch (error) {
            console.error("Erro ao adicionar OS: ", error);
        }
    });

    modalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const osId = document.getElementById('modal-os-hidden-id').value;

        const pecasRows = document.querySelectorAll('#pecas-list .peca-row');
        const pecasArray = [];
        pecasRows.forEach(row => {
            const nome = row.querySelector('.peca-nome').value;
            const valor = parseFloat(row.querySelector('.peca-valor').value) || 0;
            if (nome) {
                pecasArray.push({ nome, valor });
            }
        });

        const tecnicoSelect = document.getElementById('modal-tecnico-responsavel');
        const newTechId = tecnicoSelect.value;
        const newTech = allTechnicians.find(t => t.id === newTechId);

        try {
            await updateDoc(doc(osCollectionRef, osId), {
                pecas: pecasArray,
                mao_de_obra: document.getElementById('modal-mao_de_obra').value,
                servico_executado: document.getElementById('modal-servico_executado').value,
                status: document.getElementById('modal-status-select').value,
                tecnicoId: newTechId,
                tecnicoNome: newTech ? newTech.name : ''
            });
            closeModal();
        } catch (error) {
            console.error("Erro ao atualizar OS: ", error);
        }
    });

    osTableBody.addEventListener('click', (e) => {
        const button = e.target.closest('.btn-details');
        if (button) openModal(button.dataset.id);
    });
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    searchInput.addEventListener('input', () => applyFiltersAndRender(allServiceOrders));
    filterAbertasBtn.addEventListener('click', () => {
        currentOsFilter = 'abertas';
        filterAbertasBtn.classList.add('active');
        filterFechadasBtn.classList.remove('active');
        applyFiltersAndRender(allServiceOrders);
    });
    filterFechadasBtn.addEventListener('click', () => {
        currentOsFilter = 'fechadas';
        filterFechadasBtn.classList.add('active');
        filterAbertasBtn.classList.remove('active');
        applyFiltersAndRender(allServiceOrders);
    });
    document.getElementById('btn-fechar-com-reparo').addEventListener('click', () => closeOs(document.getElementById('modal-os-hidden-id').value, 'Entregue com Reparo'));
    document.getElementById('btn-fechar-sem-reparo').addEventListener('click', () => closeOs(document.getElementById('modal-os-hidden-id').value, 'Entregue sem Reparo'));
    document.getElementById('btn-reabrir-os').addEventListener('click', () => reopenOs(document.getElementById('modal-os-hidden-id').value));
    defeitoTextarea.addEventListener('input', () => {
        if (defeitoTextarea.value.trim().length > 10) btnDiagnostico.classList.remove('hidden');
        else btnDiagnostico.classList.add('hidden');
    });

    document.getElementById('btn-add-peca').addEventListener('click', () => addPecaRow());
    document.getElementById('pecas-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-peca')) {
            e.target.parentElement.remove();
            updateValoresModal();
        }
    });
    document.getElementById('pecas-list').addEventListener('input', updateValoresModal);
    document.getElementById('modal-mao_de_obra').addEventListener('input', updateValoresModal);
    
    document.getElementById('btn-comprovante-entrada').addEventListener('click', () => generateDocument(document.getElementById('modal-os-hidden-id').value, 'entrada', allServiceOrders));
    document.getElementById('btn-laudo').addEventListener('click', () => generateDocument(document.getElementById('modal-os-hidden-id').value, 'laudo', allServiceOrders));
    document.getElementById('btn-laudo-fechado').addEventListener('click', () => generateDocument(document.getElementById('modal-os-hidden-id').value, 'laudo', allServiceOrders));

    btnDiagnostico.addEventListener('click', async () => {
        const defeito = defeitoTextarea.value; if (!defeito) return;
        const prompt = `Como técnico, liste em tópicos curtos (*) os possíveis problemas e diagnósticos para: '${defeito}'`;
        const sugestao = await callGeminiApi(prompt, btnDiagnostico);
        const formattedHtml = sugestao.split('*').filter(s => s.trim() !== '').map(s => `<li>${s.trim()}</li>`).join('');
        diagnosticoSugestaoDiv.innerHTML = `<p class="text-sm font-semibold text-purple-800 mb-2">Sugestões:</p><ul class="text-sm text-gray-700 space-y-1 gemini-suggestion-list">${formattedHtml}</ul>`;
        diagnosticoSugestaoDiv.classList.remove('hidden');
    });

    btnGerarLaudo.addEventListener('click', async () => {
        const osId = document.getElementById('modal-os-hidden-id').value;
        const os = allServiceOrders.find(o => o.id === osId); if (!os) return;
        const servicoTextarea = document.getElementById('modal-servico_executado');
        
        const pecasRows = document.querySelectorAll('#pecas-list .peca-row');
        const pecasTexto = Array.from(pecasRows).map(row => {
            const nome = row.querySelector('.peca-nome').value;
            const valor = row.querySelector('.peca-valor').value;
            return nome ? `${nome} (R$ ${valor || '0,00'})` : '';
        }).filter(Boolean).join(', ');

        const prompt = `Como técnico, reescreva de forma profissional o laudo, baseado em:\n- Defeito: '${os.defeito_relatado}'\n- Peças: '${pecasTexto || 'N/A'}'\n- Anotações: '${servicoTextarea.value}'`;
        servicoTextarea.value = await callGeminiApi(prompt, btnGerarLaudo);
    });

    btnGerarResumo.addEventListener('click', async () => {
        const laudoTecnico = document.getElementById('modal-servico_executado').value;
        if (!laudoTecnico.trim()) {
            resumoClienteDiv.innerHTML = 'Preencha o campo "Serviço Executado".';
            resumoClienteDiv.classList.remove('hidden');
            return;
        }
        const prompt = `Converta o laudo a seguir para uma explicação simples para um cliente leigo:\n"${laudoTecnico}"`;
        const resumo = await callGeminiApi(prompt, btnGerarResumo);
        resumoClienteDiv.innerHTML = `<p class="text-sm font-semibold text-green-800 mb-2">Resumo para Cliente:</p><p>${resumo.replace(/\n/g, '<br>')}</p>`;
        resumoClienteDiv.classList.remove('hidden');
    });

    btnGerarMensagem.addEventListener('click', async () => {
        const osId = document.getElementById('modal-os-hidden-id').value;
        const os = allServiceOrders.find(o => o.id === osId); if (!os) return;
        const prompt = `Crie uma mensagem curta para WhatsApp informando o status do equipamento.\n- Cliente: ${os.nome_cliente}\n- Equipamento: ${os.equipamento}\n- Status: ${document.getElementById('modal-status-select').value}\n- Valor: R$ ${document.getElementById('modal-mao_de_obra').value || '0,00'}`;
        mensagemStatusTexto.value = await callGeminiApi(prompt, btnGerarMensagem);
        mensagemStatusContainer.classList.remove('hidden');
    });

    btnCopiarMensagem.addEventListener('click', () => {
        mensagemStatusTexto.select();
        document.execCommand('copy');
        const originalText = btnCopiarMensagem.textContent;
        btnCopiarMensagem.textContent = 'Copiado!';
        setTimeout(() => { btnCopiarMensagem.textContent = originalText; }, 2000);
    });
}

export function applyFiltersAndRender(serviceOrders) {
    const searchTerm = searchInput.value.toLowerCase();
    let dataToFilter = [...serviceOrders];
    if (currentOsFilter === 'abertas') dataToFilter = dataToFilter.filter(os => !os.status_final);
    else dataToFilter = dataToFilter.filter(os => os.status_final);
    if (searchTerm) dataToFilter = dataToFilter.filter(os => os.id.toLowerCase().includes(searchTerm) || os.nome_cliente.toLowerCase().includes(searchTerm) || os.equipamento.toLowerCase().includes(searchTerm));
    renderOsList(dataToFilter);
}

function renderOsList(listToRender) {
    osTableBody.innerHTML = '';
    if (listToRender.length === 0) {
        osTableBody.parentElement.classList.add('hidden');
        emptyState.classList.remove('hidden');
        document.getElementById('empty-state-title').textContent = currentOsFilter === 'abertas' ? 'Nenhuma OS aberta' : 'Nenhuma OS fechada';
        return;
    }
    osTableBody.parentElement.classList.remove('hidden');
    emptyState.classList.add('hidden');
    document.getElementById('th-status').textContent = currentOsFilter === 'abertas' ? 'Status' : 'Status Final';
    listToRender.forEach(os => {
        const row = osTableBody.insertRow();
        const statusToShow = currentOsFilter === 'abertas' ? os.status : os.status_final;
        const statusColor = statusColors[statusToShow] || statusColors['A Aguardar Análise'];
        row.innerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${os.id.substring(0, 8)}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${os.nome_cliente}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${os.tipo_equipamento}: ${os.equipamento}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${os.data_entrada}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor.bg} ${statusColor.text}">${statusToShow}</span></td><td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><button class="btn-details text-indigo-600 hover:text-indigo-900" data-id="${os.id}">Detalhes</button></td>`;
    });
}

export function openModal(osId) {
    const os = allServiceOrders.find(o => o.id === osId);
    if (!os) return;
    document.getElementById('modal-os-id').textContent = `${os.id.substring(0, 8)}`;
    document.getElementById('modal-os-hidden-id').value = os.id;
    if (os.status_final) {
        modalContentMain.classList.add('hidden');
        modalContentClosed.classList.remove('hidden');
        document.getElementById('closed-status-final').textContent = os.status_final;
        document.getElementById('closed-data-saida').textContent = os.data_saida;
    } else {
        modalContentMain.classList.remove('hidden');
        modalContentClosed.classList.add('hidden');
        document.getElementById('modal-mao_de_obra').value = os.mao_de_obra || '';
        document.getElementById('modal-servico_executado').value = os.servico_executado || '';
        const statusSelect = document.getElementById('modal-status-select');
        statusSelect.innerHTML = '';
        activeStatuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            if (status === os.status) option.selected = true;
            statusSelect.appendChild(option);
        });
        const tecnicoSelect = document.getElementById('modal-tecnico-responsavel');
        tecnicoSelect.innerHTML = '';
        allTechnicians.forEach(tech => {
            const option = document.createElement('option');
            option.value = tech.id;
            option.textContent = tech.name;
            if (tech.id === os.tecnicoId) option.selected = true;
            tecnicoSelect.appendChild(option);
        });
        renderPecas(os.pecas);
        updateValoresModal();
    }
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
}

async function closeOs(osId, statusFinal) {
    try {
        await updateDoc(doc(osCollectionRef, osId), {
            status_final: statusFinal,
            data_saida: new Date().toLocaleString('pt-BR')
        });
        closeModal();
    } catch (error) {
        console.error("Erro ao fechar OS:", error);
    }
}

async function reopenOs(osId) {
    try {
        await updateDoc(doc(osCollectionRef, osId), {
            status_final: null,
            data_saida: null
        });
        closeModal();
    } catch (error) {
        console.error("Erro ao reabrir OS:", error);
    }
}

function renderPecas(pecas) {
    const pecasList = document.getElementById('pecas-list');
    pecasList.innerHTML = '';
    const pecasArray = Array.isArray(pecas) ? pecas : [];
    if (pecasArray.length === 0) {
        addPecaRow();
    } else {
        pecasArray.forEach(peca => addPecaRow(peca));
    }
}

function addPecaRow(peca = { nome: '', valor: '' }) {
    const pecasList = document.getElementById('pecas-list');
    const row = document.createElement('div');
    row.className = 'peca-row flex items-center gap-2';
    row.innerHTML = `
        <input type="text" class="peca-nome flex-grow px-2 py-1 border border-gray-300 rounded-md text-sm" value="${peca.nome}" placeholder="Nome da Peça">
        <input type="number" class="peca-valor w-24 px-2 py-1 border border-gray-300 rounded-md text-sm" value="${peca.valor}" placeholder="Valor">
        <button type="button" class="btn-remove-peca text-red-500 hover:text-red-700">&times;</button>
    `;
    pecasList.appendChild(row);
}

function updateValoresModal() {
    const pecasRows = document.querySelectorAll('#pecas-list .peca-row');
    let totalPecas = 0;
    pecasRows.forEach(row => {
        totalPecas += parseFloat(row.querySelector('.peca-valor').value) || 0;
    });
    document.getElementById('modal-total-pecas').value = `R$ ${totalPecas.toFixed(2).replace('.', ',')}`;
    
    const maoDeObra = parseFloat(document.getElementById('modal-mao_de_obra').value) || 0;
    document.getElementById('modal-valor-total').value = `R$ ${(totalPecas + maoDeObra).toFixed(2).replace('.', ',')}`;

    const comissao = maoDeObra * 0.35;
    document.getElementById('modal-comissao').value = `R$ ${comissao.toFixed(2).replace('.', ',')}`;
}

export function updateCustomerDatalist(customers) {
    const datalist = document.getElementById('customer-suggestions');
    datalist.innerHTML = '';
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.nome;
        datalist.appendChild(option);
    });
    document.getElementById('nome_cliente').addEventListener('input', (e) => {
        const match = customers.find(c => c.nome === e.target.value);
        if(match) {
            document.getElementById('contato_cliente').value = match.contato;
        }
    });
}

