// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Configuration constants
const CONFIG = {
    MIN_SELECTION_SIZE: 0.001,      // Minimum normalized selection dimension
    SELECTION_COLOR_RED: '#ef4444',  // Pending selection border color
    SELECTION_COLOR_BLUE: '#2563eb', // Delete selection border color
    TOAST_DURATION: 2000,            // Toast message display duration (ms)
    OCR_CONFIDENCE_MIN: 0.3,         // Minimum OCR confidence threshold
    OPTIMAL_SCALE_THRESHOLD: 0.85    // Canvas scale fitting threshold
};

/**
 * PdfRegionEraser - Main application class for PDF region selection, filling, and deletion
 *
 * Features:
 * - Load and view PDF files in browser
 * - Select regions with left-click drag (pending selections)
 * - Apply selections with color fill modes (dominant, border, custom)
 * - Delete selections with right-click drag + left-click
 * - Group selections across multiple pages
 * - Export as PDF or PowerPoint
 * - Auto-detect text regions with OCR
 */
class PdfRegionEraser {
    constructor() {
        this.pdfDoc = null;
        this.currentPage = 1;
        this.totalPages = 0;
        this.baseScale = 1.0;
        this.pagesData = [];
        this.isSelecting = false;
        this.isRightClickSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.tempSelectionBox = null;
        this.pdfPageSize = { width: 0, height: 0 };
        this.originalFileName = '';

        this.initElements();
        this.initEventListeners();
        this.initResizeListener();
    }

    // ─── DOM Initialization ───

    initElements() {
        const $ = id => document.getElementById(id);
        this.pdfInput = $('pdfInput');
        this.fillColorInput = $('fillColor');
        this.colorModeInputs = document.querySelectorAll('input[name="colorMode"]');
        this.applyAllToggleBtn = $('applyAllToggle');
        this.clearSelectionsBtn = $('clearSelections');
        this.downloadPdfBtn = $('downloadPdf');
        this.downloadPptBtn = $('downloadPpt');
        this.autoDetectTextBtn = $('autoDetectText');
        this.pdfViewer = $('pdfViewer');
        this.pageNav = $('pageNav');
        this.firstPageBtn = $('firstPage');
        this.prevPageBtn = $('prevPage');
        this.nextPageBtn = $('nextPage');
        this.lastPageBtn = $('lastPage');
        this.currentPageSpan = $('currentPage');
        this.totalPagesSpan = $('totalPages');
        this.selectionInfo = $('selectionInfo');
        this.selectionCountSpan = $('selectionCount');
        this.selectionList = $('selectionList');
        this.toastModal = $('toastModal');
        this.toastMessageDiv = $('toastMessageText');
        this.toastTab = $('toastTab');
        this.toastProgress = $('toastProgress');
        this.toastSpinner = $('toastSpinner');
        this.toastTitle = $('toastTitle');
        this.toastProgressBar = $('toastProgressBar');
        this.toastProgressMessage = $('toastProgressMessage');
        this.confirmModal = $('confirmModal');
        this.confirmMessage = $('confirmMessage');
        this.confirmOk = $('confirmOk');
        this.confirmCancel = $('confirmCancel');
    }

    initEventListeners() {
        this.pdfInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.firstPageBtn.addEventListener('click', () => this.goToPage(1));
        this.prevPageBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextPageBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.lastPageBtn.addEventListener('click', () => this.goToPage(this.totalPages));
        this.applyAllToggleBtn.addEventListener('click', () => this.toggleApplyAll());
        this.clearSelectionsBtn.addEventListener('click', () => this.clearAllSelections());
        this.downloadPdfBtn.addEventListener('click', () => this.downloadModifiedPdf());
        this.downloadPptBtn.addEventListener('click', () => this.downloadAsPpt());
        this.autoDetectTextBtn.addEventListener('click', () => this.autoDetectText());

        this.colorModeInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.fillColorInput.disabled = e.target.value !== 'custom';
            });
        });
    }

    initResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.pdfDoc) this.renderCurrentPage();
            }, 200);
        });
    }

    // ─── UI Utilities ───

    showToast(message) {
        // Show message mode
        this.toastProgress.classList.add('hidden');
        this.toastMessageDiv.classList.remove('hidden');
        this.toastMessageDiv.textContent = message;
        this._lastToastMessage = message;
        this.toastModal.classList.remove('translate-x-full');
        this.toastTab.classList.add('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this.hideToast(), CONFIG.TOAST_DURATION);

        this.toastModal.onmouseenter = () => {
            clearTimeout(this._toastTimer);
            this.toastModal.classList.remove('translate-x-full');
            this.toastTab.classList.add('hidden');
        };
        this.toastModal.onmouseleave = () => {
            this._toastTimer = setTimeout(() => this.hideToast(), CONFIG.TOAST_DURATION);
        };
        this.toastTab.onmouseenter = () => {
            clearTimeout(this._toastTimer);
            this.toastModal.classList.remove('translate-x-full');
            this.toastTab.classList.add('hidden');
        };
    }

    hideToast() {
        this.toastModal.classList.add('translate-x-full');
        if (this._lastToastMessage) {
            this.toastTab.classList.remove('hidden');
        }
    }

    showConfirm(message) {
        return new Promise((resolve) => {
            this.confirmMessage.textContent = message;
            this.confirmModal.classList.remove('hidden');

            const cleanup = (result) => {
                this.confirmModal.classList.add('hidden');
                this.confirmOk.removeEventListener('click', onOk);
                this.confirmCancel.removeEventListener('click', onCancel);
                resolve(result);
            };
            const onOk = () => cleanup(true);
            const onCancel = () => cleanup(false);

            this.confirmOk.addEventListener('click', onOk);
            this.confirmCancel.addEventListener('click', onCancel);
        });
    }

    showProgress(title, message = '', percent = 0) {
        // Show progress mode
        this.toastMessageDiv.classList.add('hidden');
        this.toastProgress.classList.remove('hidden');
        this.toastTitle.textContent = title;
        this.toastProgressMessage.textContent = message;
        this.toastProgressBar.style.width = `${percent}%`;
        this.toastModal.classList.remove('translate-x-full');
        this.toastTab.classList.add('hidden');
        clearTimeout(this._toastTimer);
        this._toastTimer = null;
    }

    updateProgress(message, percent) {
        this.toastProgressMessage.textContent = message;
        this.toastProgressBar.style.width = `${percent}%`;
    }

    hideProgress() {
        this.toastModal.classList.add('translate-x-full');
    }

    getSelectedColorMode() {
        const checked = document.querySelector('input[name="colorMode"]:checked');
        return checked ? checked.value : 'dominant';
    }

    getColorModeName(mode) {
        const names = { dominant: 'Dominant', border: 'Border', custom: 'Custom' };
        return names[mode] || mode;
    }

    refreshUI() {
        this.updateSelectionInfo();
        this.updateSelectionList();
        this.updateButtons();
    }

    /**
     * Creates a pending selection object (drawn but not yet applied)
     * @param {object} pageData - Page data object
     * @param {object} params - Selection parameters
     * @param {number} params.x - Left edge (0-1 normalized)
     * @param {number} params.y - Top edge (0-1 normalized)
     * @param {number} params.width - Width (0-1 normalized)
     * @param {number} params.height - Height (0-1 normalized)
     * @param {string} params.colorMode - Fill mode: 'dominant', 'border', or 'custom'
     * @param {string} params.customColor - Custom hex color (if colorMode === 'custom')
     * @param {number} params.selNumber - Selection number
     * @param {string} params.applyScope - Scope: 'current', 'all', or 'range'
     * @param {string} params.pageRange - Page range string if scope is 'range' (e.g., "1,3,5-10")
     * @returns {object} Pending selection object
     */
    createPendingSelection(pageData, { x, y, width, height, colorMode, customColor, selNumber, applyScope, pageRange }) {
        return {
            id: Date.now() + Math.random(),
            selNumber: selNumber ?? pageData.nextSelNumber++,
            x, y, width, height,
            colorMode,
            customColor: colorMode === 'custom' ? customColor : null,
            applyScope: applyScope || 'current',
            pageRange: pageRange || '',
            boxElement: null
        };
    }

    // ─── Selection DOM Cleanup Helpers ───

    removeSelectionDOM(sel) {
        if (sel.boxElement) sel.boxElement.remove();
        if (sel.numberLabel) sel.numberLabel.remove();
    }

    removeAllSelectionDOM(selections) {
        selections.forEach(sel => this.removeSelectionDOM(sel));
    }

    // ─── Scale Calculation ───

    getOptimalScale(pageWidth, pageHeight) {
        const container = this.pdfViewer;
        if (!container) return this.baseScale;

        const containerWidth = container.clientWidth - 32;
        const containerHeight = window.innerHeight * 0.7;
        const scaleX = containerWidth / pageWidth;
        const scaleY = containerHeight / pageHeight;

        let optimalScale = Math.min(scaleX, scaleY, this.baseScale * 2);
        optimalScale = Math.max(optimalScale, 0.3);
        return Math.floor(optimalScale * 100) / 100;
    }

    // ─── PDF File Loading ───

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.originalFileName = file.name.replace(/\.pdf$/i, '');

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            this.totalPages = this.pdfDoc.numPages;
            this.pagesData = Array.from({ length: this.totalPages }, (_, i) => ({
                pageNumber: i + 1,
                selections: [],
                pendingSelections: [],
                nextSelNumber: 1,
                canvas: null,
                container: null
            }));

            this.currentPage = 1;
            this.updateNavigation();
            this.renderCurrentPage();
            this.pageNav.classList.remove('hidden');
        } catch (error) {
            console.error('PDF loading error:', error);
            this.showToast('An error occurred while loading the PDF file.');
        }
    }

    // ─── Page Rendering ───

    async renderCurrentPage() {
        if (!this.pdfDoc) return;

        const pageData = this.pagesData[this.currentPage - 1];
        const page = await this.pdfDoc.getPage(this.currentPage);
        const baseViewport = page.getViewport({ scale: 1.0 });

        this.pdfPageSize = { width: baseViewport.width, height: baseViewport.height };

        const optimalScale = this.getOptimalScale(baseViewport.width, baseViewport.height);
        const viewport = page.getViewport({ scale: optimalScale });
        const { width: vw, height: vh } = viewport;

        if (pageData.container) pageData.container.remove();

        const container = document.createElement('div');
        container.className = 'pdf-canvas-container';
        container.style.position = 'relative';
        container.style.marginBottom = '20px';

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = vw;
        canvas.height = vh;
        canvas.style.display = 'block';
        canvas.style.cursor = 'crosshair';
        canvas.style.border = '1px solid #d1d5db';

        await page.render({ canvasContext: context, viewport }).promise;

        this.drawSavedSelections(context, pageData.selections, vw, vh, canvas);
        container.appendChild(canvas);
        this.drawSelectionBoxes(pageData.pendingSelections, vw, vh, container, 'pending');
        this.drawSelectionBoxes(pageData.selections, vw, vh, container, 'applied');
        this.setupCanvasEvents(canvas, container, vw, vh);

        this.pdfViewer.innerHTML = '';
        this.pdfViewer.appendChild(container);

        pageData.canvas = canvas;
        pageData.container = container;
        pageData.viewportWidth = vw;
        pageData.viewportHeight = vh;
        pageData.originalImageData = context.getImageData(0, 0, vw, vh);

        this.refreshUI();
    }

    async renderPage(pageNumber) {
        if (!this.pdfDoc) return;
        const pageData = this.pagesData[pageNumber - 1];
        if (!pageData || !pageData.canvas) return;

        const page = await this.pdfDoc.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1.0 });
        const optimalScale = this.getOptimalScale(baseViewport.width, baseViewport.height);
        const viewport = page.getViewport({ scale: optimalScale });
        const { width: vw, height: vh } = viewport;

        const canvas = pageData.canvas;
        const context = canvas.getContext('2d');
        canvas.width = vw;
        canvas.height = vh;

        await page.render({ canvasContext: context, viewport }).promise;

        this.drawSavedSelections(context, pageData.selections, vw, vh, canvas);
        this.drawSelectionBoxes(pageData.pendingSelections, vw, vh, pageData.container, 'pending');
        this.drawSelectionBoxes(pageData.selections, vw, vh, pageData.container, 'applied');
    }

    // ─── Drawing Selection Regions ───

    drawSavedSelections(context, selections, width, height, canvas = null) {
        selections.forEach(sel => {
            let fillColor = sel.color;

            if (sel.colorMode === 'custom') {
                fillColor = sel.customColor || sel.color;
            } else if (canvas) {
                fillColor = this.computeRegionColor(canvas, sel, width, height);
                sel.color = fillColor;
            }

            context.fillStyle = fillColor;
            context.fillRect(sel.x * width, sel.y * height, sel.width * width, sel.height * height);
        });
    }

    // Unified selection box drawing (pending / applied common)
    drawSelectionBoxes(selections, canvasWidth, canvasHeight, container, type) {
        const cssClass = type === 'applied' ? 'applied-selection-box' : 'selection-box';

        selections.forEach(sel => {
            if (sel.numberLabel) sel.numberLabel.remove();

            let box;
            if (sel.boxElement && sel.boxElement.parentNode === container) {
                box = sel.boxElement;
            } else {
                box = document.createElement('div');
                box.className = cssClass;
                container.appendChild(box);
                sel.boxElement = box;
            }

            box.style.left = (sel.x * canvasWidth) + 'px';
            box.style.top = (sel.y * canvasHeight) + 'px';
            box.style.width = (sel.width * canvasWidth) + 'px';
            box.style.height = (sel.height * canvasHeight) + 'px';
            box.style.position = 'absolute';
        });

        selections.forEach(sel => this.updateSelectionBoxNumber(sel, type));
    }

    updateSelectionBoxNumber(sel, type = 'pending') {
        if (!sel.boxElement || !sel.boxElement.parentNode) return;

        const existingLabel = sel.boxElement.querySelector('.selection-number');
        if (existingLabel) existingLabel.remove();
        const existingLabel2 = sel.boxElement.parentNode.querySelector(`.selection-number[data-sel-id="${sel.id}"]`);
        if (existingLabel2) existingLabel2.remove();

        const boxLeft = parseFloat(sel.boxElement.style.left);
        const boxTop = parseFloat(sel.boxElement.style.top);
        const bgColor = type === 'applied' ? 'bg-green-500' : 'bg-red-500';
        const displayText = String(sel.displayNumber);
        const isLong = displayText.length > 1;

        const label = document.createElement('div');
        label.className = `selection-number absolute ${bgColor} text-white text-xs ${isLong ? 'px-1' : 'w-5'} h-5 rounded-full flex items-center justify-center font-bold z-10 whitespace-nowrap pointer-events-none`;
        label.style.left = (boxLeft - (isLong ? 28 : 20)) + 'px';
        label.style.top = (boxTop - 10) + 'px';
        label.setAttribute('data-sel-id', sel.id);
        label.textContent = sel.displayNumber;
        sel.boxElement.parentNode.appendChild(label);
        sel.numberLabel = label;
    }

    // ─── Right-Click Delete ───

    /**
     * Handles bulk deletion of selections within a dragged area
     * Called when user right-click drags to select area then left-clicks
     * @param {number} x1 - Top-left X coordinate (normalized 0-1)
     * @param {number} y1 - Top-left Y coordinate (normalized 0-1)
     * @param {number} x2 - Bottom-right X coordinate (normalized 0-1)
     * @param {number} y2 - Bottom-right Y coordinate (normalized 0-1)
     */
    async handleRightClickDelete(x1, y1, x2, y2) {
        const pageData = this.pagesData[this.currentPage - 1];
        if (!pageData) return;

        const selectionsToDelete = [];

        // Find pending selections in area (all can be deleted)
        pageData.pendingSelections.forEach((sel, idx) => {
            if (this.isSelectionInArea(sel, x1, y1, x2, y2)) {
                selectionsToDelete.push({ type: 'pending', index: idx, sel });
            }
        });

        // Find applied selections in area (exclude groups)
        pageData.selections.forEach((sel, idx) => {
            if (!sel.groupId && this.isSelectionInArea(sel, x1, y1, x2, y2)) {
                selectionsToDelete.push({ type: 'applied', index: idx, sel });
            }
        });

        if (selectionsToDelete.length === 0) {
            this.showToast('No non-group selections in this area');
            return;
        }

        const message = `${selectionsToDelete.length} selection(s) will be deleted. Continue?`;
        if (!await this.showConfirm(message)) return;

        // Delete in reverse order to maintain correct indices
        selectionsToDelete.sort((a, b) => b.index - a.index);

        selectionsToDelete.forEach(item => {
            this.removeSelectionDOM(item.sel);
            if (item.type === 'pending') {
                pageData.pendingSelections.splice(item.index, 1);
            } else {
                pageData.selections.splice(item.index, 1);
            }
        });

        this.renderPage(pageData.pageNumber);
        this.refreshUI();
        this.showToast(`${selectionsToDelete.length} selection(s) deleted.`);
    }

    isSelectionInArea(sel, x1, y1, x2, y2) {
        const selX2 = sel.x + sel.width;
        const selY2 = sel.y + sel.height;
        return !(selX2 < x1 || sel.x > x2 || selY2 < y1 || sel.y > y2);
    }

    // ─── Canvas Events ───

    setupCanvasEvents(canvas, container, canvasWidth, canvasHeight) {
        let startX, startY;
        let selectionBox = null;
        let startButton = null;
        let rightClickDragDone = false;
        let rightClickEndX, rightClickEndY;
        let canvasRect = canvas.getBoundingClientRect();

        // Helper to clamp coordinates to canvas bounds
        const clampToCanvas = (x, y) => {
            return {
                x: Math.max(0, Math.min(x, canvasWidth)),
                y: Math.max(0, Math.min(y, canvasHeight))
            };
        };

        // Helper to get canvas-relative coordinates
        const getCanvasCoords = (clientX, clientY) => {
            canvasRect = canvas.getBoundingClientRect();
            return {
                x: clientX - canvasRect.left,
                y: clientY - canvasRect.top
            };
        };

        // Helper to handle mouse move during selection
        const handleMouseMove = (e) => {
            if (!this.isSelecting && !this.isRightClickSelecting) return;
            if (this.isRightClickSelecting && rightClickDragDone) return;

            const coords = getCanvasCoords(e.clientX, e.clientY);
            const clamped = clampToCanvas(coords.x, coords.y);
            const w = clamped.x - startX;
            const h = clamped.y - startY;

            selectionBox.style.width = Math.abs(w) + 'px';
            selectionBox.style.height = Math.abs(h) + 'px';
            selectionBox.style.left = (w < 0 ? clamped.x : startX) + 'px';
            selectionBox.style.top = (h < 0 ? clamped.y : startY) + 'px';
        };

        // Helper to handle mouse up to finish selection
        const handleMouseUp = async (e) => {
            // Right click drag complete
            if (this.isRightClickSelecting && e.button === 2) {
                rightClickDragDone = true;
                const coords = getCanvasCoords(e.clientX, e.clientY);
                rightClickEndX = coords.x;
                rightClickEndY = coords.y;
                return;
            }

            // Left click selection complete
            if (!this.isSelecting) return;
            this.isSelecting = false;

            // Remove window listeners
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);

            const coords = getCanvasCoords(e.clientX, e.clientY);
            const clamped = clampToCanvas(coords.x, coords.y);

            const x1 = Math.min(startX, clamped.x) / canvasWidth;
            const y1 = Math.min(startY, clamped.y) / canvasHeight;
            const x2 = Math.max(startX, clamped.x) / canvasWidth;
            const y2 = Math.max(startY, clamped.y) / canvasHeight;
            const width = x2 - x1;
            const height = y2 - y1;

            if (width > CONFIG.MIN_SELECTION_SIZE && height > CONFIG.MIN_SELECTION_SIZE) {
                const colorMode = this.getSelectedColorMode();
                const currentPageData = this.pagesData[this.currentPage - 1];
                const sel = this.createPendingSelection(currentPageData, {
                    x: x1, y: y1, width, height,
                    colorMode,
                    customColor: this.fillColorInput.value
                });
                sel.boxElement = selectionBox;
                currentPageData.pendingSelections.push(sel);

                this.refreshUI();
                return;
            }

            if (selectionBox) {
                selectionBox.remove();
                selectionBox = null;
            }
        };

        canvas.addEventListener('mousedown', async (e) => {
            canvasRect = canvas.getBoundingClientRect();

            // If right-click selection is active, any click (left or right) triggers delete
            if (this.isRightClickSelecting && (e.button === 0 || e.button === 2)) {
                e.preventDefault();
                let endX, endY;
                if (rightClickDragDone) {
                    endX = rightClickEndX;
                    endY = rightClickEndY;
                } else {
                    const coords = getCanvasCoords(e.clientX, e.clientY);
                    endX = coords.x;
                    endY = coords.y;
                }

                const x1 = Math.min(startX, endX) / canvasWidth;
                const y1 = Math.min(startY, endY) / canvasHeight;
                const x2 = Math.max(startX, endX) / canvasWidth;
                const y2 = Math.max(startY, endY) / canvasHeight;

                this.isRightClickSelecting = false;
                rightClickDragDone = false;
                if (selectionBox) {
                    selectionBox.remove();
                    selectionBox = null;
                }
                await this.handleRightClickDelete(x1, y1, x2, y2);
                return;
            }

            if (e.button === 2) {
                e.preventDefault();
                const coords = getCanvasCoords(e.clientX, e.clientY);
                startX = coords.x;
                startY = coords.y;
                this.isRightClickSelecting = true;
                startButton = 2;

                selectionBox = document.createElement('div');
                selectionBox.className = 'selection-box delete-box';
                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
                container.appendChild(selectionBox);

                // Add window listeners for right-click drag
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
                return;
            }

            if (this.isRightClickSelecting) {
                e.preventDefault();
                return;
            }

            const coords = getCanvasCoords(e.clientX, e.clientY);
            startX = coords.x;
            startY = coords.y;
            this.isSelecting = true;
            startButton = 0;

            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            selectionBox.style.left = startX + 'px';
            selectionBox.style.top = startY + 'px';
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            container.appendChild(selectionBox);

            // Add window listeners for selection drag
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        });

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    // ─── Navigation ───

    goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages) return;
        this.currentPage = pageNum;
        this.updateNavigation();
        this.renderCurrentPage();
    }

    updateNavigation() {
        this.currentPageSpan.textContent = this.currentPage;
        this.totalPagesSpan.textContent = this.totalPages;
        this.firstPageBtn.disabled = this.currentPage <= 1;
        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.nextPageBtn.disabled = this.currentPage >= this.totalPages;
        this.lastPageBtn.disabled = this.currentPage >= this.totalPages;
    }

    // ─── Selection Info UI ───

    updateSelectionInfo() {
        this.selectionInfo.classList.remove('hidden');
        const pageData = this.pagesData[this.currentPage - 1];
        const appliedCount = pageData ? pageData.selections.length : 0;
        const pendingCount = pageData ? pageData.pendingSelections.length : 0;
        this.selectionCountSpan.textContent = `Applied: ${appliedCount}, Pending: ${pendingCount}`;
    }

    updateSelectionList() {
        this.selectionList.innerHTML = '';

        const pageData = this.pagesData[this.currentPage - 1];
        if (!pageData) return;

        const { pendingSelections, selections } = pageData;
        if (!pendingSelections.length && !selections.length) return;

        const pageHeader = document.createElement('div');
        pageHeader.className = 'flex items-center justify-between mb-2';
        pageHeader.innerHTML = `
            <span class="font-medium text-gray-700 text-sm">Page ${this.currentPage}</span>
            <div class="flex gap-1">
                ${pendingSelections.length > 0 ? `<button class="text-green-600 hover:text-green-800 text-xs px-1.5 py-0.5 border border-green-300 rounded hover:bg-green-50" onclick="app.applyAllOnPage(${this.currentPage - 1})">Apply</button>` : ''}
                ${selections.length > 0 ? `<button class="text-yellow-600 hover:text-yellow-800 text-xs px-1.5 py-0.5 border border-yellow-300 rounded hover:bg-yellow-50" onclick="app.revertAllOnPage(${this.currentPage - 1})">Revert</button>` : ''}
                ${(pendingSelections.length + selections.length) > 0 ? `<button class="text-red-600 hover:text-red-800 text-xs px-1.5 py-0.5 border border-red-300 rounded hover:bg-red-50" onclick="app.clearAllOnPage(${this.currentPage - 1})">Delete</button>` : ''}
            </div>
        `;
        this.selectionList.appendChild(pageHeader);

        const allItems = this.buildSortedSelectionItems(pageData);
        const pi = this.currentPage - 1;

        allItems.forEach(({ type, sel, index }) => {
            const item = document.createElement('div');
            if (type === 'pending') {
                this.renderPendingItem(item, sel, pi, index);
            } else {
                this.renderAppliedItem(item, sel, pi, index);
            }
            this.selectionList.appendChild(item);
            this.updateSelectionBoxNumber(sel, type);
        });
    }

    buildSortedSelectionItems(pageData) {
        const allItems = [];

        pageData.pendingSelections.forEach((sel, index) => {
            sel.displayNumber = sel.selNumber;
            if (!sel.applyScope) sel.applyScope = 'current';
            if (!sel.pageRange) sel.pageRange = '';
            allItems.push({ type: 'pending', sel, index, sortKey: [this.currentPage, sel.selNumber || 0] });
        });

        pageData.selections.forEach((sel, index) => {
            sel.displayNumber = sel.groupId ? `${sel.sourcePage}-${sel.sourceNumber}` : `${sel.sourceNumber}`;
            allItems.push({ type: 'applied', sel, index, sortKey: [sel.sourcePage || this.currentPage, sel.sourceNumber || 0] });
        });

        allItems.sort((a, b) => a.sortKey[0] !== b.sortKey[0] ? a.sortKey[0] - b.sortKey[0] : a.sortKey[1] - b.sortKey[1]);
        return allItems;
    }

    renderPendingItem(item, sel, pi, index) {
        item.className = 'selection-item flex-col bg-yellow-50 border border-yellow-200';
        item.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <div class="text-xs font-medium text-gray-700">#${sel.selNumber} ${this.getColorModeName(sel.colorMode)}</div>
                <div class="flex gap-0.5 ml-auto">
                    <button class="text-green-500 hover:text-green-700 text-xs px-1 py-0.5" onclick="app.applySelection(${pi}, ${index})">Apply</button>
                    <button class="text-red-500 hover:text-red-700 text-xs px-1 py-0.5" onclick="app.removePendingSelection(${pi}, ${index})">Delete</button>
                </div>
            </div>
            <div class="flex items-center gap-1 w-full">
                <select class="text-xs border rounded px-1 py-0.5 bg-white" onchange="app.updateSelectionScope(${pi}, ${index}, this.value)">
                    <option value="current" ${sel.applyScope === 'current' ? 'selected' : ''}>Current</option>
                    <option value="all" ${sel.applyScope === 'all' ? 'selected' : ''}>All</option>
                    <option value="range" ${sel.applyScope === 'range' ? 'selected' : ''}>Range</option>
                </select>
                <input type="text" id="pageRange_${pi}_${index}" placeholder="1,3,5-10" value="${sel.pageRange}"
                    class="text-xs border rounded px-1 py-0.5 flex-1 min-w-0 ${sel.applyScope === 'range' ? '' : 'hidden'}"
                    oninput="app.updateSelectionPageRange(${pi}, ${index}, this.value)">
            </div>
        `;
    }

    renderAppliedItem(item, sel, pi, index) {
        let groupLabel = '';
        let groupTooltip = '';
        if (sel.groupId) {
            const groupPages = [];
            this.pagesData.forEach((pd, idx) => {
                if (pd.selections.some(s => s.groupId === sel.groupId)) groupPages.push(idx + 1);
            });
            const rangeText = sel.applyScope === 'all' ? 'All' : groupPages.join(', ');
            groupLabel = ` <span class="text-blue-500 cursor-default" title="Pages: ${rangeText}">(G)</span>`;
            groupTooltip = `Pages: ${rangeText}`;
        }
        const isSourcePage = !sel.groupId || sel.sourcePage === this.currentPage;
        const revertBtn = isSourcePage
            ? `<button class="text-yellow-600 hover:text-yellow-800 text-xs px-1 py-0.5" onclick="app.toggleSelection(${pi}, ${index})">Revert</button>`
            : '';

        item.className = 'selection-item flex-row bg-green-50 border border-green-200';
        item.innerHTML = `
            <div class="min-w-0" ${groupTooltip ? `title="${groupTooltip}"` : ''}>
                <div class="text-xs font-medium text-gray-700">#${sel.displayNumber} ${this.getColorModeName(sel.colorMode)}${groupLabel}</div>
            </div>
            <div class="flex gap-0.5 ml-auto">
                ${revertBtn}
                <button class="text-red-500 hover:text-red-700 text-xs px-1 py-0.5" onclick="app.removeAppliedSelection(${pi}, ${index})">Delete</button>
            </div>
        `;
    }

    // ─── Apply/Revert/Delete Selections ───

    /**
     * Applies a pending selection to the current and target pages with specified scope
     * @param {number} pageIndex - Current page index (0-based)
     * @param {number} selectionIndex - Index of pending selection to apply
     * @param {boolean} skipUpdate - Skip UI refresh (for batch operations)
     * @description
     * - Creates applied selections on target pages based on applyScope:
     *   - 'current': only on current page
     *   - 'all': on all pages
     *   - 'range': on specified page numbers (stored in sel.pageRange)
     * - Groups multi-page selections with a unique groupId
     * - Preserves scope and pageRange for future revert operations
     */
    applySelection(pageIndex, selectionIndex, skipUpdate = false) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData || !pageData.pendingSelections[selectionIndex]) return;

        const sel = pageData.pendingSelections[selectionIndex];
        const scope = sel.applyScope || 'current';
        const targetPages = this.getTargetPageIndices(scope, sel.pageRange, pageIndex);
        const groupId = (scope !== 'current') ? `grp_${Date.now()}_${Math.random()}` : null;
        const sourcePage = pageIndex + 1;
        const sourceNumber = sel.selNumber;

        if (targetPages.includes(pageIndex)) {
            let fillColor = sel.customColor || '#ffffff';

            if (pageData.canvas) {
                const { canvas, viewportWidth: vw, viewportHeight: vh } = pageData;
                const context = canvas.getContext('2d');

                fillColor = this.resolveSelectionColor(sel, canvas, vw, vh);
                context.fillStyle = fillColor;
                context.fillRect(sel.x * vw, sel.y * vh, sel.width * vw, sel.height * vh);
            }

            const appliedSelection = this.createAppliedSelection(sel, fillColor, groupId, sourcePage, sourceNumber);
            pageData.selections.push(appliedSelection);
            this.createAppliedBox(appliedSelection, pageData);
        }

        targetPages.forEach(targetIdx => {
            if (targetIdx === pageIndex || targetIdx < 0 || targetIdx >= this.totalPages) return;
            this.pagesData[targetIdx].selections.push(
                this.createAppliedSelection(sel, sel.customColor || '#ffffff', groupId, sourcePage, sourceNumber)
            );
        });

        this.removeSelectionDOM(sel);
        pageData.pendingSelections.splice(selectionIndex, 1);

        if (!skipUpdate) {
            if (targetPages.length > 1) {
                const scopeName = scope === 'all' ? 'All' : sel.pageRange;
                this.showToast(`Selection applied to ${scopeName} pages.`);
            }
            this.refreshUI();
        }
    }

    createAppliedSelection(sel, fillColor, groupId, sourcePage, sourceNumber) {
        return {
            id: Date.now() + Math.random(),
            x: sel.x, y: sel.y,
            width: sel.width, height: sel.height,
            color: fillColor,
            colorMode: sel.colorMode,
            customColor: sel.customColor,
            groupId, sourcePage, sourceNumber,
            applyScope: sel.applyScope || 'current',
            pageRange: sel.pageRange || '',
            boxElement: null, numberLabel: null
        };
    }

    createAppliedBox(appliedSelection, pageData) {
        const container = pageData.container;
        if (!container) return;

        const greenBox = document.createElement('div');
        greenBox.className = 'applied-selection-box';
        const vw = pageData.viewportWidth || 0;
        const vh = pageData.viewportHeight || 0;
        greenBox.style.left = (appliedSelection.x * vw) + 'px';
        greenBox.style.top = (appliedSelection.y * vh) + 'px';
        greenBox.style.width = (appliedSelection.width * vw) + 'px';
        greenBox.style.height = (appliedSelection.height * vh) + 'px';
        greenBox.style.position = 'absolute';
        container.appendChild(greenBox);
        appliedSelection.boxElement = greenBox;
    }

    /**
     * Reverts an applied selection back to pending state
     * Preserves original applyScope and pageRange for reapplication
     * If selection is part of a group, removes group from other pages
     */
    toggleSelection(pageIndex, selectionIndex) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData || !pageData.selections[selectionIndex]) return;

        const sel = pageData.selections[selectionIndex];
        this.removeSelectionDOM(sel);

        pageData.pendingSelections.push(this.createPendingSelection(pageData, {
            x: sel.x, y: sel.y, width: sel.width, height: sel.height,
            colorMode: sel.colorMode, customColor: sel.customColor,
            selNumber: sel.sourceNumber,
            applyScope: sel.applyScope, pageRange: sel.pageRange
        }));

        pageData.selections.splice(selectionIndex, 1);

        if (sel.groupId) this.removeGroupFromOtherPages(sel.groupId, pageIndex);

        this.renderPage(pageData.pageNumber);
        this.refreshUI();
    }

    removeAppliedSelection(pageIndex, selectionIndex) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData || !pageData.selections[selectionIndex]) return;

        const sel = pageData.selections[selectionIndex];
        this.removeSelectionDOM(sel);
        pageData.selections.splice(selectionIndex, 1);

        if (sel.groupId) this.removeGroupFromOtherPages(sel.groupId, pageIndex);

        this.renderPage(pageData.pageNumber);
        this.refreshUI();
    }

    removePendingSelection(pageIndex, selectionIndex) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData || !pageData.pendingSelections[selectionIndex]) return;

        this.removeSelectionDOM(pageData.pendingSelections[selectionIndex]);
        pageData.pendingSelections.splice(selectionIndex, 1);
        this.refreshUI();
    }

    removeGroupFromOtherPages(groupId, excludePageIndex) {
        this.pagesData.forEach((pd, idx) => {
            if (idx === excludePageIndex) return;
            pd.selections = pd.selections.filter(s => {
                if (s.groupId === groupId) {
                    this.removeSelectionDOM(s);
                    return false;
                }
                return true;
            });
        });
    }

    // ─── Range/Scope ───

    updateSelectionScope(pageIndex, selIndex, scope) {
        const sel = this.pagesData[pageIndex].pendingSelections[selIndex];
        if (!sel) return;
        sel.applyScope = scope;
        const input = document.getElementById(`pageRange_${pageIndex}_${selIndex}`);
        if (input) input.classList.toggle('hidden', scope !== 'range');
    }

    updateSelectionPageRange(pageIndex, selIndex, range) {
        const sel = this.pagesData[pageIndex].pendingSelections[selIndex];
        if (sel) sel.pageRange = range;
    }

    parsePageRange(rangeStr) {
        const pages = new Set();
        if (!rangeStr) return [];
        rangeStr.split(',').forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                        if (i >= 1 && i <= this.totalPages) pages.add(i);
                    }
                }
            } else {
                const num = parseInt(part);
                if (!isNaN(num) && num >= 1 && num <= this.totalPages) pages.add(num);
            }
        });
        return Array.from(pages).sort((a, b) => a - b);
    }

    getTargetPageIndices(scope, pageRange, currentPageIndex) {
        if (scope === 'all') return Array.from({ length: this.totalPages }, (_, i) => i);
        if (scope === 'range') {
            const pages = this.parsePageRange(pageRange).map(p => p - 1);
            if (!pages.includes(currentPageIndex)) pages.push(currentPageIndex);
            return pages.sort((a, b) => a - b);
        }
        return [currentPageIndex];
    }

    // ─── Button States ───

    updateButtons() {
        const hasAnyPending = this.pagesData.some(p => p.pendingSelections.length > 0);
        const hasAnyApplied = this.pagesData.some(p => p.selections.length > 0);
        const hasSelections = hasAnyPending || hasAnyApplied;

        const btnBase = 'w-full px-4 py-2 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm';
        if (hasAnyPending) {
            this.applyAllToggleBtn.textContent = 'Apply All';
            this.applyAllToggleBtn.className = `${btnBase} bg-green-500 hover:bg-green-600`;
            this.applyAllToggleBtn.disabled = false;
        } else if (hasAnyApplied) {
            this.applyAllToggleBtn.textContent = 'Revert All';
            this.applyAllToggleBtn.className = `${btnBase} bg-yellow-500 hover:bg-yellow-600`;
            this.applyAllToggleBtn.disabled = false;
        } else {
            this.applyAllToggleBtn.textContent = 'Apply All';
            this.applyAllToggleBtn.className = `${btnBase} bg-green-500 hover:bg-green-600`;
            this.applyAllToggleBtn.disabled = true;
        }

        this.clearSelectionsBtn.disabled = !hasSelections;
        this.downloadPdfBtn.disabled = !hasAnyApplied;
        this.downloadPptBtn.disabled = !this.pdfDoc;
        this.autoDetectTextBtn.disabled = !this.pdfDoc;
    }

    // ─── Batch Operations ───

    toggleApplyAll() {
        const hasAnyPending = this.pagesData.some(p => p.pendingSelections.length > 0);
        if (hasAnyPending) {
            this.applyAllPending();
        } else {
            this.revertAllApplied();
        }
    }

    applyAllPending() {
        let applied = false;
        for (let i = 0; i < this.pagesData.length; i++) {
            while (this.pagesData[i].pendingSelections.length > 0) {
                this.applySelection(i, 0, true);
                applied = true;
            }
        }
        if (applied) {
            this.renderCurrentPage();
            this.showToast('All selections have been applied.');
        }
    }

    async revertAllApplied() {
        if (!this.pagesData.some(p => p.selections.length > 0)) return;
        if (!await this.showConfirm('Do you want to revert all applied selections?')) return;

        this.pagesData.forEach(pageData => {
            pageData.selections.forEach(sel => {
                this.removeSelectionDOM(sel);
                const isSource = !sel.groupId || sel.sourcePage === pageData.pageNumber;
                if (isSource) {
                    pageData.pendingSelections.push(this.createPendingSelection(pageData, {
                        x: sel.x, y: sel.y, width: sel.width, height: sel.height,
                        colorMode: sel.colorMode, customColor: sel.customColor,
                        selNumber: sel.sourceNumber,
                        applyScope: sel.applyScope, pageRange: sel.pageRange
                    }));
                }
            });
            pageData.selections = [];
        });

        this.renderCurrentPage();
        this.showToast('All selections have been reverted.');
    }

    async clearAllSelections() {
        if (!await this.showConfirm('Do you want to clear all selections?')) return;

        this.pagesData.forEach(pageData => {
            this.removeAllSelectionDOM(pageData.selections);
            this.removeAllSelectionDOM(pageData.pendingSelections);
            pageData.selections = [];
            pageData.pendingSelections = [];
        });

        this.renderCurrentPage();
    }

    // ─── Per-Page Batch Operations ───

    applyAllOnPage(pageIndex) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData || !pageData.pendingSelections.length) return;
        while (pageData.pendingSelections.length > 0) {
            this.applySelection(pageIndex, 0, true);
        }
        this.renderPage(pageData.pageNumber);
        this.refreshUI();
        this.showToast(`Page ${pageIndex + 1}: All selections applied.`);
    }

    async revertAllOnPage(pageIndex) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData || !pageData.selections.length) return;
        if (!await this.showConfirm(`Page ${pageIndex + 1}의 적용된 선택을 모두 해제하시겠습니까?`)) return;

        const groupIds = new Set();
        pageData.selections.forEach(sel => {
            this.removeSelectionDOM(sel);
            const isSource = !sel.groupId || sel.sourcePage === pageData.pageNumber;
            if (isSource) {
                pageData.pendingSelections.push(this.createPendingSelection(pageData, {
                    x: sel.x, y: sel.y, width: sel.width, height: sel.height,
                    colorMode: sel.colorMode, customColor: sel.customColor,
                    selNumber: sel.sourceNumber,
                    applyScope: sel.applyScope, pageRange: sel.pageRange
                }));
            }
            if (sel.groupId) groupIds.add(sel.groupId);
        });
        pageData.selections = [];
        groupIds.forEach(gid => this.removeGroupFromOtherPages(gid, pageIndex));
        this.renderPage(pageData.pageNumber);
        this.refreshUI();
        this.showToast(`Page ${pageIndex + 1}: All selections reverted.`);
    }

    async clearAllOnPage(pageIndex) {
        const pageData = this.pagesData[pageIndex];
        if (!pageData) return;
        if (!await this.showConfirm(`Page ${pageIndex + 1}의 모든 선택을 삭제하시겠습니까?`)) return;

        this.removeAllSelectionDOM(pageData.selections);
        this.removeAllSelectionDOM(pageData.pendingSelections);
        pageData.selections = [];
        pageData.pendingSelections = [];
        this.renderPage(pageData.pageNumber);
        this.refreshUI();
        this.showToast(`Page ${pageIndex + 1}: All selections cleared.`);
    }

    // ─── Color Calculation ───

    // Unified method to calculate region color based on colorMode
    computeRegionColor(canvas, sel, canvasWidth, canvasHeight) {
        const startX = sel.x * canvasWidth;
        const startY = sel.y * canvasHeight;
        const endX = (sel.x + sel.width) * canvasWidth;
        const endY = (sel.y + sel.height) * canvasHeight;

        if (sel.colorMode === 'dominant') {
            return this.getDominantColor(canvas, startX, startY, endX, endY);
        } else if (sel.colorMode === 'border') {
            return this.getBorderColor(canvas, startX, startY, endX, endY);
        }
        return sel.customColor || sel.color || '#ffffff';
    }

    // Color resolution used by applySelection
    resolveSelectionColor(sel, canvas, vw, vh) {
        if (sel.colorMode === 'custom') return sel.customColor || '#ffffff';
        return this.computeRegionColor(canvas, sel, vw, vh);
    }

    getDominantColor(canvas, startX, startY, endX, endY) {
        const context = canvas.getContext('2d');
        const x1 = Math.floor(Math.min(startX, endX));
        const y1 = Math.floor(Math.min(startY, endY));
        const width = Math.floor(Math.max(startX, endX)) - x1;
        const height = Math.floor(Math.max(startY, endY)) - y1;

        if (width <= 0 || height <= 0) return '#ffffff';

        const imageData = context.getImageData(x1, y1, width, height);
        const data = imageData.data;
        const colorMap = {};

        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
                const i = (y * width + x) * 4;
                if (data[i + 3] < 128) continue;

                const quantize = v => Math.round(v / 16) * 16;
                const key = `${quantize(data[i])},${quantize(data[i + 1])},${quantize(data[i + 2])}`;
                colorMap[key] = (colorMap[key] || 0) + 1;
            }
        }

        let maxCount = 0;
        let dominant = { r: 255, g: 255, b: 255 };

        for (const [key, count] of Object.entries(colorMap)) {
            if (count > maxCount) {
                maxCount = count;
                const [r, g, b] = key.split(',').map(Number);
                dominant = { r, g, b };
            }
        }

        return this.rgbToHex(dominant.r, dominant.g, dominant.b);
    }

    // Border color calculation — performance improved with batch getImageData
    getBorderColor(canvas, startX, startY, endX, endY) {
        const context = canvas.getContext('2d');
        const x1 = Math.floor(Math.min(startX, endX));
        const y1 = Math.floor(Math.min(startY, endY));
        const x2 = Math.floor(Math.max(startX, endX));
        const y2 = Math.floor(Math.max(startY, endY));
        const width = x2 - x1;
        const height = y2 - y1;

        if (width <= 0 || height <= 0) return '#ffffff';

        // Fetch entire region at once, then sample only border pixels
        const imageData = context.getImageData(x1, y1, width, height);
        const data = imageData.data;
        let r = 0, g = 0, b = 0, count = 0;

        const addPixel = (px, py) => {
            const i = (py * width + px) * 4;
            if (data[i + 3] >= 128) {
                r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
            }
        };

        // Top/Bottom borders
        for (let x = 0; x < width; x += 2) {
            addPixel(x, 0);
            addPixel(x, height - 1);
        }
        // Left/Right borders
        for (let y = 0; y < height; y += 2) {
            addPixel(0, y);
            addPixel(width - 1, y);
        }

        if (count === 0) return '#ffffff';
        return this.rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count));
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : { r: 255, g: 255, b: 255 };
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // ─── Download ───

    downloadBlob(bytes, filename) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async downloadModifiedPdf() {
        if (!this.pdfDoc) return;

        const { PDFDocument, rgb } = PDFLib;
        const pdfBytes = await this.pdfDoc.getData();

        try {
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                for (const sel of this.pagesData[i].selections) {
                    const color = this.hexToRgb(sel.color);
                    page.drawRectangle({
                        x: sel.x * width,
                        y: height - (sel.y + sel.height) * height,
                        width: sel.width * width,
                        height: sel.height * height,
                        color: rgb(color.r / 255, color.g / 255, color.b / 255)
                    });
                }
            }

            this.downloadBlob(await pdfDoc.save(), `${this.originalFileName}_cleared.pdf`);
        } catch (error) {
            console.error('PDF download error:', error);
            this.showToast('An error occurred while generating the PDF.');
        }
    }

    async downloadAsPpt() {
        if (!this.pdfDoc) return;

        try {
            this.showProgress('Generating PPT...', 'Loading library...', 5);

            await this.loadScript('PptxGenJS', 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js');

            const pptx = new PptxGenJS();
            const slideDataList = [];

            for (let i = 1; i <= this.totalPages; i++) {
                const progressPercent = Math.floor(5 + (i / this.totalPages) * 60);
                this.updateProgress(`Rendering page ${i}/${this.totalPages}...`, progressPercent);

                const page = await this.pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvasContext: context, viewport }).promise;

                const pageData = this.pagesData[i - 1];
                const appliedSels = pageData?.selections || [];
                const pendingSels = pageData?.pendingSelections || [];

                // Crop only pending selections (exclude applied selections)
                const croppedImages = pendingSels
                    .map(sel => this.cropSelectionImage(canvas, sel, viewport))
                    .filter(Boolean);

                // Fill applied selections
                appliedSels.forEach(sel => {
                    const { sx, sy, sw, sh } = this.getSelectionPixelCoords(sel, viewport);
                    context.fillStyle = sel.color;
                    context.fillRect(sx, sy, sw, sh);
                });

                // Fill pending selections
                pendingSels.forEach(sel => {
                    const { sx, sy, sw, sh } = this.getSelectionPixelCoords(sel, viewport);
                    context.fillStyle = this.resolveSelectionColor(sel, canvas, viewport.width, viewport.height);
                    context.fillRect(sx, sy, sw, sh);
                });

                slideDataList.push({
                    bgImage: canvas.toDataURL('image/png'),
                    croppedImages
                });
            }

            this.updateProgress('Creating slides...', 70);

            const slideW = 10;
            const slideH = 5.625;

            slideDataList.forEach(({ bgImage, croppedImages }, idx) => {
                const progressPercent = Math.floor(70 + (idx / slideDataList.length) * 20);
                this.updateProgress(`Creating slide ${idx + 1}/${slideDataList.length}...`, progressPercent);

                const slide = pptx.addSlide();
                slide.addImage({ data: bgImage, x: 0, y: 0, w: '100%', h: '100%' });
                croppedImages.forEach(crop => {
                    slide.addImage({
                        data: crop.data,
                        x: crop.x * slideW, y: crop.y * slideH,
                        w: crop.w * slideW, h: crop.h * slideH
                    });
                });
            });

            this.updateProgress('Writing file...', 95);
            await pptx.writeFile({ fileName: `${this.originalFileName}_cleared.pptx` });

            this.updateProgress('Complete!', 100);
            setTimeout(() => this.hideProgress(), 500);
        } catch (error) {
            console.error('PPT download error:', error);
            this.hideProgress();
            this.showToast('An error occurred while generating the PPT: ' + error.message);
        }
    }

    getSelectionPixelCoords(sel, viewport) {
        return {
            sx: Math.round(sel.x * viewport.width),
            sy: Math.round(sel.y * viewport.height),
            sw: Math.round(sel.width * viewport.width),
            sh: Math.round(sel.height * viewport.height)
        };
    }

    cropSelectionImage(canvas, sel, viewport) {
        const { sx, sy, sw, sh } = this.getSelectionPixelCoords(sel, viewport);
        if (sw <= 0 || sh <= 0) return null;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        cropCanvas.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

        return { data: cropCanvas.toDataURL('image/png'), x: sel.x, y: sel.y, w: sel.width, h: sel.height };
    }

    // ─── Auto Text Detection ───

    async autoDetectText() {
        if (!this.pdfDoc) return;

        try {
            await this.loadScript('Tesseract', 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
                'Loading text detection engine...');

            this.autoDetectTextBtn.disabled = true;

            const colorMode = this.getSelectedColorMode();
            const customColor = colorMode === 'custom' ? this.fillColorInput.value : null;

            const worker = await Tesseract.createWorker('kor+eng');
            let totalAdded = 0;
            const padding = 2;

            for (let i = 1; i <= this.totalPages; i++) {
                this.autoDetectTextBtn.textContent = `Detecting... (${i}/${this.totalPages})`;

                const pageData = this.pagesData[i - 1];
                const page = await this.pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });

                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = viewport.width;
                tempCanvas.height = viewport.height;
                await page.render({ canvasContext: tempCanvas.getContext('2d'), viewport }).promise;

                const { data } = await worker.recognize(tempCanvas);
                if (!data.words || data.words.length === 0) continue;

                const lines = this.mergeWordsToLines(data.words);

                lines.forEach(line => {
                    const x1 = Math.max(0, (line.x0 - padding) / viewport.width);
                    const y1 = Math.max(0, (line.y0 - padding) / viewport.height);
                    const x2 = Math.min(1, (line.x1 + padding) / viewport.width);
                    const y2 = Math.min(1, (line.y1 + padding) / viewport.height);
                    const width = x2 - x1;
                    const height = y2 - y1;

                    if (width > CONFIG.MIN_SELECTION_SIZE && height > CONFIG.MIN_SELECTION_SIZE) {
                        pageData.pendingSelections.push(this.createPendingSelection(pageData, {
                            x: x1, y: y1, width, height, colorMode, customColor
                        }));
                        totalAdded++;
                    }
                });
            }

            await worker.terminate();

            const currentPageData = this.pagesData[this.currentPage - 1];
            if (currentPageData?.canvas) {
                this.drawSelectionBoxes(
                    currentPageData.pendingSelections,
                    currentPageData.viewportWidth, currentPageData.viewportHeight,
                    currentPageData.canvas.parentElement, 'pending'
                );
            }

            this.refreshUI();
            this.showToast(`Detected ${totalAdded} text regions across ${this.totalPages} pages.`);
        } catch (error) {
            console.error('Text detection error:', error);
            this.showToast('An error occurred during text detection: ' + error.message);
        } finally {
            this.autoDetectTextBtn.disabled = false;
            this.autoDetectTextBtn.textContent = 'Auto Detect Text';
        }
    }

    mergeWordsToLines(words) {
        const filtered = words.filter(w => w.confidence > 30 && w.text.trim().length > 0);
        if (filtered.length === 0) return [];

        const sorted = filtered.sort((a, b) => {
            const yDiff = a.bbox.y0 - b.bbox.y0;
            if (Math.abs(yDiff) > (a.bbox.y1 - a.bbox.y0) * 0.5) return yDiff;
            return a.bbox.x0 - b.bbox.x0;
        });

        const lines = [];
        let current = { ...sorted[0].bbox };

        for (let i = 1; i < sorted.length; i++) {
            const word = sorted[i].bbox;
            const lineHeight = current.y1 - current.y0;
            const verticalOverlap = Math.min(current.y1, word.y1) - Math.max(current.y0, word.y0);

            if (verticalOverlap > lineHeight * 0.3 && (word.x0 - current.x1) < lineHeight * 2) {
                current.x1 = Math.max(current.x1, word.x1);
                current.y0 = Math.min(current.y0, word.y0);
                current.y1 = Math.max(current.y1, word.y1);
            } else {
                lines.push({ ...current });
                current = { x0: word.x0, y0: word.y0, x1: word.x1, y1: word.y1 };
            }
        }
        lines.push({ ...current });
        return lines;
    }

    // ─── Dynamic Script Loading ───

    async loadScript(globalName, url, loadingMessage) {
        if (typeof window[globalName] !== 'undefined') return;
        if (loadingMessage) this.showToast(loadingMessage);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// App initialization
let app;
document.addEventListener('DOMContentLoaded', () => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    script.onload = () => { app = new PdfRegionEraser(); };
    document.head.appendChild(script);
});
