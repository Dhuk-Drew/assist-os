export const activeStatuses = ['A Aguardar Análise', 'Em Análise', 'A Aguardar Peças', 'Em Reparação', 'Pronto para Recolha'];
export const statusColors = {
    'A Aguardar Análise': { bg: 'bg-gray-100', text: 'text-gray-800', hex: '#F3F4F6' },
    'Em Análise': { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#FEF3C7' },
    'A Aguardar Peças': { bg: 'bg-orange-100', text: 'text-orange-800', hex: '#FFEDD5' },
    'Em Reparação': { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#DBEAFE' },
    'Pronto para Recolha': { bg: 'bg-green-100', text: 'text-green-800', hex: '#D1FAE5' },
    'Entregue com Reparo': { bg: 'bg-green-200', text: 'text-green-900', hex: '#A7F3D0' },
    'Entregue sem Reparo': { bg: 'bg-red-200', text: 'text-red-900', hex: '#FECACA' }
};

export async function callGeminiApi(prompt, button) {
    const originalButtonText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" role="status" aria-label="loading"></span> Gerando...`;
    
    // ATENÇÃO: Cole a sua chave da API do Gemini aqui
    const apiKey = ""; 
    
    if (apiKey === "") {
        alert("Por favor, adicione a sua chave de API do Gemini no ficheiro js/utils.js");
        button.disabled = false;
        button.innerHTML = originalButtonText;
        return "Erro: Chave de API não configurada.";
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts: [{ text: prompt }] }] };
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text; else throw new Error("Nenhum texto encontrado na resposta da API.");
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "Erro ao contatar a IA.";
    } finally {
        button.disabled = false;
        button.innerHTML = originalButtonText;
    }
}

export function generateDocument(osId, type, allServiceOrders) {
    const os = allServiceOrders.find(o => o.id === osId); if (!os) return;
    let title = '', content = ''; const today = new Date().toLocaleDateString('pt-BR');
    const header = `<div style="text-align:center; margin-bottom: 20px;"><h1 style="font-size:24px; margin:0;">NOME DA SUA ASSISTÊNCIA</h1><p style="margin:0;">O Seu Endereço, 123 - A Sua Cidade</p><p style="margin:0;">Telefone: (00) 12345-6789</p></div><hr style="margin-bottom: 20px;">`;
    if (type === 'entrada') {
        title = 'Comprovativo de Entrada';
        content = `<h2 style="text-align:center; margin-bottom: 30px;">${title} - OS Nº: ${os.id.substring(0,10)}</h2><p><strong>Data:</strong> ${os.data_entrada}</p><p><strong>Cliente:</strong> ${os.nome_cliente}</p><p><strong>Equipamento:</strong> ${os.tipo_equipamento}: ${os.equipamento}</p><p><strong>Defeito:</strong> ${os.defeito_relatado}</p><br><br><br><div style="text-align:center;"><p>__________________</p><p>Assinatura</p></div>`;
    } else if (type === 'laudo') {
        title = 'Laudo Técnico';
        const maoDeObra = parseFloat(os.mao_de_obra || 0).toFixed(2);
        const servicoExecutadoHtml = (os.servico_executado || 'N/A').replace(/\n/g, '<br>');
        const pecasArray = Array.isArray(os.pecas) ? os.pecas : [];
        const pecasTexto = pecasArray.length > 0 ? pecasArray.map(p => `${p.nome} (R$ ${parseFloat(p.valor || 0).toFixed(2).replace('.',',')})`).join(', ') : 'Nenhuma';
        content = `<h2 style="text-align:center; margin-bottom: 30px;">${title} - OS Nº: ${os.id.substring(0,10)}</h2><p><strong>Data:</strong> ${today}</p><p><strong>Cliente:</strong> ${os.nome_cliente}</p><hr style="margin: 20px 0;"><p><strong>Serviço Executado:</strong></p><div style="padding: 10px; border: 1px solid #ccc; min-height: 80px;">${servicoExecutadoHtml}</div><p><strong>Peças:</strong> ${pecasTexto}</p><p><strong>Mão de Obra:</strong> R$ ${maoDeObra.replace('.', ',')}</p>`;
    }
    const docWindow = window.open('', '_blank');
    docWindow.document.write(`<html><head><title>${title}</title><style>body{font-family: Arial, sans-serif; margin: 40px;} p{line-height:1.6;}</style></head><body>${header}${content}<div style="position:fixed; top:10px; right:10px; @media print{display:none;}}"><button onclick="window.print()">Imprimir</button></div></body></html>`);
    docWindow.document.close();
}

