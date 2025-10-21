document.getElementById("gerar").addEventListener("click", async () => {

  // --- 1. Captura de Valores e Elementos ---
  const dias = document.getElementById("dias").value;
  const horas = document.getElementById("horas").value;

  const resultado = document.getElementById("resultado");
  const loader = document.getElementById("loader");

  loader.classList.add("show");

  // Validação básica
  if (!dias || !horas || isNaN(parseInt(dias)) || isNaN(parseInt(horas))) {
    loader.classList.remove("show");
    resultado.innerHTML = '<div class="error">Por favor, insira dias e horas válidos.</div>';
    return;
  }


  // --- 2. Carregamento do Conteúdo JSON ---
  let conteudo;
  try {
    conteudo = await fetch("conteudo.json")
      .then(res => res.json())
      .catch(err => {
        console.error("Erro ao carregar o JSON de conteúdos: ", err);
        return [];
      });
  } catch (err) {
    loader.classList.remove("show");
    resultado.innerHTML = '<div class="error">Erro ao carregar conteúdo: ' + err.message + '</div>';
    return;
  }

  // --- 3. Montagem do Prompt da IA ---
  const prompt = `Monte um cronograma de estudo para a ETEC baseado no JSON abaixo.
    Distribua o tempo disponível (dias: ${dias}, horas por dia: ${horas}) respeitando os
    pesos das matérias e tambem quero que mostra separadamente objetivo de estudar tal materia
    . Explique em forma de lista organizada por dia. **USE Markdown** para formatar: use títulos (## ou ###) para os dias e listas (*) ou (-) para os tópicos.
    Exemplo de formato:
    
    ## Dia 1
    - Objetivo: Interpretação de texto e Introdução a Álgebra.
    - Tópicos de Português: Interpretação de textos narrativos.
    - Tópicos de Matemática: Revisão de operações básicas.
    
    Eu quero apenas que você me mande o cronograma, não comente sobre o codigo ou algo a mais , apenas a resposta.
  ${JSON.stringify({ dias_ate_prova: dias, horas_por_dia: horas, materias: conteudo })}`;

  const API_KEY = "AIzaSyAh-CyyJeuI3gT3-qmSFEHKGWBekzdHdqQ"; // Mantenha isso em um local SEGURO (variável de ambiente, não no frontend)
  const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  // --- 4. Requisição à API ---
  try {
    const resultadoDaApi = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }] },
        ],
      }),
    });

    loader.classList.remove("show");

    if (!resultadoDaApi.ok) {
      throw new Error(`Erro na API: ${resultadoDaApi.status} ${resultadoDaApi.statusText}`);
    }

    const data = await resultadoDaApi.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Não consegui gerar um cronograma";

    // *** ESTE É O PASSO PRINCIPAL ***
    // 1. O prompt foi ajustado para PEDIR Markdown.
    // 2. marked.parse() converte o texto Markdown da IA para HTML.
    const htmlCronograma = marked.parse(text);

    // 3. Inserir o HTML limpo e formatado no elemento.
    resultado.innerHTML = `<div class="response">${htmlCronograma}</div>`;
    document.getElementById("gerar-pdf").style.display = "inline-block";

    // *** Opcional: Adicionar algum estilo para o H2 gerado pelo Markdown
    // Você pode estilizar a classe .response H2 no seu CSS (ex: border-bottom)

  } catch (err) {
    loader.classList.remove("show")
    resultado.innerHTML = `<div class="error">Erro na requisição: ${err.message}</div>`;
    console.error(err);
  }
});

document.getElementById("gerar-pdf").addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const elemento = document.querySelector(".response");

  if (!elemento) {
    alert("Gere o cronograma primeiro!");
    return;
  }

  html2canvas(elemento, { scale: 2 }).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    //Definições da Página e Margens
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // Cálculos de Dimensão da Imagem
    // A largura da imagem no PDF será a largura da página menos 2x a margem
    const imgPdfWidth = pdfWidth - (2 * margin);
    const imgPdfHeight = (canvas.height * imgPdfWidth) / canvas.width;

    let heightLeft = imgPdfHeight; // Altura total restante da imagem
    let currentYPosition = margin; // Posição Y inicial na página

    //Adicionar Título
    const title = "Cronograma de Estudos - Vestibulinho ETEC";
    pdf.setFontSize(16);
    pdf.text(title, margin, margin + 5); // Adiciona o título um pouco abaixo da margem

    // Ajusta a posição Y inicial para começar após o título
    currentYPosition = margin + 15;

    // Altura da área de conteúdo útil (altura total - margem superior - margem inferior)
    const pageContentHeight = pdfHeight - (2 * margin);

    // Adicionar a Imagem (Primeira Página)
    // A posição X é a margem. A posição Y é a margem + a altura do título.
    pdf.addImage(imgData, "PNG", margin, currentYPosition, imgPdfWidth, imgPdfHeight);

    // Subtrai o conteúdo útil da página (excluindo margem) da altura total da imagem
    heightLeft -= (pdfHeight - currentYPosition - margin);

    // A posição Y para "rolar" a imagem na próxima página é negativa
    let imagePositionY = currentYPosition - pageContentHeight;

    // 5. Loop para Quebrar Páginas
    while (heightLeft > 0) {
      pdf.addPage();

      // Adiciona a imagem, mas com uma posição Y negativa para mostrar a parte 'abaixo'
      // Isso simula o scroll da imagem
      pdf.addImage(imgData, "PNG", margin, imagePositionY, imgPdfWidth, imgPdfHeight);

      // Atualiza o que resta da imagem
      heightLeft -= pageContentHeight;

      // Atualiza a posição de rolagem para a próxima página
      imagePositionY -= pageContentHeight;
    }

    pdf.save("cronograma.pdf");
  });

});
