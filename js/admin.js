import { collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, auth, allServiceOrders, allTechnicians, usersCollectionRef, osCollectionRef, clientesCollectionRef } from './main.js';
import { updateCustomerDatalist } from './os.js';

const techniciansListDiv = document.getElementById('technicians-list');
const adminOsTbody = document.getElementById('admin-os-tbody');
const btnGerarRelatorio = document.getElementById('btn-gerar-relatorio');
const reportModal = document.getElementById('report-modal');
const customersListDiv = document.getElementById('customers-list');
const btnNovoCliente = document.getElementById('btn-novo-cliente');
const formNovoCliente = document.getElementById('form-novo-cliente');
const btnNovoTecnico = document.getElementById('btn-novo-tecnico');
const formNovoTecnico = document.getElementById('form-novo-tecnico');

let tempTechnicianData = null;

export function setupAdminListeners() {
    btnGerarRelatorio.addEventListener('click', () => generateWeeklyReport(allServiceOrders, allTechnicians));
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal || e.target.closest('#report-close-btn')) reportModal.classList.add('hidden-element');
    });

    btnNovoCliente.addEventListener('click', () => {
        formNovoCliente.classList.toggle('visible');
    });
    btnNovoTecnico.addEventListener('click', () => {
        formNovoTecnico.classList.toggle('visible');
    });

    formNovoCliente.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newCustomer = {
            nome: document.getElementById('novo-cliente-nome').value,
            contato: document.getElementById('novo-cliente-contato').value,
            endereco: document.getElementById('novo-cliente-endereco').value,
            timestamp: serverTimestamp()
        };
        try {
            await addDoc(clientesCollectionRef, newCustomer);
            formNovoCliente.reset();
            formNovoCliente.classList.remove('visible');
        } catch (error) {
            console.error("Erro ao adicionar cliente:", error);
        }
    });

    formNovoTecnico.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('novo-tecnico-nome').value;
        const email = document.getElementById('novo-tecnico-email').value;
        const password = document.getElementById('novo-tecnico-senha').value;
        const telefone = document.getElementById('novo-tecnico-telefone').value;
        const cpf = document.getElementById('novo-tecnico-cpf').value;

        tempTechnicianData = { name, email, telefone, cpf, role: 'technician', createdAt: serverTimestamp() };

        document.getElementById('finalize-email').textContent = email;
        document.getElementById('finalize-password').textContent = password;

        formNovoTecnico.classList.remove('visible');
        document.getElementById('finalizar-cadastro-tecnico').classList.remove('hidden-element');
    });

    document.getElementById('btn-finalizar-cadastro').addEventListener('click', async () => {
        const uid = document.getElementById('finalize-uid').value.trim();
        if (!uid) { alert("Por favor, cole o UID do Firebase."); return; }
        if (!tempTechnicianData) { alert("Dados temporários do técnico não encontrados."); return; }

        try {
            await setDoc(doc(usersCollectionRef, uid), tempTechnicianData);
            alert("Técnico cadastrado com sucesso!");

            document.getElementById('finalizar-cadastro-tecnico').classList.add('hidden-element');
            document.getElementById('finalize-uid').value = '';
            formNovoTecnico.reset();
            tempTechnicianData = null;
        } catch (error) {
            console.error("Erro ao finalizar cadastro:", error);
            alert("Ocorreu um erro ao salvar os dados.");
        }
    });
}

export function updateAdminData(serviceOrders, technicians, customers) {
    if(customers) renderCustomersList(customers);
    if(technicians) renderTechniciansList(technicians);
    if(serviceOrders && technicians) renderAdminOsTable(serviceOrders, technicians);
}

function renderCustomersList(customers) {
    customersListDiv.innerHTML = '';
    customers.forEach(customer => {
        const customerDiv = document.createElement('div');
        customerDiv.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg border';
        customerDiv.innerHTML = `<div><p class="font-semibold text-gray-800">${customer.nome}</p><p class="text-sm text-gray-500">${customer.contato}</p></div>`;
        customersListDiv.appendChild(customerDiv);
    });
}

function renderTechniciansList(technicians) {
    techniciansListDiv.innerHTML = '';
    const currentUser = auth.currentUser;
    technicians.forEach(tech => {
        const techDiv = document.createElement('div');
        techDiv.className = 'flex items-center justify-between bg-gray-50 p-3 rounded-lg border';

        let roleSelector = `<span class="text-xs font-bold uppercase text-gray-500">${tech.role}</span>`;
        if (tech.id !== currentUser.uid) { // Admin não pode mudar a própria função
            roleSelector = `<select data-userid="${tech.id}" class="admin-role-select rounded-md border-gray-300"><option value="technician" ${tech.role === 'technician' ? 'selected' : ''}>Técnico</option><option value="admin" ${tech.role === 'admin' ? 'selected' : ''}>Admin</option></select>`;
        }

        techDiv.innerHTML = `<div><p class="font-semibold text-gray-800">${tech.name}</p><p class="text-sm text-gray-500">${tech.email}</p></div><div>${roleSelector}</div>`;
        techniciansListDiv.appendChild(techDiv);
    });

    techniciansListDiv.addEventListener('change', async (e) => {
        if (e.target.classList.contains('admin-role-select')) {
            const userId = e.target.dataset.userid;
            const newRole = e.target.value;
            try {
                await updateDoc(doc(usersCollectionRef, userId), { role: newRole });
            } catch (error) {
                console.error("Erro ao atualizar função:", error);
            }
        }
    });
}

function renderAdminOsTable(serviceOrders, technicians) {
    adminOsTbody.innerHTML = '';
    const osAbertas = serviceOrders.filter(os => !os.status_final);
    osAbertas.forEach(os => {
        const row = adminOsTbody.insertRow();
        let selectHTML = `<select data-osid="${os.id}" class="admin-tech-select w-full p-1 border-gray-300 rounded-md">`;
        technicians.forEach(tech => {
            selectHTML += `<option value="${tech.id}" ${os.tecnicoId === tech.id ? 'selected' : ''}>${tech.name}</option>`;
        });
        selectHTML += '</select>';
        row.innerHTML = `<td class="px-4 py-2 text-sm">${os.id.substring(0,8)}</td><td class="px-4 py-2 text-sm">${os.nome_cliente}</td><td class="px-4 py-2">${selectHTML}</td>`;
    });

    adminOsTbody.addEventListener('change', async (e) => {
        if (e.target.classList.contains('admin-tech-select')) {
            const osId = e.target.dataset.osid;
            const newTechId = e.target.value;
            const newTech = technicians.find(t => t.id === newTechId);
            try {
                await updateDoc(doc(osCollectionRef, osId), {
                    tecnicoId: newTechId,
                    tecnicoNome: newTech.name
                });
            } catch (error) {
                console.error("Erro ao reatribuir técnico:", error);
            }
        }
    });
}

function generateWeeklyReport(serviceOrders, technicians) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const osFechadasSemana = serviceOrders.filter(os => os.status_final && os.timestamp.toDate() >= oneWeekAgo);

    const totalFechadas = osFechadasSemana.length;
    const totalReceita = osFechadasSemana.reduce((acc, os) => acc + parseFloat(os.mao_de_obra || 0), 0);

    const porTecnico = technicians.map(tech => {
        const osDoTecnico = osFechadasSemana.filter(os => os.tecnicoId === tech.id);
        return {
            name: tech.name,
            count: osDoTecnico.length,
            revenue: osDoTecnico.reduce((acc, os) => acc + parseFloat(os.mao_de_obra || 0), 0)
        };
    });

    const reportContentEl = document.getElementById('report-content');
    reportContentEl.innerHTML = `
        <div id="printable-report">
            <h3 class="text-xl font-bold mb-1">Relatório de Desempenho Semanal</h3>
            <p class="text-sm text-gray-500 mb-6">Período: ${oneWeekAgo.toLocaleDateString('pt-BR')} - ${new Date().toLocaleDateString('pt-BR')}</p>
            <div class="grid grid-cols-2 gap-4 mb-6"><div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600">Total de OS Fechadas</p><p class="text-2xl font-bold">${totalFechadas}</p></div><div class="bg-gray-100 p-4 rounded-lg"><p class="text-sm text-gray-600">Receita Total (Mão de Obra)</p><p class="text-2xl font-bold">R$ ${totalReceita.toFixed(2).replace('.',',')}</p></div></div>
            <h4 class="font-semibold mb-3">Desempenho por Técnico:</h4>
            <table class="min-w-full divide-y divide-gray-200 border"><thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left text-sm font-medium">Técnico</th><th class="px-4 py-2 text-left text-sm font-medium">OS Fechadas</th><th class="px-4 py-2 text-left text-sm font-medium">Receita (R$)</th></tr></thead><tbody class="divide-y">${porTecnico.map(t => `<tr><td class="px-4 py-2">${t.name}</td><td class="px-4 py-2">${t.count}</td><td class="px-4 py-2">${t.revenue.toFixed(2).replace('.',',')}</td></tr>`).join('')}</tbody></table>
        </div>`;
    reportModal.classList.remove('hidden-element');

    document.getElementById('btn-print-report').addEventListener('click', () => {
        const content = document.getElementById('printable-report').innerHTML;
        const win = window.open('', '', 'height=600,width=800');
        win.document.write('<html><head><title>Relatório Semanal</title><script src="https://cdn.tailwindcss.com"><\/script></head><body>' + content + '</body></html>');
        win.document.close();
        win.print();
    });
}

