import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminPaginationComponent } from '../shared/admin-pagination/admin-pagination.component';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { SideDrawerComponent } from '../../../../shared/side-drawer/side-drawer.component';
import { AdminApiService, BannerDto, Paged } from '../../../../services/admin-api.service';
import { BannerImageEditorComponent } from '../../../../shared/banner-image-editor/banner-image-editor.component';
import { AdminCrudComponent, ColumnDef } from '../../../../shared/admin-crud/admin-crud.component';
import { FormSchema } from '../../../../shared/admin-crud/form-schema';

@Component({
  selector: 'app-admin-banners',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, SideDrawerComponent, BannerImageEditorComponent, AdminCrudComponent],
  templateUrl: './banners.component.html',
  styleUrls: ['./banners.component.scss']
})
export class BannersAdminComponent implements OnInit {
  // image preview and drag/drop handlers implemented below
  q = signal('');
  active = signal<'all'|'1'|'0'>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<BannerDto[]>([]);
  loading = signal(false);

  selected = signal<BannerDto|null>(null);
  form!: FormGroup;

  showCreate = signal(false);
  createForm!: FormGroup;

  // Preview simples e arquivos
  desktopPreviewUrl: string | null = null;
  mobilePreviewUrl: string | null = null;
  desktopFile: File | null = null;
  mobileFile: File | null = null;
  desktopWarn = signal<string | null>(null);
  mobileWarn = signal<string | null>(null);
  desktopExpected = 4;
  mobileExpected = 4;
  @ViewChild('desktopEditor') desktopEditorComp?: BannerImageEditorComponent | null;
  @ViewChild('mobileEditor') mobileEditorComp?: BannerImageEditorComponent | null;
  @ViewChild('desktopEditorCreate') desktopEditorCreateComp?: BannerImageEditorComponent | null;
  @ViewChild('mobileEditorCreate') mobileEditorCreateComp?: BannerImageEditorComponent | null;
  @ViewChild('desktopFrame') desktopFrame?: ElementRef | null;
  @ViewChild('mobileFrame') mobileFrame?: ElementRef | null;
  desktopEditor: any = { img: null, naturalWidth: 0, naturalHeight: 0, scale: 1, x: 0, y: 0, edited: false, dragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 };
  mobileEditor: any = { img: null, naturalWidth: 0, naturalHeight: 0, scale: 1, x: 0, y: 0, edited: false, dragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 };

  positions = [
    { value: 'loja', label: 'Loja' }
  ];

  // table columns for admin-crud
  columns: ColumnDef[] = [
    { key: 'nome', label: 'Nome' },
    { key: 'posicao', label: 'Posição' },
    { key: 'link', label: 'Link' }
  ];

  constructor(private api: AdminApiService, private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initCreateForm();
    this.load();
  }

  initCreateForm() {
    this.createForm = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      link: [''],
      alt: [''],
      posicao: ['loja'],
      ordem: [1],
      inicio: [''],
      fim: [''],
      ativo: [1],
      target_blank: [1]
    });
  }

  load() {
    this.loading.set(true);
    const params: any = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    this.api.listBanners(params).subscribe({
      next: (res: Paged<BannerDto>) => {
        this.items.set(res.data || []);
        // Normalize total: some backends return totalPages instead of total
        let totalValue = 0;
        if (res && typeof (res as any).total === 'number') {
          totalValue = (res as any).total || 0;
        } else if (res && typeof (res as any).totalPages === 'number') {
          const pageSizeFromRes = (res as any).pageSize || this.pageSize();
          totalValue = (res as any).totalPages * Number(pageSizeFromRes || 0);
        }
        this.total.set(totalValue || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onQ(ev: Event) { const el = ev.target as HTMLInputElement|null; if (el) { this.q.set(el.value); this.page.set(1); this.load(); } }
  onActive(ev: Event) { const el = ev.target as HTMLSelectElement|null; if (el) { this.active.set(el.value as any); this.page.set(1); this.load(); } }
  totalPages() { const s=this.pageSize(); const t=this.total(); return s? Math.max(1, Math.ceil(t/s)) : 1; }
  canPrev() { return this.page()>1; }
  canNext() { return this.page()<this.totalPages(); }
  prev() { if (this.canPrev()) { this.page.set(this.page()-1); this.load(); } }
  next() { if (this.canNext()) { this.page.set(this.page()+1); this.load(); } }

  view(item: BannerDto) {
    this.selected.set(item);
    this.form = this.fb.group({
      nome: [item.nome || '', [Validators.required, Validators.minLength(2)]],
      link: [item.link || ''],
      alt: [item.alt || ''],
      posicao: ['loja'],
      ordem: [item.ordem ?? 1],
      inicio: [item.inicio ? this.toDateTimeLocal(item.inicio) : ''],
      fim: [item.fim ? this.toDateTimeLocal(item.fim) : ''],
      ativo: [item.ativo ?? 1],
      target_blank: [ (item as any).target_blank ?? 1 ]
    });
    this.desktopPreviewUrl = (item as any).desktop_image_url || null;
    this.mobilePreviewUrl = (item as any).mobile_image_url || null;
    this.desktopFile = null;
    this.mobileFile = null;
    // initialize editor state from existing URLs
    const d = (item as any).desktop_image_url || null;
    const m = (item as any).mobile_image_url || null;
    if (d) setTimeout(() => this.setupEditor('desktop', d), 0);
    if (m) setTimeout(() => this.setupEditor('mobile', m), 0);
  }

  closeDetail() { this.selected.set(null); }

  async save() {
    console.log('BannersAdminComponent.save called', { selected: this.selected(), formValid: this.form ? !this.form.invalid : null, formValue: this.form?.value, desktopFile: this.desktopFile, mobileFile: this.mobileFile });
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload: any = { ...this.form.value };
    // convert datetime-local (if present) to ISO strings
    payload.inicio = payload.inicio ? new Date(payload.inicio).toISOString() : null;
    payload.fim = payload.fim ? new Date(payload.fim).toISOString() : null;
    payload.ordem = Number(payload.ordem || 0) || 0;

    // Build FormData so we can include images with the same PUT request
    const form = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      form.append(k, String(v));
    }

    if (this.desktopFile) {
      const blob = await this.exportCroppedBlob('desktop');
      const file = blob ? new File([blob], (this.desktopFile?.name || 'desktop.jpg'), { type: blob.type }) : this.desktopFile!;
      form.append('bannerDesktop', file);
    }
    if (this.mobileFile) {
      const blob = await this.exportCroppedBlob('mobile');
      const file = blob ? new File([blob], (this.mobileFile?.name || 'mobile.jpg'), { type: blob.type }) : this.mobileFile!;
      form.append('bannerMobile', file);
    }

    this.api.updateBanner(s.id!, form).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set(updated);
      this.load();
    });
  }

  remove() {
    const s = this.selected(); if (!s) return;
    if (!confirm('Remover banner?')) return;
    this.api.deleteBanner(s.id!).subscribe(() => { this.selected.set(null); this.load(); });
  }

  // Remove handler used by admin-crud (passes item)
  removeItem(item?: BannerDto) {
    const id = item?.id ?? this.selected()?.id;
    if (!id) return;
    if (!confirm('Remover banner?')) return;
    this.api.deleteBanner(id).subscribe(() => { this.selected.set(null); this.load(); });
  }

  openCreate() { this.initCreateForm(); this.desktopPreviewUrl = null; this.mobilePreviewUrl = null; this.desktopFile = null; this.mobileFile = null; this.showCreate.set(true); }
  cancelCreate() { this.showCreate.set(false); }

  onCrudEdit(item: BannerDto) {
    this.view(item);
    this.showCreate.set(true);
  }

  onCrudCreate() {
    this.openCreate();
  }

  onCrudCancel() {
    // Called when admin-crud emits cancel (backdrop/ESC) or when user clicks close in drawer
    this.showCreate.set(false);
    this.selected.set(null);
    this.resetEditors();
  }

  onDrawerOpenChange(open: boolean) {
    if (!open) {
      this.showCreate.set(false);
      this.resetEditors();
    }
  }

  private resetEditors() {
    this.desktopFile = null; this.mobileFile = null; this.desktopPreviewUrl = null; this.mobilePreviewUrl = null;
    try { this.desktopEditorComp?.clearImage(); } catch {};
    try { this.mobileEditorComp?.clearImage(); } catch {};
    try { this.desktopEditorCreateComp?.clearImage(); } catch {};
    try { this.mobileEditorCreateComp?.clearImage(); } catch {};
  }

  async create() {
    console.log('BannersAdminComponent.create called', { createFormValid: this.createForm ? !this.createForm.invalid : null, createFormValue: this.createForm?.value, desktopFile: this.desktopFile, mobileFile: this.mobileFile });
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const payload: any = { ...this.createForm.value };
    payload.inicio = payload.inicio ? new Date(payload.inicio).toISOString() : null;
    payload.fim = payload.fim ? new Date(payload.fim).toISOString() : null;
    payload.ordem = Number(payload.ordem || 0) || 0;

    const form = new FormData();
    for (const [k, v] of Object.entries(payload)) {
      if (v === undefined || v === null) continue;
      form.append(k, String(v));
    }

    if (this.desktopFile) {
      const blob = await this.exportCroppedBlob('desktop');
      const file = blob ? new File([blob], (this.desktopFile?.name || 'desktop.jpg'), { type: blob.type }) : this.desktopFile!;
      form.append('bannerDesktop', file);
    }
    if (this.mobileFile) {
      const blob = await this.exportCroppedBlob('mobile');
      const file = blob ? new File([blob], (this.mobileFile?.name || 'mobile.jpg'), { type: blob.type }) : this.mobileFile!;
      form.append('bannerMobile', file);
    }

    this.api.createBanner(form).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
    });
  }

  // Auto-generated form schema used by `app-admin-crud` when no projected drawer is present (create flow).
  bannerFormSchema: FormSchema = {
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', required: true },
      { key: 'link', label: 'Link', type: 'text' },
      { key: 'alt', label: 'Alt', type: 'text' },
      { key: 'posicao', label: 'Posição', type: 'select', options: [ { label: 'Loja', value: 'loja' } ] },
      { key: 'ordem', label: 'Ordem', type: 'number' },
      { key: 'inicio', label: 'Início', type: 'datetime' },
      { key: 'fim', label: 'Fim', type: 'datetime' },
      { key: 'ativo', label: 'Status', type: 'select', options: [ { label: 'Ativa', value: 1 }, { label: 'Inativa', value: 0 } ] }
    ]
  };

  async onSchemaSubmit(evt: { id?: any; values: any }) {
    const id = evt.id;
    const values = evt.values || {};
    const payload: any = { ...values };
    payload.inicio = payload.inicio ? new Date(payload.inicio).toISOString() : null;
    payload.fim = payload.fim ? new Date(payload.fim).toISOString() : null;
    payload.ordem = Number(payload.ordem || 0) || 0;

    const needsFiles = !!(this.desktopFile || this.mobileFile);

    if (id) {
      if (needsFiles) {
        const form = new FormData();
        for (const [k, v] of Object.entries(payload)) { if (v !== undefined && v !== null) form.append(k, String(v)); }
        if (this.desktopFile) {
          const blob = await this.exportCroppedBlob('desktop');
          const file = blob ? new File([blob], (this.desktopFile?.name || 'desktop.jpg'), { type: blob.type }) : this.desktopFile!;
          form.append('bannerDesktop', file);
        }
        if (this.mobileFile) {
          const blob = await this.exportCroppedBlob('mobile');
          const file = blob ? new File([blob], (this.mobileFile?.name || 'mobile.jpg'), { type: blob.type }) : this.mobileFile!;
          form.append('bannerMobile', file);
        }
        this.api.updateBanner(id, form).subscribe(updated => { this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x)); this.selected.set(updated); this.load(); });
      } else {
        this.api.updateBanner(id, payload).subscribe(updated => { this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x)); this.selected.set(updated); this.load(); });
      }
    } else {
      if (needsFiles) {
        const form = new FormData();
        for (const [k, v] of Object.entries(payload)) { if (v !== undefined && v !== null) form.append(k, String(v)); }
        if (this.desktopFile) {
          const blob = await this.exportCroppedBlob('desktop');
          const file = blob ? new File([blob], (this.desktopFile?.name || 'desktop.jpg'), { type: blob.type }) : this.desktopFile!;
          form.append('bannerDesktop', file);
        }
        if (this.mobileFile) {
          const blob = await this.exportCroppedBlob('mobile');
          const file = blob ? new File([blob], (this.mobileFile?.name || 'mobile.jpg'), { type: blob.type }) : this.mobileFile!;
          form.append('bannerMobile', file);
        }
        this.api.createBanner(form).subscribe(created => { this.showCreate.set(false); this.page.set(1); this.load(); setTimeout(() => this.view(created), 0); });
      } else {
        this.api.createBanner(payload).subscribe(created => { this.showCreate.set(false); this.page.set(1); this.load(); setTimeout(() => this.view(created), 0); });
      }
    }
  }

  onDesktopSelected(ev: Event) {
    const el = ev.target as HTMLInputElement | null; if (!el || !el.files || !el.files[0]) return;
    const f = el.files[0]; this.desktopFile = f;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      this.desktopPreviewUrl = data;
      if (typeof window !== 'undefined') {
        this.checkImageAspect(data, this.desktopExpected).then(msg => this.desktopWarn.set(msg));
        setTimeout(() => this.setupEditor('desktop', data), 0);
      }
    };
    reader.readAsDataURL(f);
  }

  onDesktopImageInput(event: Event) {
    // wrapper used by template file input
    try { this.onDesktopSelected(event); } catch (e) { /* noop */ }
  }

  onMobileSelected(ev: Event) {
    const el = ev.target as HTMLInputElement | null; if (!el || !el.files || !el.files[0]) return;
    const f = el.files[0]; this.mobileFile = f;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      this.mobilePreviewUrl = data;
      if (typeof window !== 'undefined') {
        this.checkImageAspect(data, this.mobileExpected).then(msg => this.mobileWarn.set(msg));
        setTimeout(() => this.setupEditor('mobile', data), 0);
      }
    };
    reader.readAsDataURL(f);
  }

  onMobileImageInput(event: Event) {
    // wrapper used by template file input
    try { this.onMobileSelected(event); } catch (e) { /* noop */ }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.add('dragover');
  }
  onDragLeave(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.remove('dragover');
  }
  onDropDesktop(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.remove('dragover');
    const files = event.dataTransfer?.files; if (files && files.length) { const fake = { target: { files } } as unknown as Event; this.onDesktopSelected(fake); }
  }
  onDropMobile(event: DragEvent) {
    event.preventDefault(); event.stopPropagation(); (event.currentTarget as HTMLElement).classList.remove('dragover');
    const files = event.dataTransfer?.files; if (files && files.length) { const fake = { target: { files } } as unknown as Event; this.onMobileSelected(fake); }
  }

  // Removido: duplicidade, agora métodos simples para preview/drag and drop

  private setupEditor(type: 'desktop'|'mobile', dataUrl: string) {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    try {
      const img = new Image();
      img.onload = () => {
        editor.img = img;
        editor.naturalWidth = img.naturalWidth || img.width;
        editor.naturalHeight = img.naturalHeight || img.height;
        // determine frame size
        const frameEl = type === 'desktop' ? this.desktopFrame?.nativeElement : this.mobileFrame?.nativeElement;
        if (!frameEl) return;
        const rect = frameEl.getBoundingClientRect();
        const fw = rect.width || 800;
        const fh = rect.height || 200;
        const initScale = Math.max(fw / editor.naturalWidth, fh / editor.naturalHeight);
        editor.scale = initScale;
        editor.x = (fw - editor.naturalWidth * editor.scale) / 2;
        editor.y = (fh - editor.naturalHeight * editor.scale) / 2;
        editor.edited = false;
      };
      img.src = dataUrl;
    } catch (e) {
      // ignore
    }
  }

  // Pointer/drag handlers
  onPointerDown(ev: PointerEvent, type: 'desktop'|'mobile') {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    if (!editor.img) return;
    const target: any = ev.currentTarget as any;
    if (target && typeof target.setPointerCapture === 'function') target.setPointerCapture(ev.pointerId);
    editor.dragging = true;
    editor.startX = ev.clientX;
    editor.startY = ev.clientY;
    editor.initialX = editor.x;
    editor.initialY = editor.y;
  }

  onPointerMove(ev: PointerEvent, type: 'desktop'|'mobile') {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    if (!editor.dragging) return;
    const dx = ev.clientX - editor.startX;
    const dy = ev.clientY - editor.startY;
    editor.x = editor.initialX + dx;
    editor.y = editor.initialY + dy;
    editor.edited = true;
  }

  onPointerUp(ev: PointerEvent, type: 'desktop'|'mobile') {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    if (!editor.img) return;
    const target: any = ev.currentTarget as any;
    try { if (target && typeof target.releasePointerCapture === 'function') target.releasePointerCapture(ev.pointerId); } catch(e) {}
    editor.dragging = false;
  }

  onWheel(ev: WheelEvent, type: 'desktop'|'mobile') {
    ev.preventDefault();
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    const frameEl = type === 'desktop' ? this.desktopFrame?.nativeElement : this.mobileFrame?.nativeElement;
    if (!editor.img || !frameEl) return;
    const rect = frameEl.getBoundingClientRect();
    const oldScale = editor.scale;
    const delta = -ev.deltaY;
    const factor = delta > 0 ? 1.08 : 0.92;
    const newScale = Math.max(0.1, Math.min(6, oldScale * factor));
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const imgX = (px - editor.x) / oldScale;
    const imgY = (py - editor.y) / oldScale;
    editor.scale = newScale;
    editor.x = px - imgX * newScale;
    editor.y = py - imgY * newScale;
    editor.edited = true;
  }

  zoom(dir: 'in'|'out', type: 'desktop'|'mobile') {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    if (!editor.img) return;
    const factor = dir === 'in' ? 1.12 : 0.88;
    const frameEl = type === 'desktop' ? this.desktopFrame?.nativeElement : this.mobileFrame?.nativeElement;
    const rect = frameEl?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 200;
    const cy = rect ? rect.height / 2 : 100;
    const oldScale = editor.scale;
    const newScale = Math.max(0.1, Math.min(6, oldScale * factor));
    const imgX = (cx - editor.x) / oldScale;
    const imgY = (cy - editor.y) / oldScale;
    editor.scale = newScale;
    editor.x = cx - imgX * newScale;
    editor.y = cy - imgY * newScale;
    editor.edited = true;
  }

  reset(type: 'desktop'|'mobile') {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    if (!editor.img) return;
    const frameEl = type === 'desktop' ? this.desktopFrame?.nativeElement : this.mobileFrame?.nativeElement;
    if (!frameEl) return;
    const rect = frameEl.getBoundingClientRect();
    const fw = rect.width; const fh = rect.height;
    const initScale = Math.max(fw / editor.naturalWidth, fh / editor.naturalHeight);
    editor.scale = initScale;
    editor.x = (fw - editor.naturalWidth * editor.scale) / 2;
    editor.y = (fh - editor.naturalHeight * editor.scale) / 2;
    editor.edited = true;
  }

  getTransform(type: 'desktop'|'mobile') {
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    return `translate(${Math.round(editor.x)}px, ${Math.round(editor.y)}px) scale(${editor.scale})`;
  }

  // crop/export visible frame as Blob (JPEG)
  async exportCroppedBlob(type: 'desktop'|'mobile') {
    // Prefer the new BannerImageEditor child component when available
    const child = (type === 'desktop')
      ? (this.showCreate() ? this.desktopEditorCreateComp : this.desktopEditorComp)
      : (this.showCreate() ? this.mobileEditorCreateComp : this.mobileEditorComp);
    if (child && typeof child.exportCroppedBlob === 'function') {
      try { return await child.exportCroppedBlob(); } catch { /* fallback to legacy code below */ }
    }
    const editor = type === 'desktop' ? this.desktopEditor : this.mobileEditor;
    const frameEl = type === 'desktop' ? this.desktopFrame?.nativeElement : this.mobileFrame?.nativeElement;
    if (!editor.img || !frameEl) return null;
    const rect = frameEl.getBoundingClientRect();
    const fw = rect.width; const fh = rect.height;
    const outW = type === 'desktop' ? 1600 : 800;
    const ratio = type === 'desktop' ? this.desktopExpected : this.mobileExpected;
    const outH = Math.round(outW / ratio);
    // visible area in image coords
    const visLeft = -editor.x;
    const visTop = -editor.y;
    const sx = Math.max(0, visLeft / editor.scale);
    const sy = Math.max(0, visTop / editor.scale);
    const sw = Math.max(1, Math.min(editor.naturalWidth - sx, fw / editor.scale));
    const sh = Math.max(1, Math.min(editor.naturalHeight - sy, fh / editor.scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000'; ctx.fillRect(0,0,outW,outH);
    ctx.drawImage(editor.img, sx, sy, sw, sh, 0, 0, outW, outH);
    return await new Promise<Blob|null>(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.9));
  }

  clearDesktopImage() {
    this.desktopPreviewUrl = null;
    this.desktopFile = null;
  }

  clearMobileImage() {
    this.mobilePreviewUrl = null;
    this.mobileFile = null;
  }

  private checkImageAspect(dataUrl: string, expectedRatio: number): Promise<string|null> {
    return new Promise(resolve => {
      try {
        const img = new Image();
        img.onload = () => {
          const w = (img.naturalWidth || img.width) as number;
          const h = (img.naturalHeight || img.height) as number;
          if (!w || !h) return resolve(null);
          const ratio = w / h;
          const diff = Math.abs(ratio - expectedRatio) / expectedRatio;
          if (diff > 0.15) {
            resolve(`Aviso: proporção do arquivo (${ratio.toFixed(2)}) difere do esperado (${expectedRatio.toFixed(2)}).`);
          } else resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      } catch (e) { resolve(null); }
    });
  }

  toDateTimeLocal(iso?: string|null) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
