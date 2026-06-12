const SUPABASE_URL = 'https://xoohircyfzeodoqlgkyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2hpcmN5Znplb2RvcWxna3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MjI2MDYsImV4cCI6MjA5NjE5ODYwNn0.uO3DKRrsXoLJekxIvr_sBTaZ1PKQctKZiqhpsD2NdnE';
let supabaseClient;
try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("Error al inicializar Supabase Client:", e);
    // Cliente mock seguro para evitar caídas catastróficas
    supabaseClient = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: [], error: null })
                }),
                order: () => Promise.resolve({ data: [], error: null })
            })
        })
    };
}
const userId = sessionStorage.getItem('ds_user') || 'demo_user';

const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function limpiarMarkdownFences(text) {
    if (!text) return '';
    let clean = text.trim();
    const markdownMatch = clean.match(/```(?:markdown|html)?\s?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
        clean = markdownMatch[1];
    }
    return clean.trim();
}

async function abrirModalVisualizador(doc) {
    let contenido = doc.contenido || {};
    if (typeof contenido === 'string') {
        try {
            contenido = JSON.parse(contenido);
        } catch (e) {
            console.error("Error al parsear contenido:", e);
            contenido = {};
        }
    }

    const docName = doc.nombre;
    const docId = doc.id;
    const fileLink = contenido.pdfUrl || contenido.pdfBase64 || '';
    const documentationTextRaw = contenido.documentation || '';
    const documentationText = limpiarMarkdownFences(documentationTextRaw);

    const modalBody = document.getElementById('modalBody');

    // Función para renderizar la vista de sólo lectura (PDF limpio a pantalla completa sin barra lateral)
    function renderVistaLectura() {
        // Siempre limpiar el fragmento # de la URL base y añadir parámetros frescos + cache-buster
        const fileLinkBase = fileLink ? fileLink.split('#')[0].split('?')[0] : '';
        const cacheBuster = Date.now();
        const fileLinkClean = fileLinkBase ? `${fileLinkBase}?t=${cacheBuster}#toolbar=1&navpanes=0&view=FitH` : '';
        
        modalBody.innerHTML = `
            <div class="pdf-modal-view" style="color: #fff; font-family: 'Outfit', sans-serif;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="font-size: 1.4rem; color: #a78bfa; margin: 0;">📄 ${escapeHtml(docName)}</h3>
                    <div style="display: flex; gap: 10px;">
                        <button id="btnEditarContenido" class="action-btn" style="display: inline-flex; align-items: center; background: #10b981; color: #fff; padding: 10px 18px; border-radius: 30px; font-weight: 600; font-size: 0.85rem; border: none; cursor: pointer; transition: transform 0.2s;">
                            ✏️ Editar Contenido
                        </button>
                        <a href="${fileLinkBase}" target="_blank" download="${docName}.pdf" class="action-btn" style="text-decoration: none; display: inline-flex; align-items: center; background: linear-gradient(135deg, #a78bfa, #5e6ad2); color: #fff; padding: 10px 18px; border-radius: 30px; font-weight: 600; font-size: 0.85rem; box-shadow: 0 4px 15px rgba(94, 106, 210, 0.4); border: none; cursor: pointer; transition: transform 0.2s;">
                            📥 Descargar PDF
                        </a>
                    </div>
                </div>
                <p style="color: #9ca3af; margin-bottom: 15px; font-size: 0.9rem;">
                    Este documento cuenta con un PDF almacenado de forma segura en Supabase Storage.
                </p>
                
                <!-- Visor de PDF Integrado con visualización completa sin panel de miniaturas -->
                <div style="border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15); background: #1e1e2e; margin-bottom: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);">
                    <iframe id="pdfViewerIframe" src="${fileLinkClean}" style="width: 100%; height: 550px; border: none; display: block;" onload="this.style.opacity=1" onerror="document.getElementById('pdfViewerIframe').src=this.src"></iframe>
                </div>
            </div>
        `;

        document.getElementById('btnEditarContenido')?.addEventListener('click', renderVistaEdicion);
    }

    // Función para renderizar el editor WYSIWYG con TinyMCE + Preview PDF en vivo
    function renderVistaEdicion() {
        modalBody.innerHTML = `
            <div class="edit-modal-view" style="color: #fff; font-family: 'Outfit', sans-serif;">
                <div style="flex-shrink:0; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                    <h3 style="font-size:1.3rem; color:#a78bfa; margin:0;">✏️ Editar: ${escapeHtml(docName)}</h3>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button id="btnGuardarEdicion" class="action-btn" style="display:inline-flex; align-items:center; background:#10b981; color:#fff; padding:10px 18px; border-radius:30px; font-weight:600; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.2s;">
                            💾 Guardar
                        </button>
                        <button id="btnGuardarYVer" class="action-btn" style="display:inline-flex; align-items:center; background:linear-gradient(135deg,#a78bfa,#5e6ad2); color:#fff; padding:10px 18px; border-radius:30px; font-weight:600; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.2s; box-shadow:0 4px 15px rgba(94,106,210,0.4);">
                            💾 Guardar y Ver
                        </button>
                        <button id="btnCancelarEdicion" class="action-btn" style="display:inline-flex; align-items:center; background:#6b7280; color:#fff; padding:10px 18px; border-radius:30px; font-weight:600; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.2s;">
                            ❌ Cancelar
                        </button>
                    </div>
                </div>
                <p style="color:#9ca3af; margin-bottom:10px; font-size:0.85rem; flex-shrink:0;">
                    Usa el botón <b>Salto de página</b> en la barra de herramientas para cortar las hojas. La vista previa se actualiza automáticamente.
                </p>
                <div style="display:flex; gap:14px; overflow:hidden; height:720px;">
                    <div style="flex:1 1 50%; min-width:320px; height:100%;">
                        <textarea id="editorTiny"></textarea>
                    </div>
                    <div style="flex:1 1 50%; min-width:320px; display:flex; flex-direction:column; background:#161621; border-radius:12px; border:1px solid rgba(255,255,255,0.1); overflow:hidden; height:100%;">
                        <div style="flex-shrink:0; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#a78bfa; font-weight:600; font-size:0.9rem;">📄 Vista Previa PDF</span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span id="previewStatus" style="color:#6b7280; font-size:0.75rem;">Listo</span>
                                <button id="btnActualizarPreview" class="action-btn" style="background:rgba(94,106,210,0.2); border:1px solid rgba(94,106,210,0.4); color:#a78bfa; padding:4px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer;">🔄 Actualizar</button>
                            </div>
                        </div>
                        <iframe id="pdfPreviewIframe" style="flex:1; width:100%; border:none; background:#1e1e2e;"></iframe>
                    </div>
                </div>
            </div>
        `;

        // Preparar HTML inicial
        let docHtml = '';
        if (documentationText.trim().startsWith('<') || documentationText.trim().includes('</p>') || documentationText.trim().includes('</h1>')) {
            docHtml = documentationText;
        } else {
            docHtml = window.marked.parse(documentationText);
        }

        // Función auxiliar: limpiar HTML para PDF
        function prepararHtmlParaPdf(rawHtml) {
            return rawHtml
                .replace(/<!-- pagebreak -->/gi, '<div class="html2pdf__page-break"></div>')
                .replace(/<hr[^>]*class=["']?mce-pagebreak["']?[^>]*>/gi, '<div class="html2pdf__page-break"></div>')
                .replace(/<div[^>]*class=["']?mce-pagebreak["']?[^>]*>.*?<\/div>/gi, '<div class="html2pdf__page-break"></div>');
        }

        // Función auxiliar: generar Blob PDF desde HTML limpio
        async function generarPdfBlob(pdfHtml, esPreview = false) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
            const hiddenDiv = document.createElement('div');
            hiddenDiv.style.cssText = 'width:210mm;background:#ffffff;padding:15mm 20mm;box-sizing:border-box;color:#1f2937;';
            hiddenDiv.innerHTML = pdfHtml;
            wrapper.appendChild(hiddenDiv);
            document.body.appendChild(wrapper);

            hiddenDiv.querySelectorAll('*').forEach(el => {
                el.style.backgroundColor = 'transparent';
                if (el.classList.contains('html2pdf__page-break')) {
                    el.style.cssText = 'page-break-after: always; height: 0px; margin: 0px; padding: 0px; border: none; overflow: hidden;';
                    return;
                }
                if (el.tagName === 'H1' || el.tagName === 'H2' || el.tagName === 'H3' || el.tagName === 'H4') {
                    el.style.color = '#1e3a8a';
                    el.style.borderBottom = '2px solid #e5e7eb';
                    el.style.paddingBottom = '6px';
                    el.style.marginTop = '28px';
                    el.style.marginBottom = '16px';
                    el.style.fontWeight = '700';
                    el.style.pageBreakAfter = 'avoid';
                } else if (el.tagName === 'P') {
                    el.style.color = '#374151';
                    el.style.lineHeight = '1.7';
                    el.style.marginBottom = '16px';
                } else if (el.tagName === 'TABLE') {
                    el.style.width = '100%';
                    el.style.borderCollapse = 'collapse';
                    el.style.marginBottom = '20px';
                    el.style.pageBreakInside = 'avoid';
                } else if (el.tagName === 'TR') {
                    el.style.pageBreakInside = 'avoid';
                } else if (el.tagName === 'TH') {
                    el.style.color = '#111827';
                    el.style.backgroundColor = '#e5e7eb';
                    el.style.border = '2px solid #374151';
                    el.style.fontWeight = '700';
                    el.style.padding = '10px';
                    el.style.fontSize = '0.9rem';
                } else if (el.tagName === 'TD') {
                    el.style.color = '#111827';
                    el.style.border = '1.5px solid #6b7280';
                    el.style.padding = '10px';
                    el.style.fontSize = '0.85rem';
                } else if (el.tagName === 'A') {
                    el.style.color = '#2563eb';
                } else if (el.tagName === 'PRE' || el.tagName === 'CODE') {
                    el.style.backgroundColor = '#f8fafc';
                    el.style.color = '#0f172a';
                    el.style.border = '1px solid #e2e8f0';
                    el.style.padding = '12px';
                    el.style.borderRadius = '6px';
                    el.style.fontSize = '0.85rem';
                    el.style.whiteSpace = 'pre-wrap';
                    el.style.wordBreak = 'break-all';
                    el.style.pageBreakInside = 'avoid';
                } else if (el.tagName === 'LI') {
                    el.style.color = '#374151';
                    el.style.marginBottom = '8px';
                    el.style.lineHeight = '1.6';
                } else {
                    el.style.color = '#374151';
                }
            });

            const opt = {
                margin: [10, 10, 10, 10],
                filename: `${docName}.pdf`,
                image: { type: 'jpeg', quality: esPreview ? 0.85 : 0.98 },
                html2canvas: { scale: esPreview ? 1 : 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'] }
            };

            const pdfBlob = await window.html2pdf().set(opt).from(hiddenDiv).output('blob');
            document.body.removeChild(wrapper);
            return pdfBlob;
        }

        let previewDebounceTimer = null;
        let currentPreviewUrl = null;
        let isGeneratingPreview = false;

        async function actualizarPreview() {
            if (isGeneratingPreview) return;
            const editor = window.tinymce.get('editorTiny');
            if (!editor) return;
            const statusEl = document.getElementById('previewStatus');
            isGeneratingPreview = true;
            if (statusEl) statusEl.innerText = 'Generando...';

            try {
                const rawHtml = editor.getContent();
                const pdfHtml = prepararHtmlParaPdf(rawHtml);
                const blob = await generarPdfBlob(pdfHtml, true);

                if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
                currentPreviewUrl = URL.createObjectURL(blob);

                const iframe = document.getElementById('pdfPreviewIframe');
                if (iframe) iframe.src = currentPreviewUrl + '#toolbar=0&navpanes=0&view=FitH';
                if (statusEl) statusEl.innerText = 'Actualizado';
            } catch (e) {
                console.warn('Error al generar vista previa:', e);
                if (statusEl) statusEl.innerText = 'Error';
            } finally {
                isGeneratingPreview = false;
            }
        }

        // Inicializar TinyMCE
        if (window.tinymce) {
            window.tinymce.remove('#editorTiny');
        }
        window.tinymce.init({
            selector: '#editorTiny',
            height: 650,
            plugins: 'pagebreak lists table code searchreplace fullscreen',
            toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | table | pagebreak | removeformat',
            skin: 'oxide-dark',
            content_css: false,
            content_style: `
                body {
                    background: #ffffff !important;
                    color: #1f2937 !important;
                    font-family: 'Outfit', sans-serif;
                    font-size: 11pt;
                    line-height: 1.7;
                    padding: 16px;
                    /* Líneas guía punteadas cada ~920px (aprox A4) */
                    background-image: repeating-linear-gradient(
                        to bottom,
                        transparent,
                        transparent 920px,
                        rgba(167, 139, 250, 0.35) 920px,
                        rgba(167, 139, 250, 0.35) 921px
                    ) !important;
                }
                h1, h2, h3, h4 {
                    color: #1e3a8a;
                    font-weight: 700;
                    margin-top: 20px;
                    margin-bottom: 10px;
                }
                p { margin-bottom: 12px; }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-bottom: 16px;
                }
                th, td {
                    border: 1px solid #9ca3af;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #e5e7eb;
                    font-weight: 700;
                }
                img { max-width: 100%; height: auto; }
                a { color: #2563eb; }
                hr.mce-pagebreak {
                    border: none;
                    border-top: 3px dashed #a78bfa;
                    margin: 20px 0;
                    height: 3px;
                    background: transparent;
                }
            `,
            setup: function(editor) {
                editor.on('init', function() {
                    editor.setContent(docHtml);
                    setTimeout(actualizarPreview, 800);
                });
                editor.on('input change undo redo setcontent', function() {
                    clearTimeout(previewDebounceTimer);
                    const statusEl = document.getElementById('previewStatus');
                    if (statusEl) statusEl.innerText = 'Escribiendo...';
                    previewDebounceTimer = setTimeout(actualizarPreview, 2500);
                });
            }
        });

        document.getElementById('btnActualizarPreview')?.addEventListener('click', actualizarPreview);

        document.getElementById('btnCancelarEdicion')?.addEventListener('click', () => {
            if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
            window.tinymce.remove('#editorTiny');
            renderVistaLectura();
        });

        async function guardarCambios(verDespues = false) {
            const editor = window.tinymce.get('editorTiny');
            if (!editor) {
                alert('El editor no está listo aún. Espera un momento e intenta de nuevo.');
                return;
            }
            const nuevoHtml = prepararHtmlParaPdf(editor.getContent());

            const btnGuardar = document.getElementById('btnGuardarEdicion');
            const btnVer = document.getElementById('btnGuardarYVer');
            if (btnGuardar) { btnGuardar.disabled = true; }
            if (btnVer) { btnVer.disabled = true; }

            const btnActivo = verDespues ? btnVer : btnGuardar;
            if (btnActivo) btnActivo.innerText = '⚡ Regenerando PDF...';

            try {
                const pdfBlob = await generarPdfBlob(nuevoHtml);

                // Eliminar el PDF anterior de Storage si existe
                const urlAnterior = contenido.pdfUrl || '';
                if (urlAnterior) {
                    try {
                        const storagePrefix = '/storage/v1/object/public/documentos_pdf/';
                        const idxPrefix = urlAnterior.indexOf(storagePrefix);
                        if (idxPrefix !== -1) {
                            const pathAnterior = decodeURIComponent(urlAnterior.substring(idxPrefix + storagePrefix.length).split('?')[0].split('#')[0]);
                            await supabaseClient.storage.from('documentos_pdf').remove([pathAnterior]);
                        }
                    } catch (delErr) {
                        console.warn('No se pudo eliminar el PDF anterior:', delErr);
                    }
                }

                // Subir el nuevo PDF a Storage
                const nuevoFilePath = `user_${doc.usuario_id || userId}/${docId}_documentacion.pdf`;
                const { data: uploadData, error: uploadError } = await supabaseClient.storage
                    .from('documentos_pdf')
                    .upload(nuevoFilePath, pdfBlob, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                // Obtener URL pública
                const { data: publicUrlData } = supabaseClient.storage
                    .from('documentos_pdf')
                    .getPublicUrl(nuevoFilePath);

                const nuevaPdfUrl = publicUrlData.publicUrl;

                // Actualizar la base de datos
                const nuevoContenido = {
                    ...contenido,
                    documentation: nuevoHtml,
                    pdfUrl: nuevaPdfUrl
                };

                const { error: updateError } = await supabaseClient
                    .from('documentos')
                    .update({
                        contenido: nuevoContenido,
                        fecha_mod: new Date().toISOString()
                    })
                    .eq('id', docId);

                if (updateError) throw updateError;

                // Registrar log de edicion de contenido
                try {
                    await fetch('/api/logs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            usuarioId: userId,
                            usuarioEmail: sessionStorage.getItem('ds_email') || '',
                            accion: 'editar_contenido',
                            detalles: {
                                documentoId: docId,
                                nombreDocumento: docName
                            }
                        })
                    });
                } catch (logErr) {
                    console.error('Error registrando log de edicion:', logErr);
                }

                if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
                window.tinymce.remove('#editorTiny');

                contenido = nuevoContenido;
                doc.contenido = nuevoContenido;

                alert('¡Cambios guardados y PDF regenerado con éxito!');
                renderTodo();

                if (verDespues) {
                    setTimeout(() => {
                        abrirModalVisualizador(doc);
                    }, 600);
                } else {
                    document.getElementById('docModal').style.display = 'none';
                }

            } catch (err) {
                console.error("Error al guardar edición:", err);
                alert("Error al guardar cambios: " + err.message);
                if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerText = '💾 Guardar'; }
                if (btnVer) { btnVer.disabled = false; btnVer.innerText = '💾 Guardar y Ver'; }
            }
        }

        document.getElementById('btnGuardarEdicion')?.addEventListener('click', () => guardarCambios(false));
        document.getElementById('btnGuardarYVer')?.addEventListener('click', () => guardarCambios(true));
    }

    renderVistaLectura();
    document.getElementById('docModal').style.display = 'flex';
}

function obtenerDocumentosSimulados() {
    return [
        {
            id: 'sim_1',
            nombre: 'farmaciaDB_auditoria_final',
            acceso: 'Personal',
            fecha_mod: new Date().toISOString(),
            contenido: {
                documentation: '# Auditoría de FarmaciaDB\nAnálisis heurístico completado con 100% de normalización.',
                pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            }
        },
        {
            id: 'sim_2',
            nombre: 'tienda_ventas_nosql_doc',
            acceso: 'Personal',
            fecha_mod: new Date(Date.now() - 86400000).toISOString(),
            contenido: {
                documentation: '# Análisis NoSQL de Ventas\nEstructuras de colecciones indexadas de forma óptima.',
                pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            }
        }
    ];
}

function obtenerPapeleraSimulada() {
    return [
        {
            id: 'trash_sim_1',
            nombre: 'borrador_esquema_antiguo',
            acceso: 'Personal',
            fecha_eliminacion: new Date(Date.now() - 172800000).toISOString(),
            contenido: { documentation: 'Borrador antiguo' }
        }
    ];
}

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => m==='&'?'&amp;':m==='<'?'&lt;':'&gt;'); }

const timeoutPromise = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

async function cargarDocumentos() {
    if (!isUuid(userId)) {
        console.warn("userId no es un UUID válido. Cargando documentos simulados.");
        return obtenerDocumentosSimulados();
    }

    let data = [];
    try {
        const fetchPromise = supabaseClient.from('documentos').select('*').eq('usuario_id', userId).order('created_at', { ascending: false });
        const result = await Promise.race([fetchPromise, timeoutPromise(5000)]);
        if (result.error) console.error("Error al cargar documentos:", result.error);
        data = result.data || [];
    } catch (e) {
        console.warn("Carga de documentos de Supabase excedió tiempo límite o falló.");
    }
    
    return data;
}

async function cargarPapelera() {
    if (!isUuid(userId)) {
        console.warn("userId no es un UUID válido. Cargando papelera simulada.");
        return obtenerPapeleraSimulada();
    }

    let data = [];
    try {
        const fetchPromise = supabaseClient.from('papelera').select('*').eq('usuario_id', userId);
        const result = await Promise.race([fetchPromise, timeoutPromise(5000)]);
        if (result.error) console.error("Error al cargar papelera:", result.error);
        data = result.data || [];
    } catch (e) {
        console.warn("Carga de papelera de Supabase excedió tiempo límite o falló.");
    }
    
    return data;
}

async function moverAPapelera(id, nombre, acceso, contenido) {
    if (!isUuid(userId)) {
        alert("Operación no permitida en modo de demostración.");
        return;
    }
    await supabaseClient.from('papelera').insert([{ usuario_id: userId, nombre, acceso, fecha_eliminacion: new Date().toISOString(), contenido }]);
    await supabaseClient.from('documentos').delete().eq('id', id);
    try {
        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: userId,
                usuarioEmail: sessionStorage.getItem('ds_email') || '',
                accion: 'mover_papelera',
                detalles: { nombreDocumento: nombre, documentoId: id }
            })
        });
    } catch (logErr) {
        console.error('Error registrando log de papelera:', logErr);
    }
}

async function restaurarDocumento(papId, nombre, acceso, contenido) {
    if (!isUuid(userId)) {
        alert("Operación no permitida en modo de demostración.");
        return;
    }
    await supabaseClient.from('documentos').insert([{ usuario_id: userId, nombre, acceso, fecha_mod: new Date().toISOString(), contenido }]);
    await supabaseClient.from('papelera').delete().eq('id', papId);
    try {
        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: userId,
                usuarioEmail: sessionStorage.getItem('ds_email') || '',
                accion: 'restaurar_documento',
                detalles: { nombreDocumento: nombre, documentoId: papId }
            })
        });
    } catch (logErr) {
        console.error('Error registrando log de restaurar:', logErr);
    }
}
async function eliminarPermanente(papId) { 
    await supabaseClient.from('papelera').delete().eq('id', papId); 
    try {
        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: userId,
                usuarioEmail: sessionStorage.getItem('ds_email') || '',
                accion: 'eliminar_definitivo',
                detalles: { documentoId: papId }
            })
        });
    } catch (logErr) {
        console.error('Error registrando log de eliminar definitivo:', logErr);
    }
}
async function limpiarPapelera() {
    const items = await cargarPapelera(); const ahora = new Date();
    for (const item of items) {
        const dias = (ahora - new Date(item.fecha_eliminacion)) / (86400000);
        if (dias >= 15) await eliminarPermanente(item.id);
    }
}

let activeDocsList = [];
let trashDocsList = [];

async function renderDocumentosActivos() {
    activeDocsList = await cargarDocumentos();
    const container = document.getElementById('documentosContainer');
    if (activeDocsList.length === 0) { 
        container.innerHTML = `<div class="seccion-tabla"><h2>📄 Documentos activos</h2><div class="empty-message">No hay documentos guardados.</div></div>`; 
        return; 
    }
    let html = `
    <style>
        .dropdown-item {
            display: block;
            padding: 10px 14px;
            text-decoration: none;
            font-size: 0.9rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        .dropdown-item:hover {
            background: rgba(255, 255, 255, 0.08);
        }
        .dropdown-item[disabled] {
            opacity: 0.4;
            pointer-events: none;
            cursor: not-allowed;
        }
    </style>
    <div class="seccion-tabla">
        <h2>📄 Documentos activos</h2>
        <div class="table-responsive" style="overflow-x: auto; width: 100%;">
            <table class="doc-table" style="width: 100%; min-width: 600px;">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Acceso</th>
                        <th>Fecha modificación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>`;
                
    activeDocsList.forEach((doc, idx) => {
        let fechaModStr = 'No disponible';
        if (doc.fecha_mod) {
            const dateObj = new Date(doc.fecha_mod);
            if (!isNaN(dateObj.getTime())) {
                fechaModStr = dateObj.toLocaleDateString();
            }
        }
        
        // Verificar si contiene esquema para habilitar o no las opciones avanzadas
        const hasSchema = doc.contenido && (typeof doc.contenido === 'string' ? JSON.parse(doc.contenido).schema : doc.contenido.schema);
        const disabledAttr = hasSchema ? '' : 'disabled style="opacity: 0.4; cursor: not-allowed; pointer-events: none;"';
        
        html += `<tr>
            <td>${escapeHtml(doc.nombre)}</td>
            <td>${escapeHtml(doc.acceso)}</td>
            <td>${fechaModStr}</td>
            <td>
                <div class="action-buttons" style="display: flex; gap: 8px; align-items: center; white-space: nowrap;">
                    <button class="view-doc" data-idx="${idx}" style="padding: 6px 12px; border-radius: 8px; font-weight: 500; min-width: 100px;">Ver y Editar</button>
                    
                    <select class="actions-select" data-idx="${idx}" style="background: rgba(255, 255, 255, 0.05); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 8px; font-weight: 500; cursor: pointer; outline: none; font-family: 'Outfit', sans-serif;">
                        <option value="" disabled selected style="background: #151922; color: #9ca3af;">Acciones ▾</option>
                        <option value="diagram" ${hasSchema ? '' : 'disabled'} style="background: #151922; color: #a78bfa;">Diagrama ER</option>
                        <option value="schema" ${hasSchema ? '' : 'disabled'} style="background: #151922; color: #60a5fa;">Esquema</option>
                        <option value="converter" ${hasSchema ? '' : 'disabled'} style="background: #151922; color: #fbbf24;">Convertidor</option>
                        <option value="testdata" ${hasSchema ? '' : 'disabled'} style="background: #151922; color: #f43f5e;">Datos Prueba</option>
                        <option value="edit" style="background: #151922; color: #eef2ff;">Editar Nombre</option>
                        <option value="share" style="background: #151922; color: #34d399;">Compartir</option>
                        <option value="delete" style="background: #151922; color: #f87171;">Eliminar</option>
                    </select>
                </div>
            </td>
        </tr>`;
    });
    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    document.querySelectorAll('.view-doc').forEach(btn => btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const doc = activeDocsList[idx];
        abrirModalVisualizador(doc);
    }));

    document.querySelectorAll('.actions-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const action = e.target.value;
            const idx = parseInt(select.dataset.idx);
            const doc = activeDocsList[idx];
            if (!action) return;

            // Restablecer el select al placeholder
            select.value = "";

            switch (action) {
                case 'diagram':
                    abrirModalDiagrama(doc);
                    break;
                case 'schema':
                    abrirModalEsquema(doc);
                    break;
                case 'converter':
                    abrirModalConvertidor(doc);
                    break;
                case 'testdata':
                    abrirModalDatosPrueba(doc);
                    break;
                case 'edit':
                    const nuevo = prompt('Nuevo nombre:', doc.nombre);
                    if (nuevo) {
                        await supabaseClient.from('documentos').update({ nombre: nuevo.trim() }).eq('id', doc.id);
                        
                        // Registrar log de renombrar
                        try {
                            await fetch('/api/logs', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    usuarioId: userId,
                                    usuarioEmail: sessionStorage.getItem('ds_email') || '',
                                    accion: 'renombrar_documento',
                                    detalles: {
                                        documentoId: doc.id,
                                        nombreAnterior: doc.nombre,
                                        nombreNuevo: nuevo.trim()
                                    }
                                })
                            });
                        } catch (logErr) {
                            console.error('Error registrando log de renombrar:', logErr);
                        }

                        renderTodo();
                    }
                    break;
                case 'share':
                    mostrarModalCompartir(doc);
                    break;
                case 'delete':
                    if (confirm(`¿Mover "${doc.nombre}" a la papelera?`)) {
                        await moverAPapelera(doc.id, doc.nombre, doc.acceso, doc.contenido);
                        renderTodo();
                    }
                    break;
            }
        });
    });
}


async function renderPapelera() {
    await limpiarPapelera();
    trashDocsList = await cargarPapelera();
    const container = document.getElementById('papeleraContainer');
    if (trashDocsList.length === 0) { 
        container.innerHTML = `<div class="seccion-tabla"><h2>🗑️ Papelera</h2><div class="empty-message">Papelera vacía.</div></div>`; 
        return; 
    }
    const ahora = new Date();
    let html = `<div class="seccion-tabla"><h2>🗑️ Papelera (eliminación tras 15 días)</h2><table class="doc-table"><thead><tr><th>Nombre</th><th>Eliminado el</th><th>Tiempo restante</th><th>Acciones</th></tr></thead><tbody>`;
    trashDocsList.forEach((item, idx) => {
        let fechaElimStr = 'No disponible';
        let restanteStr = '15 días';
        if (item.fecha_eliminacion) {
            const fechaElim = new Date(item.fecha_eliminacion);
            if (!isNaN(fechaElim.getTime())) {
                fechaElimStr = fechaElim.toLocaleDateString();
                const dias = Math.floor((ahora - fechaElim) / 86400000);
                restanteStr = `${Math.max(0, 15 - dias)} días`;
            }
        }
        html += `<tr><td>${escapeHtml(item.nombre)}</td><td>${fechaElimStr}</td><td>${restanteStr}</td><td class="action-buttons"><button class="restore-pap" data-idx="${idx}">Restaurar</button><button class="delete-perm" data-idx="${idx}">Eliminar definitivo</button></td></tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;

    document.querySelectorAll('.restore-pap').forEach(btn => btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const item = trashDocsList[idx];
        await restaurarDocumento(item.id, item.nombre, item.acceso, item.contenido);
        renderTodo();
    }));

    document.querySelectorAll('.delete-perm').forEach(btn => btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.idx);
        const item = trashDocsList[idx];
        if (confirm(`¿Eliminar "${item.nombre}" permanentemente?`)) {
            await eliminarPermanente(item.id);
            renderTodo();
        }
    }));
}

async function renderTodo() {
    document.getElementById('documentosContainer').innerHTML = '<div class="loading">Cargando documentos...</div>';
    document.getElementById('papeleraContainer').innerHTML = '<div class="loading">Cargando papelera...</div>';
    await renderDocumentosActivos();
    await renderPapelera();
}

const modal = document.getElementById('docModal');
document.querySelector('.close-modal')?.addEventListener('click', () => { 
    if (modal) modal.style.display = 'none'; 
    if (window.tinymce) window.tinymce.remove('#editorTiny');
});
window.addEventListener('click', (e) => { 
    if (modal && e.target === modal) {
        modal.style.display = 'none'; 
        if (window.tinymce) window.tinymce.remove('#editorTiny');
    }
});
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await supabaseClient.auth.signOut();
    } catch (err) {
        console.error('Error signing out:', err);
    }
    sessionStorage.clear();
    window.location.href = '/';
});

async function mostrarModalCompartir(doc) {
    if (doc.id.startsWith('sim_') || !isUuid(userId)) {
        alert("Esta función requiere estar autenticado con una cuenta real y tener documentos guardados en Supabase.");
        return;
    }
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = '<div class="loading">Cargando datos para compartir...</div>';
    document.getElementById('docModal').style.display = 'flex';
    
    try {
        // 1. Obtener todos los perfiles de usuario
        const { data: perfiles, error: perfError } = await supabaseClient
            .from('perfiles')
            .select('id, nombres, apellidos')
            .neq('id', userId); // Excluir al usuario actual
            
        if (perfError) throw perfError;
        
        // 2. Obtener usuarios con acceso actual al documento
        const { data: compartidos, error: compError } = await supabaseClient
            .from('compartidos')
            .select('id, usuario_compartido_id, permiso')
            .eq('documento_id', doc.id);
            
        if (compError) throw compError;
        
        // Renderizar la UI del modal de compartir
        let userOptions = perfiles.map(p => `<option value="${p.id}">${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)}</option>`).join('');
        if (perfiles.length === 0) {
            userOptions = `<option value="">No hay otros usuarios registrados</option>`;
        }
        
        const compartidosConNombre = compartidos.map(c => {
            const perfil = perfiles.find(p => p.id === c.usuario_compartido_id);
            return {
                id: c.id,
                nombreCompleto: perfil ? `${perfil.nombres} ${perfil.apellidos}` : 'Usuario desconocido',
                permiso: c.permiso || 'ver'
            };
        });
        
        let sharedListHtml = compartidosConNombre.map(c => `
            <div class="shared-user-item">
                <span class="shared-user-name" style="display: inline-flex; align-items: center; gap: 8px;">
                    👤 ${escapeHtml(c.nombreCompleto)}
                    <span style="display:inline-flex; align-items:center; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; 
                        ${c.permiso === 'editar' ? 'background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.2);' : 'background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.2);'}">
                        ${c.permiso === 'editar' ? 'Editor' : 'Lector'}
                    </span>
                </span>
                <button class="revoke-share-btn" data-share-id="${c.id}">Quitar acceso</button>
            </div>
        `).join('');
        
        if (compartidosConNombre.length === 0) {
            sharedListHtml = '<div class="empty-message" style="padding:15px; font-size:0.85rem;">Este documento aún no ha sido compartido.</div>';
        }
        
        modalBody.innerHTML = `
            <div class="share-modal-container">
                <h3 class="share-modal-title">Compartir Documento</h3>
                <p style="margin-bottom: 20px; font-size: 0.95rem; color: #9ca3af;">
                    Documento: <strong style="color: #f3f4f6;">${escapeHtml(doc.nombre)}</strong>
                </p>
                
                <div class="share-form" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 10px;">
                        <select id="shareUserSelect" class="share-select" style="flex: 1;" ${perfiles.length === 0 ? 'disabled' : ''}>
                            ${userOptions}
                        </select>
                        <select id="sharePermisoSelect" class="share-select" style="width: 170px;">
                            <option value="ver">Lector (Solo ver)</option>
                            <option value="editar">Editor (Ver y editar)</option>
                        </select>
                    </div>
                    <button id="btnConcederAcceso" class="share-submit-btn" ${perfiles.length === 0 ? 'disabled' : ''}>
                        Conceder Acceso
                    </button>
                </div>
                
                <h4 class="shared-list-title">Usuarios con acceso:</h4>
                <div class="shared-users-list">
                    ${sharedListHtml}
                </div>
            </div>
        `;
        
        document.getElementById('btnConcederAcceso')?.addEventListener('click', async () => {
            const selectEl = document.getElementById('shareUserSelect');
            const targetUserId = selectEl.value;
            const permisoEl = document.getElementById('sharePermisoSelect');
            const permiso = permisoEl ? permisoEl.value : 'ver';
            if (!targetUserId) return;
            
            const btn = document.getElementById('btnConcederAcceso');
            btn.disabled = true;
            btn.innerText = 'Compartiendo...';
            
            try {
                const { error } = await supabaseClient.from('compartidos').insert([
                    {
                        documento_id: doc.id,
                        usuario_compartido_id: targetUserId,
                        permiso: permiso
                    }
                ]);
                if (error) {
                    if (error.code === '23505') {
                        alert('Este documento ya está compartido con ese usuario.');
                    } else {
                        throw error;
                    }
                } else {
                    // Registrar log de compartir exitoso
                    try {
                        await fetch('/api/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                usuarioId: userId,
                                usuarioEmail: sessionStorage.getItem('ds_email') || '',
                                accion: 'compartir_documento',
                                detalles: {
                                    documentoId: doc.id,
                                    nombreDocumento: doc.nombre,
                                    compartidoConId: targetUserId,
                                    permiso: permiso
                                }
                            })
                        });
                    } catch (logErr) {
                        console.error('Error registrando log de compartir:', logErr);
                    }

                    mostrarModalCompartir(doc);
                }
            } catch (err) {
                console.error(err);
                alert('Error al compartir: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = 'Conceder Acceso';
            }
        });
        
        document.querySelectorAll('.revoke-share-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const shareId = btn.dataset.shareId;
                if (!shareId) return;
                
                btn.disabled = true;
                btn.innerText = 'Quitando...';
                
                try {
                    const { error } = await supabaseClient.from('compartidos').delete().eq('id', shareId);
                    if (error) throw error;

                    // Registrar log de revocar compartir exitoso
                    try {
                        await fetch('/api/logs', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                usuarioId: userId,
                                usuarioEmail: sessionStorage.getItem('ds_email') || '',
                                accion: 'revocar_compartir',
                                detalles: {
                                    documentoId: doc.id,
                                    nombreDocumento: doc.nombre,
                                    shareId: shareId
                                }
                            })
                        });
                    } catch (logErr) {
                        console.error('Error registrando log de revocar:', logErr);
                    }

                    mostrarModalCompartir(doc);
                } catch (err) {
                    console.error(err);
                    alert('Error al revocar acceso: ' + err.message);
                    btn.disabled = false;
                    btn.innerText = 'Quitar acceso';
                }
            });
        });
        
    } catch (err) {
        console.error("Error al cargar modal de compartir:", err);
        modalBody.innerHTML = `<div class="empty-message" style="color: #f87171;">⚠️ Error al cargar: ${escapeHtml(err.message)}</div>`;
    }
}

renderTodo();

// ==========================================
// NUEVAS FUNCIONES PARA LOS BOTONES DE ACCIÓN ADICIONALES (OPCIÓN B)
// ==========================================

async function abrirModalDiagrama(doc) {
    let contenido = doc.contenido || {};
    if (typeof contenido === 'string') {
        try { contenido = JSON.parse(contenido); } catch (e) { contenido = {}; }
    }
    
    const docName = doc.nombre;
    const schema = contenido.schema;
    const modalBody = document.getElementById('modalBody');
    document.getElementById('docModal').style.display = 'flex';
    
    if (!schema || !schema.tables || schema.tables.length === 0) {
        modalBody.innerHTML = `
            <div class="diagram-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; padding: 20px;">
                <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 15px;">📊 Diagrama ER: ${escapeHtml(docName)}</h3>
                <p style="color: #f87171;">Este documento no contiene información de esquema para generar un diagrama.</p>
            </div>
        `;
        return;
    }

    modalBody.innerHTML = `
        <div class="diagram-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; height: 100%;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; flex-wrap: wrap; gap: 10px; flex-shrink: 0;">
                <h3 style="font-size: 1.4rem; color: #a78bfa; margin: 0;">📊 Diagrama ER: ${escapeHtml(docName)}</h3>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div class="zoom-controls" style="display: flex; align-items: center; gap: 10px;">
                        <label for="modalDiagramZoom" style="font-size: 0.9rem;">Zoom:</label>
                        <input type="range" id="modalDiagramZoom" min="0.5" max="2" step="0.1" value="1" style="cursor: pointer;">
                        <span id="modalZoomValue" style="font-size: 0.9rem; min-width: 45px;">100%</span>
                    </div>
                    <button id="btnDownloadModalDiagram" class="action-btn" style="background: linear-gradient(135deg, #a78bfa, #5e6ad2); color: #fff; border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                        Descargar SVG
                    </button>
                </div>
            </div>
            
            <div class="diagram-container" style="flex: 1; overflow: auto; background: #0c0e12; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; padding: 20px; min-height: 400px; max-height: calc(95vh - 150px);">
                <div id="modalMermaidDiagram" class="mermaid" style="transition: transform 0.2s; transform-origin: center center;"></div>
            </div>
        </div>
    `;

    // Generar sintaxis de Mermaid
    let mermaidCode = 'erDiagram\n';
    schema.tables.forEach(table => {
        const cleanTableName = table.name.replace(/\s+/g, '_');
        mermaidCode += `    ${cleanTableName} {\n`;
        table.columns.forEach(col => {
            const type = col.type.split('(')[0].replace(/\s+/g, '_');
            const name = col.name.replace(/\s+/g, '_');
            const pk = col.primaryKey ? 'PK' : '';
            mermaidCode += `        ${type} ${name} ${pk}\n`;
        });
        mermaidCode += `    }\n`;
    });

    if (schema.relations && schema.relations.length > 0) {
        schema.relations.forEach(rel => {
            const from = rel.from.replace(/\s+/g, '_');
            const to = rel.to.replace(/\s+/g, '_');
            mermaidCode += `    ${from} ||--o{ ${to} : "relaciona"\n`;
        });
    }

    try {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                background: '#0c0e12',
                primaryColor: '#0c0e12',
                lineColor: '#ffffff',
                textColor: '#ffffff'
            }
        });
        const id = 'mermaid-modal-' + Date.now();
        const { svg } = await mermaid.render(id, mermaidCode);
        const diagDiv = document.getElementById('modalMermaidDiagram');
        if (diagDiv) diagDiv.innerHTML = svg;
    } catch (error) {
        console.error('Error rendering mermaid inside modal:', error);
        const diagDiv = document.getElementById('modalMermaidDiagram');
        if (diagDiv) diagDiv.innerHTML = '<p class="error-text" style="color: #f87171;">Error al generar el diagrama visual.</p>';
    }

    // Zoom Event
    const zoomInput = document.getElementById('modalDiagramZoom');
    const zoomVal = document.getElementById('modalZoomValue');
    const svgEl = document.querySelector('#modalMermaidDiagram svg');
    if (zoomInput && zoomVal) {
        zoomInput.addEventListener('input', (event) => {
            const scale = event.target.value;
            zoomVal.textContent = `${Math.round(scale * 100)}%`;
            if (svgEl) {
                svgEl.style.transform = `scale(${scale})`;
            }
        });
    }

    // Download Event
    document.getElementById('btnDownloadModalDiagram').onclick = () => {
        const svgElement = document.querySelector('#modalMermaidDiagram svg');
        if (!svgElement) return;
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagrama_${docName}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
}

function abrirModalEsquema(doc) {
    let contenido = doc.contenido || {};
    if (typeof contenido === 'string') {
        try { contenido = JSON.parse(contenido); } catch (e) { contenido = {}; }
    }
    
    const docName = doc.nombre;
    const schema = contenido.schema;
    const modalBody = document.getElementById('modalBody');
    document.getElementById('docModal').style.display = 'flex';
    
    if (!schema || !schema.tables || schema.tables.length === 0) {
        modalBody.innerHTML = `
            <div class="schema-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; padding: 20px;">
                <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 15px;">🗂️ Esquema Bruto: ${escapeHtml(docName)}</h3>
                <p style="color: #f87171;">Este documento no contiene información de esquema.</p>
            </div>
        `;
        return;
    }

    const totalColumns = schema.tables.reduce((total, table) => total + table.columns.length, 0);
    const totalRelations = schema.relations ? schema.relations.length : 0;

    const statsHtml = `
        <div class="schema-stats" style="display: flex; gap: 20px; margin-bottom: 24px;">
            <div class="stat-card" style="flex: 1; padding: 20px;">
                <h4>Tablas Encontradas</h4>
                <p style="font-size: 2rem; font-weight: 700; color: #a78bfa; margin-top: 5px;">${schema.tables.length}</p>
            </div>
            <div class="stat-card" style="flex: 1; padding: 20px;">
                <h4>Relaciones Inferidas</h4>
                <p style="font-size: 2rem; font-weight: 700; color: #a78bfa; margin-top: 5px;">${totalRelations}</p>
            </div>
            <div class="stat-card" style="flex: 1; padding: 20px;">
                <h4>Columnas Totales</h4>
                <p style="font-size: 2rem; font-weight: 700; color: #a78bfa; margin-top: 5px;">${totalColumns}</p>
            </div>
        </div>
    `;

    const tablesHtml = schema.tables.map(table => `
        <div class="table-card" style="margin-bottom: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px;">
            <div class="table-name" style="font-size: 1.1rem; font-weight: 600; color: #a78bfa; display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                ${escapeHtml(table.name)}
            </div>
            <div class="table-columns" style="display: flex; flex-direction: column; gap: 8px;">
                ${table.columns.map(column => `
                    <div class="column-item" style="display: grid; grid-template-columns: 2fr 1.5fr auto; gap: 12px; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; align-items: center;">
                        <span class="column-name" style="font-weight: 500; font-size: 0.95rem; color: #eef2ff;">${escapeHtml(column.name)}</span>
                        <span class="column-type" style="font-size: 0.9rem; color: #9ca3af; font-family: monospace;">${escapeHtml(column.type)}</span>
                        <div class="badges-wrapper" style="display: flex; gap: 6px;">
                            ${column.primaryKey ? '<span class="column-badge badge-primary" style="background: rgba(157, 78, 221, 0.2); color: #e0aaff; border-radius: 12px; padding: 2px 8px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.5px;">PK</span>' : ''}
                            ${!column.nullable ? '<span class="column-badge badge-nullable" style="background: rgba(255, 167, 38, 0.2); color: #ffcc80; border-radius: 12px; padding: 2px 8px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.5px;">NOT NULL</span>' : ''}
                            ${column.autoIncrement ? '<span class="column-badge badge-auto" style="background: rgba(76, 175, 80, 0.2); color: #a5d6a7; border-radius: 12px; padding: 2px 8px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.5px;">AUTO</span>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    modalBody.innerHTML = `
        <div class="schema-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; padding: 10px; overflow-y: auto; max-height: calc(95vh - 80px);">
            <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 20px;">🗂️ Esquema Bruto: ${escapeHtml(docName)}</h3>
            ${statsHtml}
            <div class="tables-container" style="display: flex; flex-direction: column; gap: 16px;">
                ${tablesHtml}
            </div>
        </div>
    `;
}

function abrirModalConvertidor(doc) {
    let contenido = doc.contenido || {};
    if (typeof contenido === 'string') {
        try { contenido = JSON.parse(contenido); } catch (e) { contenido = {}; }
    }
    
    const docName = doc.nombre;
    const schema = contenido.schema;
    const modalBody = document.getElementById('modalBody');
    document.getElementById('docModal').style.display = 'flex';
    
    if (!schema || !schema.tables || schema.tables.length === 0) {
        modalBody.innerHTML = `
            <div class="converter-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; padding: 20px;">
                <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 15px;">🔄 Convertidor: ${escapeHtml(docName)}</h3>
                <p style="color: #f87171;">Este documento no contiene información de esquema para convertir.</p>
            </div>
        `;
        return;
    }

    modalBody.innerHTML = `
        <div class="converter-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; height: 100%;">
            <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 15px; flex-shrink: 0;">🔄 Convertidor: ${escapeHtml(docName)}</h3>
            
            <div class="converter-controls" style="display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 15px; border-radius: 12px; margin-bottom: 15px; flex-wrap: wrap; flex-shrink: 0;">
                <label for="modalTargetFormat" style="font-size: 0.95rem;">Convertir esquema a:</label>
                <select id="modalTargetFormat" class="share-select" style="width: auto; min-width: 200px;">
                    <option value="" disabled selected>Seleccionar formato...</option>
                    <option value="mysql">SQL (MySQL)</option>
                    <option value="postgresql">SQL (PostgreSQL)</option>
                    <option value="mariadb">MariaDB</option>
                    <option value="mongodb">MongoDB (Mongoose)</option>
                    <option value="prisma">Prisma Schema</option>
                    <option value="graphql">GraphQL Type Defs</option>
                    <option value="json_schema">JSON Schema</option>
                </select>
                
                <button id="modalConvertBtn" class="share-submit-btn" style="background: linear-gradient(135deg, #a78bfa, #5e6ad2); margin: 0; padding: 10px 20px;">
                    Transformar Esquema
                </button>
                
                <button id="modalDownloadConvertedBtn" class="action-btn" style="background: #10b981; border: none; color: #fff; padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer;" disabled>
                    Descargar Archivo
                </button>
            </div>
            
            <div class="conversion-result" style="flex: 1; background: #0c0e12; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); padding: 20px; overflow: auto; min-height: 300px; max-height: calc(95vh - 200px);">
                <p id="modalConvertPlaceholder" style="color: #9ca3af; text-align: center; margin-top: 50px;">Selecciona un formato y presiona Transformar...</p>
                <pre id="modalConvertedCode" style="display: none; color: #34d399; font-family: monospace; font-size: 0.9rem; line-height: 1.5; white-space: pre-wrap; margin: 0;"></pre>
            </div>
        </div>
    `;

    const selectEl = document.getElementById('modalTargetFormat');
    const convertBtn = document.getElementById('modalConvertBtn');
    const downloadBtn = document.getElementById('modalDownloadConvertedBtn');
    const codeEl = document.getElementById('modalConvertedCode');
    const placeholder = document.getElementById('modalConvertPlaceholder');

    let convertedCode = '';

    convertBtn.onclick = async () => {
        const targetFormat = selectEl.value;
        if (!targetFormat) return;

        convertBtn.disabled = true;
        convertBtn.innerHTML = 'Convirtiendo...';
        
        // Mostrar animación de carga
        placeholder.innerHTML = `
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
            <div class="loading-spinner" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; margin-top: 40px;">
                <div style="width: 40px; height: 40px; border: 4px solid rgba(167, 139, 250, 0.1); border-top: 4px solid #a78bfa; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="color: #a78bfa; font-weight: 500;">Procesando esquema con IA, por favor espera...</p>
            </div>
        `;
        placeholder.style.display = 'block';
        codeEl.style.display = 'none';
        downloadBtn.disabled = true;

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-email': sessionStorage.getItem('ds_email') || ''
                },
                body: JSON.stringify({ schema, targetFormat })
            });

            const result = await response.json();

            if (response.ok) {
                convertedCode = result.convertedCode || '';
                convertedCode = convertedCode.replace(/```[\w]*\n?/g, '').replace(/```/g, '');
                
                codeEl.textContent = convertedCode;
                codeEl.style.display = 'block';
                placeholder.style.display = 'none';
                downloadBtn.disabled = false;
            } else {
                alert('Error en la conversión: ' + result.error);
                placeholder.innerHTML = 'Selecciona un formato y presiona Transformar...';
            }
        } catch (error) {
            alert('Error de conexión: ' + error.message);
            placeholder.innerHTML = 'Selecciona un formato y presiona Transformar...';
        } finally {
            convertBtn.disabled = false;
            convertBtn.innerHTML = 'Transformar Esquema';
        }
    };

    downloadBtn.onclick = () => {
        if (!convertedCode) return;
        const targetFormat = selectEl.value;
        let extension = 'txt';
        switch (targetFormat) {
            case 'sql':
            case 'mysql':
            case 'mariadb':
            case 'postgresql':
                extension = 'sql';
                break;
            case 'mongodb':
                extension = 'js';
                break;
            case 'prisma':
                extension = 'prisma';
                break;
            case 'graphql':
                extension = 'graphql';
                break;
            case 'json_schema':
                extension = 'json';
                break;
        }

        const blob = new Blob([convertedCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `esquema_convertido_${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
}

function abrirModalDatosPrueba(doc) {
    let contenido = doc.contenido || {};
    if (typeof contenido === 'string') {
        try { contenido = JSON.parse(contenido); } catch (e) { contenido = {}; }
    }
    
    const docName = doc.nombre;
    const schema = contenido.schema;
    const modalBody = document.getElementById('modalBody');
    document.getElementById('docModal').style.display = 'flex';
    
    if (!schema || !schema.tables || schema.tables.length === 0) {
        modalBody.innerHTML = `
            <div class="testdata-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; padding: 20px;">
                <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 15px;">💾 Generador de Datos: ${escapeHtml(docName)}</h3>
                <p style="color: #f87171;">Este documento no contiene información de esquema para generar datos de prueba.</p>
            </div>
        `;
        return;
    }

    const tables = schema.tables;
    const required = getRequiredTables(schema);
    const dialect = getDialectFromSchema(schema);
    const isNoSql = dialect === 'json' || schema.type === 'nosql' || schema.type === 'json' || schema.type === 'yaml' || schema.type === 'excel';
    let lastGeneratedDialect = isNoSql ? 'json' : 'sql';

    let listHtml = '';
    tables.forEach((table, idx) => {
        const tname = table.name;
        const isRequired = required.has(tname);
        listHtml += `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 12px; background:rgba(255,255,255,0.03); border-radius:10px; margin-bottom:8px; flex-wrap:wrap; border:1px solid rgba(255,255,255,0.05);">
                <input type="checkbox" id="modal-td-check-${idx}" ${isRequired ? 'checked disabled' : 'checked'} 
                    style="width:18px; height:18px; accent-color:#a78bfa; cursor:pointer;">
                <label for="modal-td-check-${idx}" style="flex:1; min-width:120px; font-weight:500; cursor:${isRequired ? 'default' : 'pointer'};">
                    ${escapeHtml(tname)}
                    ${isRequired ? '<span style="background:rgba(167,139,250,0.15); color:#c084fc; border:1px solid rgba(167,139,250,0.3); padding:2px 8px; border-radius:12px; font-size:0.75rem; margin-left:6px;">REQUERIDA</span>' : ''}
                </label>
                <div style="display:flex; align-items:center; gap:8px; color:#9ca3af; font-size:0.9rem;">
                    <span>Filas:</span>
                    <input type="number" id="modal-td-rows-${idx}" min="1" max="20" value="5" 
                        style="width:64px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 10px; border-radius:8px; outline:none;">
                </div>
            </div>
        `;
    });

    modalBody.innerHTML = `
        <div class="testdata-tab-view" style="color: #fff; font-family: 'Outfit', sans-serif; display: flex; flex-direction: column; height: 100%;">
            <h3 style="font-size: 1.4rem; color: #a78bfa; margin-bottom: 15px; flex-shrink: 0;">💾 Generador de Datos: ${escapeHtml(docName)}</h3>
            
            <div style="background:rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 15px; border-radius: 12px; margin-bottom: 15px; flex-shrink: 0; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong>Dialecto del esquema:</strong> 
                    <span style="color:#a78bfa; text-transform:uppercase;">${isNoSql ? 'NoSQL / JSON' : (schema.dialect || 'genérico')}</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <button id="modalQuickGenerateBtn" class="share-submit-btn" style="background: linear-gradient(135deg, #a78bfa, #5e6ad2); margin:0; padding:10px 20px; display:inline-flex; align-items:center; gap:6px;">
                        Generar INSERTs
                    </button>
                    <button id="modalDownloadTestDataBtn" class="action-btn" style="background:#10b981; color:#fff; border:none; padding:10px 20px; border-radius:10px; font-weight:600; cursor:pointer;" disabled>
                        Descargar
                    </button>
                </div>
            </div>
            
            <div style="display:flex; gap:15px; flex:1; min-height:0; overflow:hidden;">
                <!-- Config List -->
                <div style="width: 320px; background:rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius:12px; padding:15px; display:flex; flex-direction:column;">
                    <h4 style="color:#a78bfa; margin-bottom:10px;">Configurar tablas</h4>
                    <div style="flex:1; overflow-y:auto; padding-right:5px;">
                        ${listHtml}
                    </div>
                </div>
                
                <!-- Preview area -->
                <div style="flex:1; background:#0c0e12; border-radius:12px; border:1px solid rgba(255,255,255,0.15); display:flex; flex-direction:column; overflow:hidden;">
                    <div style="padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2);">
                        <span style="color:#a78bfa; font-weight:600; font-size:0.9rem;">Vista previa del script generado</span>
                    </div>
                    <div style="flex:1; overflow:auto; padding:15px;">
                        <p id="modalTestdataPlaceholder" style="color:#9ca3af; text-align:center; margin-top:50px;">Presiona "Generar INSERTs" para ver los datos generados...</p>
                        <pre id="modalTestdataCode" style="display:none; color:#34d399; font-family:monospace; font-size:0.9rem; line-height:1.5; white-space:pre-wrap; margin:0;"></pre>
                    </div>
                </div>
            </div>
        </div>
    `;

    const generateBtn = document.getElementById('modalQuickGenerateBtn');
    const downloadBtn = document.getElementById('modalDownloadTestDataBtn');
    const codeEl = document.getElementById('modalTestdataCode');
    const placeholder = document.getElementById('modalTestdataPlaceholder');

    let generatedScript = '';

    generateBtn.onclick = async () => {
        const configTables = {};
        tables.forEach((table, idx) => {
            const tname = table.name;
            const checkbox = document.getElementById(`modal-td-check-${idx}`);
            const rowsInput = document.getElementById(`modal-td-rows-${idx}`);
            const enabled = checkbox ? checkbox.checked : true;
            const rows = rowsInput ? Math.min(parseInt(rowsInput.value) || 5, 20) : 5;
            configTables[tname] = {
                enabled: enabled || required.has(tname),
                rows: rows
            };
        });

        const config = {
            maxRows: 5,
            tables: configTables
        };

        generateBtn.disabled = true;
        generateBtn.innerHTML = 'Generando...';

        try {
            const response = await fetch('/generate-data', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': userId,
                    'x-user-email': sessionStorage.getItem('ds_email') || ''
                },
                body: JSON.stringify({ schema, config })
            });

            const result = await response.json();

            if (response.ok && result.sqlScript) {
                generatedScript = result.sqlScript;
                codeEl.textContent = generatedScript;
                codeEl.style.display = 'block';
                placeholder.style.display = 'none';
                downloadBtn.disabled = false;
            } else {
                alert(result.error || 'No se pudo generar el script de datos de prueba.');
            }
        } catch (error) {
            alert('Error de conexión: ' + error.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generar INSERTs';
        }
    };

    downloadBtn.onclick = () => {
        if (!generatedScript) return;
        const extension = lastGeneratedDialect === 'json' ? 'js' : 'sql';
        const blob = new Blob([generatedScript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `datos_prueba_${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
}

function getRequiredTables(schema) {
    const required = new Set();
    const tables = schema.tables || [];
    tables.forEach(t => {
        const fks = t.foreignKeys || [];
        fks.forEach(fk => {
            const refTable = fk.referencesTable || (fk.references && fk.references.table) || '';
            if (refTable) required.add(refTable);
        });
    });
    return required;
}

function getDialectFromSchema(schema) {
    if (!schema) return 'mysql';
    if (schema.dialect) return schema.dialect.toLowerCase();
    if (schema.type) return schema.type.toLowerCase();
    return 'mysql';
}

renderTodo();