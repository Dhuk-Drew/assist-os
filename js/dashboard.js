import { statusColors, activeStatuses } from './utils.js';
import { openModal } from './os.js';

let statusChart = null;
let calendar = null;

export function initializeDashboard() {
    if (calendar) return; // Previne reinicialização

    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        buttonText: {
            today: 'Hoje'
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listWeek'
        },
        eventClick: (info) => openModal(info.event.extendedProps.osId)
    });
    calendar.render();

    const ctx = document.getElementById('status-chart').getContext('2d');
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: activeStatuses,
            datasets: [{
                label: 'OS por Status',
                data: [],
                backgroundColor: activeStatuses.map(s => statusColors[s].hex),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

export function updateDashboard(allServiceOrders) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const osAbertas = allServiceOrders.filter(os => !os.status_final);
    const osFechadasMes = allServiceOrders.filter(os => os.status_final && os.timestamp.toDate() >= startOfMonth);
    const receitaMes = osFechadasMes.reduce((acc, os) => acc + parseFloat(os.mao_de_obra || 0), 0);

    document.getElementById('dashboard-total-abertas').textContent = osAbertas.length;
    document.getElementById('dashboard-total-fechadas').textContent = osFechadasMes.length;
    document.getElementById('dashboard-receita-mes').textContent = `R$ ${receitaMes.toFixed(2).replace('.', ',')}`;

    updateStatusChart(osAbertas);
    updateCalendar(allServiceOrders);
}

function updateStatusChart(osAbertas) {
    if (!statusChart) return;
    const statusCounts = activeStatuses.map(status => osAbertas.filter(os => os.status === status).length);
    statusChart.data.datasets[0].data = statusCounts;
    statusChart.update();
}

function updateCalendar(data) {
    if (!calendar) return;
    const events = data.map(os => {
        const status = os.status_final || os.status;
        const colorInfo = statusColors[status] || statusColors['A Aguardar Análise'];
        return {
            title: `OS ${os.id.substring(0,4)}... ${os.equipamento}`,
            start: os.timestamp.toDate(),
            color: colorInfo.hex,
            textColor: '#1f2937',
            extendedProps: {
                osId: os.id
            }
        };
    });
    calendar.removeAllEvents();
    calendar.addEventSource(events);
}

