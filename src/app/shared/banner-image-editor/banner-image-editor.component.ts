import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-banner-image-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './banner-image-editor.component.html',
  styleUrls: ['./banner-image-editor.component.scss']
})
export class BannerImageEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() label?: string;
  @Input() expectedRatio: number = 16 / 9;
  @Input() initialImage: string | null = null;

  @Output() previewChange = new EventEmitter<string | null>();
  @Output() fileChange = new EventEmitter<File | null>();
  @Output() warnChange = new EventEmitter<string | null>();

  @ViewChild('frame', { static: true }) frameRef!: ElementRef<HTMLDivElement>;
  @ViewChild('imgEl') imgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  imageSrc: string | null = null;
  previewData: string | null = null;
  warning: string | null = null;

  naturalW = 0;
  naturalH = 0;

  // Display (px)
  displayW = 0;
  displayH = 0;

  // Position of image top-left relative to frame (px)
  posX = 0;
  posY = 0;

  // Scale (display / natural)
  scale = 1;
  minScale = 0.1;
  maxScale = 3;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startPosX = 0;
  private startPosY = 0;

  private boundMouseMove = (e: MouseEvent) => this._onMouseMove(e);
  private boundMouseUp = (e: MouseEvent) => this._onMouseUp(e);
  private boundTouchMove = (e: TouchEvent) => this._onTouchMove(e);
  private boundTouchEnd = (e: TouchEvent) => this._onTouchEnd(e);

  ngAfterViewInit(): void {
    if (this.initialImage) {
      this.loadImage(this.initialImage).catch(() => {});
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialImage'] && !changes['initialImage'].firstChange) {
      if (this.initialImage) {
        this.loadImage(this.initialImage).catch(() => {});
      } else {
        this.clearImage();
      }
    }
    if (changes['expectedRatio'] && this.imageSrc) {
      setTimeout(() => this._setupLayout(), 0);
    }
  }

  onZoomIn() { this.scale = Math.min(this.maxScale, this.scale * 1.12); this.onZoom(); }
  onZoomOut() { this.scale = Math.max(this.minScale, this.scale * 0.88); this.onZoom(); }

  ngOnDestroy(): void {
    this._removeDragListeners();
  }

  public async exportCroppedBlob(outW?: number, outH?: number): Promise<Blob | null> {
    if (!this.imageSrc || !this.naturalW || !this.naturalH) return null;

    const frameRect = this.frameRef.nativeElement.getBoundingClientRect();
    const frameW = frameRect.width;
    const frameH = frameRect.height;

    const imgLeft = this.posX;
    const imgTop = this.posY;

    const intersectionLeft = Math.max(0, imgLeft);
    const intersectionTop = Math.max(0, imgTop);
    const intersectionRight = Math.min(frameW, imgLeft + this.displayW);
    const intersectionBottom = Math.min(frameH, imgTop + this.displayH);

    const visibleDisplayW = Math.max(0, intersectionRight - intersectionLeft);
    const visibleDisplayH = Math.max(0, intersectionBottom - intersectionTop);
    if (visibleDisplayW <= 0 || visibleDisplayH <= 0) return null;

    const startXdisplay = intersectionLeft - imgLeft;
    const startYdisplay = intersectionTop - imgTop;

    const srcX = startXdisplay / this.scale;
    const srcY = startYdisplay / this.scale;
    const srcW = visibleDisplayW / this.scale;
    const srcH = visibleDisplayH / this.scale;

    if (srcW <= 0 || srcH <= 0) return null;

    let destW: number;
    let destH: number;
    if (outW && outH) {
      destW = outW;
      destH = outH;
    } else if (outW) {
      destW = outW;
      destH = Math.round((outW * srcH) / srcW);
    } else if (outH) {
      destH = outH;
      destW = Math.round((outH * srcW) / srcH);
    } else {
      destW = Math.round(srcW);
      destH = Math.round(srcH);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, destW);
    canvas.height = Math.max(1, destH);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    const imgEl = this.imgRef?.nativeElement;
    if (imgEl && imgEl.complete && imgEl.naturalWidth) {
      try {
        ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      } catch {
        const fallback = await this._loadImageElement(this.imageSrc);
        if (!fallback) return null;
        try { ctx.drawImage(fallback, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height); } catch { return null; }
      }
    } else {
      const fallback = await this._loadImageElement(this.imageSrc);
      if (!fallback) return null;
      try { ctx.drawImage(fallback, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height); } catch { return null; }
    }

    return await new Promise<Blob | null>((resolve) => { canvas.toBlob((b) => resolve(b), 'image/png'); });
  }

  onFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input?.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this._setWarning('Selected file is not an image.');
      this.fileChange.emit(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      try { await this.loadImage(dataUrl); this.fileChange.emit(file); } catch { this._setWarning('Failed to load selected image.'); this.fileChange.emit(null); }
    };
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.imageSrc = null; this.previewData = null; this.warning = null;
    this.previewChange.emit(null); this.fileChange.emit(null); this.warnChange.emit(null);
    try { if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = ''; } catch {}
  }

  onDragStart(e: MouseEvent) {
    if (!this.imageSrc) return; e.preventDefault(); this.dragging = true; this.dragStartX = e.clientX; this.dragStartY = e.clientY; this.startPosX = this.posX; this.startPosY = this.posY; window.addEventListener('mousemove', this.boundMouseMove); window.addEventListener('mouseup', this.boundMouseUp);
  }

  onTouchStart(e: TouchEvent) {
    if (!this.imageSrc) return; e.preventDefault(); const t = e.touches[0]; this.dragging = true; this.dragStartX = t.clientX; this.dragStartY = t.clientY; this.startPosX = this.posX; this.startPosY = this.posY; window.addEventListener('touchmove', this.boundTouchMove, { passive: false }); window.addEventListener('touchend', this.boundTouchEnd);
  }

  onZoom(_e?: Event) {
    if (!this.naturalW) return;
    const frameRect = this.frameRef.nativeElement.getBoundingClientRect();
    const frameW = frameRect.width; const frameH = frameRect.height;
    const prevDisplayW = this.displayW || (this.naturalW * this.scale);
    const prevDisplayH = this.displayH || (this.naturalH * this.scale);
    const centerX = frameW / 2; const centerY = frameH / 2;
    const centerRelX = prevDisplayW ? (centerX - this.posX) / prevDisplayW : 0.5;
    const centerRelY = prevDisplayH ? (centerY - this.posY) / prevDisplayH : 0.5;
    this.displayW = this.naturalW * this.scale; this.displayH = this.naturalH * this.scale;
    this.posX = centerX - this.displayW * centerRelX; this.posY = centerY - this.displayH * centerRelY; this._clampPosition(); this._updatePreview();
  }

  async loadImage(src: string): Promise<void> {
    const img = await this._loadImageElement(src); if (!img) throw new Error('Image load failed'); this.naturalW = img.naturalWidth; this.naturalH = img.naturalHeight; this.imageSrc = src; setTimeout(() => { this._setupLayout(); this._validateAspectRatio(); }, 0);
  }

  private _setupLayout() { if (!this.frameRef || !this.naturalW || !this.naturalH) return; const frameRect = this.frameRef.nativeElement.getBoundingClientRect(); const frameW = frameRect.width || 1; const frameH = frameRect.height || 1; const initialScale = Math.max(frameW / this.naturalW, frameH / this.naturalH) || 1; this.minScale = initialScale; this.maxScale = Math.max(initialScale * 3, initialScale + 0.1); this.scale = initialScale; this.displayW = this.naturalW * this.scale; this.displayH = this.naturalH * this.scale; this.posX = (frameW - this.displayW) / 2; this.posY = (frameH - this.displayH) / 2; this._clampPosition(); this._updatePreview(); }

  private _validateAspectRatio() { if (!this.naturalW || !this.naturalH) return; const actualRatio = this.naturalW / this.naturalH; const expected = this.expectedRatio || 1; const relDiff = Math.abs(actualRatio / expected - 1); if (relDiff > 0.05) { const expText = this._ratioText(expected); const gotText = this._ratioText(actualRatio); const msg = `Aspect ratio mismatch: expected ${expText}, got ${gotText}.`; this._setWarning(msg); } else { this._setWarning(null); } }

  private _ratioText(r: number) { const approx = Math.round(r * 100) / 100; for (let y = 1; y <= 32; y++) { const x = Math.round(r * y); if (x / y === Math.round(r * 100) / 100) { return `${x}:${y}`; } } return `${approx}:1`; }

  private _setWarning(msg: string | null) { this.warning = msg; this.warnChange.emit(msg); }

  private _clampPosition() { const frameRect = this.frameRef.nativeElement.getBoundingClientRect(); const fw = frameRect.width; const fh = frameRect.height; if (this.displayW > fw) { const minX = fw - this.displayW; this.posX = Math.min(Math.max(this.posX, minX), 0); } else { this.posX = (fw - this.displayW) / 2; } if (this.displayH > fh) { const minY = fh - this.displayH; this.posY = Math.min(Math.max(this.posY, minY), 0); } else { this.posY = (fh - this.displayH) / 2; } }

  private _updatePreview() {
    if (!this.imageSrc || !this.naturalW || !this.naturalH) { this.previewData = null; this.previewChange.emit(null); return; }
    const frameRect = this.frameRef.nativeElement.getBoundingClientRect(); const frameW = frameRect.width; const frameH = frameRect.height; const imgLeft = this.posX; const imgTop = this.posY; const intersectionLeft = Math.max(0, imgLeft); const intersectionTop = Math.max(0, imgTop); const intersectionRight = Math.min(frameW, imgLeft + this.displayW); const intersectionBottom = Math.min(frameH, imgTop + this.displayH); const visibleDisplayW = Math.max(0, intersectionRight - intersectionLeft); const visibleDisplayH = Math.max(0, intersectionBottom - intersectionTop); if (visibleDisplayW <= 0 || visibleDisplayH <= 0) { this.previewData = null; this.previewChange.emit(null); return; } const startXdisplay = intersectionLeft - imgLeft; const startYdisplay = intersectionTop - imgTop; const srcX = startXdisplay / this.scale; const srcY = startYdisplay / this.scale; const srcW = visibleDisplayW / this.scale; const srcH = visibleDisplayH / this.scale; const destW = 320; const destH = Math.max(1, Math.round(destW / this.expectedRatio)); const canvas = document.createElement('canvas'); canvas.width = destW; canvas.height = destH; const ctx = canvas.getContext('2d'); if (!ctx) { this.previewData = null; this.previewChange.emit(null); return; } const drawFromElement = () => { try { const imgEl = this.imgRef?.nativeElement; if (!imgEl) throw new Error('no img element'); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(imgEl, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height); this.previewData = canvas.toDataURL('image/png'); this.previewChange.emit(this.previewData); } catch { this._loadImageElement(this.imageSrc!).then((fallback) => { if (!fallback) { this.previewData = null; this.previewChange.emit(null); return; } try { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(fallback, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height); this.previewData = canvas.toDataURL('image/png'); this.previewChange.emit(this.previewData); } catch { this.previewData = null; this.previewChange.emit(null); } }); } }; drawFromElement(); }

  private _onMouseMove(e: MouseEvent) { if (!this.dragging) return; const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY; this.posX = this.startPosX + dx; this.posY = this.startPosY + dy; this._clampPosition(); this._updatePreview(); }

  private _onMouseUp(_e: MouseEvent) { this.dragging = false; this._removeDragListeners(); }

  private _onTouchMove(e: TouchEvent) { if (!this.dragging) return; e.preventDefault(); const t = e.touches[0]; const dx = t.clientX - this.dragStartX; const dy = t.clientY - this.dragStartY; this.posX = this.startPosX + dx; this.posY = this.startPosY + dy; this._clampPosition(); this._updatePreview(); }

  private _onTouchEnd(_e?: TouchEvent) { this.dragging = false; this._removeDragListeners(); }

  private _removeDragListeners() { window.removeEventListener('mousemove', this.boundMouseMove); window.removeEventListener('mouseup', this.boundMouseUp); window.removeEventListener('touchmove', this.boundTouchMove); window.removeEventListener('touchend', this.boundTouchEnd); }

  private _loadImageElement(src: string | null): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
