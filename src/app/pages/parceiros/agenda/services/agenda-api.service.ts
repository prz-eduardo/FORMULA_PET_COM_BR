import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Recurso, Agendamento, Colaborador, PermissaoRecurso } from '../../../../types/agenda.types';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { environment } from '../../../../../environments/environment';

const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class AgendaApiService {
  constructor(
    private http: HttpClient,
    private authService: ParceiroAuthService
  ) {}

  private getHeaders() {
    return {
      ...this.authService.getAuthHeaders(),
    };
  }

  // ===========================================================================
  // RECURSOS
  // ===========================================================================

  /**
   * GET /parceiro/recursos — lista recursos acessíveis
   */
  async getRecursos(): Promise<Recurso[]> {
    const response = await lastValueFrom(
      this.http.get<{ recursos: Recurso[] }>(
        `${API_BASE}/parceiro/recursos`,
        { headers: this.getHeaders() }
      )
    );
    return response.recursos || [];
  }

  /**
   * GET /parceiro/recursos/:id — obter recurso específico
   */
  async getRecurso(id: number): Promise<Recurso> {
    const response = await lastValueFrom(
      this.http.get<{ recurso: Recurso }>(
        `${API_BASE}/parceiro/recursos/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.recurso;
  }

  /**
   * POST /parceiro/recursos — criar novo recurso (master only)
   */
  async createRecurso(data: {
    nome: string;
    tipo: 'INDIVIDUAL' | 'COMPARTILHADO';
    owner_colaborador_id?: number;
  }): Promise<Recurso> {
    const response = await lastValueFrom(
      this.http.post<{ recurso: Recurso }>(
        `${API_BASE}/parceiro/recursos`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.recurso;
  }

  /**
   * PUT /parceiro/recursos/:id — atualizar recurso (master only)
   */
  async updateRecurso(
    id: number,
    data: Partial<{ nome: string; tipo: string; owner_colaborador_id: number | null }>
  ): Promise<Recurso> {
    const response = await lastValueFrom(
      this.http.put<{ recurso: Recurso }>(
        `${API_BASE}/parceiro/recursos/${id}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.recurso;
  }

  /**
   * DELETE /parceiro/recursos/:id — soft delete recurso (master only)
   */
  async deleteRecurso(id: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/recursos/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  // ===========================================================================
  // AGENDAMENTOS
  // ===========================================================================

  /**
   * GET /parceiro/agendamentos — lista agendamentos com filtros
   */
  async getAgendamentos(filters?: {
    recurso_id?: number;
    data_inicio?: string;
    data_fim?: string;
  }): Promise<Agendamento[]> {
    const params: any = {};
    if (filters?.recurso_id) params.recurso_id = filters.recurso_id;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;

    const response = await lastValueFrom(
      this.http.get<{ agendamentos: Agendamento[] }>(
        `${API_BASE}/parceiro/agendamentos`,
        { headers: this.getHeaders(), params }
      )
    );
    return response.agendamentos || [];
  }

  /**
   * GET /parceiro/agendamentos/:id — obter agendamento específico
   */
  async getAgendamento(id: number): Promise<Agendamento> {
    const response = await lastValueFrom(
      this.http.get<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  /**
   * POST /parceiro/agendamentos — criar novo agendamento
   */
  async createAgendamento(data: {
    recurso_id: number;
    cliente_nome: string;
    cliente_telefone?: string;
    pet_nome?: string;
    inicio: string | Date;
    fim: string | Date;
    observacoes?: string;
  }): Promise<Agendamento> {
    const payload = {
      ...data,
      inicio: data.inicio instanceof Date ? data.inicio.toISOString() : data.inicio,
      fim: data.fim instanceof Date ? data.fim.toISOString() : data.fim,
    };

    const response = await lastValueFrom(
      this.http.post<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos`,
        payload,
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  /**
   * PUT /parceiro/agendamentos/:id — atualizar agendamento
   */
  async updateAgendamento(
    id: number,
    data: Partial<{
      cliente_nome: string;
      cliente_telefone: string | null;
      pet_nome: string | null;
      inicio: string | Date;
      fim: string | Date;
      observacoes: string | null;
    }>
  ): Promise<Agendamento> {
    const payload = { ...data };
    if (payload.inicio instanceof Date) payload.inicio = payload.inicio.toISOString();
    if (payload.fim instanceof Date) payload.fim = payload.fim.toISOString();

    const response = await lastValueFrom(
      this.http.put<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos/${id}`,
        payload,
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  /**
   * PATCH /parceiro/agendamentos/:id/status — transicionar status
   */
  async patchStatus(
    id: number,
    status: 'AGENDADO' | 'CONFIRMADO' | 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO'
  ): Promise<Agendamento> {
    const response = await lastValueFrom(
      this.http.patch<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos/${id}/status`,
        { status },
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  // ===========================================================================
  // COLABORADORES (master only)
  // ===========================================================================

  /**
   * GET /parceiro/colaboradores — listar colaboradores
   */
  async getColaboradores(): Promise<Colaborador[]> {
    const response = await lastValueFrom(
      this.http.get<{ colaboradores: Colaborador[] }>(
        `${API_BASE}/parceiro/colaboradores`,
        { headers: this.getHeaders() }
      )
    );
    return response.colaboradores || [];
  }

  /**
   * GET /parceiro/colaboradores/:id — obter colaborador específico
   */
  async getColaborador(id: number): Promise<Colaborador> {
    const response = await lastValueFrom(
      this.http.get<{ colaborador: Colaborador }>(
        `${API_BASE}/parceiro/colaboradores/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.colaborador;
  }

  /**
   * POST /parceiro/colaboradores — criar novo colaborador
   */
  async createColaborador(data: {
    nome: string;
    email: string;
    senha: string;
    role: 'master' | 'colaborador';
  }): Promise<Colaborador> {
    const response = await lastValueFrom(
      this.http.post<{ colaborador: Colaborador }>(
        `${API_BASE}/parceiro/colaboradores`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.colaborador;
  }

  /**
   * PUT /parceiro/colaboradores/:id — atualizar colaborador
   */
  async updateColaborador(
    id: number,
    data: Partial<{ nome: string; email: string; role: string }>
  ): Promise<Colaborador> {
    const response = await lastValueFrom(
      this.http.put<{ colaborador: Colaborador }>(
        `${API_BASE}/parceiro/colaboradores/${id}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.colaborador;
  }

  /**
   * DELETE /parceiro/colaboradores/:id — soft delete colaborador
   */
  async deleteColaborador(id: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/colaboradores/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  // ===========================================================================
  // PERMISSÕES (master only)
  // ===========================================================================

  /**
   * GET /parceiro/recursos/:recurso_id/permissoes — listar permissões
   */
  async getPermissoes(recursoId: number): Promise<PermissaoRecurso[]> {
    const response = await lastValueFrom(
      this.http.get<{ permissoes: PermissaoRecurso[] }>(
        `${API_BASE}/parceiro/recursos/${recursoId}/permissoes`,
        { headers: this.getHeaders() }
      )
    );
    return response.permissoes || [];
  }

  /**
   * PUT /parceiro/recursos/:recurso_id/permissoes/:colaborador_id
   * Upsert de permissões
   */
  async upsertPermissao(
    recursoId: number,
    colaboradorId: number,
    data: Partial<{
      pode_visualizar: boolean;
      pode_criar: boolean;
      pode_editar: boolean;
      pode_cancelar: boolean;
    }>
  ): Promise<PermissaoRecurso> {
    const response = await lastValueFrom(
      this.http.put<{ permissao: PermissaoRecurso }>(
        `${API_BASE}/parceiro/recursos/${recursoId}/permissoes/${colaboradorId}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.permissao;
  }

  /**
   * DELETE /parceiro/recursos/:recurso_id/permissoes/:colaborador_id
   */
  async deletePermissao(recursoId: number, colaboradorId: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/recursos/${recursoId}/permissoes/${colaboradorId}`,
        { headers: this.getHeaders() }
      )
    );
  }
}
