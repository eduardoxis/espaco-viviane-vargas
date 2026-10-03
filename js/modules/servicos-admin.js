// js/modules/servicos-admin.js
// Aba "Serviços" do painel administrativo. Mesma lógica dos produtos: tabela,
// formulário completo com galeria de fotos (arrastar, reordenar, ajustar
// enquadramento), importação por JSON e prompt para IA — com a diferença de que
// aqui as categorias têm subcategorias (ex.: Estética > Facial).
import { escHtml, formatBRL, toast, confirmarAcao, imgPos, generateCode } from "../utils/utils.js";
import { icon } from "../utils/icons.js";
import {
  listarServicosAdmin, criarServico, atualizarServico, excluirServico, duplicarServico,
  criarCategoriaServico, atualizarCategoriaServico, excluirCategoriaServico,
  finalizarImportacaoServicos, montarArvoreCategorias, resolverNomesServicos,
  ordenarServicos, normalizarTexto
} from "../services/servicos.js";

let categorias = [];
let servicos = [];
const filtros = { termo: "", categoriaId: "" };

// helpers injetados pelo dashboard.js (evita import circular)
let ajuda = { abrirAjusteEnquadramento: null, enviarImagem: null };

const ESTILO = `
<style>
  .svc-admin__cats { border: 1px solid var(--cinza-100); border-radius: var(--raio-md); padding: 1rem 1.1rem; margin-bottom: 1.25rem; background: var(--branco); }
  .svc-admin__cats-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .svc-admin__cats-head h2 { margin: 0; font-size: 1rem; color: var(--azul-900); }
  .svc-admin__cats-head p { margin: 0.15rem 0 0; font-size: 0.82rem; color: var(--cinza-500); }
  .svc-admin__tree { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.8rem; }
  .svc-cat { border: 1px solid var(--cinza-100); border-radius: var(--raio-sm); background: var(--cinza-050); padding: 0.7rem 0.8rem; display: grid; gap: 0.5rem; align-content: start; }
  .svc-cat__head { display: flex; align-items: center; gap: 0.4rem; }
  .svc-cat__nome { font-weight: 600; color: var(--azul-900); flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .svc-cat__count { font-size: 0.75rem; color: var(--cinza-500); white-space: nowrap; }
  .svc-cat__btn { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: transparent; color: var(--cinza-700); flex-shrink: 0; }
  .svc-cat__btn:hover { background: var(--cinza-100); }
  .svc-cat__btn .icon { width: 14px; height: 14px; }
  .svc-cat__subs { list-style: none; margin: 0; padding: 0 0 0 0.6rem; display: grid; gap: 0.25rem; border-left: 2px solid var(--cinza-200); }
  .svc-cat__subs li { display: flex; align-items: center; gap: 0.3rem; font-size: 0.86rem; color: var(--cinza-700); }
  .svc-cat__subs li span.svc-cat__nome { font-weight: 500; color: var(--cinza-900); }
  .svc-cat__add { align-self: start; font-size: 0.8rem; color: var(--azul-700); background: transparent; padding: 0.15rem 0; display: inline-flex; align-items: center; gap: 0.3rem; }
  .svc-cat__add .icon { width: 13px; height: 13px; }
  .svc-cat__add:hover { text-decoration: underline; }
  .svc-admin__ajuda { font-size: 0.8rem; color: var(--cinza-500); margin: -0.4rem 0 0; }
  .svc-admin__ajuda--grid { grid-column: 1 / -1; }
  .svc-admin__dica { font-weight: 400; color: var(--cinza-500); font-size: 0.78rem; }
</style>`;

// ---------- ENTRADA ----------
export async function carregarAbaServicos(container, helpers = {}) {
  if (!container) return;
  ajuda = { ...ajuda, ...helpers };
  await recarregarDados();
  desenharPainel(container);
}

async function recarregarDados() {
  const dados = await listarServicosAdmin();
  categorias = dados.categorias;
  servicos = dados.servicos;
}

async function recarregarEDesenhar(container) {
  await recarregarDados();
  desenharPainel(container);
}

// ---------- LISTAGEM ----------
function textoCategoria(s) {
  if (!s.categoriaNome) return "-";
  return s.subcategoriaNome ? `${s.categoriaNome} › ${s.subcategoriaNome}` : s.categoriaNome;
}

function servicosFiltrados() {
  const termo = normalizarTexto(filtros.termo);
  const lista = resolverNomesServicos(servicos, categorias).filter(s => {
    if (filtros.categoriaId && s.categoriaId !== filtros.categoriaId) return false;
    if (!termo) return true;
    return normalizarTexto([s.nome, s.categoriaNome, s.subcategoriaNome, s.codigo, s.descricaoCurta].join(" ")).includes(termo);
  });
  return ordenarServicos(lista, categorias).map(s => ({
    ...s,
    categoriaNome: s.categoriaNome, subcategoriaNome: s.subcategoriaNome
  }));
}

function contarServicos(categoriaId, ehSub) {
  return servicos.filter(s => (ehSub ? s.subcategoriaId : s.categoriaId) === categoriaId).length;
}

function desenharPainel(container) {
  const arvore = montarArvoreCategorias(categorias);
  const opcoesFiltro = arvore.map(c => `<option value="${c.id}" ${filtros.categoriaId === c.id ? "selected" : ""}>${escHtml(c.nome)}</option>`).join("");

  container.innerHTML = `${ESTILO}
    <div class="admin-panel-head">
      <h1>Serviços</h1>
      <p>Cadastre os serviços do salão, organizados em categorias e subcategorias, com fotos e explicação do que cada um faz.</p>
    </div>

    <section class="svc-admin__cats" aria-label="Categorias de serviços">
      <div class="svc-admin__cats-head">
        <div>
          <h2>Categorias de serviços</h2>
          <p>Ex.: <strong>Estética</strong> com subcategorias como Facial e Corporal. Os serviços ficam dentro delas.</p>
        </div>
        <button type="button" class="btn-secondary" id="btn-nova-categoria-servico">${icon("plus")}Nova categoria</button>
      </div>
      <div class="svc-admin__tree">
        ${arvore.map(c => `
          <div class="svc-cat" data-cat="${c.id}">
            <div class="svc-cat__head">
              <span class="svc-cat__nome">${escHtml(c.nome)}</span>
              <span class="svc-cat__count">${contarServicos(c.id, false)} serv.</span>
              <button type="button" class="svc-cat__btn" data-act="editar-cat" data-id="${c.id}" title="Editar categoria">${icon("pencil")}</button>
              <button type="button" class="svc-cat__btn" data-act="excluir-cat" data-id="${c.id}" title="Excluir categoria">${icon("trash")}</button>
            </div>
            ${c.filhas.length ? `<ul class="svc-cat__subs">${c.filhas.map(f => `
              <li>
                <span class="svc-cat__nome">${escHtml(f.nome)}</span>
                <span class="svc-cat__count">${contarServicos(f.id, true)}</span>
                <button type="button" class="svc-cat__btn" data-act="editar-cat" data-id="${f.id}" title="Editar subcategoria">${icon("pencil")}</button>
                <button type="button" class="svc-cat__btn" data-act="excluir-cat" data-id="${f.id}" title="Excluir subcategoria">${icon("trash")}</button>
              </li>`).join("")}</ul>` : ""}
            <button type="button" class="svc-cat__add" data-act="nova-sub" data-id="${c.id}">${icon("plus")}Subcategoria</button>
          </div>`).join("") || `<p style="margin:0;font-size:0.88rem;color:var(--cinza-500)">Nenhuma categoria ainda. Crie uma ou importe um JSON — as categorias e subcategorias do arquivo são criadas automaticamente.</p>`}
      </div>
    </section>

    <div class="admin-toolbar">
      <form class="admin-search" id="form-busca-admin-servicos" role="search">
        <div class="input-icon">
          ${icon("search")}
          <input type="search" id="busca-admin-servicos" placeholder="Pesquisar serviços..." autocomplete="off" value="${escHtml(filtros.termo)}">
        </div>
      </form>
      <div class="select-icon">
        ${icon("sort")}
        <select id="filtro-admin-servicos-categoria" aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>${opcoesFiltro}
        </select>
      </div>
      <button class="btn-secondary" id="btn-prompt-importacao-servicos">${icon("clipboardList")}Prompt para IA</button>
      <button class="btn-secondary" id="btn-importar-json-servicos">${icon("upload")}Importar JSON</button>
      <input type="file" id="input-importar-json-servicos" accept="application/json,.json" hidden>
      <button class="btn-primary" id="btn-novo-servico">${icon("plus")}Novo serviço</button>
    </div>

    <div class="table-wrap"><table class="admin-table" id="tabela-servicos">
      <thead><tr><th></th><th>Nome</th><th>Categoria</th><th>Duração</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody></tbody>
    </table></div>
    <div class="table-pagination"><p class="table-count" id="contagem-servicos"></p></div>

    <dialog id="dialog-servico" class="dialog-form"></dialog>
    <dialog id="dialog-categoria-servico" class="dialog-form"></dialog>
    <dialog id="dialog-importar-json-servicos" class="dialog-form">
      <h2>Resultado da importação</h2>
      <div id="resultado-importacao-json-servicos" class="import-result"></div>
      <div class="form-actions">
        <button type="button" class="btn-primary" id="btn-fechar-importacao-servicos">Fechar</button>
      </div>
    </dialog>
    <dialog id="dialog-prompt-importacao-servicos" class="dialog-form dialog-prompt-importacao">
      <div class="prompt-importacao__head">
        <div><h2>Prompt para criar JSON de serviços com IA</h2><p>Copie, cole na IA e depois importe o arquivo gerado.</p></div>
        <button type="button" class="prompt-importacao__close" id="btn-fechar-prompt-servicos" aria-label="Fechar">${icon("close")}</button>
      </div>
      <textarea id="texto-prompt-servicos" class="prompt-importacao__texto" readonly spellcheck="false"></textarea>
      <div class="form-actions">
        <button type="button" class="btn-primary" id="btn-copiar-prompt-servicos">${icon("copy")}Copiar prompt</button>
      </div>
    </dialog>`;

  renderizarTabela(container);
  ligarEventos(container);
}

function renderizarTabela(container) {
  const tbody = container.querySelector("#tabela-servicos tbody");
  const lista = servicosFiltrados();
  container.querySelector("#contagem-servicos").textContent = `${lista.length} serviço(s)`;

  tbody.innerHTML = lista.map(s => {
    const img = imgPos(s.imagem);
    return `
    <tr data-id="${s.id}">
      <td><img class="thumb" src="${img.src || "/assets/images/placeholder.svg"}" style="object-position:${img.pos}" alt=""></td>
      <td>${escHtml(s.nome)}</td>
      <td>${escHtml(textoCategoria(s))}</td>
      <td>${escHtml(s.duracao || "-")}</td>
      <td>${Number(s.preco) > 0 ? formatBRL(s.preco) : "Sob consulta"}</td>
      <td><span class="status-pill status-${escHtml(s.status || "disponivel")}">${s.status === "oculto" ? "oculto" : "disponível"}</span></td>
      <td class="row-actions">
        <button data-action="editar" title="Editar">${icon("pencil")}</button>
        <button data-action="duplicar" title="Duplicar">${icon("copy")}</button>
        <button data-action="excluir" title="Excluir">${icon("trash")}</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="7">
      <div class="empty-state">
        ${icon("gridEmpty", "empty-state__icon")}
        <strong>${filtros.termo || filtros.categoriaId ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}</strong>
        <p>${filtros.termo || filtros.categoriaId ? "Tente outro nome ou categoria." : "Adicione o primeiro serviço do salão ou importe um arquivo JSON."}</p>
        ${filtros.termo || filtros.categoriaId ? "" : `<button type="button" class="btn-secondary" id="btn-primeiro-servico">${icon("plus")}Adicionar primeiro serviço</button>`}
      </div>
    </td></tr>`;

  tbody.querySelector("#btn-primeiro-servico")?.addEventListener("click", () => abrirFormularioServico(container));

  tbody.querySelectorAll("tr[data-id]").forEach(tr => {
    const servico = servicos.find(s => s.id === tr.dataset.id);
    if (!servico) return;
    tr.querySelector('[data-action="editar"]').addEventListener("click", () => abrirFormularioServico(container, servico));
    tr.querySelector('[data-action="duplicar"]').addEventListener("click", async () => {
      try {
        await duplicarServico(servico);
        toast("Serviço duplicado.");
        await recarregarEDesenhar(container);
      } catch (erro) { falha("duplicar o serviço", erro); }
    });
    tr.querySelector('[data-action="excluir"]').addEventListener("click", async () => {
      const ok = await confirmarAcao(`Excluir "${servico.nome}"? Esta ação não pode ser desfeita.`, {
        titulo: "Excluir serviço", textoConfirmar: "Excluir"
      });
      if (!ok) return;
      try {
        await excluirServico(servico.id);
        toast("Serviço excluído.");
        await recarregarEDesenhar(container);
      } catch (erro) { falha("excluir o serviço", erro); }
    });
  });
}

function falha(acao, erro) {
  console.error(`[servicos] erro ao ${acao}:`, erro);
  toast(erro?.message || `Não foi possível ${acao}.`, "error");
}

function ligarEventos(container) {
  const busca = container.querySelector("#busca-admin-servicos");
  container.querySelector("#form-busca-admin-servicos").addEventListener("submit", (e) => e.preventDefault());
  busca.addEventListener("input", () => { filtros.termo = busca.value; renderizarTabela(container); });
  container.querySelector("#filtro-admin-servicos-categoria").addEventListener("change", (e) => {
    filtros.categoriaId = e.target.value;
    renderizarTabela(container);
  });

  container.querySelector("#btn-novo-servico").addEventListener("click", () => abrirFormularioServico(container));
  container.querySelector("#btn-nova-categoria-servico").addEventListener("click", () => abrirFormularioCategoria(container));

  // categorias (editar / excluir / nova subcategoria)
  container.querySelector(".svc-admin__tree").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const cat = categorias.find(c => c.id === btn.dataset.id);
    if (!cat) return;
    if (btn.dataset.act === "editar-cat") return abrirFormularioCategoria(container, cat);
    if (btn.dataset.act === "nova-sub") return abrirFormularioCategoria(container, null, cat.id);
    if (btn.dataset.act === "excluir-cat") return excluirCategoria(container, cat);
  });

  // importação
  const inputJson = container.querySelector("#input-importar-json-servicos");
  container.querySelector("#btn-importar-json-servicos").addEventListener("click", () => inputJson.click());
  inputJson.addEventListener("change", async () => {
    const arquivo = inputJson.files?.[0];
    inputJson.value = "";
    if (!arquivo) return;
    await importarServicosJson(container, arquivo);
  });

  // prompt para IA
  const dialogPrompt = container.querySelector("#dialog-prompt-importacao-servicos");
  const textoPrompt = container.querySelector("#texto-prompt-servicos");
  container.querySelector("#btn-prompt-importacao-servicos").addEventListener("click", () => {
    textoPrompt.value = criarPromptImportacaoServicos();
    dialogPrompt.showModal();
  });
  container.querySelector("#btn-fechar-prompt-servicos").addEventListener("click", () => dialogPrompt.close());
  container.querySelector("#btn-copiar-prompt-servicos").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textoPrompt.value);
    } catch {
      textoPrompt.focus();
      textoPrompt.select();
      document.execCommand("copy");
    }
    toast("Prompt copiado. Cole na IA para gerar o arquivo JSON.");
  });
}

// ---------- CATEGORIAS ----------
async function excluirCategoria(container, cat) {
  const filhas = categorias.filter(c => c.parentId === cat.id);
  if (filhas.length) {
    toast("Esta categoria tem subcategorias. Exclua ou mova as subcategorias primeiro.", "error");
    return;
  }
  const usados = servicos.filter(s => s.categoriaId === cat.id || s.subcategoriaId === cat.id).length;
  if (usados) {
    toast(`Há ${usados} serviço(s) nesta categoria. Mude a categoria deles ou exclua-os antes.`, "error");
    return;
  }
  const ok = await confirmarAcao(`Excluir "${cat.nome}"? Esta ação não pode ser desfeita.`, {
    titulo: cat.parentId ? "Excluir subcategoria" : "Excluir categoria", textoConfirmar: "Excluir"
  });
  if (!ok) return;
  try {
    await excluirCategoriaServico(cat.id);
    toast("Categoria excluída.");
    await recarregarEDesenhar(container);
  } catch (erro) { falha("excluir a categoria", erro); }
}

function abrirFormularioCategoria(container, categoria = null, parentIdInicial = "") {
  const dialog = container.querySelector("#dialog-categoria-servico");
  const principais = categorias.filter(c => !c.parentId && c.id !== categoria?.id);
  const temFilhas = categoria && categorias.some(c => c.parentId === categoria.id);
  const parentAtual = categoria ? (categoria.parentId || "") : parentIdInicial;

  dialog.innerHTML = `
    <form id="form-categoria-servico" class="product-form">
      <h3>${categoria ? "Editar categoria" : (parentIdInicial ? "Nova subcategoria" : "Nova categoria")}</h3>
      <div class="form-grid">
        <label>Nome<input name="nome" required autocomplete="off" value="${escHtml(categoria?.nome || "")}" placeholder="Ex.: Estética"></label>
        <label>Dentro de
          <select name="parentId" ${temFilhas ? "disabled" : ""}>
            <option value="">Nenhuma (categoria principal)</option>
            ${principais.map(c => `<option value="${c.id}" ${parentAtual === c.id ? "selected" : ""}>${escHtml(c.nome)}</option>`).join("")}
          </select>
        </label>
      </div>
      ${temFilhas ? `<p class="svc-admin__ajuda">Esta categoria tem subcategorias, por isso continua como categoria principal.</p>` : ""}
      <div class="form-actions">
        <button type="button" data-fechar>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`;
  dialog.showModal();
  dialog.querySelector("[data-fechar]").addEventListener("click", () => dialog.close());

  dialog.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const nome = form.nome.value.trim();
    const parentId = temFilhas ? "" : form.parentId.value;
    if (!nome) return;

    const duplicada = categorias.some(c =>
      c.id !== categoria?.id && (c.parentId || "") === parentId && normalizarTexto(c.nome) === normalizarTexto(nome));
    if (duplicada) { toast("Já existe uma categoria com esse nome aí.", "error"); return; }

    btn.disabled = true;
    try {
      if (categoria) await atualizarCategoriaServico(categoria.id, { nome, parentId });
      else await criarCategoriaServico({ nome, parentId });
      toast("Categoria salva.");
      dialog.close();
      await recarregarEDesenhar(container);
    } catch (erro) {
      falha("salvar a categoria", erro);
      btn.disabled = false;
    }
  });
}

// ---------- FORMULÁRIO DO SERVIÇO ----------
async function abrirFormularioServico(container, servico = null) {
  const dialog = container.querySelector("#dialog-servico");
  dialog.className = "dialog-form dialog-produto";
  const arvore = montarArvoreCategorias(categorias);

  const opcoesCategoria = arvore.map(c =>
    `<option value="${c.id}" ${servico?.categoriaId === c.id ? "selected" : ""}>${escHtml(c.nome)}</option>`).join("");

  // galeria: cada item é { id, url (existente) ou file+previewUrl (novo) }
  const iniciais = Array.isArray(servico?.imagens) && servico.imagens.length
    ? servico.imagens : (servico?.imagem ? [servico.imagem] : []);
  let galeria = iniciais.map(url => ({ id: crypto.randomUUID(), url, file: null, previewUrl: null }));
  let arrastando = null;

  const linhas = (v) => escHtml((Array.isArray(v) ? v : []).join("\n"));

  dialog.innerHTML = `
    <form id="form-servico" class="product-form">
      <header class="product-form__head">
        <div class="product-form__title"><span>${icon("calendar")}</span><div><h2>${servico ? "Editar serviço" : "Novo serviço"}</h2><p>Preencha as informações do serviço para o site.</p></div></div>
        <button type="button" class="product-form__close" data-modal-close-dialog aria-label="Fechar formulário">${icon("close")}</button>
      </header>
      <div class="product-form__scroll">
        <div class="form-grid">
          <label>Nome do serviço<input name="nome" required autocomplete="off" value="${escHtml(servico?.nome || "")}" placeholder="Ex.: Limpeza de pele"></label>
          <label>Código<input name="codigo" autocomplete="off" value="${escHtml(servico?.codigo || generateCode("SERV"))}"></label>
          <label>Categoria<select name="categoriaId"><option value="">Selecione</option>${opcoesCategoria}</select></label>
          <label>Subcategoria<select name="subcategoriaId"></select></label>
          <label>Duração<input name="duracao" autocomplete="off" value="${escHtml(servico?.duracao || "")}" placeholder="Ex.: 60 min"></label>
          <label>Preço a partir de (R$)<input name="preco" type="number" step="0.01" min="0" value="${Number(servico?.preco) > 0 ? servico.preco : ""}" placeholder="Vazio = sob consulta"></label>
          <label>Status
            <select name="status">
              <option value="disponivel" ${servico?.status !== "oculto" ? "selected" : ""}>Disponível (aparece no site)</option>
              <option value="oculto" ${servico?.status === "oculto" ? "selected" : ""}>Oculto (não aparece no site)</option>
            </select>
          </label>
          <label>Sessões / frequência recomendada<input name="sessoes" autocomplete="off" value="${escHtml(servico?.sessoes || "")}" placeholder="Ex.: 1 sessão a cada 30 dias"></label>
        </div>

        <div class="galeria-produto" id="galeria-servico-wrap">
          <h4>Fotos do serviço</h4>
          <p class="galeria-produto__ajuda">A primeira foto da lista é a capa no site. Arraste as miniaturas para reordenar e use ⤡ para ajustar o enquadramento.</p>
          <div class="galeria-produto__grid" id="galeria-grid-servico"></div>
          <label class="galeria-produto__upload">
            ${icon("plus")}Escolher arquivos
            <input type="file" id="input-galeria-servico" accept="image/*" multiple hidden>
          </label>
        </div>

        <label>Descrição curta (aparece no card)
          <textarea name="descricaoCurta" rows="2" maxlength="180" placeholder="Uma frase que resume o serviço. Ex.: Remove impurezas e renova a pele do rosto.">${escHtml(servico?.descricaoCurta || "")}</textarea>
        </label>
        <label>O que é este serviço?
          <textarea name="descricao" rows="4" placeholder="Explique o que é o procedimento e o que ele faz pela cliente.">${escHtml(servico?.descricao || "")}</textarea>
        </label>
        <label>Como funciona (passo a passo) <span class="svc-admin__dica">— um passo por linha</span>
          <textarea name="comoFunciona" rows="4" placeholder="Avaliação da pele&#10;Higienização&#10;Extração&#10;Máscara e finalização">${linhas(servico?.comoFunciona)}</textarea>
        </label>
        <label>Benefícios <span class="svc-admin__dica">— um por linha</span>
          <textarea name="beneficios" rows="3" placeholder="Pele mais limpa e uniforme&#10;Previne cravos e acne">${linhas(servico?.beneficios)}</textarea>
        </label>
        <label>Indicado para <span class="svc-admin__dica">— um por linha</span>
          <textarea name="indicadoPara" rows="3" placeholder="Pele oleosa ou com cravos&#10;Quem busca manutenção mensal">${linhas(servico?.indicadoPara)}</textarea>
        </label>
        <label>Cuidados e contraindicações
          <textarea name="cuidados" rows="3" placeholder="Evitar sol por 48h após o procedimento. Não indicado para gestantes sem liberação médica.">${escHtml(servico?.cuidados || "")}</textarea>
        </label>
      </div>
      <footer class="form-actions product-form__actions">
        <button type="button" data-modal-close-dialog>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </footer>
    </form>`;

  dialog.showModal();
  dialog.querySelectorAll("[data-modal-close-dialog]").forEach(b => b.addEventListener("click", () => dialog.close()));

  const form = dialog.querySelector("#form-servico");

  // subcategorias dependem da categoria escolhida
  const selCat = form.categoriaId;
  const selSub = form.subcategoriaId;
  function preencherSubcategorias(subSelecionada = "") {
    const filhas = categorias
      .filter(c => c.parentId === selCat.value)
      .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
    selSub.innerHTML = `<option value="">${filhas.length ? "Nenhuma" : "Sem subcategorias"}</option>` +
      filhas.map(f => `<option value="${f.id}" ${subSelecionada === f.id ? "selected" : ""}>${escHtml(f.nome)}</option>`).join("");
    selSub.disabled = !filhas.length;
  }
  preencherSubcategorias(servico?.subcategoriaId || "");
  selCat.addEventListener("change", () => preencherSubcategorias(""));

  // ----- galeria -----
  const grid = dialog.querySelector("#galeria-grid-servico");
  function renderizarGaleria() {
    grid.innerHTML = galeria.map((item, i) => {
      const { src, pos } = imgPos(item.previewUrl || item.url);
      return `
      <div class="galeria-item" draggable="true" data-id="${item.id}">
        <img src="${src}" style="object-position:${pos}" alt="">
        <button type="button" class="galeria-item__ajustar" data-ajustar="${item.id}" aria-label="Ajustar posição da imagem" title="Ajustar enquadramento">⤡</button>
        <button type="button" class="galeria-item__remover" data-remover="${item.id}" aria-label="Remover imagem">${icon("close")}</button>
        ${i === 0 ? `<span class="galeria-item__principal">Principal</span>` : ""}
      </div>`;
    }).join("");

    grid.querySelectorAll("[data-ajustar]").forEach(btn => btn.addEventListener("click", () => {
      const item = galeria.find(g => g.id === btn.dataset.ajustar);
      if (!item || !ajuda.abrirAjusteEnquadramento) return;
      ajuda.abrirAjusteEnquadramento(item.previewUrl || item.url, (novaUrl) => {
        if (item.previewUrl) item.previewUrl = novaUrl; else item.url = novaUrl;
        renderizarGaleria();
      });
    }));

    grid.querySelectorAll("[data-remover]").forEach(btn => btn.addEventListener("click", async () => {
      const ok = await confirmarAcao("Remover esta foto do serviço?", { titulo: "Remover imagem" });
      if (!ok) return;
      const item = galeria.find(g => g.id === btn.dataset.remover);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      galeria = galeria.filter(g => g.id !== btn.dataset.remover);
      renderizarGaleria();
    }));

    grid.querySelectorAll(".galeria-item").forEach(el => {
      el.addEventListener("dragstart", () => { arrastando = el.dataset.id; el.classList.add("is-dragging"); });
      el.addEventListener("dragend", () => el.classList.remove("is-dragging"));
      el.addEventListener("dragover", (e) => e.preventDefault());
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!arrastando || arrastando === el.dataset.id) return;
        const de = galeria.findIndex(g => g.id === arrastando);
        const ate = galeria.findIndex(g => g.id === el.dataset.id);
        const [movido] = galeria.splice(de, 1);
        galeria.splice(ate, 0, movido);
        renderizarGaleria();
      });
    });
  }
  renderizarGaleria();

  dialog.querySelector("#input-galeria-servico").addEventListener("change", (e) => {
    [...e.target.files].forEach(file => {
      galeria.push({ id: crypto.randomUUID(), url: null, file, previewUrl: URL.createObjectURL(file) });
    });
    e.target.value = "";
    renderizarGaleria();
  });

  // ----- salvar -----
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSalvar = form.querySelector('button[type="submit"]');
    const nome = form.nome.value.trim();
    if (!nome) return;
    btnSalvar.disabled = true;

    try {
      const pendentes = galeria.filter(g => g.file);
      for (let i = 0; i < pendentes.length; i++) {
        btnSalvar.textContent = `Enviando foto ${i + 1}/${pendentes.length}...`;
        const url = await ajuda.enviarImagem(pendentes[i].file, `SERVICO-${nome.toUpperCase()}-${i + 1}`);
        if (!url) return; // enviarImagem já mostrou o erro; o formulário continua aberto
        const posSalva = imgPos(pendentes[i].previewUrl || "").pos;
        pendentes[i].url = posSalva !== "50% 50%" ? `${url}#pos=${posSalva.replace(/%/g, "").replace(" ", ",")}` : url;
        if (pendentes[i].previewUrl) URL.revokeObjectURL(pendentes[i].previewUrl);
      }

      const precoNum = parseFloat(form.preco.value);
      const imagens = galeria.map(g => g.url).filter(Boolean);
      const dados = {
        nome,
        codigo: form.codigo.value.trim() || generateCode("SERV"),
        categoriaId: form.categoriaId.value,
        subcategoriaId: form.categoriaId.value ? form.subcategoriaId.value : "",
        duracao: form.duracao.value.trim(),
        preco: Number.isFinite(precoNum) && precoNum > 0 ? precoNum : 0,
        status: form.status.value === "oculto" ? "oculto" : "disponivel",
        sessoes: form.sessoes.value.trim(),
        descricaoCurta: form.descricaoCurta.value.trim(),
        descricao: form.descricao.value.trim(),
        comoFunciona: paraLista(form.comoFunciona.value),
        beneficios: paraLista(form.beneficios.value),
        indicadoPara: paraLista(form.indicadoPara.value),
        cuidados: form.cuidados.value.trim(),
        imagens,
        imagem: imagens[0] || ""
      };

      if (servico) {
        await atualizarServico(servico.id, dados);
        toast("Serviço atualizado.");
      } else {
        await criarServico(dados);
        toast("Serviço cadastrado.");
      }
      dialog.close();
      await recarregarEDesenhar(container);
    } catch (erro) {
      falha("salvar o serviço", erro);
    } finally {
      if (dialog.open) {
        btnSalvar.disabled = false;
        btnSalvar.textContent = "Salvar";
      }
    }
  });
}

function paraLista(valor) {
  if (Array.isArray(valor)) return valor.map(v => String(v).trim()).filter(Boolean);
  return String(valor || "").split("\n").map(l => l.trim()).filter(Boolean);
}

// ---------- IMPORTAÇÃO JSON ----------
function criarPromptImportacaoServicos() {
  const arvore = montarArvoreCategorias(categorias);
  const existentes = arvore.length
    ? arvore.map(c => `- ${c.nome}${c.filhas.length ? ` (subcategorias: ${c.filhas.map(f => f.nome).join(", ")})` : ""}`).join("\n")
    : "- Nenhuma categoria cadastrada ainda. Pode criar as categorias e subcategorias que fizerem sentido.";

  return `Crie e entregue um ARQUIVO para download chamado "servicos-importacao.json" para importar os serviços no painel do Espaço Viviane Vargas (estética e salão de beleza).

Não responda com explicações, texto comum, Markdown ou blocos de código. Gere o arquivo .json anexável/baixável; o conteúdo do arquivo deve ser somente JSON válido.

O arquivo deve ter exatamente esta estrutura:
{
  "categorias": [
    {
      "nome": "Estética",
      "subcategorias": ["Facial", "Corporal"],
      "servicos": [
        {
          "nome": "Limpeza de pele",
          "subcategoria": "Facial",
          "descricaoCurta": "Frase curta que aparece no card do serviço.",
          "descricao": "Explicação do que é o serviço e o que ele faz pela cliente.",
          "comoFunciona": ["Avaliação da pele", "Higienização", "Extração", "Máscara e finalização"],
          "beneficios": ["Pele mais limpa", "Previne cravos"],
          "indicadoPara": ["Pele oleosa", "Manutenção mensal"],
          "cuidados": "Evitar sol por 48h após o procedimento.",
          "duracao": "60 min",
          "sessoes": "1 sessão a cada 30 dias",
          "preco": 120,
          "status": "disponivel",
          "codigo": "SERV-LIMPEZA-001",
          "imagens": ["https://url-publica-da-imagem.webp"]
        }
      ]
    }
  ]
}

Regras obrigatórias:
- Só "nome" é obrigatório em cada serviço. Todos os outros campos são opcionais; omita o que não souber.
- Cada categoria tem "nome", "subcategorias" (lista de textos, opcional) e "servicos" (lista). Um serviço pode ficar direto na categoria (sem "subcategoria") ou dentro de uma subcategoria, usando em "subcategoria" exatamente o mesmo nome listado em "subcategorias".
- Se um serviço não precisar de subcategoria, pode ser só o nome em texto, por exemplo: "servicos": ["Massagem", "Microagulhamento"].
- "descricaoCurta": uma frase de até 180 caracteres. "descricao": explique de forma clara e simples o que o serviço é e o que ele faz.
- "comoFunciona", "beneficios" e "indicadoPara" são listas de textos curtos. "cuidados" é um texto.
- "preco" é número (sem R$, vírgula ou texto); omita se o valor for sob consulta. "status" pode ser "disponivel" ou "oculto".
- "imagens" é opcional e só aceita URLs públicas HTTPS. Sem foto, o serviço aparece no site com imagem padrão.
- Se a categoria/subcategoria já existir no painel, mantenha exatamente a mesma grafia para não duplicar. Categorias novas serão criadas automaticamente.
- Não use comentários, reticências, texto fora do JSON, vírgula depois do último campo, base64, arquivo local ou URL privada.

Categorias já cadastradas no painel agora:
${existentes}`;
}

function paraListaImport(v) {
  if (Array.isArray(v)) return v.map(x => String(x ?? "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map(l => l.trim()).filter(Boolean);
  return [];
}

function normalizarServicoImportado(item) {
  const bruto = typeof item === "string" ? { nome: item } : (item && typeof item === "object" ? item : {});
  const nome = String(bruto.nome || "").trim();
  if (!nome) return { ok: false, nome: "(sem nome)", erros: ["nome ausente"] };

  const precoNum = Number(String(bruto.preco ?? "").replace(",", "."));
  const imagens = (Array.isArray(bruto.imagens) ? bruto.imagens : (bruto.imagem ? [bruto.imagem] : []))
    .map(u => String(u || "").trim()).filter(u => /^https:\/\//i.test(u));

  return {
    ok: true,
    dados: {
      nome,
      codigo: String(bruto.codigo || "").trim() || generateCode("SERV"),
      duracao: String(bruto.duracao || "").trim(),
      preco: Number.isFinite(precoNum) && precoNum > 0 ? precoNum : 0,
      status: bruto.status === "oculto" ? "oculto" : "disponivel",
      sessoes: String(bruto.sessoes || "").trim(),
      descricaoCurta: String(bruto.descricaoCurta || "").trim().slice(0, 180),
      descricao: String(bruto.descricao || "").trim(),
      comoFunciona: paraListaImport(bruto.comoFunciona),
      beneficios: paraListaImport(bruto.beneficios),
      indicadoPara: paraListaImport(bruto.indicadoPara),
      cuidados: Array.isArray(bruto.cuidados) ? bruto.cuidados.map(String).join("\n") : String(bruto.cuidados || "").trim(),
      imagens,
      imagem: imagens[0] || ""
    }
  };
}

/** Converte qualquer formato aceito em: { categorias: [{nome, subs:[nome]}], servicos: [{categoria, subcategoria, item}] } */
function lerEstruturaImportada(json) {
  const cats = [];
  const itens = [];
  let listaCats = [];
  let listaServicos = [];

  if (Array.isArray(json)) {
    const pareceCategoria = json.some(i => i && typeof i === "object" && (Array.isArray(i.servicos) || Array.isArray(i.subcategorias)));
    if (pareceCategoria) listaCats = json; else listaServicos = json;
  } else if (json && typeof json === "object") {
    listaCats = Array.isArray(json.categorias) ? json.categorias : [];
    listaServicos = Array.isArray(json.servicos) ? json.servicos : [];
  } else {
    return null;
  }

  for (const cat of listaCats) {
    const nomeCat = String(typeof cat === "string" ? cat : cat?.nome || "").trim();
    if (!nomeCat) continue;
    const entrada = { nome: nomeCat, subs: [] };
    cats.push(entrada);
    if (typeof cat === "string") continue;

    for (const sub of (Array.isArray(cat.subcategorias) ? cat.subcategorias : [])) {
      const nomeSub = String(typeof sub === "string" ? sub : sub?.nome || "").trim();
      if (!nomeSub) continue;
      entrada.subs.push(nomeSub);
      if (typeof sub === "object") {
        for (const s of (Array.isArray(sub.servicos) ? sub.servicos : [])) {
          itens.push({ categoria: nomeCat, subcategoria: nomeSub, item: s });
        }
      }
    }
    for (const s of (Array.isArray(cat.servicos) ? cat.servicos : [])) {
      const nomeSub = typeof s === "object" ? String(s?.subcategoria || "").trim() : "";
      if (nomeSub && !entrada.subs.some(x => normalizarTexto(x) === normalizarTexto(nomeSub))) entrada.subs.push(nomeSub);
      itens.push({ categoria: nomeCat, subcategoria: nomeSub, item: s });
    }
  }

  for (const s of listaServicos) {
    const obj = typeof s === "object" && s ? s : {};
    itens.push({
      categoria: String(obj.categoria || "").trim(),
      subcategoria: String(obj.subcategoria || "").trim(),
      item: s
    });
  }
  return { categorias: cats, servicos: itens };
}

async function importarServicosJson(container, arquivo) {
  const dialog = container.querySelector("#dialog-importar-json-servicos");
  const resultado = container.querySelector("#resultado-importacao-json-servicos");

  let estrutura;
  try {
    estrutura = lerEstruturaImportada(JSON.parse(await arquivo.text()));
    if (!estrutura) throw new Error("formato");
  } catch {
    toast("Arquivo JSON inválido. Use o formato { \"categorias\": [...] } gerado pelo botão Prompt para IA.", "error");
    return;
  }
  if (!estrutura.categorias.length && !estrutura.servicos.length) {
    toast("O arquivo não tem nenhuma categoria ou serviço.", "error");
    return;
  }

  const criadasCats = [];
  const invalidos = [];
  let importados = 0;
  let ordem = Date.now();

  // Busca categoria por nome (ignora maiúsculas/acentos) ou cria.
  async function garantirCategoria(nome, parentId = "") {
    const achada = categorias.find(c => (c.parentId || "") === parentId && normalizarTexto(c.nome) === normalizarTexto(nome));
    if (achada) return achada.id;
    const id = await criarCategoriaServico({ nome, parentId, ordem: ordem++ }, { silencioso: true });
    categorias.push({ id, nome, parentId, ordem });
    criadasCats.push(parentId ? `${categorias.find(c => c.id === parentId)?.nome} › ${nome}` : nome);
    return id;
  }

  try {
    for (const cat of estrutura.categorias) {
      const idCat = await garantirCategoria(cat.nome);
      for (const sub of cat.subs) await garantirCategoria(sub, idCat);
    }

    for (let i = 0; i < estrutura.servicos.length; i++) {
      const { categoria, subcategoria, item } = estrutura.servicos[i];
      const r = normalizarServicoImportado(item);
      if (!r.ok) { invalidos.push({ linha: i + 1, nome: r.nome, erros: r.erros }); continue; }

      const categoriaId = categoria ? await garantirCategoria(categoria) : "";
      const subcategoriaId = categoriaId && subcategoria ? await garantirCategoria(subcategoria, categoriaId) : "";

      const jaExiste = servicos.some(s =>
        normalizarTexto(s.nome) === normalizarTexto(r.dados.nome) &&
        (s.categoriaId || "") === categoriaId && (s.subcategoriaId || "") === subcategoriaId);
      if (jaExiste) { invalidos.push({ linha: i + 1, nome: r.dados.nome, erros: ["serviço já cadastrado nesta categoria"] }); continue; }

      const dados = { ...r.dados, categoriaId, subcategoriaId, ordem: ordem++ };
      const id = await criarServico(dados, { silencioso: true });
      servicos.push({ id, ...dados });
      importados++;
    }
  } catch (erro) {
    falha("concluir a importação", erro);
  } finally {
    await finalizarImportacaoServicos();
  }

  resultado.innerHTML = `
    <p><strong>${importados}</strong> serviço(s) importado(s) com sucesso.</p>
    ${criadasCats.length ? `<p><strong>${criadasCats.length}</strong> categoria(s)/subcategoria(s) criada(s): ${criadasCats.map(escHtml).join(", ")}.</p>` : ""}
    ${invalidos.length ? `
      <p><strong>${invalidos.length}</strong> ignorado(s):</p>
      <ul class="import-result__errors">
        ${invalidos.map(e => `<li>#${e.linha} "${escHtml(e.nome)}": ${escHtml(e.erros.join(", "))}</li>`).join("")}
      </ul>` : ""}`;

  dialog.querySelector("#btn-fechar-importacao-servicos").onclick = async () => {
    dialog.close();
    await recarregarEDesenhar(container);
  };
  dialog.showModal();
  if (importados) toast(`${importados} serviço(s) importado(s).`);
}
