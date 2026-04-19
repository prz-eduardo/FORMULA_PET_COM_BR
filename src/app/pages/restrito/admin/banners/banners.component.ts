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

@Component({
  selector: 'app-admin-banners',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, AdminPaginationComponent, ButtonDirective, ButtonComponent, SideDrawerComponent, BannerImageEditorComponent, AdminCrudComponent],
  templateUrl: './banners.component.html',
  styleUrls: ['./banners.component.scss']
})
export class BannersAdminComponent implements OnInit {
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

  desktopPreview = signal<string|null>(null);
  mobilePreview = signal<string|null>(null);
  desktopFile: File | null = null;
  mobileFile: File | null = null;
  desktopWarn = signal<string|null>(null);
  mobileWarn = signal<string|null>(null);
  // expected aspect ratios (width / height)
  desktopExpected = 16 / 5;
  mobileExpected = 16 / 9;

  positions = [
    { value: 'home', label: 'Home' },
    { value: 'loja', label: 'Loja' },
    { value: 'topo', label: 'Topo' }
  ];

  // Image editor state for pan/zoom
  @ViewChild('desktopFrame', { static: false }) desktopFrame?: ElementRef<HTMLDivElement>;
  @ViewChild('mobileFrame', { static: false }) mobileFrame?: ElementRef<HTMLDivElement>;
  @ViewChild('desktopEditorComp', { static: false }) desktopEditorComp?: BannerImageEditorComponent;
  @ViewChild('mobileEditorComp', { static: false }) mobileEditorComp?: BannerImageEditorComponent;
  @ViewChild('desktopEditorCreate', { static: false }) desktopEditorCreateComp?: BannerImageEditorComponent;
  @ViewChild('mobileEditorCreate', { static: false }) mobileEditorCreateComp?: BannerImageEditorComponent;

  desktopEditor: any = { img: null, scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0, naturalWidth: 0, naturalHeight: 0, edited: false };
  mobileEditor: any = { img: null, scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0, naturalWidth: 0, naturalHeight: 0, edited: false };

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
      posicao: [item.posicao || 'home'],
      ordem: [item.ordem ?? 1],
      inicio: [item.inicio ? this.toDateTimeLocal(item.inicio) : ''],
      fim: [item.fim ? this.toDateTimeLocal(item.fim) : ''],
      ativo: [item.ativo ?? 1],
      target_blank: [ (item as any).target_blank ?? 1 ]
    });
    this.desktopPreview.set((item as any).desktop_image_url || null);
    this.mobilePreview.set((item as any).mobile_image_url || null);
    this.desktopFile = null;
    this.mobileFile = null;
    // initialize editor state from existing URLs
    const d = (item as any).desktop_image_url || null;
    const m = (item as any).mobile_image_url || null;
    if (d) setTimeout(() => this.setupEditor('desktop', d), 0);
    if (m) setTimeout(() => this.setupEditor('mobile', m), 0);
  }

  closeDetail() { this.selected.set(null); }

  save() {
    const s = this.selected(); if (!s || !this.form || this.form.invalid) { this.form?.markAllAsTouched(); return; }
    const payload: any = { ...this.form.value };
    // convert datetime-local (if present) to ISO strings
    payload.inicio = payload.inicio ? new Date(payload.inicio).toISOString() : null;
    payload.fim = payload.fim ? new Date(payload.fim).toISOString() : null;
    payload.ordem = Number(payload.ordem || 0) || 0;
    this.api.updateBanner(s.id!, payload).subscribe(updated => {
      this.items.set(this.items().map(x => x.id === updated.id ? { ...x, ...updated } : x));
      this.selected.set(updated);
      // upload images: prefer cropped/exported blob when available
      if (this.desktopFile) {
        (async () => {
          const blob = await this.exportCroppedBlob('desktop');
          const file = blob ? new File([blob], (this.desktopFile?.name || 'desktop.jpg'), { type: blob.type }) : this.desktopFile!;
          this.api.uploadBannerImage(updated.id!, file as File, 'desktop').subscribe(() => this.load());
        })();
      }
      if (this.mobileFile) {
        (async () => {
          const blob = await this.exportCroppedBlob('mobile');
          const file = blob ? new File([blob], (this.mobileFile?.name || 'mobile.jpg'), { type: blob.type }) : this.mobileFile!;
          this.api.uploadBannerImage(updated.id!, file as File, 'mobile').subscribe(() => this.load());
        })();
      }
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

  openCreate() { this.showCreate.set(true); this.initCreateForm(); this.desktopPreview.set(null); this.mobilePreview.set(null); this.desktopFile = null; this.mobileFile = null; }
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
    this.desktopFile = null; this.mobileFile = null; this.desktopPreview.set(null); this.mobilePreview.set(null);
    try { this.desktopEditorComp?.clearImage(); } catch {};
    try { this.mobileEditorComp?.clearImage(); } catch {};
    try { this.desktopEditorCreateComp?.clearImage(); } catch {};
    try { this.mobileEditorCreateComp?.clearImage(); } catch {};
  }

  create() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const payload: any = { ...this.createForm.value };
    payload.inicio = payload.inicio ? new Date(payload.inicio).toISOString() : null;
    payload.fim = payload.fim ? new Date(payload.fim).toISOString() : null;
    payload.ordem = Number(payload.ordem || 0) || 0;
    this.api.createBanner(payload).subscribe(created => {
      this.showCreate.set(false);
      this.page.set(1);
      this.load();
      setTimeout(() => this.view(created), 0);
      if (this.desktopFile) {
        (async () => {
          const blob = await this.exportCroppedBlob('desktop');
          const file = blob ? new File([blob], (this.desktopFile?.name || 'desktop.jpg'), { type: blob.type }) : this.desktopFile!;
          this.api.uploadBannerImage(created.id!, file as File, 'desktop').subscribe(() => this.load());
        })();
      }
      if (this.mobileFile) {
        (async () => {
          const blob = await this.exportCroppedBlob('mobile');
          const file = blob ? new File([blob], (this.mobileFile?.name || 'mobile.jpg'), { type: blob.type }) : this.mobileFile!;
          this.api.uploadBannerImage(created.id!, file as File, 'mobile').subscribe(() => this.load());
        })();
      }
    });
  }

  onDesktopSelected(ev: Event) {
    const el = ev.target as HTMLInputElement | null; if (!el || !el.files || !el.files[0]) return;
    const f = el.files[0]; this.desktopFile = f;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      this.desktopPreview.set(data);
      if (typeof window !== 'undefined') {
        this.checkImageAspect(data, this.desktopExpected).then(msg => this.desktopWarn.set(msg));
        setTimeout(() => this.setupEditor('desktop', data), 0);
      }
    };
    reader.readAsDataURL(f);
  }

  onMobileSelected(ev: Event) {
    const el = ev.target as HTMLInputElement | null; if (!el || !el.files || !el.files[0]) return;
    const f = el.files[0]; this.mobileFile = f;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result);
      this.mobilePreview.set(data);
      if (typeof window !== 'undefined') {
        this.checkImageAspect(data, this.mobileExpected).then(msg => this.mobileWarn.set(msg));
        setTimeout(() => this.setupEditor('mobile', data), 0);
      }
    };
    reader.readAsDataURL(f);
  }

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
    const outH = Math.round(outW / (type === 'desktop' ? (16/5) : (16/9)));
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
    // If editing an existing banner that already has an image, warn user
    const s = this.selected();
    if (s && s.desktop_image_url) {
      if (!confirm('A imagem atual está salva no servidor. Isso apenas limpará o preview local. Deseja continuar?')) return;
    }
    this.desktopPreview.set(null);
    this.desktopFile = null;
    this.desktopWarn.set(null);
  }

  clearMobileImage() {
    const s = this.selected();
    if (s && s.mobile_image_url) {
      if (!confirm('A imagem atual está salva no servidor. Isso apenas limpará o preview local. Deseja continuar?')) return;
    }
    this.mobilePreview.set(null);
    this.mobileFile = null;
    this.mobileWarn.set(null);
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
